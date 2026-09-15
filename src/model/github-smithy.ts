import type { InputField, OperationEntry, ServiceEntry } from "./types.js";
import { normalizeFuzzyText } from "../search/fuzzy.js";

type SmithyTarget = {
  target: string;
  traits?: Record<string, unknown>;
};

type SmithyShape = {
  type: string;
  version?: string;
  input?: SmithyTarget;
  output?: SmithyTarget;
  read?: SmithyTarget;
  identifiers?: Record<string, SmithyTarget>;
  members?: Record<string, SmithyTarget>;
  member?: SmithyTarget;
  traits?: Record<string, any>;
};

export type SmithyModel = {
  shapes: Record<string, SmithyShape>;
};

type CachedModel = {
  etag?: string;
  model: SmithyModel;
};

type ParsedArn = {
  value: string;
  service: string;
  region: string;
  resource: string;
  resourceType?: string;
  resourceId: string;
  nestedResourceType?: string;
  primaryId: string;
  leafId: string;
};

type ArnReference = {
  type?: string;
  service?: string;
  resource?: string;
};

type ResourceCandidate = {
  shape: SmithyShape;
  name: string;
  score: number;
  captures: Record<string, string>;
};

type OperationCandidate = {
  operationId: string;
  operation: SmithyShape;
  score: number;
  captures: Record<string, string>;
};

export type ArnOccurrence = {
  arn: string;
  key?: string;
};

export type ArnResolution = {
  arn: string;
  entry: OperationEntry;
  input: Record<string, unknown>;
  region?: string;
};

function shapeName(id: string): string {
  return id.split("#").at(-1) ?? id;
}

function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

