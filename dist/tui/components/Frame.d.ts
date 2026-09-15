import type { ReactNode } from "react";
export declare function frameHeaderHeight(columns: number, title: string, metadata?: string): number;
export declare function Frame({ title, metadata, help, children, }: {
    title: string;
    metadata?: string;
    help: string;
    children: ReactNode;
}): import("react").JSX.Element;
