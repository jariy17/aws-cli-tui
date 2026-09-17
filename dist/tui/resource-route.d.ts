import type { OperationEntry } from "../model/types.js";
export type ResourcePath = string[];
export declare function rootResourcePath(entry: OperationEntry): ResourcePath;
export declare function replaceResource(path: ResourcePath, resourceName: string): ResourcePath;
export declare function appendResource(path: ResourcePath, resourceName: string): ResourcePath;
export declare function formatResourcePath(path: ResourcePath): string;
export declare function formatOperationContext(entry: OperationEntry, input: Record<string, unknown>): string;
