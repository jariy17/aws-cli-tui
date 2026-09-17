import { readFile } from "node:fs/promises";

import {
  normalizeFuzzyText,
  scoreNormalizedFuzzyText,
} from "../search/fuzzy.js";
import type {
  Catalog,
  InputField,
  OperationEntry,
  ResourceEntry,
  ServiceEntry,
  SupportedOperationMode,
} from "./types.js";
import { hasDefaultValue } from "./input-values.js";

let cachedCatalog: Catalog | undefined;

export function normalizeSearch(value: string): string {
  return normalizeFuzzyText(value);
}

function scoreOperation(
  entry: OperationEntry,
  query: string,
): number | undefined {
  let best: number | undefined;

  for (const key of entry.searchKeys) {
    const score = scoreNormalizedFuzzyText(key, query);

    if (score !== undefined && (best === undefined || score < best)) {
      best = score;
    }
  }

  return best;
}

type SearchScope = "api" | "service" | "resource";

function parseScopedSearch(value: string): {
  scope: SearchScope;
  query: string;
} {
  const match = /^(service|resource):(.*)$/i.exec(value);
  if (!match) return { scope: "api", query: normalizeSearch(value) };
  return {
    scope: match[1]!.toLowerCase() as Exclude<SearchScope, "api">,
    query: normalizeSearch(match[2] ?? ""),
  };
}

function scoreValues(
  values: Array<string | undefined>,
  query: string,
): number | undefined {
  let best: number | undefined;
  for (const value of values) {
    if (!value) continue;
    const score = scoreNormalizedFuzzyText(normalizeSearch(value), query);
    if (score !== undefined && (best === undefined || score < best)) {
      best = score;
    }
  }
  return best;
}

function scoreScopedOperation(
  entry: OperationEntry,
  scope: SearchScope,
  query: string,
): number | undefined {
  if (scope === "service") {
    return scoreValues(
      [entry.serviceTitle, entry.serviceCliName, entry.serviceId],
      query,
    );
  }
  if (scope === "resource") {
    return scoreValues(entry.resourceNames ?? [entry.resourceName], query);
  }
  return scoreOperation(entry, query);
}

function normalizeResourceName(value: string): string {
  const normalized = normalizeSearch(value);
  if (normalized.endsWith("ies")) return `${normalized.slice(0, -3)}y`;
  if (normalized.endsWith("s")) return normalized.slice(0, -1);
  return normalized;
}

function entryResourceNames(entry: OperationEntry): string[] {
  return Array.from(
    new Set([...(entry.resourceNames ?? []), entry.resourceName]),
  );
}

function serviceFamily(serviceCliName: string): string {
  return serviceCliName.replace(/-(control|runtime)$/, "");
}

function targetName(target?: string): string | undefined {
  return target?.split("#").at(-1);
}

function findRecordValue(
  record: Record<string, unknown>,
  name: string,
): unknown {
  const matchingKey = Object.keys(record).find(
    (key) => key.toLowerCase() === name.toLowerCase(),
  );
  return matchingKey ? record[matchingKey] : undefined;
}

function collectNamedValues(
  value: unknown,
  name: string,
  values: unknown[],
  depth = 0,
): void {
  if (depth > 8 || value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value) collectNamedValues(item, name, values, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (key.toLowerCase() === name.toLowerCase() && item !== undefined) {
      values.push(item);
    }
    collectNamedValues(item, name, values, depth + 1);
  }
}

function uniqueValue(values: unknown[]): unknown {
  const unique = values.filter(
    (value, index) =>
      values.findIndex(
        (candidate) => JSON.stringify(candidate) === JSON.stringify(value),
      ) === index,
  );
  return unique.length === 1 ? unique[0] : undefined;
}

