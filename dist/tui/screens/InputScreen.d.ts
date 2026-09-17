import type { OperationEntry } from "../../model/types.js";
import { type ResourcePath } from "../resource-route.js";
type InputPurpose = "required" | "configure";
export declare function InputScreen({ entry, initialValues, resourcePath, purpose, onSubmit, onBack, }: {
    entry: OperationEntry;
    initialValues?: Record<string, unknown>;
    resourcePath?: ResourcePath;
    purpose?: InputPurpose;
    onSubmit: (input: Record<string, unknown>) => void;
    onBack: () => void;
}): import("react").JSX.Element | null;
export {};
