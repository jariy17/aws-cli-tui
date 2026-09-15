import { jsx as _jsx } from "react/jsx-runtime";
import { render } from "ink";
import { SmithyCatalog } from "../model/catalog.js";
import { App } from "./App.js";
import { DebugProvider } from "./debug.js";
export async function renderTui({ context, mode, }) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw new Error("Interactive mode requires a TTY. Provide a search token for JSON output.");
    }
    const catalog = await SmithyCatalog.load();
    const instance = render(_jsx(DebugProvider, { children: _jsx(App, { catalog: catalog, context: context, ...(mode ? { initialMode: mode } : {}) }) }));
    await instance.waitUntilExit();
}
//# sourceMappingURL=render.js.map