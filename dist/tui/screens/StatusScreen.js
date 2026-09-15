import { jsx as _jsx } from "react/jsx-runtime";
import { Text, useApp, useInput } from "ink";
import { Frame } from "../components/Frame.js";
export function StatusScreen({ title, message, error = false, onBack, }) {
    const { exit } = useApp();
    useInput((input, key) => {
        if (key.ctrl && input === "q")
            exit();
        else if (key.escape)
            onBack?.();
    });
    return (_jsx(Frame, { title: title, help: onBack ? "Esc back · Ctrl+Q quit" : "Ctrl+Q quit", children: _jsx(Text, { color: error ? "red" : "cyan", children: message }) }));
}
//# sourceMappingURL=StatusScreen.js.map