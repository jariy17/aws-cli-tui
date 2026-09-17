import { describe, expect, it } from "vitest";

import { normalizeSearch, SmithyCatalog } from "../src/model/catalog.js";
import type { Catalog, OperationEntry } from "../src/model/types.js";
import { inferGetInput } from "../src/rendering/projector.js";

function operation(overrides: Partial<OperationEntry>): OperationEntry {
  return {
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

  it("returns unsupported operations globally but not in runnable mode searches", () => {
    const create = operation({
      id: "agentcore:CreateAgentRuntime",
      mode: "unsupported",
      action: "CREATE",
      supported: false,
      unsupportedReason:
        "Only List, Get, and Describe operations are supported.",
      operationName: "CreateAgentRuntime",
      displayName: "Create agent runtime",
      resourceName: "Agent runtime",
      searchKeys: ["createagentruntime", "agentruntime"],
    });
    const value = catalog([create]);

    expect(value.search("createagentruntime")).toEqual([create]);
    expect(value.search("createagentruntime", "list")).toEqual([]);
    expect(value.search("createagentruntime", "get")).toEqual([]);
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

  it("includes required-input Lists and unsupported actions from Smithy", async () => {
    const generated = await SmithyCatalog.load();
    const listMemoryRecords = generated
      .search("listmemoryrecords")
      .find(
        (entry) =>
          entry.operationName === "ListMemoryRecords" &&
          entry.serviceCliName === "bedrock-agentcore",
      );
    const createAgentRuntime = generated
      .search("createagentruntime")
      .find(
        (entry) =>
          entry.operationName === "CreateAgentRuntime" &&
          entry.serviceCliName === "bedrock-agentcore-control",
      );

    expect(listMemoryRecords).toMatchObject({
      mode: "list",
      action: "LIST",
      supported: true,
      inputFields: expect.arrayContaining([
        expect.objectContaining({ name: "memoryId", required: true }),
        expect.objectContaining({ name: "namespace", required: false }),
        expect.objectContaining({ name: "maxResults", defaultValue: 100 }),
      ]),
    });
    expect(createAgentRuntime).toMatchObject({
      mode: "unsupported",
      action: "CREATE",
      supported: false,
    });
  });

  it("resolves a ListMemoryRecords row to GetMemoryRecord with List context", async () => {
    const generated = await SmithyCatalog.load();
    const listMemoryRecords = generated
      .search("listmemoryrecords", "list")
      .find(
        (entry) =>
          entry.operationName === "ListMemoryRecords" &&
          entry.serviceCliName === "bedrock-agentcore",
      )!;
    const row = {
      memoryRecordId: "record-1",
      memoryStrategyId: "strategy-1",
    };
    const listInput = {
      memoryId: "memory-1",
      namespace: "/users/example",
    };
    const resolution = generated
      .findRelatedGet(listMemoryRecords)
      .map((entry) => ({
        entry,
        input: inferGetInput(entry, row, listInput),
      }))
      .find((candidate) => candidate.input !== undefined);

    expect(resolution).toMatchObject({
      entry: { operationName: "GetMemoryRecord" },
      input: {
        memoryId: "memory-1",
        memoryRecordId: "record-1",
        namespace: "/users/example",
      },
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

  it("finds inferred child Lists for an AgentCore Memory detail", async () => {
    const generated = await SmithyCatalog.load();
    const getMemory = generated
      .search("getmemory", "get")
      .find(
        (entry) =>
          entry.operationName === "GetMemory" &&
          entry.serviceCliName === "bedrock-agentcore-control",
      )!;
    const related = generated.findRelatedLists(
      getMemory,
      { memoryId: "memory-1" },
      { memory: { id: "memory-1", name: "CustomerMemory" } },
    );

    expect(
      related.map((relation) => ({
        operation: relation.entry.operationName,
        source: relation.source,
        inherited: relation.inheritedFields,
      })),
    ).toEqual(
      expect.arrayContaining([
        {
          operation: "ListMemoryRecords",
          source: "inferred",
          inherited: ["memoryId"],
        },
        {
          operation: "ListActors",
          source: "inferred",
          inherited: ["memoryId"],
        },
      ]),
    );
  });

  it("infers AgentCore Gateway collections from their modeled GatewayIdentifier", async () => {
    const generated = await SmithyCatalog.load();
    const getGateway = generated
      .search("getgateway", "get")
      .find(
        (entry) =>
          entry.operationName === "GetGateway" &&
          entry.serviceCliName === "bedrock-agentcore-control",
      )!;
    const related = generated.findRelatedLists(
      getGateway,
      { gatewayIdentifier: "example-gateway-1234567890" },
      {
        gatewayId: "example-gateway-1234567890",
        name: "Example gateway",
      },
    );

    expect(
      related.map((relation) => ({
        operation: relation.entry.operationName,
        source: relation.source,
        input: relation.input,
      })),
    ).toEqual(
      expect.arrayContaining([
        {
          operation: "ListGatewayTargets",
          source: "inferred",
          input: { gatewayIdentifier: "example-gateway-1234567890" },
        },
        {
          operation: "ListGatewayRules",
          source: "inferred",
          input: { gatewayIdentifier: "example-gateway-1234567890" },
        },
        {
          operation: "ListGatewayRateLimits",
          source: "inferred",
          input: { gatewayIdentifier: "example-gateway-1234567890" },
        },
      ]),
    );
  });

  it("opens GetGateway from a ListGateways gatewayId", async () => {
    const generated = await SmithyCatalog.load();
    const listGateways = generated
      .search("listgateways", "list")
      .find(
        (entry) =>
          entry.operationName === "ListGateways" &&
          entry.serviceCliName === "bedrock-agentcore-control",
      )!;
    const resolution = generated
      .findRelatedGet(listGateways)
      .map((entry) => ({
        entry,
        input: inferGetInput(
          entry,
          {
            gatewayId: "example-gateway-1234567890",
            name: "Example gateway",
          },
          {},
          listGateways,
        ),
      }))
      .find((candidate) => candidate.input !== undefined);

    expect(resolution).toMatchObject({
      entry: { operationName: "GetGateway" },
      input: { gatewayIdentifier: "example-gateway-1234567890" },
    });
  });

  it("opens GetMemory from a ListMemories row using the Smithy MemoryId target", async () => {
    const generated = await SmithyCatalog.load();
    const listMemories = generated
      .search("listmemories", "list")
      .find(
        (entry) =>
          entry.operationName === "ListMemories" &&
          entry.serviceCliName === "bedrock-agentcore-control",
      )!;
    const resolution = generated
      .findRelatedGet(listMemories)
      .map((entry) => ({
        entry,
        input: inferGetInput(
          entry,
          { id: "memory-1", status: "ACTIVE" },
          {},
          listMemories,
        ),
      }))
      .find((candidate) => candidate.input !== undefined);

    expect(resolution).toMatchObject({
      entry: { operationName: "GetMemory" },
      input: { memoryId: "memory-1" },
    });
    expect(
      resolution?.entry.inputFields.find((field) => field.name === "view"),
    ).toMatchObject({
      defaultValue: "full",
      enumValues: ["full", "without_decryption"],
    });
  });

  it("uses an explicit Smithy child resource for Payment Connectors", async () => {
    const generated = await SmithyCatalog.load();
    const getPaymentManager = generated
      .search("getpaymentmanager", "get")
      .find(
        (entry) =>
          entry.operationName === "GetPaymentManager" &&
          entry.serviceCliName === "bedrock-agentcore-control",
      )!;
    const related = generated.findRelatedLists(
      getPaymentManager,
      { paymentManagerId: "pm-1" },
      { paymentManagerId: "pm-1" },
    );

    expect(related).toEqual([
      expect.objectContaining({
        resourceName: "Payment Connector",
        source: "smithy",
        input: { paymentManagerId: "pm-1" },
        entry: expect.objectContaining({
          operationName: "ListPaymentConnectors",
        }),
      }),
    ]);
  });
});
