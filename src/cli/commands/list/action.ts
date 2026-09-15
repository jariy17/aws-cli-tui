import { AwsCliExecutor } from "../../../execution/aws-cli-executor.js";
import type { AwsContext } from "../../../execution/types.js";
import { resolveOperation } from "../../resolve.js";

export async function runList(
  search: string,
  context: AwsContext,
): Promise<Record<string, unknown>> {
  const entry = await resolveOperation(search, "list");
  const executor = new AwsCliExecutor(context);
  const result = await executor.execute(entry);
  return {
    service: result.entry.serviceTitle,
    serviceCommand: result.entry.serviceCliName,
    operation: result.entry.operationName,
    page: 1,
    hasNextPage: result.nextToken !== undefined,
    data: result.output,
  };
}
