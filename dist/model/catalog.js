import { readFile } from "node:fs/promises";
import { normalizeFuzzyText, scoreNormalizedFuzzyText, } from "../search/fuzzy.js";
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
export class SmithyCatalog {
    catalog;
    constructor(catalog) {
        this.catalog = catalog;
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
    search(queryValue, mode, limit = 50) {
        const { scope, query } = parseScopedSearch(queryValue);
        if (!query)
            return [];
        return this.catalog.operations
            .filter((entry) => !mode || entry.mode === mode)
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
            .filter((entry) => entry.mode === "get" &&
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
}
//# sourceMappingURL=catalog.js.map