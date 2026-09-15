import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useEffect, useMemo, useState } from "react";

import type { ArnOccurrence } from "../../model/github-smithy.js";

type JsonLine = {
  text: string;
  arn?: string;
  key?: string;
};

type JsonEntry = {
  lineIndex: number;
  line: JsonLine;
};

export function arnOccurrenceKey(occurrence: ArnOccurrence): string {
  return `${occurrence.key ?? ""}\u0000${occurrence.arn}`;
}

function parseJsonLine(text: string): JsonLine {
  const keyMatch = /^\s*"((?:\\.|[^"])*)"\s*:/.exec(text);
  const arnMatch = /"(arn:[^"]+)"/.exec(text);
  let key: string | undefined;
  if (keyMatch) {
    try {
      key = JSON.parse(`"${keyMatch[1]}"`) as string;
    } catch {
      key = keyMatch[1];
    }
  }
  return {
    text,
    ...(arnMatch?.[1] ? { arn: arnMatch[1] } : {}),
    ...(key ? { key } : {}),
  };
}

export function findArnOccurrences(value: unknown): ArnOccurrence[] {
  const serialized = JSON.stringify(value, null, 2);
  if (serialized === undefined) return [];
  const occurrences = serialized
    .split("\n")
    .map(parseJsonLine)
    .flatMap((line) =>
      line.arn
        ? [
            {
              arn: line.arn,
              ...(line.key ? { key: line.key } : {}),
            },
          ]
        : [],
    );
  return occurrences.filter(
    (occurrence, index, values) =>
      values.findIndex(
        (candidate) =>
          arnOccurrenceKey(candidate) === arnOccurrenceKey(occurrence),
      ) === index,
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

function isJsonEntry(line: JsonLine): boolean {
  if (line.key !== undefined) return true;
  const text = line.text.trim().replace(/,$/, "");
  return !["{", "}", "[", "]"].includes(text);
}

function SyntaxLine({
  line,
  selected,
  linked,
}: {
  line: JsonLine;
  selected: boolean;
  linked: boolean;
}) {
  if (line.arn && linked) {
    const start = line.text.indexOf(line.arn);
    return (
      <Text
        wrap="truncate-end"
        {...(selected ? { backgroundColor: "cyan", color: "black" } : {})}
      >
        {line.text.slice(0, start)}
        <Text color={selected ? "black" : "cyan"} underline>
          {line.arn}
        </Text>
        {line.text.slice(start + line.arn.length)}
      </Text>
    );
  }

  const keyMatch = /^(\s*)("[^"]+")(:\s*)(.*)$/.exec(line.text);
  if (!keyMatch) {
    return (
      <Text
        color={selected ? "black" : "gray"}
        {...(selected ? { backgroundColor: "cyan" as const } : {})}
        wrap="truncate-end"
      >
        {line.text}
      </Text>
    );
  }
  const [, indentation, key, separator, value] = keyMatch;
  const valueColor = value?.startsWith('"')
    ? "green"
    : /^(true|false|null)/.test(value ?? "")
      ? "magenta"
      : /^-?\d/.test(value ?? "")
        ? "yellow"
        : "gray";
  return (
    <Text
      {...(selected
        ? { color: "black" as const, backgroundColor: "cyan" as const }
        : {})}
      wrap="truncate-end"
    >
      {indentation}
      <Text color={selected ? "black" : "cyan"}>{key}</Text>
      {separator}
      <Text color={selected ? "black" : valueColor}>{value}</Text>
    </Text>
  );
}

export function JsonView({
  value,
  resolvableArns,
  checkingArns,
  onOpenArn,
  onBack,
}: {
  value: unknown;
  resolvableArns: ReadonlySet<string>;
  checkingArns: boolean;
  onOpenArn: (occurrence: ArnOccurrence) => void;
  onBack: () => void;
}) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;
  const lineLimit = Math.max(4, terminalHeight - 7);
  const lines = useMemo(() => {
    const serialized = JSON.stringify(value, null, 2);
    return (serialized ?? String(value)).split("\n").map(parseJsonLine);
  }, [value]);
  const entries = useMemo<JsonEntry[]>(
    () =>
      lines.flatMap((line, lineIndex) =>
        isJsonEntry(line) ? [{ lineIndex, line }] : [],
      ),
    [lines],
  );
  const allReferences = useMemo(
    () =>
      lines.flatMap((line, lineIndex) =>
        line.arn
          ? [
              {
                lineIndex,
                occurrence: {
                  arn: line.arn,
                  ...(line.key ? { key: line.key } : {}),
                },
              },
            ]
          : [],
      ),
    [lines],
  );
  const references = useMemo(
    () =>
      allReferences.filter(({ occurrence }) =>
        resolvableArns.has(arnOccurrenceKey(occurrence)),
      ),
    [allReferences, resolvableArns],
  );
  const [selectedEntry, setSelectedEntry] = useState(0);
  const [scrollStart, setScrollStart] = useState(0);
  const maximumScroll = Math.max(0, lines.length - lineLimit);

  useEffect(() => {
    setSelectedEntry(0);
    const firstLine = entries[0]?.lineIndex ?? 0;
    setScrollStart(
      clamp(firstLine - Math.floor(lineLimit / 2), 0, maximumScroll),
    );
  }, [entries, lineLimit, maximumScroll]);

  useInput((input, key) => {
    if (key.ctrl && input === "q") {
      exit();
      return;
    }
    if (key.escape) {
      onBack();
      return;
    }
    if (
      (key.upArrow ||
        key.downArrow ||
        input.toLowerCase() === "j" ||
        input.toLowerCase() === "k") &&
      entries.length > 0
    ) {
      const direction = key.upArrow || input.toLowerCase() === "k" ? -1 : 1;
      const next =
        (selectedEntry + direction + entries.length) % entries.length;
      setSelectedEntry(next);
      setScrollStart(
        clamp(
          entries[next]!.lineIndex - Math.floor(lineLimit / 2),
          0,
          maximumScroll,
        ),
      );
      return;
    }
    if ((key.pageDown || key.pageUp) && entries.length > 0) {
      const direction = key.pageDown ? 1 : -1;
      const next = clamp(
        selectedEntry + direction * lineLimit,
        0,
        entries.length - 1,
      );
      setSelectedEntry(next);
      setScrollStart(
        clamp(
          entries[next]!.lineIndex - Math.floor(lineLimit / 2),
          0,
          maximumScroll,
        ),
      );
      return;
    }
    const selected = entries[selectedEntry];
    if (key.return && selected?.line.arn) {
      const occurrence = {
        arn: selected.line.arn,
        ...(selected.line.key ? { key: selected.line.key } : {}),
      };
      if (resolvableArns.has(arnOccurrenceKey(occurrence))) {
        onOpenArn(occurrence);
      }
    }
  });

  const selectedLine = entries[selectedEntry]?.lineIndex;
  const selectedOccurrence = entries[selectedEntry]?.line.arn
    ? {
        arn: entries[selectedEntry]!.line.arn!,
        ...(entries[selectedEntry]!.line.key
          ? { key: entries[selectedEntry]!.line.key }
          : {}),
      }
    : undefined;
  const selectedIsLinked =
    selectedOccurrence !== undefined &&
    resolvableArns.has(arnOccurrenceKey(selectedOccurrence));
  const visible = lines.slice(scrollStart, scrollStart + lineLimit);

  return (
    <Box flexDirection="column">
      {visible.map((line, index) => {
        const lineIndex = scrollStart + index;
        return (
          <SyntaxLine
            key={lineIndex}
            line={line}
            selected={lineIndex === selectedLine}
            linked={
              line.arn !== undefined &&
              resolvableArns.has(
                arnOccurrenceKey({
                  arn: line.arn,
                  ...(line.key ? { key: line.key } : {}),
                }),
              )
            }
          />
        );
      })}
      <Text dimColor wrap="truncate-end">
        Lines {scrollStart + 1}–
        {Math.min(lines.length, scrollStart + lineLimit)} of {lines.length}
        {checkingArns
          ? " · Checking ARN links…"
          : entries.length > 0
            ? ` · Entry ${selectedEntry + 1}/${entries.length}${selectedIsLinked ? " · Enter open ARN" : references.length > 0 ? " · Linked ARNs underlined" : ""}`
            : allReferences.length > 0
              ? " · No linked ARN resources"
              : ""}
      </Text>
    </Box>
  );
}
