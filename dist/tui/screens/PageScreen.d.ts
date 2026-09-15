import type { PageResult } from "../../execution/types.js";
export declare function PageScreen({ pages, pageIndex, loading, onNext, onPrevious, onBack, onDetail, }: {
    pages: PageResult[];
    pageIndex: number;
    loading: boolean;
    onNext: () => void;
    onPrevious: () => void;
    onBack: () => void;
    onDetail: (row: unknown) => void;
}): import("react").JSX.Element;
