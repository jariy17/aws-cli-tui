import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text, useStdout } from "ink";
import { displayValue, projectTable } from "../../rendering/projector.js";
function truncate(value, width) {
    if (value.length <= width)
        return value;
    return `${value.slice(0, Math.max(1, width - 1))}…`;
}
export function TableView({ rows, selectedIndex, visibleRowCount, emptyMessage = "No resources returned.", }) {
    const { stdout } = useStdout();
    if (rows.length === 0) {
        return (_jsx(Box, { height: visibleRowCount + 1, paddingLeft: 2, children: _jsx(Text, { dimColor: true, children: emptyMessage }) }));
    }
    const terminalWidth = stdout?.columns ?? 100;
    const table = projectTable(rows, terminalWidth < 90 ? 3 : 5);
    const contentWidth = Math.max(30, terminalWidth - 8);
    const markerWidth = 2;
    const columnWidth = Math.max(10, Math.floor((contentWidth - markerWidth) / table.columns.length));
    const viewportStart = Math.max(0, Math.min(selectedIndex - Math.floor(visibleRowCount / 2), table.rows.length - visibleRowCount));
    const viewportEnd = Math.min(table.rows.length, viewportStart + visibleRowCount);
    const visibleRows = table.rows.slice(viewportStart, viewportEnd);
    const rowSlots = Array.from({ length: visibleRowCount }, (_, index) => visibleRows[index]);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { children: [_jsx(Box, { width: markerWidth, children: _jsx(Text, { children: " " }) }), table.columns.map((column) => (_jsx(Box, { width: columnWidth, children: _jsx(Text, { bold: true, dimColor: true, children: truncate(column, columnWidth - 1) }) }, column)))] }), rowSlots.map((row, index) => {
                const actualIndex = viewportStart + index;
                const selected = row !== undefined && actualIndex === selectedIndex;
                return (_jsxs(Box, { height: 1, children: [_jsx(Box, { width: markerWidth, children: _jsx(Text, { color: selected ? "cyan" : "white", children: selected ? "❯ " : "  " }) }), table.columns.map((column) => (_jsx(Box, { width: columnWidth, children: _jsx(Text, { color: selected ? "cyan" : "white", children: row === undefined
                                    ? " "
                                    : truncate(displayValue(row[column]), columnWidth - 1) }) }, column)))] }, row === undefined ? `empty-${index}` : actualIndex));
            })] }));
}
//# sourceMappingURL=TableView.js.map