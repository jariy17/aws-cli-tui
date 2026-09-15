import { render } from "ink";
import React from "react";

import type { AwsContext } from "../execution/types.js";
import { SmithyCatalog } from "../model/catalog.js";
import type { OperationMode } from "../model/types.js";
import { App } from "./App.js";
import { DebugProvider } from "./debug.js";

export async function renderTui({
  context,
  mode,
}: {
  context: AwsContext;
  mode?: OperationMode;
}): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Interactive mode requires a TTY. Provide a search token for JSON output.",
    );
  }
  const catalog = await SmithyCatalog.load();
  const instance = render(
    <DebugProvider>
      <App
        catalog={catalog}
        context={context}
        {...(mode ? { initialMode: mode } : {})}
      />
    </DebugProvider>,
  );
  await instance.waitUntilExit();
}
