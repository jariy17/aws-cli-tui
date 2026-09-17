import type { OperationEntry } from "../model/types.js";
export type ProjectedTable = {
    columns: string[];
    rows: Record<string, unknown>[];
};
export declare function getPath(value: unknown, pathValue?: string): unknown;
export declare function extractRows(entry: OperationEntry, output: Record<string, unknown>): unknown[];
export declare function projectTable(rows: unknown[], maxColumns?: number): ProjectedTable;
export declare function displayValue(value: unknown): string;
export declare function fuzzyFilterRows(rows: unknown[], queryValue: string): unknown[];
export declare function inferGetInput(entry: OperationEntry, row: unknown, pageInput?: Record<string, unknown>, listEntry?: OperationEntry): Record<string, unknown> | undefined;
