import type { InputField, OperationEntry } from "./types.js";

export function hasDefaultValue(field: InputField): boolean {
  return field.defaultValue !== undefined && field.defaultValue !== null;
}

export function defaultInputValues(
  entry: OperationEntry,
): Record<string, unknown> {
  return Object.fromEntries(
    entry.inputFields
      .filter(
        (field) =>
          field.name !== entry.pagination?.inputToken && hasDefaultValue(field),
      )
      .map((field) => [field.name, field.defaultValue]),
  );
}

export function inputValueText(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? String(value);
}
