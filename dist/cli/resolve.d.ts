import type { OperationEntry, OperationMode } from "../model/types.js";
export declare class AmbiguousSearchError extends Error {
    readonly matches: OperationEntry[];
    constructor(matches: OperationEntry[]);
}
export declare function resolveOperation(search: string, mode: OperationMode): Promise<OperationEntry>;
export declare function formatMatches(matches: OperationEntry[]): string;
