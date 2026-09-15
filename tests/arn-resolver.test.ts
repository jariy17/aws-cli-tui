import { describe, expect, it, vi } from "vitest";

import {
  ArnReferenceResolver,
  GithubSmithyRepository,
  type SmithyModel,
} from "../src/model/github-smithy.js";
import type { ServiceEntry } from "../src/model/types.js";

const sourceService: ServiceEntry = {
  id: "example.source#Service",
  name: "Service",
  cliName: "source",
  title: "Source Service",
  version: "2026-01-01",
  modelFile: "source-2026-01-01.json",
  arnNamespace: "source",
  cloudFormationName: "Source",
};

const iamService: ServiceEntry = {
  id: "com.amazonaws.iam#IAM",
  name: "IAM",
  cliName: "iam",
  title: "AWS Identity and Access Management",
  version: "2010-05-08",
  modelFile: "iam-2010-05-08.json",
  sdkId: "IAM",
  arnNamespace: "iam",
  cloudFormationName: "IAM",
};

function sourceModel(withReference: boolean): SmithyModel {
  return {
    shapes: {
      "example.source#Service": { type: "service", version: "2026-01-01" },
      "example.source#Output": {
        type: "structure",
        members: {
          roleArn: { target: "example.source#RoleArn" },
        },
      },
      "example.source#RoleArn": {
        type: "string",
        traits: withReference
          ? { "aws.api#arnReference": { type: "AWS::IAM::Role" } }
          : { "smithy.api#pattern": "^arn:aws:iam::[0-9]{12}:role/.+$" },
      },
    },
  };
}

const iamModel: SmithyModel = {
  shapes: {
    "com.amazonaws.iam#IAM": { type: "service", version: "2010-05-08" },
    "com.amazonaws.iam#GetRole": {
      type: "operation",
      input: { target: "com.amazonaws.iam#GetRoleInput" },
    },
    "com.amazonaws.iam#GetRoleInput": {
      type: "structure",
      members: {
        RoleName: {
          target: "com.amazonaws.iam#RoleName",
          traits: { "smithy.api#required": {} },
        },
      },
    },
    "com.amazonaws.iam#RoleName": {
      type: "string",
      traits: {
        "smithy.api#pattern": "^[\\w+=,.@-]+$",
        "smithy.api#length": { min: 1, max: 64 },
      },
    },
  },
};

const widgetService: ServiceEntry = {
  id: "example.widget#WidgetService",
  name: "WidgetService",
  cliName: "widget",
  title: "Widget Service",
  version: "2026-01-01",
  modelFile: "widget-2026-01-01.json",
  arnNamespace: "widget",
  cloudFormationName: "Widget",
};

const dynamodbService: ServiceEntry = {
  id: "com.amazonaws.dynamodb#DynamoDB_20120810",
  name: "DynamoDB_20120810",
  cliName: "dynamodb",
  title: "Amazon DynamoDB",
  version: "2012-08-10",
  modelFile: "dynamodb-2012-08-10.json",
  arnNamespace: "dynamodb",
  cloudFormationName: "DynamoDB",
};

const widgetSourceModel: SmithyModel = {
  shapes: {
    "example.source#Service": { type: "service", version: "2026-01-01" },
    "example.source#WidgetArn": {
      type: "string",
      traits: {
        "aws.api#arnReference": {
          service: "example.widget#WidgetService",
          resource: "example.widget#WidgetResource",
        },
      },
    },
  },
};

const widgetModel: SmithyModel = {
  shapes: {
    "example.widget#WidgetService": {
      type: "service",
      version: "2026-01-01",
    },
    "example.widget#WidgetResource": {
      type: "resource",
      identifiers: {
        WidgetId: { target: "example.widget#WidgetId" },
      },
      read: { target: "example.widget#ReadWidget" },
      traits: {
        "aws.api#arn": { template: "widget:{WidgetId}" },
      },
    },
    "example.widget#ReadWidget": {
      type: "operation",
      input: { target: "example.widget#ReadWidgetInput" },
    },
    "example.widget#ReadWidgetInput": {
      type: "structure",
      members: {
        id: {
          target: "example.widget#WidgetId",
          traits: {
            "smithy.api#required": {},
            "smithy.api#resourceIdentifier": "WidgetId",
          },
        },
      },
    },
    "example.widget#WidgetId": { type: "string" },
  },
};

