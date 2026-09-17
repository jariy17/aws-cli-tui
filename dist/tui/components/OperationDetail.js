import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { COLORS } from "../constants.js";
function Field({ label, value, labelWidth, }) {
    return (_jsxs(Box, { children: [_jsx(Box, { width: labelWidth, flexShrink: 0, children: _jsx(Text, { dimColor: true, children: label }) }), _jsx(Box, { flexGrow: 1, children: _jsx(Text, { wrap: "truncate-end", children: value }) })] }));
}
export function OperationDetail({ entry, }) {
    const labelWidth = 16;
    const requiredInputs = entry?.inputFields
        .filter((field) => field.required)
        .map((field) => field.name)
        .join(", ") || "None";
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, wrap: "truncate-end", ...(entry ? { color: COLORS.action } : {}), children: entry?.displayName ?? "Selected API" }), _jsx(Text, { children: " " }), _jsx(Field, { label: "Service", value: entry?.serviceTitle ?? "—", labelWidth: labelWidth }), _jsx(Field, { label: "Service command", value: entry?.serviceCliName ?? "—", labelWidth: labelWidth }), _jsx(Field, { label: "API operation", value: entry?.operationName ?? "—", labelWidth: labelWidth }), _jsx(Field, { label: "Action", value: entry?.action ?? "—", labelWidth: labelWidth }), _jsx(Field, { label: "Support", value: entry
                    ? entry.supported
                        ? "Supported"
                        : (entry.unsupportedReason ?? "Unsupported")
                    : "—", labelWidth: labelWidth }), _jsx(Field, { label: "Required inputs", value: entry ? requiredInputs : "—", labelWidth: labelWidth }), _jsx(Field, { label: "Pagination", value: entry ? (entry.pagination ? "Page by page" : "Single response") : "—", labelWidth: labelWidth })] }));
}
//# sourceMappingURL=OperationDetail.js.map