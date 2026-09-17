import type { ArnOccurrence } from "../../model/github-smithy.js";
import type { OperationEntry } from "../../model/types.js";
import { type ResourcePath } from "../resource-route.js";
export type DetailState = {
    entry: OperationEntry;
    value: unknown;
    source: "list row" | "get response";
    input?: Record<string, unknown>;
};
export declare function DetailScreen({ detail, onBack, onCheckArn, onOpenArn, relatedCount, onRelated, resourcePath, }: {
    detail: DetailState;
    onBack: () => void;
    onCheckArn: (occurrence: ArnOccurrence) => Promise<boolean>;
    onOpenArn: (occurrence: ArnOccurrence) => void;
    relatedCount?: number;
    onRelated?: () => void;
    resourcePath?: ResourcePath;
}): import("react").JSX.Element;
