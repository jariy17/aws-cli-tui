import { defaultInputValues } from "../model/input-values.js";
function coerce(value, field) {
    if (!field)
        return value;
    const type = field.type.toLowerCase();
    if ([
        "byte",
        "short",
        "integer",
        "long",
        "float",
        "double",
        "biginteger",
        "bigdecimal",
        "intenum",
    ].includes(type)) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed))
            throw new Error(`${field.name} must be a number.`);
        return parsed;
    }
    if (type === "boolean") {
        if (value === "true")
            return true;
        if (value === "false")
            return false;
        throw new Error(`${field.name} must be true or false.`);
    }
    if (type === "list" ||
        type === "map" ||
        type === "structure" ||
        type === "union" ||
        type === "document") {
        try {
            return JSON.parse(value);
        }
        catch {
            throw new Error(`${field.name} must be valid JSON.`);
        }
    }
    return value;
}
export function parseInputPairs(entry, pairs, options = {}) {
    const input = options.includeDefaults === false ? {} : defaultInputValues(entry);
    for (const pair of pairs) {
        const separator = pair.indexOf("=");
        if (separator <= 0)
            throw new Error(`Invalid input "${pair}". Use key=value.`);
        const name = pair.slice(0, separator);
        const value = pair.slice(separator + 1);
        const field = entry.inputFields.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
        if (!field)
            throw new Error(`Unknown input "${name}" for ${entry.operationName}.`);
        input[field.name] = coerce(value, field);
    }
    const missing = entry.inputFields
        .filter((field) => field.required && input[field.name] === undefined)
        .map((field) => field.name);
    if (missing.length > 0) {
        throw new Error(`Missing required input: ${missing.join(", ")}.`);
    }
    return input;
}
export function collectInput(value, previous) {
    return [...previous, value];
}
//# sourceMappingURL=input.js.map