import type { InputField, OperationEntry } from "./types.js";
export declare function hasDefaultValue(field: InputField): boolean;
export declare function defaultInputValues(entry: OperationEntry): Record<string, unknown>;
export declare function inputValueText(value: unknown): string;
