import type { OperationEntry } from "../model/types.js";
import {
  normalizeFuzzyText,
  scoreNormalizedFuzzyText,
} from "../search/fuzzy.js";

export type ProjectedTable = {
  columns: string[];
  rows: Record<string, unknown>[];
};

export function getPath(value: unknown, pathValue?: string): unknown {
  if (!pathValue) return undefined;
  return pathValue.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, value);
}

function findFirstArray(value: Record<string, unknown>): unknown[] {
  for (const item of Object.values(value)) {
    if (Array.isArray(item)) return item;
  }
  return [];
}

export function extractRows(
  entry: OperationEntry,
  output: Record<string, unknown>,
): unknown[] {
  const paginatedItems = getPath(output, entry.pagination?.items);
  if (Array.isArray(paginatedItems)) return paginatedItems;
  return findFirstArray(output);
}

function isScalar(value: unknown): boolean {
  return (
    value === null || ["string", "number", "boolean"].includes(typeof value)
  );
}

function columnScore(name: string): number {
  const normalized = name.toLowerCase();
  if (normalized === "name" || normalized.endsWith("name")) return 0;
  if (normalized === "id" || normalized.endsWith("id")) return 10;
  if (normalized.includes("status") || normalized.includes("state")) return 20;
  if (normalized.includes("updated") || normalized.includes("created"))
    return 30;
  if (normalized.includes("type")) return 40;
  if (normalized.endsWith("arn")) return 50;
  return 100;
}

export function projectTable(rows: unknown[], maxColumns = 5): ProjectedTable {
  const objectRows = rows.filter(
    (row): row is Record<string, unknown> =>
      Boolean(row) && typeof row === "object" && !Array.isArray(row),
  );
  if (objectRows.length === 0) {
    return {
      columns: ["value"],
      rows: rows.map((value) => ({ value })),
    };
  }

  const columns = Array.from(
    new Set(
      objectRows.flatMap((row) =>
        Object.keys(row).filter((key) => isScalar(row[key])),
      ),
    ),
  )
    .sort(
      (left, right) =>
        columnScore(left) - columnScore(right) || left.localeCompare(right),
    )
    .slice(0, maxColumns);

  return { columns, rows: objectRows };
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}

function collectSearchValues(
  value: unknown,
  values: string[],
  depth = 0,
): void {
  if (
    values.length >= 100 ||
    depth > 5 ||
    value === null ||
    value === undefined
  )
    return;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    const normalized = normalizeFuzzyText(String(value).slice(0, 500));
    if (normalized) values.push(normalized);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSearchValues(item, values, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value))
      collectSearchValues(item, values, depth + 1);
  }
}

export function fuzzyFilterRows(
  rows: unknown[],
  queryValue: string,
): unknown[] {
  const query = normalizeFuzzyText(queryValue);
  if (!query) return rows;

  return rows
    .map((row, index) => {
      const values: string[] = [];
      collectSearchValues(row, values);
      const scores = values
        .map((value) => scoreNormalizedFuzzyText(value, query))
        .filter((score): score is number => score !== undefined);
      return {
        row,
        index,
        score: scores.length > 0 ? Math.min(...scores) : undefined,
      };
    })
    .filter(
      (result): result is { row: unknown; index: number; score: number } =>
        result.score !== undefined,
    )
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map((result) => result.row);
}

export function inferGetInput(
  entry: OperationEntry,
  row: unknown,
): Record<string, unknown> | undefined {
  const requiredFields = entry.inputFields.filter(
    (candidate) => candidate.required,
  );
  if (
    typeof row === "string" ||
    typeof row === "number" ||
    typeof row === "boolean"
  ) {
    if (requiredFields.length !== 1) return undefined;
    const [field] = requiredFields;
    const type = field!.type.toLowerCase();
    const compatible =
      (typeof row === "string" && type.includes("string")) ||
      (typeof row === "boolean" && type === "boolean") ||
      (typeof row === "number" &&
        [
          "byte",
          "short",
          "integer",
          "long",
          "float",
          "double",
          "bigInteger",
          "bigDecimal",
        ]
          .map((value) => value.toLowerCase())
          .includes(type));
    return compatible ? { [field!.name]: row } : undefined;
  }

  if (!row || typeof row !== "object" || Array.isArray(row)) return undefined;
  const record = row as Record<string, unknown>;
  const input: Record<string, unknown> = {};

  for (const field of requiredFields) {
    const matchingKey = Object.keys(record).find(
      (key) => key.toLowerCase() === field.name.toLowerCase(),
    );
    if (!matchingKey || record[matchingKey] === undefined) return undefined;
    input[field.name] = record[matchingKey];
  }

  return input;
}
