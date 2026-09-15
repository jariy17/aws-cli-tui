import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text, useApp, useInput } from "ink";
import { useState } from "react";
import { Frame } from "../components/Frame.js";
import { HELP } from "../constants.js";
export function InputScreen({ entry, onSubmit, onBack, }) {
    const { exit } = useApp();
    const fields = entry.inputFields.filter((field) => field.required);
    const [fieldIndex, setFieldIndex] = useState(0);
    const [value, setValue] = useState("");
    const [inputValues, setInputValues] = useState({});
    const field = fields[fieldIndex];
    useInput((input, key) => {
        if (key.ctrl && input === "q") {
            exit();
            return;
        }
        if (key.ctrl)
            return;
        if (key.escape) {
            onBack();
            return;
        }
        if (key.backspace || key.delete) {
            setValue((current) => current.slice(0, -1));
            return;
        }
        if (key.return && field && value) {
            const nextValues = { ...inputValues, [field.name]: value };
            if (fieldIndex === fields.length - 1) {
                onSubmit(nextValues);
            }
            else {
                setInputValues(nextValues);
                setFieldIndex((index) => index + 1);
                setValue("");
            }
            return;
        }
        if (input)
            setValue((current) => current + input);
    });
    if (!field)
        return null;
    return (_jsxs(Frame, { title: entry.displayName, metadata: `${entry.serviceTitle} · ${fieldIndex + 1}/${fields.length}`, help: HELP.input, children: [_jsx(Text, { bold: true, children: field.name }), _jsxs(Text, { dimColor: true, children: [field.type, field.documentation ? ` · ${field.documentation}` : ""] }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "cyan", children: "> " }), _jsx(Text, { children: field.sensitive ? "*".repeat(value.length) : value }), _jsx(Text, { inverse: true, children: " " })] })] }));
}
//# sourceMappingURL=InputScreen.js.map