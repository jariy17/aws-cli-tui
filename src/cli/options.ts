import type { Command } from "commander";

import type { AwsContext } from "../execution/types.js";

export type GlobalOptions = {
  profile?: string;
  region?: string;
  endpointUrl?: string;
};

export function addAwsOptions<T extends Command>(command: T): T {
  return command
    .option("--profile <name>", "AWS shared-config profile")
    .option("--region <region>", "AWS region")
    .option("--endpoint-url <url>", "Override the AWS service endpoint") as T;
}

export function awsContextFrom(command: Command): AwsContext {
  const options = command.optsWithGlobals<GlobalOptions>();
  return {
    ...(options.profile ? { profile: options.profile } : {}),
    ...(options.region ? { region: options.region } : {}),
    ...(options.endpointUrl ? { endpointUrl: options.endpointUrl } : {}),
  };
}
