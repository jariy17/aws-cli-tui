import type { OperationEntry, SupportedOperationMode } from "../model/types.js";
export declare class AmbiguousSearchError extends Error {
    readonly matches: OperationEntry[];
    constructor(matches: OperationEntry[]);
}
export declare function resolveOperation(search: string, mode: SupportedOperationMode): Promise<OperationEntry>;
export declare function formatMatches(matches: OperationEntry[]): string;
