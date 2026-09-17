export const routePatterns = {
  home: "/",
  search: "/apis",
  input: "/operations/:operationId/input",
  configure: "/operations/:operationId/configure",
  pages: "/operations/:operationId/pages/:pageNumber",
  listEntry: "/operations/:operationId/pages/:pageNumber/entries/:entryKey",
  detail: "/operations/:operationId/resource",
  related: "/operations/:operationId/resource/related",
  working: "/operations/:operationId/working",
  error: "/error",
} as const;

function operationPath(operationId: string): string {
  return `/operations/${encodeURIComponent(operationId)}`;
}

export function inputRoutePath(operationId: string): string {
  return `${operationPath(operationId)}/input`;
}

export function configureRoutePath(operationId: string): string {
  return `${operationPath(operationId)}/configure`;
}

export function pagesRoutePath(operationId: string, pageIndex: number): string {
  return `${operationPath(operationId)}/pages/${Math.max(0, pageIndex) + 1}`;
}

function scalarText(value: unknown): string | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    const text = String(value);
    return text.length > 0 ? text : undefined;
  }
  return undefined;
}

export function listEntryRouteKey(row: unknown, rowIndex: number): string {
  const scalar = scalarText(row);
  if (scalar !== undefined) return scalar;

  if (typeof row === "object" && row !== null && !Array.isArray(row)) {
    const fields = Object.entries(row)
      .map(([name, value], index) => {
        const normalizedName = name.toLowerCase();
        const rank =
          normalizedName === "id" ||
          name.endsWith("Id") ||
          name.endsWith("ID") ||
          /[_-]id$/i.test(name)
            ? 0
            : normalizedName === "name" ||
                name.endsWith("Name") ||
                /[_-]name$/i.test(name)
              ? 1
              : normalizedName === "arn" ||
                  name.endsWith("Arn") ||
                  name.endsWith("ARN") ||
                  /[_-]arn$/i.test(name)
                ? 2
                : undefined;
        return { index, rank, value: scalarText(value) };
      })
      .filter(
        (field): field is { index: number; rank: number; value: string } =>
          field.rank !== undefined && field.value !== undefined,
      )
      .sort(
        (left, right) => left.rank - right.rank || left.index - right.index,
      );
    if (fields[0]) return fields[0].value;
  }

  return `row-${Math.max(0, rowIndex) + 1}`;
}

export function listEntryRoutePath(
  operationId: string,
  pageIndex: number,
  entryKey: string,
): string {
  return `${pagesRoutePath(operationId, pageIndex)}/entries/${encodeURIComponent(entryKey)}`;
}

export function detailRoutePath(operationId: string): string {
  return `${operationPath(operationId)}/resource`;
}

export function relatedRoutePath(operationId: string): string {
  return `${detailRoutePath(operationId)}/related`;
}

export function workingRoutePath(operationId: string): string {
  return `${operationPath(operationId)}/working`;
}
