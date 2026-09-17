import { normalizeSearch, SmithyCatalog } from "../model/catalog.js";
import type { OperationEntry, SupportedOperationMode } from "../model/types.js";

export class AmbiguousSearchError extends Error {
  public constructor(public readonly matches: OperationEntry[]) {
    super("Search matched more than one API operation.");
    this.name = "AmbiguousSearchError";
  }
}

export async function resolveOperation(
  search: string,
  mode: SupportedOperationMode,
): Promise<OperationEntry> {
  const catalog = await SmithyCatalog.load();
  const matches = catalog.search(search, mode);
  if (matches.length === 0) {
    throw new Error(
      `No ${mode.toUpperCase()} API matched "${normalizeSearch(search)}".`,
    );
  }

  const query = normalizeSearch(search);
  const exact = matches.filter((entry) => entry.searchKeys.includes(query));
  if (exact.length === 1) return exact[0]!;
  if (matches.length === 1) return matches[0]!;
  throw new AmbiguousSearchError(matches.slice(0, 12));
}

export function formatMatches(matches: OperationEntry[]): string {
  return matches
    .map((entry) => `  ${entry.operationName.padEnd(36)} ${entry.serviceTitle}`)
    .join("\n");
}