function inheritedValue(
  parentEntry: OperationEntry,
  parentInput: Record<string, unknown>,
  parentValue: unknown,
  childField: InputField,
): unknown {
  const exactInput = findRecordValue(parentInput, childField.name);
  if (exactInput !== undefined) return exactInput;

  const responseValues: unknown[] = [];
  collectNamedValues(parentValue, childField.name, responseValues);
  const exactResponse = uniqueValue(responseValues);
  if (exactResponse !== undefined) return exactResponse;

  const childTarget = targetName(childField.target);
  if (!childTarget) return undefined;
  const matchingParentFields = parentEntry.inputFields.filter(
    (field) => targetName(field.target) === childTarget,
  );
  const targetValues = matchingParentFields
    .map((field) => findRecordValue(parentInput, field.name))
    .filter((value) => value !== undefined);
  return uniqueValue(targetValues);
}

export type RelatedResource = {
  entry: OperationEntry;
  resourceName: string;
  source: "smithy" | "inferred";
  input: Record<string, unknown>;
  inheritedFields: string[];
  missingRequired: string[];
  remainingInputs: number;
};

export class SmithyCatalog {
  private readonly operationsById: ReadonlyMap<string, OperationEntry>;
  private readonly resourcesById: ReadonlyMap<string, ResourceEntry>;

  public constructor(private readonly catalog: Catalog) {
    this.operationsById = new Map(
      catalog.operations.map((entry) => [entry.id, entry]),
    );
    this.resourcesById = new Map(
      (catalog.resources ?? []).map((entry) => [entry.id, entry]),
    );
  }

  public static async load(): Promise<SmithyCatalog> {
    if (!cachedCatalog) {
      const contents = await readFile(
        new URL("../../src/model/generated/catalog.json", import.meta.url),
        "utf8",
      );
      cachedCatalog = JSON.parse(contents) as Catalog;
    }
    return new SmithyCatalog(cachedCatalog);
  }

  public metadata(): Pick<
    Catalog,
    "generatedAt" | "source" | "operationCount"
  > {
    const { generatedAt, source, operationCount } = this.catalog;
    return { generatedAt, source, operationCount };
  }

  public services(): readonly ServiceEntry[] {
    return this.catalog.services ?? [];
  }

  public resources(): readonly ResourceEntry[] {
    return this.catalog.resources ?? [];
  }

  public search(
    queryValue: string,
    mode?: SupportedOperationMode,
    limit = 50,
  ): OperationEntry[] {
    const { scope, query } = parseScopedSearch(queryValue);
    if (!query) return [];

    return this.catalog.operations
      .filter((entry) => !mode || (entry.supported && entry.mode === mode))
      .map((entry) => ({
        entry,
        score: scoreScopedOperation(entry, scope, query),
      }))
      .filter(
        (result): result is { entry: OperationEntry; score: number } =>
          result.score !== undefined,
      )
      .sort(
        (left, right) =>
          left.score - right.score ||
          left.entry.operationName.localeCompare(right.entry.operationName) ||
          left.entry.serviceTitle.localeCompare(right.entry.serviceTitle),
      )
      .slice(0, limit)
      .map((result) => result.entry);
  }

  public findRelatedGet(listEntry: OperationEntry): OperationEntry[] {
    const resources = (listEntry.resourceNames ?? [listEntry.resourceName]).map(
      (resource) => normalizeSearch(resource.replace(/s$/, "")),
    );
    return this.catalog.operations
      .filter(
        (entry) =>
          entry.supported &&
          entry.mode === "get" &&
          entry.serviceCliName === listEntry.serviceCliName,
      )
      .map((entry) => ({
        entry,
        score: Math.min(
          ...(entry.resourceNames ?? [entry.resourceName]).flatMap(
            (candidate) =>
              resources.map((resource) =>
                Math.abs(normalizeSearch(candidate).length - resource.length),
              ),
          ),
        ),
      }))
      .filter(({ entry }) =>
        (entry.resourceNames ?? [entry.resourceName]).some((candidate) => {
          const normalized = normalizeSearch(candidate);
          return resources.some(
            (resource) =>
              normalized.includes(resource) || resource.includes(normalized),
          );
        }),
      )
      .sort((left, right) => left.score - right.score)
      .map(({ entry }) => entry);
  }