describe("ArnReferenceResolver", () => {
  it.each([true, false])(
    "loads live GitHub models and resolves an IAM role with explicit reference=%s",
    async (withReference) => {
      const fetchMock = vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        const model = url.includes("/models/iam/")
          ? iamModel
          : sourceModel(withReference);
        return new Response(JSON.stringify(model), {
          status: 200,
          headers: { etag: `"${url}"` },
        });
      });
      const resolver = new ArnReferenceResolver(
        [sourceService, iamService],
        new GithubSmithyRepository(fetchMock as unknown as typeof fetch),
      );

      const resolution = await resolver.resolve(sourceService, {
        key: "roleArn",
        arn: "arn:aws:iam::123456789012:role/service-role/TestRole",
      });

      expect(resolution).toMatchObject({
        entry: {
          serviceCliName: "iam",
          operationName: "GetRole",
        },
        input: { RoleName: "TestRole" },
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
        expect.stringContaining(
          "/aws/api-models-aws/main/models/source/service/",
        ),
        expect.stringContaining("/aws/api-models-aws/main/models/iam/service/"),
      ]);
    },
  );

  it("follows an explicit service/resource reference to its read operation", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const model = url.includes("/models/widget/")
        ? widgetModel
        : widgetSourceModel;
      return new Response(JSON.stringify(model), { status: 200 });
    });
    const resolver = new ArnReferenceResolver(
      [sourceService, widgetService],
      new GithubSmithyRepository(fetchMock as unknown as typeof fetch),
    );

    const resolution = await resolver.resolve(sourceService, {
      key: "widgetArn",
      arn: "arn:aws:widget:us-west-2:123456789012:widget:widget-123",
    });

    expect(resolution).toMatchObject({
      entry: {
        serviceCliName: "widget",
        operationName: "ReadWidget",
      },
      input: { id: "widget-123" },
      region: "us-west-2",
    });
  });

  it("refuses to guess when two resource reads are equally valid", async () => {
    const ambiguousSource: SmithyModel = {
      shapes: {
        "example.source#Service": {
          type: "service",
          version: "2026-01-01",
        },
        "example.source#WidgetArn": { type: "string" },
      },
    };
    const ambiguousTarget: SmithyModel = {
      shapes: {
        ...widgetModel.shapes,
        "example.widget#AlternateWidgetResource": {
          type: "resource",
          read: { target: "example.widget#ReadAlternateWidget" },
          traits: {
            "aws.api#arn": { template: "widget:{WidgetId}" },
          },
        },
        "example.widget#ReadAlternateWidget": {
          type: "operation",
          input: { target: "example.widget#ReadWidgetInput" },
        },
      },
    };
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const model = url.includes("/models/widget/")
        ? ambiguousTarget
        : ambiguousSource;
      return new Response(JSON.stringify(model), { status: 200 });
    });
    const resolver = new ArnReferenceResolver(
      [sourceService, widgetService],
      new GithubSmithyRepository(fetchMock as unknown as typeof fetch),
    );

    const resolution = await resolver.resolve(sourceService, {
      key: "widgetArn",
      arn: "arn:aws:widget:us-west-2:123456789012:widget:widget-123",
    });

    expect(resolution).toBeUndefined();
  });

  it("does not treat a nested DynamoDB IndexArn as a table link", async () => {
    const model: SmithyModel = {
      shapes: {
        "com.amazonaws.dynamodb#DynamoDB_20120810": {
          type: "service",
          version: "2012-08-10",
        },
        "com.amazonaws.dynamodb#GlobalSecondaryIndexDescription": {
          type: "structure",
          members: {
            IndexArn: { target: "com.amazonaws.dynamodb#String" },
          },
        },
        "com.amazonaws.dynamodb#String": { type: "string" },
        "com.amazonaws.dynamodb#DescribeTable": {
          type: "operation",
          input: { target: "com.amazonaws.dynamodb#DescribeTableInput" },
        },
        "com.amazonaws.dynamodb#DescribeTableInput": {
          type: "structure",
          members: {
            TableName: {
              target: "com.amazonaws.dynamodb#String",
              traits: { "smithy.api#required": {} },
            },
          },
        },
      },
    };
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify(model), { status: 200 });
    });
    const resolver = new ArnReferenceResolver(
      [dynamodbService],
      new GithubSmithyRepository(fetchMock as unknown as typeof fetch),
    );

    const resolution = await resolver.resolve(dynamodbService, {
      key: "IndexArn",
      arn: "arn:aws:dynamodb:us-west-2:123456789012:table/Example/index/MyIndex",
    });

    expect(resolution).toBeUndefined();
  });
});

describe("GithubSmithyRepository", () => {
  it("uses the Smithy model directory separately from the AWS CLI command", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request) => {
      return new Response(JSON.stringify(iamModel), { status: 200 });
    });
    const repository = new GithubSmithyRepository(
      fetchMock as unknown as typeof fetch,
    );

    await repository.load({
      ...iamService,
      cliName: "dynamodbstreams",
      modelDirectory: "dynamodb-streams",
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/models/dynamodb-streams/service/",
    );
  });

  it("checks GitHub on every load and reuses the cached model on 304", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(iamModel), {
          status: 200,
          headers: { etag: '"iam-model-v1"' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const repository = new GithubSmithyRepository(
      fetchMock as unknown as typeof fetch,
    );

    const first = await repository.load(iamService);
    const second = await repository.load(iamService);

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: { "If-None-Match": '"iam-model-v1"' },
    });
  });
});
