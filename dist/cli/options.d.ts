import type { Command } from "commander";
import type { AwsContext } from "../execution/types.js";
export type GlobalOptions = {
    profile?: string;
    region?: string;
    endpointUrl?: string;
};
export declare function addAwsOptions<T extends Command>(command: T): T;
export declare function awsContextFrom(command: Command): AwsContext;
