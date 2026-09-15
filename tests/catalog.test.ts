import { describe, expect, it } from "vitest";

import { normalizeSearch, SmithyCatalog } from "../src/model/catalog.js";
import type { Catalog, OperationEntry } from "../src/model/types.js";

function operation(overrides: Partial<OperationEntry>): OperationEntry {
  return {
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
    ...overrides,
  };
}

function catalog(operations: OperationEntry[]): SmithyCatalog {
  const value: Catalog = {
    generatedAt: "2026-09-15T00:00:00.000Z",
    source: {
      repository: "https://github.com/aws/api-models-aws",
      commit: "abc123",
    },
    operationCount: operations.length,
    operations,
  };
  return new SmithyCatalog(value);
}

describe("SmithyCatalog", () => {
  it.each([
    ["Agent Runtime", "agentruntime"],
    ["list-agent_runtimes", "listagentruntimes"],
    ["LISTAGENTRUNTIMES", "listagentruntimes"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeSearch(input)).toBe(expected);
  });

  it("resolves a no-space resource search without exposing service selection", () => {
    const value = catalog([
      operation({}),
      operation({
        id: "agentcore:GetAgentRuntime",
        mode: "get",
        operationName: "GetAgentRuntime",
        displayName: "Get agent runtime",
        resourceName: "Agent runtime",
        searchKeys: ["getagentruntime", "agentruntime"],
      }),
    ]);

    expect(
      value.search("agentruntime", "list").map((entry) => entry.operationName),
    ).toEqual(["ListAgentRuntimes"]);
    expect(
      value.search("agentruntime", "get").map((entry) => entry.operationName),
    ).toEqual(["GetAgentRuntime"]);
  });

  it.each([
    ["agentruntmie", "ListAgentRuntimes"],
    ["agntrntm", "ListAgentRuntimes"],
  ])("fuzzy matches %s to %s", (query, expected) => {
    const value = catalog([operation({})]);

    expect(value.search(query, "list")[0]?.operationName).toBe(expected);
  });

  it("keeps exact matches ahead of fuzzy matches", () => {
    const value = catalog([
      operation({}),
      operation({
        id: "agentcore:ListAgentRuntimeEndpoints",
        operationName: "ListAgentRuntimeEndpoints",
        displayName: "List agent runtime endpoints",
        resourceName: "Agent runtime endpoints",
        searchKeys: [
          "listagentruntimeendpoints",
          "agentruntimeendpoints",
          "agentruntimeendpoint",
        ],
      }),
    ]);

    expect(value.search("agentruntime", "list")[0]?.operationName).toBe(
      "ListAgentRuntimes",
    );
  });

  it("does not return unrelated fuzzy results", () => {
    expect(catalog([operation({})]).search("zzzzzzzz", "list")).toEqual([]);
  });

  it("supports fuzzy service: and resource: scoped searches", () => {
    const topic = operation({
      id: "sns:ListTopics",
      operationName: "ListTopics",
      displayName: "List topics",
      resourceName: "Topic",
      resourceNames: ["Topic"],
      searchKeys: ["listtopics", "topics", "topic"],
      serviceId: "com.amazonaws.sns#SimpleNotificationService",
      serviceTitle: "Amazon Simple Notification Service",
      serviceCliName: "sns",
    });
    const monitor = operation({
      id: "internetmonitor:ListMonitors",
      operationName: "ListMonitors",
      displayName: "List monitors",
      resourceName: "Monitor",
      resourceNames: ["Monitor"],
      searchKeys: ["listmonitors", "monitors", "monitor"],
      serviceTitle: "Amazon CloudWatch Internet Monitor",
      serviceCliName: "internetmonitor",
    });
    const value = catalog([topic, monitor]);

    expect(value.search("service:sns").map((entry) => entry.id)).toEqual([
      "sns:ListTopics",
    ]);
    expect(value.search("resource:topc").map((entry) => entry.id)).toEqual([
      "sns:ListTopics",
    ]);
  });

  it("loads the generated catalog with the AgentCore service route", async () => {
    const generated = await SmithyCatalog.load();
    const [entry] = generated.search("listagentruntimes", "list");

    expect(entry).toMatchObject({
      operationName: "ListAgentRuntimes",
      serviceTitle: "Amazon Bedrock AgentCore Control",
      serviceCliName: "bedrock-agentcore-control",
      resourceNames: expect.arrayContaining(["Agent"]),
    });
  });

  it("uses the canonical AWS CLI route for DynamoDB Streams", async () => {
    const generated = await SmithyCatalog.load();
    const entry = generated
      .search("liststreams", "list")
      .find(
        (candidate) => candidate.serviceTitle === "Amazon DynamoDB Streams",
      );

    expect(entry).toMatchObject({
      operationName: "ListStreams",
      serviceCliName: "dynamodbstreams",
    });
    expect(
      generated
        .services()
        .find((service) => service.title === "Amazon DynamoDB Streams"),
    ).toMatchObject({
      cliName: "dynamodbstreams",
      modelDirectory: "dynamodb-streams",
    });
  });
});
