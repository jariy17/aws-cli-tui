import type { ArnOccurrence } from "../../model/github-smithy.js";
export declare function arnOccurrenceKey(occurrence: ArnOccurrence): string;
export declare function findArnOccurrences(value: unknown): ArnOccurrence[];
export declare function JsonView({ value, resolvableArns, checkingArns, onOpenArn, relatedCount, onRelated, onBack, }: {
    value: unknown;
    resolvableArns: ReadonlySet<string>;
    checkingArns: boolean;
    onOpenArn: (occurrence: ArnOccurrence) => void;
    relatedCount?: number;
    onRelated?: () => void;
    onBack: () => void;
}): import("react").JSX.Element;
