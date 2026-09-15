import type { OperationEntry } from "../model/types.js";
export declare function parseInputPairs(entry: OperationEntry, pairs: string[]): Record<string, unknown>;
export declare function collectInput(value: string, previous: string[]): string[];
