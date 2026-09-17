import { AwsCliExecutor } from "../../../execution/aws-cli-executor.js";
import { parseInputPairs } from "../../input.js";
import { resolveOperation } from "../../resolve.js";
export async function runList(search, pairs, context) {
    const entry = await resolveOperation(search, "list");
    const input = parseInputPairs(entry, pairs);
    const executor = new AwsCliExecutor(context);
    const result = await executor.execute(entry, input);
    return {
        service: result.entry.serviceTitle,
        serviceCommand: result.entry.serviceCliName,
        operation: result.entry.operationName,
        page: 1,
        hasNextPage: result.nextToken !== undefined,
        data: result.output,
    };
}
//# sourceMappingURL=action.js.map