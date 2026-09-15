import type { OperationEntry, ServiceEntry } from "./types.js";
type SmithyTarget = {
    target: string;
    traits?: Record<string, unknown>;
};
type SmithyShape = {
    type: string;
    version?: string;
    input?: SmithyTarget;
    output?: SmithyTarget;
    read?: SmithyTarget;
    identifiers?: Record<string, SmithyTarget>;
    members?: Record<string, SmithyTarget>;
    member?: SmithyTarget;
    traits?: Record<string, any>;
};
export type SmithyModel = {
    shapes: Record<string, SmithyShape>;
};
export type ArnOccurrence = {
    arn: string;
    key?: string;
};
export type ArnResolution = {
    arn: string;
    entry: OperationEntry;
    input: Record<string, unknown>;
    region?: string;
};
export declare class GithubSmithyRepository {
    private readonly fetcher;
    private readonly branch;
    private readonly cache;
    constructor(fetcher?: typeof fetch, branch?: string);
    load(service: ServiceEntry): Promise<SmithyModel>;
}
export declare class ArnReferenceResolver {
    private readonly services;
    private readonly repository;
    constructor(services: readonly ServiceEntry[], repository: GithubSmithyRepository);
    resolve(sourceService: ServiceEntry, occurrence: ArnOccurrence): Promise<ArnResolution | undefined>;
}
export {};
