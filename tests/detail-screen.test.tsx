import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { DetailScreen } from "../src/tui/screens/DetailScreen.js";
import type { OperationEntry } from "../src/model/types.js";

const entry: OperationEntry = {
  id: "agentcore:GetAgentRuntime",
  mode: "get",
  action: "GET",
  supported: true,
  operationName: "GetAgentRuntime",
  displayName: "Get agent runtime",
  resourceName: "Agent runtime",
  searchKeys: ["getagentruntime"],
  serviceId: "example#Service",
  serviceTitle: "Amazon Bedrock AgentCore Control",
  serviceCliName: "bedrock-agentcore-control",
  serviceVersion: "2023-06-05",
  inputFields: [],
};

describe("DetailScreen", () => {
  it("shows prettified JSON without the equivalent command and opens ARN values", async () => {
    const onOpenArn = vi.fn();
    const onRelated = vi.fn();
    const onCheckArn = vi.fn(
      async (occurrence: { key?: string }) => occurrence.key === "roleArn",
    );
    const screen = render(
      <DetailScreen
        detail={{
          entry,
          value: {
            agentRuntimeId: "runtime-1",
            roleArn: "arn:aws:iam::123456789012:role/TestRole",
            IndexArn:
              "arn:aws:dynamodb:us-west-2:123456789012:table/Example/index/MyIndex",
          },
          source: "get response",
        }}
        onBack={() => {}}
        onCheckArn={onCheckArn}
        onOpenArn={onOpenArn}
        relatedCount={2}
        onRelated={onRelated}
      />,
    );

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.lastFrame()).toContain("Amazon Bedrock AgentCore Control");
    expect(screen.lastFrame()).toContain("Full resource");
    expect(screen.lastFrame()).toContain("GetAgentRuntime");
    expect(screen.lastFrame()).toContain('"agentRuntimeId": "runtime-1"');
    expect(screen.lastFrame()).toContain(
      "arn:aws:iam::123456789012:role/TestRole",
    );
    expect(screen.lastFrame()).toContain(
      "arn:aws:dynamodb:us-west-2:123456789012:table/Example/index/MyIndex",
    );
    expect(screen.lastFrame()).toContain("Entry 1/4");
    expect(screen.lastFrame()).toContain("Related resources (2)");
    expect(screen.lastFrame()).toContain("R Related");
    expect(screen.lastFrame()).not.toContain("Equivalent command");

    screen.stdin.write("r");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onRelated).toHaveBeenCalledOnce();
    onRelated.mockClear();

    screen.stdin.write("\u001B[B");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.lastFrame()).toContain("Entry 2/4 · Enter open ARN");
    screen.stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onOpenArn).toHaveBeenCalledWith({
      arn: "arn:aws:iam::123456789012:role/TestRole",
      key: "roleArn",
    });

    screen.stdin.write("\u001B[B");
    await new Promise((resolve) => setTimeout(resolve, 20));
    screen.stdin.write("\u001B[B");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.lastFrame()).toContain("Enter open related resources");
    screen.stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onRelated).toHaveBeenCalledOnce();
  });

  it("labels fallback JSON as a list entry", () => {
    const screen = render(
      <DetailScreen
        detail={{
          entry,
          value: { agentRuntimeId: "runtime-1", status: "READY" },
          source: "list row",
        }}
        resourcePath={["Agent runtimes", "runtime-1"]}
        onBack={() => {}}
        onCheckArn={async () => false}
        onOpenArn={() => {}}
      />,
    );

    expect(screen.lastFrame()).toContain("Agent runtimes › runtime-1");
    expect(screen.lastFrame()).toContain("List entry");
    expect(screen.lastFrame()).toContain('"status": "READY"');
  });
});
