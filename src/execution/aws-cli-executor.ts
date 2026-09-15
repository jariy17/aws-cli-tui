import { spawn } from "node:child_process";

import { buildAwsCliArgs, formatCommand } from "./command-builder.js";
import type { AwsContext, PageResult } from "./types.js";
import { extractRows, getPath } from "../rendering/projector.js";
import type { OperationEntry } from "../model/types.js";

export class AwsCliError extends Error {
  public constructor(
    message: string,
    public readonly exitCode?: number,
  ) {
    super(message);
    this.name = "AwsCliError";
  }
}

function runAws(args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("aws", args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      signal,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      reject(
        error.message.includes("ENOENT")
          ? new AwsCliError("AWS CLI v2 was not found on PATH.")
          : error,
      );
    });
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else
        reject(
          new AwsCliError(
            stderr.trim() || `AWS CLI exited with code ${code}.`,
            code ?? undefined,
          ),
        );
    });
  });
}

export class AwsCliExecutor {
  public constructor(private readonly context: AwsContext) {}

  public command(
    entry: OperationEntry,
    input: Record<string, unknown> = {},
  ): string {
    const args = buildAwsCliArgs(entry, input, this.context);
    const sensitiveValues = entry.inputFields
      .filter((field) => field.sensitive)
      .map((field) => input[field.name])
      .filter((value): value is string => typeof value === "string");
    return formatCommand(args, sensitiveValues);
  }

  public async execute(
    entry: OperationEntry,
    input: Record<string, unknown> = {},
    signal?: AbortSignal,
  ): Promise<PageResult> {
    const args = buildAwsCliArgs(entry, input, this.context);
    const sensitiveValues = entry.inputFields
      .filter((field) => field.sensitive)
      .map((field) => input[field.name])
      .filter((value): value is string => typeof value === "string");
    const startedAt = performance.now();
    const stdout = await runAws(args, signal);
    const durationMs = Math.round(performance.now() - startedAt);

    let output: Record<string, unknown>;
    try {
      output = stdout.trim()
        ? (JSON.parse(stdout) as Record<string, unknown>)
        : {};
    } catch {
      throw new AwsCliError("AWS CLI returned output that was not valid JSON.");
    }

    const nextToken = getPath(output, entry.pagination?.outputToken);
    return {
      entry,
      input,
      output,
      rows: extractRows(entry, output),
      ...(nextToken !== undefined && nextToken !== null ? { nextToken } : {}),
      command: formatCommand(args, sensitiveValues),
      durationMs,
    };
  }

  public nextInput(page: PageResult): Record<string, unknown> | undefined {
    const inputToken = page.entry.pagination?.inputToken;
    if (!inputToken || page.nextToken === undefined) return undefined;
    return { ...page.input, [inputToken]: page.nextToken };
  }
}