function stripHtml(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
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

function parseArn(value: string): ParsedArn | undefined {
  const match = /^arn:([^:]+):([^:]*):([^:]*):([^:]*):(.*)$/.exec(value);
  if (!match) return undefined;
  const [, , service = "", region = "", , resource = ""] = match;
  const separatorIndex = resource.search(/[/:]/);
  const resourceType =
    separatorIndex > 0 ? resource.slice(0, separatorIndex) : undefined;
  const resourceId =
    separatorIndex > 0 ? resource.slice(separatorIndex + 1) : resource;
  const resourceParts = resourceId.split(/[/:]/);
  const nestedResourceType =
    resourceParts.length >= 3 ? resourceParts[1] : undefined;
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

function serviceMatches(service: ServiceEntry, token: string): boolean {
  const normalized = normalizeFuzzyText(token);
  return [
    service.id,
    service.name,
    service.cliName,
    service.sdkId,
    service.arnNamespace,
    service.cloudFormationName,
  ].some(
    (candidate) =>
      candidate !== undefined && normalizeFuzzyText(candidate) === normalized,
  );
}

function referenceParts(reference: ArnReference | undefined): {
  service?: string;
  resource?: string;
} {
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

function findReferences(
  model: SmithyModel,
  key: string | undefined,
): ArnReference[] {
  if (!key) return [];
  const normalizedKey = normalizeFuzzyText(key);
  const references: ArnReference[] = [];

  for (const [shapeId, shape] of Object.entries(model.shapes)) {
    if (normalizeFuzzyText(shapeName(shapeId)) === normalizedKey) {
      const reference = shape.traits?.["aws.api#arnReference"] as
        ArnReference | undefined;
      if (reference) references.push(reference);
    }
    for (const [memberName, member] of Object.entries(shape.members ?? {})) {
      if (normalizeFuzzyText(memberName) !== normalizedKey) continue;
      const target = model.shapes[member.target];
      const reference =
        (member.traits?.["aws.api#arnReference"] as ArnReference | undefined) ??
        (target?.traits?.["aws.api#arnReference"] as ArnReference | undefined);
      if (reference) references.push(reference);
    }
  }

  return references.filter(
    (reference, index, values) =>
      values.findIndex(
        (candidate) => JSON.stringify(candidate) === JSON.stringify(reference),
      ) === index,
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchArnTemplate(
  template: string | undefined,
  resource: string,
): Record<string, string> | undefined {
  if (!template) return undefined;
  const names: string[] = [];
  let source = "^";
  let cursor = 0;
  for (const match of template.matchAll(/\{([^}]+)\}/g)) {
    source += escapeRegex(template.slice(cursor, match.index));
    source += "(.+?)";
    names.push(match[1]!);
    cursor = match.index! + match[0].length;
  }
  source += `${escapeRegex(template.slice(cursor))}$`;
  const result = new RegExp(source).exec(resource);
  if (!result) return undefined;
  return Object.fromEntries(
    names.map((name, index) => [name, result[index + 1]!]),
  );
}

function getInputFields(
  model: SmithyModel,
  operation: SmithyShape,
): InputField[] {
  const input = operation.input?.target
    ? model.shapes[operation.input.target]
    : undefined;
  if (!input || input.type !== "structure") return [];

  return Object.entries(input.members ?? {}).map(([name, member]) => {
    const target = model.shapes[member.target];
    const length = target?.traits?.["smithy.api#length"] as
      { min?: number; max?: number } | undefined;
    const documentation = stripHtml(
      member.traits?.["smithy.api#documentation"],
    );
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
      sensitive: Boolean(
        member.traits?.["smithy.api#sensitive"] ??
        target?.traits?.["smithy.api#sensitive"],
      ),
      ...(typeof target?.traits?.["smithy.api#pattern"] === "string"
        ? { pattern: target.traits["smithy.api#pattern"] }
        : {}),
      ...(typeof length?.min === "number" ? { minLength: length.min } : {}),
      ...(typeof length?.max === "number" ? { maxLength: length.max } : {}),
      ...(documentation ? { documentation } : {}),
    };
  });
}

function validFieldValue(field: InputField, value: string): boolean {
  if (field.type !== "string" && !field.type.toLowerCase().includes("string")) {
    return false;
  }
  if (field.minLength !== undefined && value.length < field.minLength)
    return false;
  if (field.maxLength !== undefined && value.length > field.maxLength)
    return false;
  if (field.pattern) {
    try {
      if (!new RegExp(field.pattern).test(value)) return false;
    } catch {
      // Some Smithy regex dialect constructs are not valid JavaScript regexes.
    }
  }
  return true;
}

function unique(values: Array<string | undefined>): string[] {
  return values.filter(
    (value, index, all): value is string =>
      Boolean(value) && all.indexOf(value) === index,
  );
}

function buildInput(
  fields: InputField[],
  parsed: ParsedArn,
  captures: Record<string, string>,
): Record<string, unknown> | undefined {
  const required = fields.filter((field) => field.required);
  const input: Record<string, unknown> = {};

  for (const field of required) {
    const normalized = normalizeFuzzyText(field.name);
    const identifier = normalizeFuzzyText(
      field.resourceIdentifier ?? field.name,
    );
    const captured = Object.entries(captures).find(
      ([name]) => normalizeFuzzyText(name) === identifier,
    )?.[1];
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
    const value = candidates.find((candidate) =>
      validFieldValue(field, candidate),
    );
    if (!value) return undefined;
    input[field.name] = value;
  }

  return input;
}

function createOperationEntry(
  service: ServiceEntry,
  model: SmithyModel,
  operationId: string,
  operation: SmithyShape,
): OperationEntry {
  const operationName = shapeName(operationId);
  const prefix = operationName.startsWith("Describe")
    ? "Describe"
    : operationName.startsWith("Get")
      ? "Get"
      : "";
  const resourceName = prefix
    ? operationName.slice(prefix.length)
    : operationName;
  const documentation = stripHtml(
    operation.traits?.["smithy.api#documentation"],
  );
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

function resourceTargets(
  reference: ArnReference | undefined,
  parsed: ParsedArn,
  key: string | undefined,
): string[] {
  const target = referenceParts(reference).resource;
  const keyTarget = key?.replace(/Arn$/i, "");
  const explicitTarget = target
    ? shapeName(target).replace(/Resource$/, "")
    : undefined;
  const includeRootResource =
    explicitTarget !== undefined ||
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

function operationCandidates(
  model: SmithyModel,
  targets: string[],
): OperationCandidate[] {
  const candidates: OperationCandidate[] = [];

  for (const target of targets) {
    const normalizedTarget = normalizeFuzzyText(target);
    for (const [operationId, operation] of Object.entries(model.shapes)) {
      if (operation.type !== "operation") continue;
      const operationName = shapeName(operationId);
      if (
        normalizeFuzzyText(operationName) === normalizeFuzzyText(`Get${target}`)
      ) {
        candidates.push({
          operationId,
          operation,
          score: 10,
          captures: {},
        });
      } else if (
        normalizeFuzzyText(operationName) ===
        normalizeFuzzyText(`Describe${target}`)
      ) {
        candidates.push({
          operationId,
          operation,
          score: 20,
          captures: {},
        });
      } else {
        const resourceName = operationName.replace(/^(Get|Describe)/, "");
        if (
          /^(Get|Describe)/.test(operationName) &&
          normalizeFuzzyText(resourceName) === normalizedTarget
        ) {
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

function resourceCandidates(
  model: SmithyModel,
  reference: ArnReference | undefined,
  parsed: ParsedArn,
  targets: string[],
): ResourceCandidate[] {
  const explicitResource = referenceParts(reference).resource;
  const candidates: ResourceCandidate[] = [];

  for (const [resourceId, resource] of Object.entries(model.shapes)) {
    if (resource.type !== "resource" || !resource.read?.target) continue;
    const name = shapeName(resourceId).replace(/Resource$/, "");
    const exact =
      explicitResource !== undefined &&
      (resourceId === explicitResource ||
        normalizeFuzzyText(name) ===
          normalizeFuzzyText(
            shapeName(explicitResource).replace(/Resource$/, ""),
          ));
    const captures = matchArnTemplate(
      resource.traits?.["aws.api#arn"]?.template,
      parsed.resource,
    );
    const named = targets.some(
      (target) => normalizeFuzzyText(target) === normalizeFuzzyText(name),
    );
    if (!exact && !captures && !named) continue;
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
  private readonly cache = new Map<string, CachedModel>();

  public constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly branch = "main",
  ) {}

  public async load(service: ServiceEntry): Promise<SmithyModel> {
    const modelDirectory = service.modelDirectory ?? service.cliName;
    const url =
      `https://raw.githubusercontent.com/aws/api-models-aws/${this.branch}/` +
      `models/${encodeURIComponent(modelDirectory)}/service/` +
      `${encodeURIComponent(service.version)}/${encodeURIComponent(service.modelFile)}`;
    const cached = this.cache.get(url);
    const response = await this.fetcher(url, {
      headers: cached?.etag ? { "If-None-Match": cached.etag } : {},
    });
    if (response.status === 304 && cached) return cached.model;
    if (!response.ok) {
      throw new Error(
        `Could not load the current ${service.title} Smithy model from GitHub (${response.status}).`,
      );
    }
    const model = (await response.json()) as SmithyModel;
    const etag = response.headers.get("etag") ?? undefined;
    this.cache.set(url, { ...(etag ? { etag } : {}), model });
    return model;
  }
}

export class ArnReferenceResolver {
  public constructor(
    private readonly services: readonly ServiceEntry[],
    private readonly repository: GithubSmithyRepository,
  ) {}

  public async resolve(
    sourceService: ServiceEntry,
    occurrence: ArnOccurrence,
  ): Promise<ArnResolution | undefined> {
    const parsed = parseArn(occurrence.arn);
    if (!parsed) return undefined;

    const sourceModel = await this.repository.load(sourceService);
    const references = findReferences(sourceModel, occurrence.key);
    const reference = references.find((candidate) => {
      const service = referenceParts(candidate).service;
      if (!service) return true;
      return this.services.some(
        (entry) =>
          serviceMatches(entry, service) &&
          serviceMatches(entry, parsed.service),
      );
    });
    const targetServiceToken =
      referenceParts(reference).service ?? parsed.service;
    const targetServices = this.services.filter(
      (service) =>
        serviceMatches(service, parsed.service) ||
        serviceMatches(service, targetServiceToken),
    );
    const resolutions: Array<ArnResolution & { score: number }> = [];

    for (const targetService of targetServices) {
      const targetModel = await this.repository.load(targetService);
      const targets = resourceTargets(reference, parsed, occurrence.key);
      const candidates = operationCandidates(targetModel, targets);

      for (const resource of resourceCandidates(
        targetModel,
        reference,
        parsed,
        targets,
      )) {
        const operationId = resource.shape.read!.target;
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
        const entry = createOperationEntry(
          targetService,
          targetModel,
          candidate.operationId,
          candidate.operation,
        );
        const input = buildInput(entry.inputFields, parsed, candidate.captures);
        if (!input) continue;
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
      .filter(
        (resolution, index, values) =>
          values.findIndex(
            (candidate) =>
              candidate.entry.id === resolution.entry.id &&
              JSON.stringify(candidate.input) ===
                JSON.stringify(resolution.input),
          ) === index,
      )
      .sort(
        (left, right) =>
          left.score - right.score ||
          left.entry.operationName.localeCompare(right.entry.operationName),
      );
    const best = uniqueResolutions[0];
    if (!best) return undefined;
    if (
      uniqueResolutions[1] &&
      uniqueResolutions[1].score === best.score &&
      uniqueResolutions[1].entry.id !== best.entry.id
    ) {
      return undefined;
    }
    const { score: _score, ...resolution } = best;
    return resolution;
  }
}
