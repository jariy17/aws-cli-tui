import { jsx as _jsx } from "react/jsx-runtime";
import { useInput } from "ink";
import { createContext, useContext, useMemo, useState, } from "react";
const DebugContext = createContext({
    visible: false,
    command: undefined,
    setCommand: () => { },
});
export function DebugProvider({ children }) {
    const [visible, setVisible] = useState(false);
    const [command, setCommand] = useState();
    useInput((input, key) => {
        if (key.ctrl && input === "g") {
            setVisible((current) => !current);
        }
    });
    const value = useMemo(() => ({ visible, command, setCommand }), [command, visible]);
    return (_jsx(DebugContext.Provider, { value: value, children: children }));
}
export function useDebug() {
    return useContext(DebugContext);
}
//# sourceMappingURL=debug.js.map