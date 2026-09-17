import { Box, Text, useInput, useStdout } from "ink";
import { useEffect, useMemo, useState } from "react";

import type { ArnOccurrence } from "../../model/github-smithy.js";
import { scoreFuzzyText } from "../../search/fuzzy.js";

type JsonLine = {
  text: string;
  arn?: string;
  key?: string;
  related?: boolean;
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
  if (line.related) return true;
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
  if (line.related) {
    return (
      <Text
        color={selected ? "black" : "cyan"}
        {...(selected ? { backgroundColor: "cyan" as const } : {})}
        bold
        wrap="truncate-end"
      >
        {line.text}
      </Text>
    );
  }

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
  relatedCount = 0,
  onRelated,
  onBack,
}: {
  value: unknown;
  resolvableArns: ReadonlySet<string>;
  checkingArns: boolean;
  onOpenArn: (occurrence: ArnOccurrence) => void;
  relatedCount?: number;
  onRelated?: () => void;
  onBack: () => void;
}) {
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;
  const lineLimit = Math.max(4, terminalHeight - 9);
  const [filterQuery, setFilterQuery] = useState("");
  const [filterActive, setFilterActive] = useState(false);
  const baseLines = useMemo(() => {
    const serialized = JSON.stringify(value, null, 2);
    const jsonLines = (serialized ?? String(value))
      .split("\n")
      .map(parseJsonLine);
    return relatedCount > 0
      ? [
          ...jsonLines,
          {
            text: `Related resources (${relatedCount})`,
            related: true,
          },
        ]
      : jsonLines;
  }, [relatedCount, value]);
  const lines = useMemo(
    () =>
      filterQuery
        ? baseLines.filter(
            (line) => scoreFuzzyText(line.text, filterQuery) !== undefined,
          )
        : baseLines,
    [baseLines, filterQuery],
  );
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
    if (filterActive) {
      if (key.escape) {
        setFilterQuery("");
        setFilterActive(false);
        return;
      }
      if (key.return) {
        setFilterActive(false);
        return;
      }
      if (key.backspace || key.delete) {
        setFilterQuery((current) => current.slice(0, -1));
        return;
      }
      if (input && !key.ctrl) {
        setFilterQuery((current) => `${current}${input}`);
      }
      return;
    }
    if (input.startsWith("/")) {
      setFilterActive(true);
      setFilterQuery(input.slice(1));
      return;
    }
    if (
      input.toLowerCase() === "r" &&
      !key.ctrl &&
      relatedCount > 0 &&
      onRelated
    ) {
      onRelated();
      return;
    }
    if (key.escape) {
      if (filterQuery) {
        setFilterQuery("");
        return;
      }
      onBack();
      return;
    }
    if ((key.upArrow || key.downArrow) && entries.length > 0) {
      const direction = key.upArrow ? -1 : 1;
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
    if ((key.rightArrow || key.leftArrow) && entries.length > 0) {
      const direction = key.rightArrow ? 1 : -1;
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
    if (key.return && selected?.line.related && onRelated) {
      onRelated();
      return;
    }
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
  const selectedIsRelated = entries[selectedEntry]?.line.related === true;
  const visible = lines.slice(scrollStart, scrollStart + lineLimit);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">/ </Text>
        <Text>{filterQuery}</Text>
        {filterActive && <Text inverse> </Text>}
        <Text dimColor wrap="truncate-end">
          {filterActive
            ? " fuzzy filter detail entries · Enter apply · Esc clear"
            : filterQuery
              ? ` ${entries.length} matching entries · / edit`
              : " press / to filter detail entries"}
        </Text>
      </Box>
      {visible.map((line, index) => {
        const lineIndex = scrollStart + index;
        return (
          <SyntaxLine
            key={lineIndex}
            line={line}
            selected={lineIndex === selectedLine}
            linked={
              !line.related &&
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
            ? ` · Entry ${selectedEntry + 1}/${entries.length}${selectedIsRelated ? " · Enter open related resources" : selectedIsLinked ? " · Enter open ARN" : references.length > 0 ? " · Linked ARNs underlined" : ""}`
            : allReferences.length > 0
              ? " · No linked ARN resources"
              : ""}
      </Text>
    </Box>
  );
}
