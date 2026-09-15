import type { AwsContext } from "./types.js";
import type { OperationEntry } from "../model/types.js";
export declare function operationToCliName(operationName: string): string;
export declare function buildAwsCliArgs(entry: OperationEntry, input: Record<string, unknown>, context: AwsContext): string[];
export declare function formatCommand(args: string[], sensitiveValues?: string[]): string;
