import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text, useInput, useStdout } from "ink";
import { useEffect, useMemo, useState } from "react";
import { Frame, frameHeaderHeight } from "../components/Frame.js";
import { TableView } from "../components/TableView.js";
import { HELP } from "../constants.js";
import { fuzzyFilterRows } from "../../rendering/projector.js";
import { formatOperationContext, formatResourcePath, rootResourcePath, } from "../resource-route.js";
export function PageScreen({ pages, pageIndex, loading, resourcePath, onNext, onPrevious, onBack, onDetail, onConfigure, }) {
    const { stdout } = useStdout();
    const page = pages[pageIndex];
    const title = formatResourcePath(resourcePath ?? rootResourcePath(page.entry));
    const finalPageLoaded = pages.at(-1)?.nextToken === undefined;
    const metadata = `${page.entry.serviceTitle} · Page ${pageIndex + 1}/${finalPageLoaded ? pages.length : "?"}`;
    const context = formatOperationContext(page.entry, page.input);
    const visibleRowCount = Math.max(1, (stdout?.rows ?? 24) -
        frameHeaderHeight(stdout?.columns ?? 80, title, metadata, context) -
        5);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [filterQuery, setFilterQuery] = useState("");
    const [filterActive, setFilterActive] = useState(false);
    const filteredRows = useMemo(() => fuzzyFilterRows(page.rows, filterQuery), [filterQuery, page.rows]);
    useEffect(() => {
        setSelectedIndex(0);
        setFilterQuery("");
        setFilterActive(false);
    }, [pageIndex]);
    useEffect(() => setSelectedIndex(0), [filterQuery]);
    useInput((input, key) => {
        if (filterActive) {
            if (key.escape) {
                setFilterQuery("");
                setFilterActive(false);
                return;
            }
            if (key.return) {
                setFilterActive(false);
                return;
            }
            if (key.backspace || key.delete) {
                setFilterQuery((value) => value.slice(0, -1));
                return;
            }
            if (input && !key.ctrl) {
                setFilterQuery((value) => `${value}${input}`);
            }
            return;
        }
        if (input.startsWith("/")) {
            setFilterActive(true);
            setFilterQuery(input.slice(1));
            return;
        }
        if (input.toLowerCase() === "e" && onConfigure) {
            onConfigure();
            return;
        }
        if (key.escape) {
            if (filterQuery) {
                setFilterQuery("");
                return;
            }
            onBack();
            return;
        }
        if (key.upArrow && filteredRows.length > 0) {
            setSelectedIndex((index) => (index - 1 + filteredRows.length) % filteredRows.length);
            return;
        }
        if (key.downArrow && filteredRows.length > 0) {
            setSelectedIndex((index) => (index + 1) % filteredRows.length);
            return;
        }
        if (key.rightArrow &&
            !loading &&
            (pageIndex + 1 < pages.length || page.nextToken !== undefined)) {
            onNext();
            return;
        }
        if (key.leftArrow && !loading && pageIndex > 0) {
            onPrevious();
            return;
        }
        if (key.return && filteredRows[selectedIndex] !== undefined) {
            onDetail(filteredRows[selectedIndex]);
        }
    });
    return (_jsxs(Frame, { title: title, metadata: metadata, context: context, help: onConfigure ? HELP.configurablePages : HELP.pages, children: [_jsxs(Box, { children: [_jsx(Text, { color: "cyan", children: "/ " }), _jsx(Text, { children: filterQuery }), filterActive && _jsx(Text, { inverse: true, children: " " }), _jsx(Text, { dimColor: true, wrap: "truncate-end", children: filterActive
                            ? " fuzzy search this API page · Enter apply · Esc clear"
                            : filterQuery
                                ? ` ${filteredRows.length}/${page.rows.length} rows · / edit · Esc clear`
                                : " press / to fuzzy search this API page" })] }), _jsx(TableView, { rows: filteredRows, selectedIndex: selectedIndex, visibleRowCount: visibleRowCount, emptyMessage: filterQuery
                    ? `No rows match "${filterQuery}".`
                    : `No ${page.entry.resourceName.toLowerCase()} returned by ${page.entry.operationName}.` }), _jsxs(Text, { dimColor: true, wrap: "truncate-end", children: [page.entry.operationName, " \u00B7 Page ", pageIndex + 1, " \u00B7", " ", filteredRows.length, "/", page.rows.length, " rows \u00B7", " ", loading
                        ? "Loading…"
                        : page.nextToken !== undefined
                            ? "Next page available"
                            : "Final page"] })] }));
}
//# sourceMappingURL=PageScreen.js.map