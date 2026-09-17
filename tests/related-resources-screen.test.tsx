import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { RelatedResource } from "../src/model/catalog.js";
import type { OperationEntry } from "../src/model/types.js";
import { RelatedResourcesScreen } from "../src/tui/screens/RelatedResourcesScreen.js";

function operation(
  operationName: string,
  resourceName: string,
): OperationEntry {
  return {
    id: `agentcore:${operationName}`,
    mode: "list",
    action: "LIST",
    supported: true,
    operationName,
    displayName: operationName,
    resourceName,
    searchKeys: [operationName.toLowerCase()],
    serviceId: "example#Service",
    serviceTitle: "Amazon Bedrock AgentCore",
    serviceCliName: "bedrock-agentcore",
    serviceVersion: "2024-02-28",
    inputFields: [],
  };
}

const relations: RelatedResource[] = [
  {
    entry: operation("ListMemoryRecords", "Memory records"),
    resourceName: "Memory records",
    source: "inferred",
    input: { memoryId: "memory-1" },
    inheritedFields: ["memoryId"],
    missingRequired: [],
    remainingInputs: 5,
  },
  {
    entry: operation("ListEvents", "Events"),
    resourceName: "Events",
    source: "inferred",
    input: { memoryId: "memory-1" },
    inheritedFields: ["memoryId"],
    missingRequired: ["sessionId", "actorId"],
    remainingInputs: 5,
  },
];

describe("RelatedResourcesScreen", () => {
  it("shows inherited and missing inputs and opens the selected child", async () => {
    const onSelect = vi.fn();
    const screen = render(
      <RelatedResourcesScreen
        parentName="Memory"
        relations={relations}
        onSelect={onSelect}
        onBack={() => {}}
      />,
    );

    expect(screen.lastFrame()).toContain("RELATED RESOURCES");
    expect(screen.lastFrame()).toContain("ListMemoryRecords");
    expect(screen.lastFrame()).toContain("memoryId ✓");
    expect(screen.lastFrame()).toContain("5 optional");

    screen.stdin.write("/events");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.lastFrame()).toContain("ListEvents");
    expect(screen.lastFrame()).not.toContain("ListMemoryRecords");
    screen.unmount();

    const selectedScreen = render(
      <RelatedResourcesScreen
        parentName="Memory"
        relations={[relations[1]!]}
        onSelect={onSelect}
        onBack={() => {}}
      />,
    );
    selectedScreen.stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onSelect).toHaveBeenCalledWith(relations[1]);
  });
});
