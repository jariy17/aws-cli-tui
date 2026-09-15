import type { Catalog, OperationEntry, OperationMode, ServiceEntry } from "./types.js";
export declare function normalizeSearch(value: string): string;
export declare class SmithyCatalog {
    private readonly catalog;
    constructor(catalog: Catalog);
    static load(): Promise<SmithyCatalog>;
    metadata(): Pick<Catalog, "generatedAt" | "source" | "operationCount">;
    services(): readonly ServiceEntry[];
    search(queryValue: string, mode?: OperationMode, limit?: number): OperationEntry[];
    findRelatedGet(listEntry: OperationEntry): OperationEntry[];
}
