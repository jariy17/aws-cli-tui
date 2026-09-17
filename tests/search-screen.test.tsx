import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { SmithyCatalog } from "../src/model/catalog.js";
import type { Catalog, OperationEntry } from "../src/model/types.js";
import { DebugProvider } from "../src/tui/debug.js";
import { SearchScreen } from "../src/tui/screens/SearchScreen.js";

const entry: OperationEntry = {
  id: "agentcore:ListAgentRuntimes",
  mode: "list",
  action: "LIST",
  supported: true,
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

function catalogWithUnsupported(): SmithyCatalog {
  const unsupported: OperationEntry = {
    ...entry,
    id: "agentcore:CreateAgentRuntime",
    mode: "unsupported",
    action: "CREATE",
    supported: false,
    unsupportedReason: "Only List, Get, and Describe operations are supported.",
    operationName: "CreateAgentRuntime",
    displayName: "Create agent runtime",
    resourceName: "Agent runtime",
    searchKeys: ["createagentruntime", "agentruntime"],
  };
  const value: Catalog = {
    generatedAt: "2026-09-15T00:00:00.000Z",
    source: {
      repository: "https://github.com/aws/api-models-aws",
      commit: "abc123",
    },
    operationCount: 2,
    operations: [entry, unsupported],
  };
  return new SmithyCatalog(value);
}

function paginatedCatalog(): SmithyCatalog {
  const operations = Array.from({ length: 40 }, (_, index) => ({
    ...entry,
    id: `example:ListThing${String(index).padStart(2, "0")}`,
    operationName: `ListThing${String(index).padStart(2, "0")}`,
    displayName: `List thing ${String(index).padStart(2, "0")}`,
    resourceName: `Thing ${String(index).padStart(2, "0")}`,
    searchKeys: ["thing"],
  }));
  return new SmithyCatalog({
    generatedAt: "2026-09-15T00:00:00.000Z",
    source: {
      repository: "https://github.com/aws/api-models-aws",
      commit: "abc123",
    },
    operationCount: operations.length,
    operations,
  });
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
    expect(emptyFrame).toContain("ACTION");
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

  it("shows unsupported actions but does not run them", async () => {
    const onSelect = vi.fn();
    const screen = render(
      <SearchScreen catalog={catalogWithUnsupported()} onSelect={onSelect} />,
    );

    screen.stdin.write("createagentruntime");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.lastFrame()).toContain("Create agent runtime");
    expect(screen.lastFrame()).toContain("CREATE");
    expect(screen.lastFrame()).toContain("Unsupported");
    screen.stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("pages through every API matching the homepage filter", async () => {
    const screen = render(
      <SearchScreen catalog={paginatedCatalog()} onSelect={() => {}} />,
    );

    screen.stdin.write("thing");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.lastFrame()).toContain("40 matches");
    expect(screen.lastFrame()).toContain("Page 1/3");
    expect(screen.lastFrame()).toContain("List thing 00");
    expect(screen.lastFrame()).not.toContain("List thing 15");

    screen.stdin.write("\u001B[C");
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(screen.lastFrame()).toContain("Page 2/3");
    expect(screen.lastFrame()).toContain("List thing 15");
    expect(screen.lastFrame()).not.toContain("List thing 00");
  });
});
