import type { ArnOccurrence } from "../../model/github-smithy.js";
import type { OperationEntry } from "../../model/types.js";
export type DetailState = {
    entry: OperationEntry;
    value: unknown;
    source: "list row" | "get response";
};
export declare function DetailScreen({ detail, onBack, onCheckArn, onOpenArn, }: {
    detail: DetailState;
    onBack: () => void;
    onCheckArn: (occurrence: ArnOccurrence) => Promise<boolean>;
    onOpenArn: (occurrence: ArnOccurrence) => void;
}): import("react").JSX.Element;
