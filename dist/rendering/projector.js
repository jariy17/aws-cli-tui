import { normalizeFuzzyText, scoreNormalizedFuzzyText, } from "../search/fuzzy.js";
export function getPath(value, pathValue) {
    if (!pathValue)
        return undefined;
    return pathValue.split(".").reduce((current, part) => {
        if (!current || typeof current !== "object")
            return undefined;
        return current[part];
    }, value);
}
function findFirstArray(value) {
    for (const item of Object.values(value)) {
        if (Array.isArray(item))
            return item;
    }
    return [];
}
export function extractRows(entry, output) {
    const paginatedItems = getPath(output, entry.pagination?.items);
    if (Array.isArray(paginatedItems))
        return paginatedItems;
    return findFirstArray(output);
}
function isScalar(value) {
    return (value === null || ["string", "number", "boolean"].includes(typeof value));
}
function columnScore(name) {
    const normalized = name.toLowerCase();
    if (normalized === "name" || normalized.endsWith("name"))
        return 0;
    if (normalized === "id" || normalized.endsWith("id"))
        return 10;
    if (normalized.includes("status") || normalized.includes("state"))
        return 20;
    if (normalized.includes("updated") || normalized.includes("created"))
        return 30;
    if (normalized.includes("type"))
        return 40;
    if (normalized.endsWith("arn"))
        return 50;
    return 100;
}
export function projectTable(rows, maxColumns = 5) {
    if (rows.length === 0) {
        return { columns: [], rows: [] };
    }
    const objectRows = rows.filter((row) => Boolean(row) && typeof row === "object" && !Array.isArray(row));
    if (objectRows.length === 0) {
        return {
            columns: ["value"],
            rows: rows.map((value) => ({ value })),
        };
    }
    const columns = Array.from(new Set(objectRows.flatMap((row) => Object.keys(row).filter((key) => isScalar(row[key])))))
        .sort((left, right) => columnScore(left) - columnScore(right) || left.localeCompare(right))
        .slice(0, maxColumns);
    return { columns, rows: objectRows };
}
export function displayValue(value) {
    if (value === null || value === undefined)
        return "—";
    if (typeof value === "string")
        return value;
    if (typeof value === "number" || typeof value === "boolean")
        return String(value);
    return JSON.stringify(value);
}
function identifierStem(name) {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const suffix of ["identifier", "id", "arn", "name"]) {
        if (normalized.endsWith(suffix) && normalized.length > suffix.length) {
            return normalized.slice(0, -suffix.length);
        }
    }
    return undefined;
}
function identifierRank(name) {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normalized.endsWith("id"))
        return 0;
    if (normalized.endsWith("identifier"))
        return 1;
    if (normalized.endsWith("arn"))
        return 2;
    if (normalized.endsWith("name"))
        return 3;
    return 4;
}
function collectSearchValues(value, values, depth = 0) {
    if (values.length >= 100 ||
        depth > 5 ||
        value === null ||
        value === undefined)
        return;
    if (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean") {
        const normalized = normalizeFuzzyText(String(value).slice(0, 500));
        if (normalized)
            values.push(normalized);
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value)
            collectSearchValues(item, values, depth + 1);
        return;
    }
    if (typeof value === "object") {
        for (const item of Object.values(value))
            collectSearchValues(item, values, depth + 1);
    }
}
export function fuzzyFilterRows(rows, queryValue) {
    const query = normalizeFuzzyText(queryValue);
    if (!query)
        return rows;
    return rows
        .map((row, index) => {
        const values = [];
        collectSearchValues(row, values);
        const scores = values
            .map((value) => scoreNormalizedFuzzyText(value, query))
            .filter((score) => score !== undefined);
        return {
            row,
            index,
            score: scores.length > 0 ? Math.min(...scores) : undefined,
        };
    })
        .filter((result) => result.score !== undefined)
        .sort((left, right) => left.score - right.score || left.index - right.index)
        .map((result) => result.row);
}
export function inferGetInput(entry, row, pageInput = {}, listEntry) {
    const requiredFields = entry.inputFields.filter((candidate) => candidate.required);
    const input = {};
    const copyMatchingFields = (record, overwrite) => {
        let matches = 0;
        for (const field of entry.inputFields) {
            if (!overwrite && input[field.name] !== undefined)
                continue;
            const matchingKey = Object.keys(record).find((key) => key.toLowerCase() === field.name.toLowerCase());
            if (matchingKey && record[matchingKey] !== undefined) {
                input[field.name] = record[matchingKey];
                matches += 1;
            }
        }
        return matches;
    };
    copyMatchingFields(pageInput, false);
    if (typeof row === "string" ||
        typeof row === "number" ||
        typeof row === "boolean") {
        const missingRequired = requiredFields.filter((field) => input[field.name] === undefined);
        if (missingRequired.length !== 1)
            return undefined;
        const [field] = missingRequired;
        const type = field.type.toLowerCase();
        const compatible = (typeof row === "string" && type.includes("string")) ||
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
        if (!compatible)
            return undefined;
        input[field.name] = row;
        return input;
    }
    if (!row || typeof row !== "object" || Array.isArray(row))
        return undefined;
    const record = row;
    let rowMatches = copyMatchingFields(record, true);
    for (const field of entry.inputFields) {
        if (input[field.name] !== undefined || !field.target || !listEntry)
            continue;
        const target = field.target.split("#").at(-1);
        if (!target || field.target.startsWith("smithy.api#"))
            continue;
        const matches = (listEntry.listItemFields ?? []).filter((sourceField) => sourceField.target?.split("#").at(-1) === target &&
            record[sourceField.name] !== undefined);
        if (matches.length === 1) {
            input[field.name] = record[matches[0].name];
            rowMatches += 1;
        }
    }
    for (const field of requiredFields) {
        if (input[field.name] !== undefined ||
            field.target?.startsWith("smithy.api#")) {
            continue;
        }
        const expectedStem = identifierStem(field.name);
        if (!expectedStem)
            continue;
        const matches = Object.keys(record)
            .map((name) => ({
            name,
            rank: identifierRank(name),
            stem: identifierStem(name),
            value: record[name],
        }))
            .filter((candidate) => candidate.stem === expectedStem &&
            candidate.value !== undefined &&
            candidate.value !== null &&
            ["string", "number", "boolean"].includes(typeof candidate.value))
            .sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name));
        const best = matches[0];
        if (best &&
            matches.filter((candidate) => candidate.rank === best.rank).length === 1) {
            input[field.name] = best.value;
            rowMatches += 1;
        }
    }
    if (rowMatches === 0)
        return undefined;
    if (requiredFields.some((field) => input[field.name] === undefined))
        return undefined;
    return input;
}
//# sourceMappingURL=projector.js.map