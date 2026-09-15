import { describe, expect, it } from "vitest";

import {
  buildAwsCliArgs,
  operationToCliName,
} from "../src/execution/command-builder.js";
import { AwsCliExecutor } from "../src/execution/aws-cli-executor.js";
import type { OperationEntry } from "../src/model/types.js";

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

describe("AWS CLI command builder", () => {
  it.each([
    ["ListAgentRuntimes", "list-agent-runtimes"],
    ["GetACL", "get-acl"],
    ["DescribeDBInstances", "describe-db-instances"],
  ])("converts %s to %s", (operation, expected) => {
    expect(operationToCliName(operation)).toBe(expected);
  });

  it("builds a parameterless first-page List command", () => {
    expect(
      buildAwsCliArgs(entry, {}, { profile: "sandbox", region: "us-west-2" }),
    ).toEqual([
      "bedrock-agentcore-control",
      "list-agent-runtimes",
      "--profile",
      "sandbox",
      "--region",
      "us-west-2",
      "--output",
      "json",
      "--no-paginate",
      "--no-cli-pager",
    ]);
  });

  it("uses the canonical AWS CLI service name instead of the model directory", () => {
    expect(
      buildAwsCliArgs(
        {
          ...entry,
          serviceCliName: "dynamodbstreams",
          operationName: "ListStreams",
        },
        {},
        {},
      ).slice(0, 2),
    ).toEqual(["dynamodbstreams", "list-streams"]);
  });

  it("adds only the internal pagination token on a later page", () => {
    expect(buildAwsCliArgs(entry, { nextToken: "token-2" }, {})).toContain(
      '{"nextToken":"token-2"}',
    );
  });

  it("formats a redacted command for hidden debug mode", () => {
    const executor = new AwsCliExecutor({
      profile: "sandbox",
      region: "us-west-2",
    });
    const command = executor.command(
      {
        ...entry,
        inputFields: [
          {
            name: "token",
            type: "string",
            required: true,
            sensitive: true,
          },
        ],
      },
      { token: "secret-value" },
    );

    expect(command).toContain(
      "aws bedrock-agentcore-control list-agent-runtimes",
    );
    expect(command).toContain("***");
    expect(command).not.toContain("secret-value");
  });
});
