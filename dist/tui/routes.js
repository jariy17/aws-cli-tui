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
};
function operationPath(operationId) {
    return `/operations/${encodeURIComponent(operationId)}`;
}
export function inputRoutePath(operationId) {
    return `${operationPath(operationId)}/input`;
}
export function configureRoutePath(operationId) {
    return `${operationPath(operationId)}/configure`;
}
export function pagesRoutePath(operationId, pageIndex) {
    return `${operationPath(operationId)}/pages/${Math.max(0, pageIndex) + 1}`;
}
function scalarText(value) {
    if (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean") {
        const text = String(value);
        return text.length > 0 ? text : undefined;
    }
    return undefined;
}
export function listEntryRouteKey(row, rowIndex) {
    const scalar = scalarText(row);
    if (scalar !== undefined)
        return scalar;
    if (typeof row === "object" && row !== null && !Array.isArray(row)) {
        const fields = Object.entries(row)
            .map(([name, value], index) => {
            const normalizedName = name.toLowerCase();
            const rank = normalizedName === "id" ||
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
            .filter((field) => field.rank !== undefined && field.value !== undefined)
            .sort((left, right) => left.rank - right.rank || left.index - right.index);
        if (fields[0])
            return fields[0].value;
    }
    return `row-${Math.max(0, rowIndex) + 1}`;
}
export function listEntryRoutePath(operationId, pageIndex, entryKey) {
    return `${pagesRoutePath(operationId, pageIndex)}/entries/${encodeURIComponent(entryKey)}`;
}
export function detailRoutePath(operationId) {
    return `${operationPath(operationId)}/resource`;
}
export function relatedRoutePath(operationId) {
    return `${detailRoutePath(operationId)}/related`;
}
export function workingRoutePath(operationId) {
    return `${operationPath(operationId)}/working`;
}
//# sourceMappingURL=routes.js.map