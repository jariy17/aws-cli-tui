import type { SmithyCatalog } from "../../model/catalog.js";
import type { OperationEntry, SupportedOperationMode } from "../../model/types.js";
export declare function SearchScreen({ catalog, initialMode, onSelect, }: {
    catalog: SmithyCatalog;
    initialMode?: SupportedOperationMode;
    onSelect: (entry: OperationEntry) => void;
}): import("react").JSX.Element;
