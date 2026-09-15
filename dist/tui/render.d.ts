import type { AwsContext } from "../execution/types.js";
import type { OperationMode } from "../model/types.js";
export declare function renderTui({ context, mode, }: {
    context: AwsContext;
    mode?: OperationMode;
}): Promise<void>;
