import { normalizeFuzzyText } from "../search/fuzzy.js";
function shapeName(id) {
    return id.split("#").at(-1) ?? id;
}
function humanize(value) {
    return value
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim()
        .replace(/^./, (character) => character.toUpperCase());
}
function stripHtml(value) {
    if (typeof value !== "string")
        return undefined;
    const text = value
        .replace(/<[^>]+>/g, " ")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();
    return text || undefined;
}
function parseArn(value) {
    const match = /^arn:([^:]+):([^:]*):([^:]*):([^:]*):(.*)$/.exec(value);
    if (!match)
        return undefined;
    const [, , service = "", region = "", , resource = ""] = match;
    const separatorIndex = resource.search(/[/:]/);
    const resourceType = separatorIndex > 0 ? resource.slice(0, separatorIndex) : undefined;
    const resourceId = separatorIndex > 0 ? resource.slice(separatorIndex + 1) : resource;
    const resourceParts = resourceId.split(/[/:]/);
    const nestedResourceType = resourceParts.length >= 3 ? resourceParts[1] : undefined;
    const primaryId = resourceId.split(":")[0] ?? resourceId;
    const leafId = primaryId.split("/").at(-1) ?? primaryId;
    return {
        value,
        service,
        region,
        resource,
        ...(resourceType ? { resourceType } : {}),
        resourceId,
        ...(nestedResourceType ? { nestedResourceType } : {}),
        primaryId,
        leafId,
    };
}
function serviceMatches(service, token) {
    const normalized = normalizeFuzzyText(token);
    return [
        service.id,
        service.name,
        service.cliName,
        service.sdkId,
        service.arnNamespace,
        service.cloudFormationName,
    ].some((candidate) => candidate !== undefined && normalizeFuzzyText(candidate) === normalized);
}
function referenceParts(reference) {
    if (!reference?.type) {
        return {
            ...(reference?.service ? { service: reference.service } : {}),
            ...(reference?.resource ? { resource: reference.resource } : {}),
        };
    }
    const match = /^AWS::([^:]+)::(.+)$/.exec(reference.type);
    const service = reference.service ?? match?.[1];
    const resource = reference.resource ?? match?.[2];
    return {
        ...(service ? { service } : {}),
        ...(resource ? { resource } : {}),
    };
}
function findReferences(model, key) {
    if (!key)
        return [];
    const normalizedKey = normalizeFuzzyText(key);
    const references = [];
    for (const [shapeId, shape] of Object.entries(model.shapes)) {
        if (normalizeFuzzyText(shapeName(shapeId)) === normalizedKey) {
            const reference = shape.traits?.["aws.api#arnReference"];
            if (reference)
                references.push(reference);
        }
        for (const [memberName, member] of Object.entries(shape.members ?? {})) {
            if (normalizeFuzzyText(memberName) !== normalizedKey)
                continue;
            const target = model.shapes[member.target];
            const reference = member.traits?.["aws.api#arnReference"] ??
                target?.traits?.["aws.api#arnReference"];
            if (reference)
                references.push(reference);
        }
    }
    return references.filter((reference, index, values) => values.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(reference)) === index);
}
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function matchArnTemplate(template, resource) {
    if (!template)
        return undefined;
    const names = [];
    let source = "^";
    let cursor = 0;
    for (const match of template.matchAll(/\{([^}]+)\}/g)) {
        source += escapeRegex(template.slice(cursor, match.index));
        source += "(.+?)";
        names.push(match[1]);
        cursor = match.index + match[0].length;
    }
    source += `${escapeRegex(template.slice(cursor))}$`;
    const result = new RegExp(source).exec(resource);
    if (!result)
        return undefined;
    return Object.fromEntries(names.map((name, index) => [name, result[index + 1]]));
}
function getInputFields(model, operation) {
    const input = operation.input?.target
        ? model.shapes[operation.input.target]
        : undefined;
    if (!input || input.type !== "structure")
        return [];
    return Object.entries(input.members ?? {}).map(([name, member]) => {
        const target = model.shapes[member.target];
        const length = target?.traits?.["smithy.api#length"];
        const documentation = stripHtml(member.traits?.["smithy.api#documentation"]);
        return {
            name,
            type: target?.type ?? shapeName(member.target),
            target: member.target,
            ...(typeof member.traits?.["smithy.api#resourceIdentifier"] === "string"
                ? {
                    resourceIdentifier: member.traits["smithy.api#resourceIdentifier"],
                }
                : {}),
            required: Boolean(member.traits?.["smithy.api#required"]),
            sensitive: Boolean(member.traits?.["smithy.api#sensitive"] ??
                target?.traits?.["smithy.api#sensitive"]),
            ...(typeof target?.traits?.["smithy.api#pattern"] === "string"
                ? { pattern: target.traits["smithy.api#pattern"] }
                : {}),
            ...(typeof length?.min === "number" ? { minLength: length.min } : {}),
            ...(typeof length?.max === "number" ? { maxLength: length.max } : {}),
            ...(documentation ? { documentation } : {}),
        };
    });
}
function validFieldValue(field, value) {
    if (field.type !== "string" && !field.type.toLowerCase().includes("string")) {
        return false;
    }
    if (field.minLength !== undefined && value.length < field.minLength)
        return false;
    if (field.maxLength !== undefined && value.length > field.maxLength)
        return false;
    if (field.pattern) {
        try {
            if (!new RegExp(field.pattern).test(value))
                return false;
        }
        catch {
            // Some Smithy regex dialect constructs are not valid JavaScript regexes.
        }
    }
    return true;
}
function unique(values) {
    return values.filter((value, index, all) => Boolean(value) && all.indexOf(value) === index);
}
function buildInput(fields, parsed, captures) {
    const required = fields.filter((field) => field.required);
    const input = {};
    for (const field of required) {
        const normalized = normalizeFuzzyText(field.name);
        const identifier = normalizeFuzzyText(field.resourceIdentifier ?? field.name);
        const captured = Object.entries(captures).find(([name]) => normalizeFuzzyText(name) === identifier)?.[1];
        const candidates = unique([
            captured,
            normalized.endsWith("arn") ? parsed.value : undefined,
            normalized.includes("name") ? parsed.primaryId : undefined,
            normalized.includes("name") ? parsed.leafId : undefined,
            normalized.includes("id") || normalized.includes("key")
                ? parsed.resourceId
                : undefined,
            normalized.includes("id") || normalized.includes("key")
                ? parsed.leafId
                : undefined,
            required.length === 1 ? parsed.value : undefined,
            required.length === 1 ? parsed.resourceId : undefined,
            required.length === 1 ? parsed.leafId : undefined,
        ]);
        const value = candidates.find((candidate) => validFieldValue(field, candidate));
        if (!value)
            return undefined;
        input[field.name] = value;
    }
    return input;
}
function createOperationEntry(service, model, operationId, operation) {
    const operationName = shapeName(operationId);
    const prefix = operationName.startsWith("Describe")
        ? "Describe"
        : operationName.startsWith("Get")
            ? "Get"
            : "";
    const resourceName = prefix
        ? operationName.slice(prefix.length)
        : operationName;
    const documentation = stripHtml(operation.traits?.["smithy.api#documentation"]);
    return {
        id: `${service.cliName}:${operationName}`,
        mode: "get",
        operationName,
        displayName: humanize(operationName),
        resourceName: humanize(resourceName),
        resourceNames: [humanize(resourceName)],
        searchKeys: [
            normalizeFuzzyText(operationName),
            normalizeFuzzyText(resourceName),
        ],
        serviceId: service.id,
        serviceTitle: service.title,
        serviceCliName: service.cliName,
        serviceVersion: service.version,
        modelFile: service.modelFile,
        ...(documentation ? { documentation } : {}),
        inputFields: getInputFields(model, operation),
    };
}
function resourceTargets(reference, parsed, key) {
    const target = referenceParts(reference).resource;
    const keyTarget = key?.replace(/Arn$/i, "");
    const explicitTarget = target
        ? shapeName(target).replace(/Resource$/, "")
        : undefined;
    const includeRootResource = explicitTarget !== undefined ||
        parsed.nestedResourceType === undefined ||
        (keyTarget !== undefined &&
            normalizeFuzzyText(keyTarget) ===
                normalizeFuzzyText(parsed.resourceType ?? ""));
    return unique([
        explicitTarget,
        includeRootResource ? parsed.resourceType : undefined,
        parsed.nestedResourceType,
        keyTarget,
    ]);
}
function operationCandidates(model, targets) {
    const candidates = [];
    for (const target of targets) {
        const normalizedTarget = normalizeFuzzyText(target);
        for (const [operationId, operation] of Object.entries(model.shapes)) {
            if (operation.type !== "operation")
                continue;
            const operationName = shapeName(operationId);
            if (normalizeFuzzyText(operationName) === normalizeFuzzyText(`Get${target}`)) {
                candidates.push({
                    operationId,
                    operation,
                    score: 10,
                    captures: {},
                });
            }
            else if (normalizeFuzzyText(operationName) ===
                normalizeFuzzyText(`Describe${target}`)) {
                candidates.push({
                    operationId,
                    operation,
                    score: 20,
                    captures: {},
                });
            }
            else {
                const resourceName = operationName.replace(/^(Get|Describe)/, "");
                if (/^(Get|Describe)/.test(operationName) &&
                    normalizeFuzzyText(resourceName) === normalizedTarget) {
                    candidates.push({
                        operationId,
                        operation,
                        score: operationName.startsWith("Get") ? 10 : 20,
                        captures: {},
                    });
                }
            }
        }
    }
    return candidates;
}
function resourceCandidates(model, reference, parsed, targets) {
    const explicitResource = referenceParts(reference).resource;
    const candidates = [];
    for (const [resourceId, resource] of Object.entries(model.shapes)) {
        if (resource.type !== "resource" || !resource.read?.target)
            continue;
        const name = shapeName(resourceId).replace(/Resource$/, "");
        const exact = explicitResource !== undefined &&
            (resourceId === explicitResource ||
                normalizeFuzzyText(name) ===
                    normalizeFuzzyText(shapeName(explicitResource).replace(/Resource$/, "")));
        const captures = matchArnTemplate(resource.traits?.["aws.api#arn"]?.template, parsed.resource);
        const named = targets.some((target) => normalizeFuzzyText(target) === normalizeFuzzyText(name));
        if (!exact && !captures && !named)
            continue;
        candidates.push({
            shape: resource,
            name,
            score: exact ? 0 : captures ? 30 : 40,
            captures: captures ?? {},
        });
    }
    return candidates;
}
export class GithubSmithyRepository {
    fetcher;
    branch;
    cache = new Map();
    constructor(fetcher = fetch, branch = "main") {
        this.fetcher = fetcher;
        this.branch = branch;
    }
    async load(service) {
        const modelDirectory = service.modelDirectory ?? service.cliName;
        const url = `https://raw.githubusercontent.com/aws/api-models-aws/${this.branch}/` +
            `models/${encodeURIComponent(modelDirectory)}/service/` +
            `${encodeURIComponent(service.version)}/${encodeURIComponent(service.modelFile)}`;
        const cached = this.cache.get(url);
        const response = await this.fetcher(url, {
            headers: cached?.etag ? { "If-None-Match": cached.etag } : {},
        });
        if (response.status === 304 && cached)
            return cached.model;
        if (!response.ok) {
            throw new Error(`Could not load the current ${service.title} Smithy model from GitHub (${response.status}).`);
        }
        const model = (await response.json());
        const etag = response.headers.get("etag") ?? undefined;
        this.cache.set(url, { ...(etag ? { etag } : {}), model });
        return model;
    }
}
export class ArnReferenceResolver {
    services;
    repository;
    constructor(services, repository) {
        this.services = services;
        this.repository = repository;
    }
    async resolve(sourceService, occurrence) {
        const parsed = parseArn(occurrence.arn);
        if (!parsed)
            return undefined;
        const sourceModel = await this.repository.load(sourceService);
        const references = findReferences(sourceModel, occurrence.key);
        const reference = references.find((candidate) => {
            const service = referenceParts(candidate).service;
            if (!service)
                return true;
            return this.services.some((entry) => serviceMatches(entry, service) &&
                serviceMatches(entry, parsed.service));
        });
        const targetServiceToken = referenceParts(reference).service ?? parsed.service;
        const targetServices = this.services.filter((service) => serviceMatches(service, parsed.service) ||
            serviceMatches(service, targetServiceToken));
        const resolutions = [];
        for (const targetService of targetServices) {
            const targetModel = await this.repository.load(targetService);
            const targets = resourceTargets(reference, parsed, occurrence.key);
            const candidates = operationCandidates(targetModel, targets);
            for (const resource of resourceCandidates(targetModel, reference, parsed, targets)) {
                const operationId = resource.shape.read.target;
                const operation = targetModel.shapes[operationId];
                if (operation?.type === "operation") {
                    candidates.push({
                        operationId,
                        operation,
                        score: resource.score,
                        captures: resource.captures,
                    });
                }
            }
            for (const candidate of candidates) {
                const entry = createOperationEntry(targetService, targetModel, candidate.operationId, candidate.operation);
                const input = buildInput(entry.inputFields, parsed, candidate.captures);
                if (!input)
                    continue;
                resolutions.push({
                    arn: occurrence.arn,
                    entry,
                    input,
                    ...(parsed.region ? { region: parsed.region } : {}),
                    score: candidate.score,
                });
            }
        }
        const uniqueResolutions = resolutions
            .filter((resolution, index, values) => values.findIndex((candidate) => candidate.entry.id === resolution.entry.id &&
            JSON.stringify(candidate.input) ===
                JSON.stringify(resolution.input)) === index)
            .sort((left, right) => left.score - right.score ||
            left.entry.operationName.localeCompare(right.entry.operationName));
        const best = uniqueResolutions[0];
        if (!best)
            return undefined;
        if (uniqueResolutions[1] &&
            uniqueResolutions[1].score === best.score &&
            uniqueResolutions[1].entry.id !== best.entry.id) {
            return undefined;
        }
        const { score: _score, ...resolution } = best;
        return resolution;
    }
}
//# sourceMappingURL=github-smithy.js.map