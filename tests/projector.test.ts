import { describe, expect, it } from "vitest";

import {
  fuzzyFilterRows,
  inferGetInput,
  projectTable,
} from "../src/rendering/projector.js";
import type { OperationEntry } from "../src/model/types.js";

describe("result projection", () => {
  it("prioritizes names, identifiers, status, and time fields", () => {
    const table = projectTable([
      {
        description: "Example",
        agentRuntimeId: "runtime-1",
        status: "READY",
        agentRuntimeName: "research-agent",
        lastUpdatedAt: "2026-09-15T00:00:00Z",
      },
    ]);

    expect(table.columns).toEqual([
      "agentRuntimeName",
      "agentRuntimeId",
      "status",
      "lastUpdatedAt",
      "description",
    ]);
  });

  it("infers required Get identifiers from a selected List row", () => {
    const getEntry: OperationEntry = {
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
      inputFields: [
        {
          name: "agentRuntimeId",
          type: "string",
          required: true,
          sensitive: false,
        },
      ],
    };

    expect(
      inferGetInput(getEntry, { agentRuntimeId: "runtime-1", status: "READY" }),
    ).toEqual({
      agentRuntimeId: "runtime-1",
    });
  });

  it("maps a scalar List row to a related API with one compatible required input", () => {
    const describeTable: OperationEntry = {
      id: "dynamodb:DescribeTable",
      mode: "get",
      action: "DESCRIBE",
      supported: true,
      operationName: "DescribeTable",
      displayName: "Describe table",
      resourceName: "Table",
      resourceNames: ["Table"],
      searchKeys: ["describetable", "table"],
      serviceId: "com.amazonaws.dynamodb#DynamoDB_20120810",
      serviceTitle: "Amazon DynamoDB",
      serviceCliName: "dynamodb",
      serviceVersion: "2012-08-10",
      inputFields: [
        {
          name: "TableName",
          type: "string",
          required: true,
          sensitive: false,
        },
      ],
    };

    expect(inferGetInput(describeTable, "ExampleTable")).toEqual({
      TableName: "ExampleTable",
    });
  });

  it("does not guess when a scalar row cannot satisfy exactly one required input", () => {
    const entry: OperationEntry = {
      id: "example:GetThing",
      mode: "get",
      action: "GET",
      supported: true,
      operationName: "GetThing",
      displayName: "Get thing",
      resourceName: "Thing",
      searchKeys: ["getthing"],
      serviceId: "example#Service",
      serviceTitle: "Example",
      serviceCliName: "example",
      serviceVersion: "2026-01-01",
      inputFields: [
        {
          name: "ParentId",
          type: "string",
          required: true,
          sensitive: false,
        },
        {
          name: "ThingId",
          type: "string",
          required: true,
          sensitive: false,
        },
      ],
    };

    expect(inferGetInput(entry, "thing-1")).toBeUndefined();
  });

  it("combines exact selected-row and List-request fields for a detail API", () => {
    const entry: OperationEntry = {
      id: "bedrock-agentcore:GetMemoryRecord",
      mode: "get",
      action: "GET",
      supported: true,
      operationName: "GetMemoryRecord",
      displayName: "Get memory record",
      resourceName: "Memory record",
      resourceNames: ["Memory", "Memory record"],
      searchKeys: ["getmemoryrecord", "memoryrecord"],
      serviceId: "com.amazonaws.bedrockagentcore#AmazonBedrockAgentCore",
      serviceTitle: "Amazon Bedrock AgentCore",
      serviceCliName: "bedrock-agentcore",
      serviceVersion: "2024-02-28",
      inputFields: [
        {
          name: "memoryId",
          type: "string",
          required: true,
          sensitive: false,
        },
        {
          name: "memoryRecordId",
          type: "string",
          required: true,
          sensitive: false,
        },
        {
          name: "namespace",
          type: "string",
          required: false,
          sensitive: false,
        },
      ],
    };

    expect(
      inferGetInput(
        entry,
        { memoryRecordId: "record-1", memoryStrategyId: "strategy-1" },
        { memoryId: "memory-1", namespace: "/users/example" },
      ),
    ).toEqual({
      memoryId: "memory-1",
      memoryRecordId: "record-1",
      namespace: "/users/example",
    });
  });

  it("does not open a parent detail using only the List request", () => {
    const entry: OperationEntry = {
      id: "bedrock-agentcore:GetMemory",
      mode: "get",
      action: "GET",
      supported: true,
      operationName: "GetMemory",
      displayName: "Get memory",
      resourceName: "Memory",
      searchKeys: ["getmemory", "memory"],
      serviceId: "com.amazonaws.bedrockagentcore#AmazonBedrockAgentCore",
      serviceTitle: "Amazon Bedrock AgentCore",
      serviceCliName: "bedrock-agentcore",
      serviceVersion: "2024-02-28",
      inputFields: [
        {
          name: "memoryId",
          type: "string",
          required: true,
          sensitive: false,
        },
      ],
    };

    expect(
      inferGetInput(
        entry,
        { memoryRecordId: "record-1" },
        { memoryId: "memory-1" },
      ),
    ).toBeUndefined();
  });

  it("maps differently named List and Get identifiers through their Smithy target", () => {
    const listEntry: OperationEntry = {
      id: "bedrock-agentcore-control:ListMemories",
      mode: "list",
      action: "LIST",
      supported: true,
      operationName: "ListMemories",
      displayName: "List memories",
      resourceName: "Memories",
      searchKeys: ["listmemories"],
      serviceId: "example#Service",
      serviceTitle: "Amazon Bedrock AgentCore Control",
      serviceCliName: "bedrock-agentcore-control",
      serviceVersion: "2023-06-05",
      inputFields: [],
      listItemFields: [
        {
          name: "id",
          type: "string",
          target: "com.amazonaws.bedrockagentcorecontrol#MemoryId",
        },
      ],
    };
    const getEntry: OperationEntry = {
      ...listEntry,
      id: "bedrock-agentcore-control:GetMemory",
      mode: "get",
      action: "GET",
      operationName: "GetMemory",
      displayName: "Get memory",
      resourceName: "Memory",
      searchKeys: ["getmemory"],
      inputFields: [
        {
          name: "memoryId",
          type: "string",
          target: "com.amazonaws.bedrockagentcorecontrol#MemoryId",
          required: true,
          sensitive: false,
        },
      ],
      listItemFields: [],
    };

    expect(inferGetInput(getEntry, { id: "memory-1" }, {}, listEntry)).toEqual({
      memoryId: "memory-1",
    });
  });

  it.each([
    ["research", ["research-agent"]],
    ["reserchagent", ["research-agent"]],
    ["invreadr", ["invoice-reader"]],
  ])("fuzzy filters the current page with %s", (query, expectedNames) => {
    const rows = [
      { name: "research-agent", status: "READY" },
      { name: "invoice-reader", status: "UPDATING" },
      { name: "support-router", status: "READY" },
    ];

    expect(
      fuzzyFilterRows(rows, query).map((row) => (row as { name: string }).name),
    ).toEqual(expectedNames);
  });

  it("searches nested scalar values and rejects unrelated rows", () => {
    const rows = [
      { name: "one", configuration: { protocol: "HTTP" } },
      { name: "two", configuration: { protocol: "MCP" } },
    ];

    expect(fuzzyFilterRows(rows, "mcp")).toEqual([rows[1]]);
    expect(fuzzyFilterRows(rows, "zzzzzz")).toEqual([]);
  });
});
