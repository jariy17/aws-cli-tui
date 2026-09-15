import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { PageResult } from "../src/execution/types.js";
import type { OperationEntry } from "../src/model/types.js";
import { PageScreen } from "../src/tui/screens/PageScreen.js";

const entry: OperationEntry = {
  id: "agentcore:ListAgentRuntimes",
  mode: "list",
  operationName: "ListAgentRuntimes",
  displayName: "List agent runtimes",
  resourceName: "Agent runtimes",
  searchKeys: ["listagentruntimes"],
  serviceId: "example#Service",
  serviceTitle: "Amazon Bedrock AgentCore Control",
  serviceCliName: "bedrock-agentcore-control",
  serviceVersion: "2023-06-05",
  inputFields: [],
};

const page: PageResult = {
  entry,
  input: {},
  output: {},
  rows: [
    { agentRuntimeName: "research-agent", status: "READY" },
    { agentRuntimeName: "invoice-reader", status: "UPDATING" },
  ],
  command: "aws bedrock-agentcore-control list-agent-runtimes",
  durationMs: 42,
};

describe("PageScreen", () => {
  it("fuzzy filters only the loaded page and opens the filtered row", async () => {
    const onDetail = vi.fn();
    const screen = render(
      <PageScreen
        pages={[page]}
        pageIndex={0}
        loading={false}
        onNext={() => {}}
        onPrevious={() => {}}
        onBack={() => {}}
        onDetail={onDetail}
      />,
    );
    const unfilteredFrame = screen.lastFrame()!;

    screen.stdin.write("/reserchagent");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.lastFrame()).toContain("research-agent");
    expect(screen.lastFrame()).not.toContain("invoice-reader");
    expect(screen.lastFrame()).toContain("1/2 rows");
    expect(screen.lastFrame()!.split("\n")).toHaveLength(
      unfilteredFrame.split("\n").length,
    );
    expect(screen.lastFrame()!.split("\n").length).toBeLessThanOrEqual(24);

    screen.stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 20));
    screen.stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onDetail).toHaveBeenCalledWith(page.rows[0]);
  });
});