  public findRelatedLists(
    parentEntry: OperationEntry,
    parentInput: Record<string, unknown>,
    parentValue: unknown,
  ): RelatedResource[] {
    const parentResources = (parentEntry.resourceIds ?? [])
      .map((id) => this.resourcesById.get(id))
      .filter((resource): resource is ResourceEntry => resource !== undefined);
    const parentResourceNames = new Set(
      [
        ...parentResources.map((resource) => resource.name),
        ...entryResourceNames(parentEntry),
      ].map(normalizeResourceName),
    );
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
    const related = new Map<string, RelatedResource>();

    const add = (
      entry: OperationEntry,
      resourceName: string,
      source: RelatedResource["source"],
    ) => {
      if (!entry.supported || entry.mode !== "list") return;
      const input: Record<string, unknown> = {};
      const inheritedFields: string[] = [];
      for (const field of entry.inputFields) {
        if (field.name === entry.pagination?.inputToken) continue;
        const value = inheritedValue(
          parentEntry,
          parentInput,
          parentValue,
          field,
        );
        if (value !== undefined) {
          input[field.name] = value;
          inheritedFields.push(field.name);
        }
      }
      const missingRequired = entry.inputFields
        .filter(
          (field) =>
            field.required &&
            !hasDefaultValue(field) &&
            field.name !== entry.pagination?.inputToken &&
            input[field.name] === undefined,
        )
        .map((field) => field.name);
      const remainingInputs = entry.inputFields.filter(
        (field) =>
          field.name !== entry.pagination?.inputToken &&
          input[field.name] === undefined,
      ).length;
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
      if (!existing || source === "smithy") related.set(entry.id, candidate);
    };

    for (const parentResource of parentResources) {
      for (const childId of parentResource.childResourceIds) {
        const child = this.resourcesById.get(childId);
        if (!child) continue;
        for (const operationId of child.operationIds) {
          const entry = this.operationsById.get(operationId);
          if (entry) add(entry, child.name, "smithy");
        }
      }
    }

    for (const entry of this.catalog.operations) {
      if (
        !entry.supported ||
        entry.mode !== "list" ||
        entry.id === parentEntry.id ||
        serviceFamily(entry.serviceCliName) !==
          serviceFamily(parentEntry.serviceCliName) ||
        normalizeResourceName(entry.resourceName) === primaryParentName
      ) {
        continue;
      }
      const sharesParentResource = entryResourceNames(entry).some((name) =>
        parentResourceNames.has(normalizeResourceName(name)),
      );
      const inheritedParentIdentifiers = entry.inputFields.filter((field) => {
        if (!field.required) return false;
        const childTarget = targetName(field.target);
        return (
          parentIdentifiers.some(
            (identifier) =>
              identifier.name.toLowerCase() === field.name.toLowerCase() ||
              (childTarget !== undefined &&
                targetName(identifier.target) === childTarget),
          ) &&
          inheritedValue(parentEntry, parentInput, parentValue, field) !==
            undefined
        );
      });
      if (inheritedParentIdentifiers.length === 0) continue;

      const sharesModeledIdentifier = inheritedParentIdentifiers.some(
        (field) =>
          field.target !== undefined &&
          !field.target.startsWith("smithy.api#") &&
          parentIdentifiers.some(
            (identifier) => identifier.target === field.target,
          ),
      );
      if (sharesParentResource || sharesModeledIdentifier) {
        add(entry, entry.resourceName, "inferred");
      }
    }

    return [...related.values()].sort(
      (left, right) =>
        (left.source === right.source
          ? 0
          : left.source === "smithy"
            ? -1
            : 1) ||
        left.missingRequired.length - right.missingRequired.length ||
        left.resourceName.localeCompare(right.resourceName) ||
        left.entry.operationName.localeCompare(right.entry.operationName),
    );
  }
}
