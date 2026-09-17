import type { AwsContext } from "../execution/types.js";
import { SmithyCatalog } from "../model/catalog.js";
import type { SupportedOperationMode } from "../model/types.js";
export declare function App({ catalog, context, initialMode, }: {
    catalog: SmithyCatalog;
    context: AwsContext;
    initialMode?: SupportedOperationMode;
}): import("react").JSX.Element;
