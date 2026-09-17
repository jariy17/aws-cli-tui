export function hasDefaultValue(field) {
    return field.defaultValue !== undefined && field.defaultValue !== null;
}
export function defaultInputValues(entry) {
    return Object.fromEntries(entry.inputFields
        .filter((field) => field.name !== entry.pagination?.inputToken && hasDefaultValue(field))
        .map((field) => [field.name, field.defaultValue]));
}
export function inputValueText(value) {
    if (typeof value === "string")
        return value;
    return JSON.stringify(value) ?? String(value);
}
//# sourceMappingURL=input-values.js.map