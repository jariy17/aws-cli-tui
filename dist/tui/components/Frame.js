import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text, useStdout } from "ink";
import { COLORS } from "../constants.js";
import { useDebug } from "../debug.js";
export function frameHeaderHeight(columns, title, metadata) {
    const titleText = `>_ AWS TUI · ${title}`;
    return metadata !== undefined &&
        titleText.length + metadata.length + 9 > columns
        ? 4
        : 3;
}
export function Frame({ title, metadata, help, children, }) {
    const { stdout } = useStdout();
    const debug = useDebug();
    const columns = stdout?.columns ?? 80;
    const titleText = `>_ AWS TUI · ${title}`;
    const stackHeader = frameHeaderHeight(columns, title, metadata) === 4;
    return (_jsxs(Box, { flexDirection: "column", width: "100%", children: [_jsxs(Box, { borderStyle: "single", borderColor: COLORS.accent, paddingX: 1, flexDirection: stackHeader ? "column" : "row", justifyContent: stackHeader ? "flex-start" : "space-between", width: "100%", children: [_jsx(Text, { bold: true, color: COLORS.accent, wrap: "truncate-end", children: titleText }), metadata && (_jsx(Text, { dimColor: true, wrap: "truncate-end", children: metadata }))] }), _jsx(Box, { flexDirection: "column", paddingX: 1, children: children }), _jsx(Box, { paddingX: 1, children: _jsx(Text, { dimColor: true, wrap: "truncate-end", children: help }) }), _jsx(Box, { paddingX: 1, height: 1, children: debug.visible && (_jsxs(Text, { color: "yellow", wrap: "truncate-end", children: ["DEBUG \u00B7 ", debug.command ?? "No AWS CLI command has run yet."] })) })] }));
}
//# sourceMappingURL=Frame.js.map