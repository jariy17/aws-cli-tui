import type { Catalog, OperationEntry, ResourceEntry, ServiceEntry, SupportedOperationMode } from "./types.js";
export declare function normalizeSearch(value: string): string;
export type RelatedResource = {
    entry: OperationEntry;
    resourceName: string;
    source: "smithy" | "inferred";
    input: Record<string, unknown>;
    inheritedFields: string[];
    missingRequired: string[];
    remainingInputs: number;
};
export declare class SmithyCatalog {
    private readonly catalog;
    private readonly operationsById;
    private readonly resourcesById;
    constructor(catalog: Catalog);
    static load(): Promise<SmithyCatalog>;
    metadata(): Pick<Catalog, "generatedAt" | "source" | "operationCount">;
    services(): readonly ServiceEntry[];
    resources(): readonly ResourceEntry[];
    search(queryValue: string, mode?: SupportedOperationMode, limit?: number): OperationEntry[];
    findRelatedGet(listEntry: OperationEntry): OperationEntry[];
    findRelatedLists(parentEntry: OperationEntry, parentInput: Record<string, unknown>, parentValue: unknown): RelatedResource[];
}
