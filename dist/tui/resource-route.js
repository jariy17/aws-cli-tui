import { inputValueText } from "../model/input-values.js";
export function rootResourcePath(entry) {
    return [entry.resourceName];
}
export function replaceResource(path, resourceName) {
    return path.length > 0
        ? [...path.slice(0, -1), resourceName]
        : [resourceName];
}
export function appendResource(path, resourceName) {
    return [...path, resourceName];
}
export function formatResourcePath(path) {
    return path.join(" › ");
}
export function formatOperationContext(entry, input) {
    const values = entry.inputFields.flatMap((field) => {
        const value = input[field.name];
        if (value === undefined || field.name === entry.pagination?.inputToken) {
            return [];
        }
        return [`${field.name}=${field.sensitive ? "***" : inputValueText(value)}`];
    });
    return [entry.operationName, ...values].join(" · ");
}
//# sourceMappingURL=resource-route.js.map