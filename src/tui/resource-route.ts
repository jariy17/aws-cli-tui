import { inputValueText } from "../model/input-values.js";
import type { OperationEntry } from "../model/types.js";

export type ResourcePath = string[];

export function rootResourcePath(entry: OperationEntry): ResourcePath {
  return [entry.resourceName];
}

export function replaceResource(
  path: ResourcePath,
  resourceName: string,
): ResourcePath {
  return path.length > 0
    ? [...path.slice(0, -1), resourceName]
    : [resourceName];
}

export function appendResource(
  path: ResourcePath,
  resourceName: string,
): ResourcePath {
  return [...path, resourceName];
}

export function formatResourcePath(path: ResourcePath): string {
  return path.join(" › ");
}

export function formatOperationContext(
  entry: OperationEntry,
  input: Record<string, unknown>,
): string {
  const values = entry.inputFields.flatMap((field) => {
    const value = input[field.name];
    if (value === undefined || field.name === entry.pagination?.inputToken) {
      return [];
    }
    return [`${field.name}=${field.sensitive ? "***" : inputValueText(value)}`];
  });
  return [entry.operationName, ...values].join(" · ");
}
