import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { OperationEntry } from "../src/model/types.js";
import { InputScreen } from "../src/tui/screens/InputScreen.js";

const entry: OperationEntry = {
  id: "bedrock-agentcore:ListMemoryRecords",
  mode: "list",
  action: "LIST",
  supported: true,
  operationName: "ListMemoryRecords",
  displayName: "List memory records",
  resourceName: "Memory records",
  searchKeys: ["listmemoryrecords"],
  serviceId: "example#Service",
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
      name: "actorId",
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
    {
      name: "nextToken",
      type: "string",
      required: false,
      sensitive: false,
    },
  ],
  pagination: {
    inputToken: "nextToken",
    outputToken: "nextToken",
  },
};

describe("InputScreen", () => {
  it("shows inherited inputs, prompts required inputs, and skips optional inputs", async () => {
    const onSubmit = vi.fn();
    const screen = render(
      <InputScreen
        entry={entry}
        initialValues={{ memoryId: "memory-1" }}
        onSubmit={onSubmit}
        onBack={() => {}}
      />,
    );

    expect(screen.lastFrame()).toContain(
      "ListMemoryRecords · memoryId=memory-1",
    );
    expect(screen.lastFrame()).toContain("ACTORID");
    expect(screen.lastFrame()).not.toContain("NAMESPACE");
    expect(screen.lastFrame()).not.toContain("nextToken");

    screen.stdin.write("[O[I");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.lastFrame()).not.toContain("[O[I");

    screen.stdin.write("actor-1");
    await new Promise((resolve) => setTimeout(resolve, 20));
    screen.stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onSubmit).toHaveBeenCalledWith({
      memoryId: "memory-1",
      actorId: "actor-1",
    });
  });

  it("renders enums as a dropdown and focuses the Smithy default", async () => {
    const onSubmit = vi.fn();
    const enumEntry: OperationEntry = {
      ...entry,
      operationName: "GetMemory",
      displayName: "Get memory",
      resourceName: "Memory",
      mode: "get",
      action: "GET",
      inputFields: [
        {
          name: "memoryId",
          type: "string",
          required: true,
          sensitive: false,
        },
        {
          name: "view",
          type: "enum",
          defaultValue: "full",
          enumValues: ["full", "without_decryption"],
          required: true,
          sensitive: false,
        },
        {
          name: "maxResults",
          type: "integer",
          defaultValue: 100,
          required: false,
          sensitive: false,
        },
      ],
    };
    const screen = render(
      <InputScreen
        entry={enumEntry}
        initialValues={{ memoryId: "memory-1" }}
        resourcePath={["Memory"]}
        onSubmit={onSubmit}
        onBack={() => {}}
      />,
    );

    expect(screen.lastFrame()).toContain("GetMemory · memoryId=memory-1");
    expect(screen.lastFrame()).toContain("Default: full");
    expect(screen.lastFrame()).toContain("without_decryption");
    expect(screen.lastFrame()).not.toContain("R Related");

    screen.stdin.write("\u001B[B");
    await new Promise((resolve) => setTimeout(resolve, 20));
    screen.stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onSubmit).toHaveBeenCalledWith({
      memoryId: "memory-1",
      view: "without_decryption",
    });
  });

  it("configures optional List inputs while keeping resource identity fixed", async () => {
    const onSubmit = vi.fn();
    const listEvents: OperationEntry = {
      ...entry,
      operationName: "ListEvents",
      displayName: "List events",
      resourceName: "Events",
      inputFields: [
        {
          name: "memoryId",
          type: "string",
          required: true,
          sensitive: false,
        },
        {
          name: "actorId",
          type: "string",
          required: true,
          sensitive: false,
        },
        {
          name: "sessionId",
          type: "string",
          required: true,
          sensitive: false,
        },
        {
          name: "includePayloads",
          type: "Boolean",
          defaultValue: true,
          required: false,
          sensitive: false,
        },
        {
          name: "filter",
          type: "structure",
          required: false,
          sensitive: false,
        },
        {
          name: "maxResults",
          type: "integer",
          defaultValue: 100,
          required: false,
          sensitive: false,
        },
        {
          name: "nextToken",
          type: "string",
          required: false,
          sensitive: false,
        },
      ],
    };
    const screen = render(
      <InputScreen
        entry={listEvents}
        purpose="configure"
        initialValues={{
          memoryId: "memory-1",
          actorId: "actor-1",
          sessionId: "session-1",
          includePayloads: true,
          maxResults: 100,
        }}
        resourcePath={["Memory", "Actors", "Sessions", "Events"]}
        onSubmit={onSubmit}
        onBack={() => {}}
      />,
    );

    expect(screen.lastFrame()).toContain("Configure 1/3");
    expect(screen.lastFrame()).toContain("INCLUDEPAYLOADS");
    expect(screen.lastFrame()).toContain("true");
    expect(screen.lastFrame()).toContain("false");
    expect(screen.lastFrame()).not.toContain("MEMORYID");

    screen.stdin.write("\u001B[B");
    await new Promise((resolve) => setTimeout(resolve, 20));
    screen.stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.lastFrame()).toContain("Configure 2/3");
    expect(screen.lastFrame()).toContain("FILTER");
    screen.stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.lastFrame()).toContain("Configure 3/3");
    expect(screen.lastFrame()).toContain("MAXRESULTS");
    screen.stdin.write("\u007F");
    screen.stdin.write("\u007F");
    screen.stdin.write("\u007F");
    screen.stdin.write("25");
    await new Promise((resolve) => setTimeout(resolve, 20));
    screen.stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onSubmit).toHaveBeenCalledWith({
      memoryId: "memory-1",
      actorId: "actor-1",
      sessionId: "session-1",
      includePayloads: false,
      maxResults: "25",
    });
  });
});
