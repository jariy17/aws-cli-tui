import type { OperationEntry } from "../model/types.js";
type ParseInputOptions = {
    includeDefaults?: boolean;
};
export declare function parseInputPairs(entry: OperationEntry, pairs: string[], options?: ParseInputOptions): Record<string, unknown>;
export declare function collectInput(value: string, previous: string[]): string[];
export {};
