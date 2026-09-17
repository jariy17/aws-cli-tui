import type { ReactNode } from "react";
export declare function frameHeaderHeight(columns: number, title: string, metadata?: string, context?: string): number;
export declare function Frame({ title, metadata, context, help, children, }: {
    title: string;
    metadata?: string;
    context?: string;
    help: string;
    children: ReactNode;
}): import("react").JSX.Element;
