import type { OperationEntry } from "../model/types.js";
export type AwsContext = {
    profile?: string;
    region?: string;
    endpointUrl?: string;
};
export type PageResult = {
    entry: OperationEntry;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    rows: unknown[];
    nextToken?: unknown;
    command: string;
    durationMs: number;
};
