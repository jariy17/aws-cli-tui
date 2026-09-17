import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text, useInput, useStdout } from "ink";
import { useMemo, useState } from "react";
import { scoreFuzzyText } from "../../search/fuzzy.js";
import { Frame, frameHeaderHeight } from "../components/Frame.js";
import { HELP } from "../constants.js";
import { formatResourcePath } from "../resource-route.js";
function inputSummary(relation) {
    const inherited = relation.inheritedFields.length > 0
        ? `${relation.inheritedFields.join(", ")} ✓`
        : "None inherited";
    if (relation.missingRequired.length > 0) {
        return `${inherited} · Need ${relation.missingRequired.join(", ")}`;
    }
    if (relation.remainingInputs > 0) {
        return `${inherited} · ${relation.remainingInputs} optional`;
    }
    return inherited;
}
export function RelatedResourcesScreen({ parentName, relations, resourcePath, context, onSelect, onBack, }) {
    const { stdout } = useStdout();
    const terminalWidth = stdout?.columns ?? 80;
    const terminalHeight = stdout?.rows ?? 24;
    const title = formatResourcePath([
        ...(resourcePath ?? [parentName]),
        "RELATED RESOURCES",
    ]);
    const metadata = `${relations.length} available`;
    const resourceWidth = Math.max(14, Math.floor(terminalWidth * 0.22));
    const apiWidth = Math.max(18, Math.floor(terminalWidth * 0.25));
    const inputWidth = Math.max(18, Math.floor(terminalWidth * 0.25));
    const serviceWidth = Math.max(14, terminalWidth - resourceWidth - apiWidth - inputWidth - 8);
    const visibleCount = Math.max(1, terminalHeight -
        frameHeaderHeight(terminalWidth, title, metadata, context) -
        5);
    const [filterQuery, setFilterQuery] = useState("");
    const [filterActive, setFilterActive] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [pageIndex, setPageIndex] = useState(0);
    const filteredRelations = useMemo(() => {
        if (!filterQuery)
            return relations;
        return relations
            .map((relation, index) => {
            const values = [
                relation.resourceName,
                relation.entry.operationName,
                relation.entry.serviceTitle,
            ];
            const scores = values
                .map((value) => scoreFuzzyText(value, filterQuery))
                .filter((score) => score !== undefined);
            return {
                relation,
                index,
                score: scores.length > 0 ? Math.min(...scores) : undefined,
            };
        })
            .filter((result) => result.score !== undefined)
            .sort((left, right) => left.score - right.score || left.index - right.index)
            .map((result) => result.relation);
    }, [filterQuery, relations]);
    const pageCount = Math.max(1, Math.ceil(filteredRelations.length / visibleCount));
    const currentPage = Math.min(pageIndex, pageCount - 1);
    const pageStart = currentPage * visibleCount;
    const visible = filteredRelations.slice(pageStart, pageStart + visibleCount);
    const selected = visible[selectedIndex];
    const slots = Array.from({ length: visibleCount }, (_, index) => visible[index]);
    useInput((input, key) => {
        if (filterActive) {
            if (key.escape) {
                setFilterQuery("");
                setFilterActive(false);
                setSelectedIndex(0);
                setPageIndex(0);
                return;
            }
            if (key.return) {
                setFilterActive(false);
                return;
            }
            if (key.backspace || key.delete) {
                setFilterQuery((value) => value.slice(0, -1));
                setSelectedIndex(0);
                setPageIndex(0);
                return;
            }
            if (input && !key.ctrl) {
                setFilterQuery((value) => `${value}${input}`);
                setSelectedIndex(0);
                setPageIndex(0);
            }
            return;
        }
        if (input.startsWith("/")) {
            setFilterActive(true);
            setFilterQuery(input.slice(1));
            setSelectedIndex(0);
            setPageIndex(0);
            return;
        }
        if (key.escape) {
            if (filterQuery) {
                setFilterQuery("");
                setSelectedIndex(0);
                setPageIndex(0);
                return;
            }
            onBack();
            return;
        }
        if (key.upArrow && visible.length > 0) {
            setSelectedIndex((index) => (index - 1 + visible.length) % visible.length);
            return;
        }
        if (key.downArrow && visible.length > 0) {
            setSelectedIndex((index) => (index + 1) % visible.length);
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
        if (key.return && selected)
            onSelect(selected);
    });
    return (_jsx(Frame, { title: title, metadata: metadata, ...(context ? { context } : {}), help: HELP.related, children: _jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Text, { color: "cyan", children: "/ " }), _jsx(Text, { children: filterQuery }), filterActive && _jsx(Text, { inverse: true, children: " " }), _jsx(Text, { dimColor: true, wrap: "truncate-end", children: filterActive
                                ? " fuzzy filter related resources · Enter apply · Esc clear"
                                : filterQuery
                                    ? ` ${filteredRelations.length}/${relations.length} matches · / edit`
                                    : " press / to filter related resources" })] }), _jsxs(Box, { columnGap: 1, children: [_jsx(Box, { width: 2, children: _jsx(Text, { children: " " }) }), _jsx(Box, { width: resourceWidth, children: _jsx(Text, { bold: true, dimColor: true, children: "RESOURCE" }) }), _jsx(Box, { width: apiWidth, children: _jsx(Text, { bold: true, dimColor: true, children: "API" }) }), _jsx(Box, { width: serviceWidth, children: _jsx(Text, { bold: true, dimColor: true, children: "SERVICE" }) }), _jsx(Box, { width: inputWidth, children: _jsx(Text, { bold: true, dimColor: true, children: "INPUTS" }) })] }), slots.map((relation, visibleIndex) => {
                    const isSelected = relation !== undefined && visibleIndex === selectedIndex;
                    return (_jsxs(Box, { height: 1, columnGap: 1, children: [_jsx(Box, { width: 2, children: _jsx(Text, { color: isSelected ? "cyan" : "white", children: isSelected ? "❯ " : "  " }) }), _jsx(Box, { width: resourceWidth, children: _jsx(Text, { color: isSelected ? "cyan" : "white", wrap: "truncate-end", children: relation?.resourceName ?? " " }) }), _jsx(Box, { width: apiWidth, children: _jsx(Text, { dimColor: true, wrap: "truncate-end", children: relation?.entry.operationName ?? " " }) }), _jsx(Box, { width: serviceWidth, children: _jsx(Text, { dimColor: true, wrap: "truncate-end", children: relation?.entry.serviceTitle ?? " " }) }), _jsx(Box, { width: inputWidth, children: _jsx(Text, { dimColor: true, wrap: "truncate-end", children: relation ? inputSummary(relation) : " " }) })] }, relation?.entry.id ?? `empty-${visibleIndex}`));
                }), _jsxs(Text, { dimColor: true, wrap: "truncate-end", children: [selected
                            ? `${selected.source === "smithy" ? "Smithy child resource" : "Compatible modeled collection"} · ${inputSummary(selected)}`
                            : "No related List APIs found", filteredRelations.length > 0
                            ? ` · Page ${currentPage + 1}/${pageCount}`
                            : " · Page 0/0"] })] }) }));
}
//# sourceMappingURL=RelatedResourcesScreen.js.map