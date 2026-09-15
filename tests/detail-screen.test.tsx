import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { DetailScreen } from "../src/tui/screens/DetailScreen.js";
import type { OperationEntry } from "../src/model/types.js";

const entry: OperationEntry = {
  id: "agentcore:GetAgentRuntime",
  mode: "get",
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
      />,
    );

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.lastFrame()).toContain("Amazon Bedrock AgentCore Control");
    expect(screen.lastFrame()).toContain("GetAgentRuntime");
    expect(screen.lastFrame()).toContain('"agentRuntimeId": "runtime-1"');
    expect(screen.lastFrame()).toContain(
      "arn:aws:iam::123456789012:role/TestRole",
    );
    expect(screen.lastFrame()).toContain(
      "arn:aws:dynamodb:us-west-2:123456789012:table/Example/index/MyIndex",
    );
    expect(screen.lastFrame()).toContain("Entry 1/3");
    expect(screen.lastFrame()).not.toContain("Equivalent command");

    screen.stdin.write("\u001B[B");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.lastFrame()).toContain("Entry 2/3 · Enter open ARN");
    screen.stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onOpenArn).toHaveBeenCalledWith({
      arn: "arn:aws:iam::123456789012:role/TestRole",
      key: "roleArn",
    });
  });
});
