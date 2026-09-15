import type { AwsContext, PageResult } from "./types.js";
import type { OperationEntry } from "../model/types.js";
export declare class AwsCliError extends Error {
    readonly exitCode?: number | undefined;
    constructor(message: string, exitCode?: number | undefined);
}
export declare class AwsCliExecutor {
    private readonly context;
    constructor(context: AwsContext);
    command(entry: OperationEntry, input?: Record<string, unknown>): string;
    execute(entry: OperationEntry, input?: Record<string, unknown>, signal?: AbortSignal): Promise<PageResult>;
    nextInput(page: PageResult): Record<string, unknown> | undefined;
}
