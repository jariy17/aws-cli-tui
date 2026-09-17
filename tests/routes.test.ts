import { describe, expect, it } from "vitest";
import { matchRoutes } from "react-router";

import {
  configureRoutePath,
  detailRoutePath,
  inputRoutePath,
  listEntryRouteKey,
  listEntryRoutePath,
  pagesRoutePath,
  relatedRoutePath,
  routePatterns,
  workingRoutePath,
} from "../src/tui/routes.js";

const operationId = "bedrock-agentcore-control:ListAgentRuntimes";
const encodedOperationId = "bedrock-agentcore-control%3AListAgentRuntimes";

describe("TUI routes", () => {
  it("uses declarative URL patterns for every screen", () => {
    expect(routePatterns).toEqual({
      home: "/",
      search: "/apis",
      input: "/operations/:operationId/input",
      configure: "/operations/:operationId/configure",
      pages: "/operations/:operationId/pages/:pageNumber",
      listEntry: "/operations/:operationId/pages/:pageNumber/entries/:entryKey",
      detail: "/operations/:operationId/resource",
      related: "/operations/:operationId/resource/related",
      working: "/operations/:operationId/working",
      error: "/error",
    });
  });

  it.each([
    [
      "input",
      inputRoutePath(operationId),
      `/operations/${encodedOperationId}/input`,
    ],
    [
      "configure",
      configureRoutePath(operationId),
      `/operations/${encodedOperationId}/configure`,
    ],
    [
      "first page",
      pagesRoutePath(operationId, 0),
      `/operations/${encodedOperationId}/pages/1`,
    ],
    [
      "third page",
      pagesRoutePath(operationId, 2),
      `/operations/${encodedOperationId}/pages/3`,
    ],
    [
      "list entry",
      listEntryRoutePath(operationId, 1, "runtime/123"),
      `/operations/${encodedOperationId}/pages/2/entries/runtime%2F123`,
    ],
    [
      "detail",
      detailRoutePath(operationId),
      `/operations/${encodedOperationId}/resource`,
    ],
    [
      "related",
      relatedRoutePath(operationId),
      `/operations/${encodedOperationId}/resource/related`,
    ],
    [
      "working",
      workingRoutePath(operationId),
      `/operations/${encodedOperationId}/working`,
    ],
  ])("builds the %s route", (_name, actual, expected) => {
    expect(actual).toBe(expected);
  });

  it("matches encoded operation and page values as route parameters", () => {
    const matches = matchRoutes(
      [{ path: routePatterns.listEntry }],
      listEntryRoutePath(operationId, 1, "runtime/123"),
    );

    expect(matches?.[0]?.params).toEqual({
      operationId,
      pageNumber: "2",
      entryKey: "runtime/123",
    });
  });

  it.each([
    ["primitive rows", "ExampleTable", 0, "ExampleTable"],
    [
      "modeled IDs",
      { agentRuntimeName: "agent", agentRuntimeId: "runtime-123" },
      0,
      "runtime-123",
    ],
    [
      "ARNs when no ID is present",
      { topicArn: "arn:aws:sns:us-west-2:123456789012:events" },
      0,
      "arn:aws:sns:us-west-2:123456789012:events",
    ],
    [
      "names when no ID or ARN is present",
      { tableName: "ExampleTable", status: "ACTIVE" },
      0,
      "ExampleTable",
    ],
    [
      "names before less readable ARNs",
      {
        indexName: "ByCustomer",
        indexArn:
          "arn:aws:dynamodb:us-west-2:123456789012:table/Orders/index/ByCustomer",
      },
      0,
      "ByCustomer",
    ],
    ["row position fallback", { status: "ACTIVE" }, 3, "row-4"],
  ])("creates entry keys for %s", (_name, row, rowIndex, expected) => {
    expect(listEntryRouteKey(row, rowIndex)).toBe(expected);
  });
});
