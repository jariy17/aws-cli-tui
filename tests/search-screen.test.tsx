import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it } from "vitest";

import { SmithyCatalog } from "../src/model/catalog.js";
import type { Catalog, OperationEntry } from "../src/model/types.js";
import { DebugProvider } from "../src/tui/debug.js";
import { SearchScreen } from "../src/tui/screens/SearchScreen.js";

const entry: OperationEntry = {
  id: "agentcore:ListAgentRuntimes",
  mode: "list",
  operationName: "ListAgentRuntimes",
  displayName: "List agent runtimes",
  resourceName: "Agent runtimes",
  resourceNames: ["Agent runtime"],
  searchKeys: ["listagentruntimes", "agentruntimes", "agentruntime"],
  serviceId: "example#Service",
  serviceTitle: "Amazon Bedrock AgentCore Control",
  serviceCliName: "bedrock-agentcore-control",
  serviceVersion: "2023-06-05",
  inputFields: [],
  documentation: "Long operation documentation. ".repeat(80),
};

function catalog(): SmithyCatalog {
  const value: Catalog = {
    generatedAt: "2026-09-15T00:00:00.000Z",
    source: {
      repository: "https://github.com/aws/api-models-aws",
      commit: "abc123",
    },
    operationCount: 1,
    operations: [entry],
  };
  return new SmithyCatalog(value);
}

describe("SearchScreen", () => {
  it("shows the service for every matching operation", async () => {
    const screen = render(
      <SearchScreen
        catalog={catalog()}
        initialMode="list"
        onSelect={() => {}}
      />,
    );
    const emptyFrame = screen.lastFrame()!;

    expect(emptyFrame).toContain("API");
    expect(emptyFrame).toContain("MODE");
    expect(emptyFrame).toContain("SERVICE");
    expect(emptyFrame).toContain("RESOURCE");
    expect(emptyFrame).toContain(
      "No API selected · Required inputs — · Pagination —",
    );
    expect(emptyFrame.match(/┌/g) ?? []).toHaveLength(1);

    screen.stdin.write("agentruntime");
    await new Promise((resolve) => setTimeout(resolve, 20));

    const populatedFrame = screen.lastFrame()!;
    expect(populatedFrame).toContain("List agent runtimes");
    expect(populatedFrame).toContain("LIST");
    expect(populatedFrame).toContain("Amazon Bedrock AgentCore Control");
    expect(populatedFrame).toContain("Agent runtime");
    expect(populatedFrame).toContain("service:x · resource:x");
    expect(populatedFrame).toContain(
      "ListAgentRuntimes · No required inputs · Single response",
    );
    expect(populatedFrame).not.toContain("Long operation documentation");
    expect(populatedFrame).not.toContain("╭");
    expect(populatedFrame.split("\n")).toHaveLength(
      emptyFrame.split("\n").length,
    );
    expect(populatedFrame.split("\n").length).toBeLessThanOrEqual(24);
  });

  it("toggles the hidden debug line with Ctrl+G without editing the query", async () => {
    const screen = render(
      <DebugProvider>
        <SearchScreen
          catalog={catalog()}
          initialMode="list"
          onSelect={() => {}}
        />
      </DebugProvider>,
    );

    screen.stdin.write("\u0007");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.lastFrame()).toContain(
      "DEBUG · No AWS CLI command has run yet.",
    );
    expect(screen.lastFrame()).toContain("agentruntime");
  });

  it("accepts a no-space resource: scoped query", async () => {
    const screen = render(
      <SearchScreen
        catalog={catalog()}
        initialMode="list"
        onSelect={() => {}}
      />,
    );

    screen.stdin.write("resource:agentruntmie");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.lastFrame()).toContain("resource:agentruntmie");
    expect(screen.lastFrame()).toContain("List agent runtimes");
    expect(screen.lastFrame()).toContain("RESOURCE");
  });
});
