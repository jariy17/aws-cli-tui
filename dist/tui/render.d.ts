import type { AwsContext } from "../execution/types.js";
import type { SupportedOperationMode } from "../model/types.js";
export declare function renderTui({ context, mode, }: {
    context: AwsContext;
    mode?: SupportedOperationMode;
}): Promise<void>;
