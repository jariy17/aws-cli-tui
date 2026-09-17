import type { PageResult } from "../../execution/types.js";
import { type ResourcePath } from "../resource-route.js";
export declare function PageScreen({ pages, pageIndex, loading, resourcePath, onNext, onPrevious, onBack, onDetail, onConfigure, }: {
    pages: PageResult[];
    pageIndex: number;
    loading: boolean;
    resourcePath?: ResourcePath;
    onNext: () => void;
    onPrevious: () => void;
    onBack: () => void;
    onDetail: (row: unknown) => void;
    onConfigure?: () => void;
}): import("react").JSX.Element;
