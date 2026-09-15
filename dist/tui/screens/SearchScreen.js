import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useMemo, useState } from "react";
import { Frame, frameHeaderHeight } from "../components/Frame.js";
import { HELP } from "../constants.js";
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
    const metadata = `${catalog.metadata().operationCount.toLocaleString()} read APIs`;
    const apiWidth = Math.max(14, Math.floor(terminalWidth * 0.28));
    const modeWidth = 7;
    const serviceWidth = Math.max(16, Math.floor(terminalWidth * 0.32));
    const resourceWidth = Math.max(12, terminalWidth - apiWidth - modeWidth - serviceWidth - 8);
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const matches = useMemo(() => catalog.search(query, initialMode, 20), [catalog, initialMode, query]);
    const selected = matches[selectedIndex] ?? matches[0];
    const maxVisibleMatches = Math.max(1, terminalHeight - frameHeaderHeight(terminalWidth, title, metadata) - 6);
    const viewportStart = Math.max(0, Math.min(selectedIndex - Math.floor(maxVisibleMatches / 2), matches.length - maxVisibleMatches));
    const viewportEnd = Math.min(matches.length, viewportStart + maxVisibleMatches);
    const visibleMatches = matches.slice(viewportStart, viewportEnd);
    const matchSlots = Array.from({ length: maxVisibleMatches }, (_, index) => visibleMatches[index]);
    const requiredInputs = selected?.inputFields.filter((field) => field.required);
    const selectedSummary = selected
        ? `${selected.operationName} · ${requiredInputs?.length
            ? `Inputs: ${requiredInputs.map((field) => field.name).join(", ")}`
            : "No required inputs"} · ${selected.pagination ? "Page by page" : "Single response"}`
        : "No API selected · Required inputs — · Pagination —";
    useInput((input, key) => {
        if (key.ctrl && input === "q") {
            exit();
            return;
        }
        if (key.ctrl)
            return;
        if (key.escape) {
            if (query) {
                setQuery("");
                setSelectedIndex(0);
            }
            else {
                exit();
            }
            return;
        }
        if (key.upArrow && matches.length > 0) {
            setSelectedIndex((index) => (index - 1 + matches.length) % matches.length);
            return;
        }
        if (key.downArrow && matches.length > 0) {
            setSelectedIndex((index) => (index + 1) % matches.length);
            return;
        }
        if (key.return && selected) {
            onSelect(selected);
            return;
        }
        if (key.backspace || key.delete) {
            setQuery((value) => value.slice(0, -1));
            setSelectedIndex(0);
            return;
        }
        const next = normalizedInput(input);
        if (next) {
            setQuery((value) => `${value}${next}`);
            setSelectedIndex(0);
        }
    });
    return (_jsxs(Frame, { title: title, metadata: metadata, help: HELP.search, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { color: "cyan", children: "/ " }), _jsx(Text, { children: query }), _jsx(Text, { inverse: true, children: " " }), !query && _jsx(Text, { dimColor: true, children: "agentruntime" })] }), _jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { columnGap: 1, children: [_jsx(Box, { width: 2, children: _jsx(Text, { children: " " }) }), _jsx(Box, { width: apiWidth, children: _jsx(Text, { bold: true, dimColor: true, children: "API" }) }), _jsx(Box, { width: modeWidth, children: _jsx(Text, { bold: true, dimColor: true, children: "MODE" }) }), _jsx(Box, { width: serviceWidth, children: _jsx(Text, { bold: true, dimColor: true, children: "SERVICE" }) }), _jsx(Box, { width: resourceWidth, children: _jsx(Text, { bold: true, dimColor: true, children: "RESOURCE" }) })] }), matchSlots.map((entry, visibleIndex) => {
                        const index = viewportStart + visibleIndex;
                        const isSelected = entry !== undefined && index === selectedIndex;
                        return (_jsxs(Box, { height: 1, columnGap: 1, children: [_jsx(Box, { width: 2, children: _jsx(Text, { ...(isSelected ? { color: "cyan" } : {}), children: isSelected ? "❯ " : "  " }) }), _jsx(Box, { width: apiWidth, children: _jsx(Text, { color: isSelected ? "cyan" : "white", wrap: "truncate-end", children: entry?.displayName ?? " " }) }), _jsx(Box, { width: modeWidth, children: _jsx(Text, { dimColor: true, children: entry?.mode.toUpperCase() ?? " " }) }), _jsx(Box, { width: serviceWidth, children: _jsx(Text, { dimColor: true, wrap: "truncate-end", children: entry?.serviceTitle ?? " " }) }), _jsx(Box, { width: resourceWidth, children: _jsx(Text, { dimColor: true, wrap: "truncate-end", children: entry
                                            ? (entry.resourceNames ?? [entry.resourceName]).join(", ")
                                            : " " }) })] }, entry?.id ?? `empty-${visibleIndex}`));
                    }), _jsxs(Text, { dimColor: true, wrap: "truncate-end", children: [selectedSummary, " \u00B7 ", matches.length, " match", matches.length === 1 ? "" : "es", " \u00B7", " ", selected ? `${selectedIndex + 1} selected` : "0 selected", viewportStart > 0 ? ` · ${viewportStart} above` : "", viewportEnd < matches.length
                                ? ` · ${matches.length - viewportEnd} below`
                                : ""] })] })] }));
}
//# sourceMappingURL=SearchScreen.js.map