import type { AwsContext } from "../execution/types.js";
import { SmithyCatalog } from "../model/catalog.js";
import type { OperationMode } from "../model/types.js";
export declare function App({ catalog, context, initialMode, }: {
    catalog: SmithyCatalog;
    context: AwsContext;
    initialMode?: OperationMode;
}): import("react").JSX.Element;
