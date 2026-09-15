import { type ReactNode } from "react";
type DebugContextValue = {
    visible: boolean;
    command: string | undefined;
    setCommand: (command: string) => void;
};
export declare function DebugProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
export declare function useDebug(): DebugContextValue;
export {};
