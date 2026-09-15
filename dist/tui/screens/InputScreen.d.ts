import type { OperationEntry } from "../../model/types.js";
export declare function InputScreen({ entry, onSubmit, onBack, }: {
    entry: OperationEntry;
    onSubmit: (input: Record<string, unknown>) => void;
    onBack: () => void;
}): import("react").JSX.Element | null;
