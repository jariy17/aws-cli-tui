import type { SmithyCatalog } from "../../model/catalog.js";
import type { OperationEntry, OperationMode } from "../../model/types.js";
export declare function SearchScreen({ catalog, initialMode, onSelect, }: {
    catalog: SmithyCatalog;
    initialMode?: OperationMode;
    onSelect: (entry: OperationEntry) => void;
}): import("react").JSX.Element;
