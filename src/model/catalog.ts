import { readFile } from "node:fs/promises";

import {
  normalizeFuzzyText,
  scoreNormalizedFuzzyText,
} from "../search/fuzzy.js";
import type {
  Catalog,
  OperationEntry,
  OperationMode,
  ServiceEntry,
} from "./types.js";

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

export class SmithyCatalog {
  public constructor(private readonly catalog: Catalog) {}

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

  public search(
    queryValue: string,
    mode?: OperationMode,
    limit = 50,
  ): OperationEntry[] {
    const { scope, query } = parseScopedSearch(queryValue);
    if (!query) return [];

    return this.catalog.operations
      .filter((entry) => !mode || entry.mode === mode)
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
}
