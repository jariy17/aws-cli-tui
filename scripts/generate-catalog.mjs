import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { awsCliServiceName } from "./aws-cli-service-names.mjs";

const repository = process.argv[2] ?? process.env.AWS_API_MODELS_PATH;
if (!repository) {
  console.error("Usage: npm run models:generate -- /path/to/api-models-aws");
  process.exit(1);
}

const modelsRoot = path.join(repository, "models");
const outputPath = fileURLToPath(
  new URL("../src/model/generated/catalog.json", import.meta.url),
);
const services = await readdir(modelsRoot, { withFileTypes: true });
const operations = [];
const serviceEntries = [];

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function shapeName(id) {
  return id.split("#").at(-1) ?? id;
}

function humanize(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

function stripHtml(value) {
  if (!value) return undefined;
  const text = value
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

function getInputFields(model, operation) {
  const target = operation.input?.target;
  const input = target ? model.shapes[target] : undefined;
  if (!input || input.type !== "structure") return [];

  return Object.entries(input.members ?? {}).map(([name, member]) => {
    const targetShape = model.shapes[member.target];
    const length = targetShape?.traits?.["smithy.api#length"];
    return {
      name,
      type: targetShape?.type ?? shapeName(member.target),
      target: member.target,
      ...(typeof member.traits?.["smithy.api#resourceIdentifier"] === "string"
        ? {
            resourceIdentifier: member.traits["smithy.api#resourceIdentifier"],
          }
        : {}),
      required: Boolean(member.traits?.["smithy.api#required"]),
      sensitive: Boolean(
        member.traits?.["smithy.api#sensitive"] ??
        targetShape?.traits?.["smithy.api#sensitive"],
      ),
      ...(targetShape?.traits?.["smithy.api#pattern"]
        ? { pattern: targetShape.traits["smithy.api#pattern"] }
        : {}),
      ...(typeof length?.min === "number" ? { minLength: length.min } : {}),
      ...(typeof length?.max === "number" ? { maxLength: length.max } : {}),
      documentation: stripHtml(member.traits?.["smithy.api#documentation"]),
    };
  });
}

function getOperationResources(model) {
  const resources = new Map();

  for (const [resourceId, resource] of Object.entries(model.shapes ?? {})) {
    if (resource.type !== "resource") continue;
    const resourceName = humanize(
      shapeName(resourceId).replace(/Resource$/, ""),
    );
    const targets = [
      resource.create?.target,
      resource.read?.target,
      resource.update?.target,
      resource.delete?.target,
      resource.list?.target,
      ...(resource.operations ?? []).map((operation) => operation.target),
      ...(resource.collectionOperations ?? []).map(
        (operation) => operation.target,
      ),
    ].filter(Boolean);

    for (const target of targets) {
      const names = resources.get(target) ?? [];
      if (!names.includes(resourceName)) names.push(resourceName);
      resources.set(target, names);
    }
  }

  return resources;
}

function toEntry({
  model,
  serviceId,
  serviceShape,
  serviceCliName,
  modelFile,
  operationId,
  operation,
  modeledResourceNames,
}) {
  const operationName = shapeName(operationId);
  const isList = operationName.startsWith("List");
  const isGet =
    operationName.startsWith("Get") || operationName.startsWith("Describe");
  if (!isList && !isGet) return undefined;

  const inputFields = getInputFields(model, operation);
  if (isList && inputFields.some((field) => field.required)) return undefined;

  const serviceTrait = serviceShape.traits?.["aws.api#service"] ?? {};
  const serviceTitle =
    serviceShape.traits?.["smithy.api#title"] ??
    serviceTrait.sdkId ??
    humanize(serviceCliName);
  const actionPrefix = operationName.startsWith("Describe")
    ? "Describe"
    : isList
      ? "List"
      : "Get";
  const inferredResourceName = humanize(
    operationName.slice(actionPrefix.length),
  );
  const resourceNames = (
    modeledResourceNames?.length ? modeledResourceNames : [inferredResourceName]
  ).filter(
    (value, index, values) =>
      value &&
      values.findIndex(
        (candidate) => normalize(candidate) === normalize(value),
      ) === index,
  );
  const resourceName = inferredResourceName;
  const displayName = humanize(operationName);
  const paginationTrait = operation.traits?.["smithy.api#paginated"];
  const pagination = paginationTrait
    ? {
        inputToken: paginationTrait.inputToken,
        outputToken: paginationTrait.outputToken,
        ...(paginationTrait.items ? { items: paginationTrait.items } : {}),
      }
    : undefined;
  const documentation = stripHtml(
    operation.traits?.["smithy.api#documentation"],
  );
  const searchKeys = [
    normalize(operationName),
    normalize(displayName),
    ...[...resourceNames, inferredResourceName].flatMap((name) => [
      normalize(name),
      normalize(name.replace(/s$/, "")),
      normalize(`${actionPrefix}${name}`),
    ]),
  ].filter((value, index, values) => value && values.indexOf(value) === index);

  return {
    id: `${serviceCliName}:${operationName}`,
    mode: isList ? "list" : "get",
    operationName,
    displayName,
    resourceName,
    resourceNames,
    searchKeys,
    serviceId,
    serviceTitle,
    serviceCliName,
    serviceVersion: serviceShape.version,
    modelFile,
    ...(documentation ? { documentation } : {}),
    inputFields,
    ...(pagination ? { pagination } : {}),
  };
}

for (const serviceDirectory of services) {
  if (!serviceDirectory.isDirectory()) continue;
  const modelDirectory = serviceDirectory.name;
  const serviceCliName = awsCliServiceName(modelDirectory);
  if (!serviceCliName) continue;
  const serviceRoot = path.join(modelsRoot, modelDirectory, "service");
  let versions;
  try {
    versions = await readdir(serviceRoot, { withFileTypes: true });
  } catch {
    continue;
  }

  const latestVersion = versions
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .at(-1);
  if (!latestVersion) continue;

  const versionRoot = path.join(serviceRoot, latestVersion);
  const files = (await readdir(versionRoot))
    .filter((file) => file.endsWith(".json"))
    .sort();
  const modelFile = files.at(-1);
  if (!modelFile) continue;

  let model;
  try {
    model = JSON.parse(
      await readFile(path.join(versionRoot, modelFile), "utf8"),
    );
  } catch (error) {
    console.warn(`Skipping ${modelDirectory}: ${error.message}`);
    continue;
  }

  const servicePair = Object.entries(model.shapes ?? {}).find(
    ([, shape]) => shape.type === "service",
  );
  if (!servicePair) continue;
  const [serviceId, serviceShape] = servicePair;
  const serviceTrait = serviceShape.traits?.["aws.api#service"] ?? {};
  const serviceTitle =
    serviceShape.traits?.["smithy.api#title"] ??
    serviceTrait.sdkId ??
    humanize(serviceCliName);

  serviceEntries.push({
    id: serviceId,
    name: shapeName(serviceId),
    cliName: serviceCliName,
    modelDirectory,
    title: serviceTitle,
    version: serviceShape.version,
    modelFile,
    ...(serviceTrait.sdkId ? { sdkId: serviceTrait.sdkId } : {}),
    ...(serviceTrait.arnNamespace
      ? { arnNamespace: serviceTrait.arnNamespace }
      : {}),
    ...(serviceTrait.cloudFormationName
      ? { cloudFormationName: serviceTrait.cloudFormationName }
      : {}),
  });

  const operationResources = getOperationResources(model);
  for (const [operationId, operation] of Object.entries(model.shapes)) {
    if (operation.type !== "operation") continue;
    const entry = toEntry({
      model,
      serviceId,
      serviceShape,
      serviceCliName,
      modelFile,
      operationId,
      operation,
      modeledResourceNames: operationResources.get(operationId),
    });
    if (entry) operations.push(entry);
  }
}

operations.sort(
  (left, right) =>
    left.displayName.localeCompare(right.displayName) ||
    left.serviceTitle.localeCompare(right.serviceTitle),
);

let commit = "unknown";
try {
  commit = execFileSync("git", ["-C", repository, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
} catch {
  // A downloaded source archive has no Git metadata.
}

const catalog = {
  generatedAt: new Date().toISOString(),
  source: {
    repository: "https://github.com/aws/api-models-aws",
    commit,
  },
  operationCount: operations.length,
  operations,
  services: serviceEntries,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Generated ${operations.length} operations at ${outputPath}`);
