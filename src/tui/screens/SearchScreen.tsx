import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useMemo, useState } from "react";

import { Frame, frameHeaderHeight } from "../components/Frame.js";
import { HELP } from "../constants.js";
import type { SmithyCatalog } from "../../model/catalog.js";
import type {
  OperationEntry,
  SupportedOperationMode,
} from "../../model/types.js";
import { hasDefaultValue } from "../../model/input-values.js";

function normalizedInput(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9:]/g, "");
}

export function SearchScreen({
  catalog,
  initialMode,
  onSelect,
}: {
  catalog: SmithyCatalog;
  initialMode?: SupportedOperationMode;
  onSelect: (entry: OperationEntry) => void;
}) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const terminalHeight = stdout?.rows ?? 24;
  const title = initialMode
    ? `${initialMode.toUpperCase()} SEARCH`
    : "GLOBAL SEARCH";
  const metadata = `${catalog.metadata().operationCount.toLocaleString()} AWS APIs`;
  const apiWidth = Math.max(14, Math.floor(terminalWidth * 0.28));
  const actionWidth = 10;
  const serviceWidth = Math.max(16, Math.floor(terminalWidth * 0.32));
  const resourceWidth = Math.max(
    12,
    terminalWidth - apiWidth - actionWidth - serviceWidth - 8,
  );
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const matches = useMemo(
    () => catalog.search(query, initialMode, catalog.metadata().operationCount),
    [catalog, initialMode, query],
  );
  const maxVisibleMatches = Math.max(
    1,
    terminalHeight - frameHeaderHeight(terminalWidth, title, metadata) - 6,
  );
  const pageCount = Math.max(1, Math.ceil(matches.length / maxVisibleMatches));
  const currentPage = Math.min(pageIndex, pageCount - 1);
  const pageStart = currentPage * maxVisibleMatches;
  const pageMatches = matches.slice(pageStart, pageStart + maxVisibleMatches);
  const selected = pageMatches[selectedIndex] ?? pageMatches[0];
  const matchSlots = Array.from(
    { length: maxVisibleMatches },
    (_, index) => pageMatches[index],
  );
  const requiredInputs = selected?.inputFields.filter(
    (field) => field.required && !hasDefaultValue(field),
  );
  const selectedSummary = selected
    ? selected.supported
      ? `${selected.operationName} · ${
          requiredInputs?.length
            ? `Inputs: ${requiredInputs.map((field) => field.name).join(", ")}`
            : "No required inputs"
        } · ${selected.pagination ? "Page by page" : "Single response"}`
      : `${selected.operationName} · Unsupported · ${selected.unsupportedReason ?? "Not available"}`
    : "No API selected · Required inputs — · Pagination —";

  useInput((input, key) => {
    if (key.ctrl) return;
    if (key.escape) {
      if (query) {
        setQuery("");
        setSelectedIndex(0);
        setPageIndex(0);
      } else {
        exit();
      }
      return;
    }
    if (key.upArrow && pageMatches.length > 0) {
      setSelectedIndex(
        (index) => (index - 1 + pageMatches.length) % pageMatches.length,
      );
      return;
    }
    if (key.downArrow && pageMatches.length > 0) {
      setSelectedIndex((index) => (index + 1) % pageMatches.length);
      return;
    }
    if (key.leftArrow && currentPage > 0) {
      setPageIndex(currentPage - 1);
      setSelectedIndex(0);
      return;
    }
    if (key.rightArrow && currentPage + 1 < pageCount) {
      setPageIndex(currentPage + 1);
      setSelectedIndex(0);
      return;
    }
    if (key.return && selected?.supported) {
      onSelect(selected);
      return;
    }
    if (key.backspace || key.delete) {
      setQuery((value) => value.slice(0, -1));
      setSelectedIndex(0);
      setPageIndex(0);
      return;
    }
    const next = normalizedInput(input);
    if (next) {
      setQuery((value) => `${value}${next}`);
      setSelectedIndex(0);
      setPageIndex(0);
    }
  });

  return (
    <Frame title={title} metadata={metadata} help={HELP.search}>
      <Box marginBottom={1}>
        <Text color="cyan">/ </Text>
        <Text>{query}</Text>
        <Text inverse> </Text>
        {!query && <Text dimColor>agentruntime</Text>}
      </Box>
      <Box flexDirection="column">
        <Box columnGap={1}>
          <Box width={2}>
            <Text> </Text>
          </Box>
          <Box width={apiWidth}>
            <Text bold dimColor>
              API
            </Text>
          </Box>
          <Box width={actionWidth}>
            <Text bold dimColor>
              ACTION
            </Text>
          </Box>
          <Box width={serviceWidth}>
            <Text bold dimColor>
              SERVICE
            </Text>
          </Box>
          <Box width={resourceWidth}>
            <Text bold dimColor>
              RESOURCE
            </Text>
          </Box>
        </Box>
        {matchSlots.map((entry, visibleIndex) => {
          const isSelected =
            entry !== undefined && visibleIndex === selectedIndex;
          const isUnsupported = entry?.supported === false;
          return (
            <Box
              key={entry?.id ?? `empty-${visibleIndex}`}
              height={1}
              columnGap={1}
            >
              <Box width={2}>
                <Text
                  color={isUnsupported ? "gray" : isSelected ? "cyan" : "white"}
                  dimColor={isUnsupported}
                >
                  {isSelected ? "❯ " : "  "}
                </Text>
              </Box>
              <Box width={apiWidth}>
                <Text
                  color={isUnsupported ? "gray" : isSelected ? "cyan" : "white"}
                  dimColor={isUnsupported}
                  wrap="truncate-end"
                >
                  {entry?.displayName ?? " "}
                </Text>
              </Box>
              <Box width={actionWidth}>
                <Text {...(isUnsupported ? { color: "gray" } : {})} dimColor>
                  {entry?.action ?? " "}
                </Text>
              </Box>
              <Box width={serviceWidth}>
                <Text
                  {...(isUnsupported ? { color: "gray" } : {})}
                  dimColor
                  wrap="truncate-end"
                >
                  {entry?.serviceTitle ?? " "}
                </Text>
              </Box>
              <Box width={resourceWidth}>
                <Text
                  {...(isUnsupported ? { color: "gray" } : {})}
                  dimColor
                  wrap="truncate-end"
                >
                  {entry
                    ? (entry.resourceNames ?? [entry.resourceName]).join(", ")
                    : " "}
                </Text>
              </Box>
            </Box>
          );
        })}
        <Text dimColor wrap="truncate-end">
          {selectedSummary} · {matches.length} match
          {matches.length === 1 ? "" : "es"} ·{" "}
          {matches.length > 0
            ? `Page ${currentPage + 1}/${pageCount} · ${pageStart + selectedIndex + 1} selected`
            : "Page 0/0 · 0 selected"}
        </Text>
      </Box>
    </Frame>
  );
}
