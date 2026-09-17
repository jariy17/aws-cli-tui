import { jsx as _jsx } from "react/jsx-runtime";
import { Text, useInput } from "ink";
import { Frame } from "../components/Frame.js";
export function StatusScreen({ title, message, error = false, onBack, }) {
    useInput((_input, key) => {
        if (key.escape)
            onBack?.();
    });
    return (_jsx(Frame, { title: title, help: onBack ? "Esc Back" : "Working…", children: _jsx(Text, { color: error ? "red" : "cyan", children: message }) }));
}
//# sourceMappingURL=StatusScreen.js.map