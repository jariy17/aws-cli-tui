import { readFile } from "node:fs/promises";
import { normalizeFuzzyText, scoreNormalizedFuzzyText, } from "../search/fuzzy.js";
import { hasDefaultValue } from "./input-values.js";
let cachedCatalog;
export function normalizeSearch(value) {
    return normalizeFuzzyText(value);
}
function scoreOperation(entry, query) {
    let best;
    for (const key of entry.searchKeys) {
        const score = scoreNormalizedFuzzyText(key, query);
        if (score !== undefined && (best === undefined || score < best)) {
            best = score;
        }
    }
    return best;
}
function parseScopedSearch(value) {
    const match = /^(service|resource):(.*)$/i.exec(value);
    if (!match)
        return { scope: "api", query: normalizeSearch(value) };
    return {
        scope: match[1].toLowerCase(),
        query: normalizeSearch(match[2] ?? ""),
    };
}
function scoreValues(values, query) {
    let best;
    for (const value of values) {
        if (!value)
            continue;
        const score = scoreNormalizedFuzzyText(normalizeSearch(value), query);
        if (score !== undefined && (best === undefined || score < best)) {
            best = score;
        }
    }
    return best;
}
function scoreScopedOperation(entry, scope, query) {
    if (scope === "service") {
        return scoreValues([entry.serviceTitle, entry.serviceCliName, entry.serviceId], query);
    }
    if (scope === "resource") {
        return scoreValues(entry.resourceNames ?? [entry.resourceName], query);
    }
    return scoreOperation(entry, query);
}
function normalizeResourceName(value) {
    const normalized = normalizeSearch(value);
    if (normalized.endsWith("ies"))
        return `${normalized.slice(0, -3)}y`;
    if (normalized.endsWith("s"))
        return normalized.slice(0, -1);
    return normalized;
}
function entryResourceNames(entry) {
    return Array.from(new Set([...(entry.resourceNames ?? []), entry.resourceName]));
}
function serviceFamily(serviceCliName) {
    return serviceCliName.replace(/-(control|runtime)$/, "");
}
function targetName(target) {
    return target?.split("#").at(-1);
}
function findRecordValue(record, name) {
    const matchingKey = Object.keys(record).find((key) => key.toLowerCase() === name.toLowerCase());
    return matchingKey ? record[matchingKey] : undefined;
}
function collectNamedValues(value, name, values, depth = 0) {
    if (depth > 8 || value === null || value === undefined)
        return;
    if (Array.isArray(value)) {
        for (const item of value)
            collectNamedValues(item, name, values, depth + 1);
        return;
    }
    if (typeof value !== "object")
        return;
    for (const [key, item] of Object.entries(value)) {
        if (key.toLowerCase() === name.toLowerCase() && item !== undefined) {
            values.push(item);
        }
        collectNamedValues(item, name, values, depth + 1);
    }
}
function uniqueValue(values) {
    const unique = values.filter((value, index) => values.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(value)) === index);
    return unique.length === 1 ? unique[0] : undefined;
}
function inheritedValue(parentEntry, parentInput, parentValue, childField) {
    const exactInput = findRecordValue(parentInput, childField.name);
    if (exactInput !== undefined)
        return exactInput;
    const responseValues = [];
    collectNamedValues(parentValue, childField.name, responseValues);
    const exactResponse = uniqueValue(responseValues);
    if (exactResponse !== undefined)
        return exactResponse;
    const childTarget = targetName(childField.target);
    if (!childTarget)
        return undefined;
    const matchingParentFields = parentEntry.inputFields.filter((field) => targetName(field.target) === childTarget);
    const targetValues = matchingParentFields
        .map((field) => findRecordValue(parentInput, field.name))
        .filter((value) => value !== undefined);
    return uniqueValue(targetValues);
}
export class SmithyCatalog {
    catalog;
    operationsById;
    resourcesById;
    constructor(catalog) {
        this.catalog = catalog;
        this.operationsById = new Map(catalog.operations.map((entry) => [entry.id, entry]));
        this.resourcesById = new Map((catalog.resources ?? []).map((entry) => [entry.id, entry]));
    }
    static async load() {
        if (!cachedCatalog) {
            const contents = await readFile(new URL("../../src/model/generated/catalog.json", import.meta.url), "utf8");
            cachedCatalog = JSON.parse(contents);
        }
        return new SmithyCatalog(cachedCatalog);
    }
    metadata() {
        const { generatedAt, source, operationCount } = this.catalog;
        return { generatedAt, source, operationCount };
    }
    services() {
        return this.catalog.services ?? [];
    }
    resources() {
        return this.catalog.resources ?? [];
    }
    search(queryValue, mode, limit = 50) {
        const { scope, query } = parseScopedSearch(queryValue);
        if (!query)
            return [];
        return this.catalog.operations
            .filter((entry) => !mode || (entry.supported && entry.mode === mode))
            .map((entry) => ({
            entry,
            score: scoreScopedOperation(entry, scope, query),
        }))
            .filter((result) => result.score !== undefined)
            .sort((left, right) => left.score - right.score ||
            left.entry.operationName.localeCompare(right.entry.operationName) ||
            left.entry.serviceTitle.localeCompare(right.entry.serviceTitle))
            .slice(0, limit)
            .map((result) => result.entry);
    }
    findRelatedGet(listEntry) {
        const resources = (listEntry.resourceNames ?? [listEntry.resourceName]).map((resource) => normalizeSearch(resource.replace(/s$/, "")));
        return this.catalog.operations
            .filter((entry) => entry.supported &&
            entry.mode === "get" &&
            entry.serviceCliName === listEntry.serviceCliName)
            .map((entry) => ({
            entry,
            score: Math.min(...(entry.resourceNames ?? [entry.resourceName]).flatMap((candidate) => resources.map((resource) => Math.abs(normalizeSearch(candidate).length - resource.length)))),
        }))
            .filter(({ entry }) => (entry.resourceNames ?? [entry.resourceName]).some((candidate) => {
            const normalized = normalizeSearch(candidate);
            return resources.some((resource) => normalized.includes(resource) || resource.includes(normalized));
        }))
            .sort((left, right) => left.score - right.score)
            .map(({ entry }) => entry);
    }
    findRelatedLists(parentEntry, parentInput, parentValue) {
        const parentResources = (parentEntry.resourceIds ?? [])
            .map((id) => this.resourcesById.get(id))
            .filter((resource) => resource !== undefined);
        const parentResourceNames = new Set([
            ...parentResources.map((resource) => resource.name),
            ...entryResourceNames(parentEntry),
        ].map(normalizeResourceName));
        const primaryParentName = normalizeResourceName(parentEntry.resourceName);
        const parentIdentifiers = [
            ...parentResources.flatMap((resource) => resource.identifiers),
            ...parentEntry.inputFields
                .filter((field) => field.required)
                .map((field) => ({
                name: field.name,
                target: field.target ?? "",
            })),
        ];
        const related = new Map();
        const add = (entry, resourceName, source) => {
            if (!entry.supported || entry.mode !== "list")
                return;
            const input = {};
            const inheritedFields = [];
            for (const field of entry.inputFields) {
                if (field.name === entry.pagination?.inputToken)
                    continue;
                const value = inheritedValue(parentEntry, parentInput, parentValue, field);
                if (value !== undefined) {
                    input[field.name] = value;
                    inheritedFields.push(field.name);
                }
            }
            const missingRequired = entry.inputFields
                .filter((field) => field.required &&
                !hasDefaultValue(field) &&
                field.name !== entry.pagination?.inputToken &&
                input[field.name] === undefined)
                .map((field) => field.name);
            const remainingInputs = entry.inputFields.filter((field) => field.name !== entry.pagination?.inputToken &&
                input[field.name] === undefined).length;
            const candidate = {
                entry,
                resourceName,
                source,
                input,
                inheritedFields,
                missingRequired,
                remainingInputs,
            };
            const existing = related.get(entry.id);
            if (!existing || source === "smithy")
                related.set(entry.id, candidate);
        };
        for (const parentResource of parentResources) {
            for (const childId of parentResource.childResourceIds) {
                const child = this.resourcesById.get(childId);
                if (!child)
                    continue;
                for (const operationId of child.operationIds) {
                    const entry = this.operationsById.get(operationId);
                    if (entry)
                        add(entry, child.name, "smithy");
                }
            }
        }
        for (const entry of this.catalog.operations) {
            if (!entry.supported ||
                entry.mode !== "list" ||
                entry.id === parentEntry.id ||
                serviceFamily(entry.serviceCliName) !==
                    serviceFamily(parentEntry.serviceCliName) ||
                normalizeResourceName(entry.resourceName) === primaryParentName) {
                continue;
            }
            const sharesParentResource = entryResourceNames(entry).some((name) => parentResourceNames.has(normalizeResourceName(name)));
            const inheritedParentIdentifiers = entry.inputFields.filter((field) => {
                if (!field.required)
                    return false;
                const childTarget = targetName(field.target);
                return (parentIdentifiers.some((identifier) => identifier.name.toLowerCase() === field.name.toLowerCase() ||
                    (childTarget !== undefined &&
                        targetName(identifier.target) === childTarget)) &&
                    inheritedValue(parentEntry, parentInput, parentValue, field) !==
                        undefined);
            });
            if (inheritedParentIdentifiers.length === 0)
                continue;
            const sharesModeledIdentifier = inheritedParentIdentifiers.some((field) => field.target !== undefined &&
                !field.target.startsWith("smithy.api#") &&
                parentIdentifiers.some((identifier) => identifier.target === field.target));
            if (sharesParentResource || sharesModeledIdentifier) {
                add(entry, entry.resourceName, "inferred");
            }
        }
        return [...related.values()].sort((left, right) => (left.source === right.source
            ? 0
            : left.source === "smithy"
                ? -1
                : 1) ||
            left.missingRequired.length - right.missingRequired.length ||
            left.resourceName.localeCompare(right.resourceName) ||
            left.entry.operationName.localeCompare(right.entry.operationName));
    }
}
//# sourceMappingURL=catalog.js.map