import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useMemo, useState } from "react";
import { Frame, frameHeaderHeight } from "../components/Frame.js";
import { HELP } from "../constants.js";
import { hasDefaultValue } from "../../model/input-values.js";
function normalizedInput(input) {
    return input.toLowerCase().replace(/[^a-z0-9:]/g, "");
}
export function SearchScreen({ catalog, initialMode, onSelect, }) {
    const { exit } = useApp();
    const { stdout } = useStdout();
    const terminalWidth = stdout?.columns ?? 80;
    const terminalHeight = stdout?.rows ?? 24;
    const title = initialMode
        ? `${initialMode.toUpperCase()} SEARCH`
        : "GLOBAL SEARCH";
    const metadata = `${catalog.metadata().operationCount.toLocaleString()} AWS APIs`;
    const apiWidth = Math.max(14, Math.floor(terminalWidth * 0.28));
    const actionWidth = 10;
    const serviceWidth = Math.max(16, Math.floor(terminalWidth * 0.32));
    const resourceWidth = Math.max(12, terminalWidth - apiWidth - actionWidth - serviceWidth - 8);
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [pageIndex, setPageIndex] = useState(0);
    const matches = useMemo(() => catalog.search(query, initialMode, catalog.metadata().operationCount), [catalog, initialMode, query]);
    const maxVisibleMatches = Math.max(1, terminalHeight - frameHeaderHeight(terminalWidth, title, metadata) - 6);
    const pageCount = Math.max(1, Math.ceil(matches.length / maxVisibleMatches));
    const currentPage = Math.min(pageIndex, pageCount - 1);
    const pageStart = currentPage * maxVisibleMatches;
    const pageMatches = matches.slice(pageStart, pageStart + maxVisibleMatches);
    const selected = pageMatches[selectedIndex] ?? pageMatches[0];
    const matchSlots = Array.from({ length: maxVisibleMatches }, (_, index) => pageMatches[index]);
    const requiredInputs = selected?.inputFields.filter((field) => field.required && !hasDefaultValue(field));
    const selectedSummary = selected
        ? selected.supported
            ? `${selected.operationName} · ${requiredInputs?.length
                ? `Inputs: ${requiredInputs.map((field) => field.name).join(", ")}`
                : "No required inputs"} · ${selected.pagination ? "Page by page" : "Single response"}`
            : `${selected.operationName} · Unsupported · ${selected.unsupportedReason ?? "Not available"}`
        : "No API selected · Required inputs — · Pagination —";
    useInput((input, key) => {
        if (key.ctrl)
            return;
        if (key.escape) {
            if (query) {
                setQuery("");
                setSelectedIndex(0);
                setPageIndex(0);
            }
            else {
                exit();
            }
            return;
        }
        if (key.upArrow && pageMatches.length > 0) {
            setSelectedIndex((index) => (index - 1 + pageMatches.length) % pageMatches.length);
            return;
        }
        if (key.downArrow && pageMatches.length > 0) {
            setSelectedIndex((index) => (index + 1) % pageMatches.length);
            return;
        }
        if (key.leftArrow && currentPage > 0) {
            setPageIndex(currentPage - 1);
            setSelectedIndex(0);
            return;
        }
        if (key.rightArrow && currentPage + 1 < pageCount) {
            setPageIndex(currentPage + 1);
            setSelectedIndex(0);
            return;
        }
        if (key.return && selected?.supported) {
            onSelect(selected);
            return;
        }
        if (key.backspace || key.delete) {
            setQuery((value) => value.slice(0, -1));
            setSelectedIndex(0);
            setPageIndex(0);
            return;
        }
        const next = normalizedInput(input);
        if (next) {
            setQuery((value) => `${value}${next}`);
            setSelectedIndex(0);
            setPageIndex(0);
        }
    });
    return (_jsxs(Frame, { title: title, metadata: metadata, help: HELP.search, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { color: "cyan", children: "/ " }), _jsx(Text, { children: query }), _jsx(Text, { inverse: true, children: " " }), !query && _jsx(Text, { dimColor: true, children: "agentruntime" })] }), _jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { columnGap: 1, children: [_jsx(Box, { width: 2, children: _jsx(Text, { children: " " }) }), _jsx(Box, { width: apiWidth, children: _jsx(Text, { bold: true, dimColor: true, children: "API" }) }), _jsx(Box, { width: actionWidth, children: _jsx(Text, { bold: true, dimColor: true, children: "ACTION" }) }), _jsx(Box, { width: serviceWidth, children: _jsx(Text, { bold: true, dimColor: true, children: "SERVICE" }) }), _jsx(Box, { width: resourceWidth, children: _jsx(Text, { bold: true, dimColor: true, children: "RESOURCE" }) })] }), matchSlots.map((entry, visibleIndex) => {
                        const isSelected = entry !== undefined && visibleIndex === selectedIndex;
                        const isUnsupported = entry?.supported === false;
                        return (_jsxs(Box, { height: 1, columnGap: 1, children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: isUnsupported ? "gray" : isSelected ? "cyan" : "white", dimColor: isUnsupported, children: isSelected ? "❯ " : "  " }) }), _jsx(Box, { width: apiWidth, children: _jsx(Text, { color: isUnsupported ? "gray" : isSelected ? "cyan" : "white", dimColor: isUnsupported, wrap: "truncate-end", children: entry?.displayName ?? " " }) }), _jsx(Box, { width: actionWidth, children: _jsx(Text, { ...(isUnsupported ? { color: "gray" } : {}), dimColor: true, children: entry?.action ?? " " }) }), _jsx(Box, { width: serviceWidth, children: _jsx(Text, { ...(isUnsupported ? { color: "gray" } : {}), dimColor: true, wrap: "truncate-end", children: entry?.serviceTitle ?? " " }) }), _jsx(Box, { width: resourceWidth, children: _jsx(Text, { ...(isUnsupported ? { color: "gray" } : {}), dimColor: true, wrap: "truncate-end", children: entry
                                            ? (entry.resourceNames ?? [entry.resourceName]).join(", ")
                                            : " " }) })] }, entry?.id ?? `empty-${visibleIndex}`));
                    }), _jsxs(Text, { dimColor: true, wrap: "truncate-end", children: [selectedSummary, " \u00B7 ", matches.length, " match", matches.length === 1 ? "" : "es", " \u00B7", " ", matches.length > 0
                                ? `Page ${currentPage + 1}/${pageCount} · ${pageStart + selectedIndex + 1} selected`
                                : "Page 0/0 · 0 selected"] })] })] }));
}
//# sourceMappingURL=SearchScreen.js.map