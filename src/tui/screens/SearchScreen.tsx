import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useMemo, useState } from "react";

import { Frame, frameHeaderHeight } from "../components/Frame.js";
import { HELP } from "../constants.js";
import type { SmithyCatalog } from "../../model/catalog.js";
import type { OperationEntry, OperationMode } from "../../model/types.js";

function normalizedInput(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9:]/g, "");
}

export function SearchScreen({
  catalog,
  initialMode,
  onSelect,
}: {
  catalog: SmithyCatalog;
  initialMode?: OperationMode;
  onSelect: (entry: OperationEntry) => void;
}) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const terminalHeight = stdout?.rows ?? 24;
  const title = initialMode
    ? `${initialMode.toUpperCase()} SEARCH`
    : "GLOBAL SEARCH";
  const metadata = `${catalog.metadata().operationCount.toLocaleString()} read APIs`;
  const apiWidth = Math.max(14, Math.floor(terminalWidth * 0.28));
  const modeWidth = 7;
  const serviceWidth = Math.max(16, Math.floor(terminalWidth * 0.32));
  const resourceWidth = Math.max(
    12,
    terminalWidth - apiWidth - modeWidth - serviceWidth - 8,
  );
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const matches = useMemo(
    () => catalog.search(query, initialMode, 20),
    [catalog, initialMode, query],
  );
  const selected = matches[selectedIndex] ?? matches[0];
  const maxVisibleMatches = Math.max(
    1,
    terminalHeight - frameHeaderHeight(terminalWidth, title, metadata) - 6,
  );
  const viewportStart = Math.max(
    0,
    Math.min(
      selectedIndex - Math.floor(maxVisibleMatches / 2),
      matches.length - maxVisibleMatches,
    ),
  );
  const viewportEnd = Math.min(
    matches.length,
    viewportStart + maxVisibleMatches,
  );
  const visibleMatches = matches.slice(viewportStart, viewportEnd);
  const matchSlots = Array.from(
    { length: maxVisibleMatches },
    (_, index) => visibleMatches[index],
  );
  const requiredInputs = selected?.inputFields.filter(
    (field) => field.required,
  );
  const selectedSummary = selected
    ? `${selected.operationName} · ${
        requiredInputs?.length
          ? `Inputs: ${requiredInputs.map((field) => field.name).join(", ")}`
          : "No required inputs"
      } · ${selected.pagination ? "Page by page" : "Single response"}`
    : "No API selected · Required inputs — · Pagination —";

  useInput((input, key) => {
    if (key.ctrl && input === "q") {
      exit();
      return;
    }
    if (key.ctrl) return;
    if (key.escape) {
      if (query) {
        setQuery("");
        setSelectedIndex(0);
      } else {
        exit();
      }
      return;
    }
    if (key.upArrow && matches.length > 0) {
      setSelectedIndex(
        (index) => (index - 1 + matches.length) % matches.length,
      );
      return;
    }
    if (key.downArrow && matches.length > 0) {
      setSelectedIndex((index) => (index + 1) % matches.length);
      return;
    }
    if (key.return && selected) {
      onSelect(selected);
      return;
    }
    if (key.backspace || key.delete) {
      setQuery((value) => value.slice(0, -1));
      setSelectedIndex(0);
      return;
    }
    const next = normalizedInput(input);
    if (next) {
      setQuery((value) => `${value}${next}`);
      setSelectedIndex(0);
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
          <Box width={modeWidth}>
            <Text bold dimColor>
              MODE
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
          const index = viewportStart + visibleIndex;
          const isSelected = entry !== undefined && index === selectedIndex;
          return (
            <Box
              key={entry?.id ?? `empty-${visibleIndex}`}
              height={1}
              columnGap={1}
            >
              <Box width={2}>
                <Text {...(isSelected ? { color: "cyan" } : {})}>
                  {isSelected ? "❯ " : "  "}
                </Text>
              </Box>
              <Box width={apiWidth}>
                <Text color={isSelected ? "cyan" : "white"} wrap="truncate-end">
                  {entry?.displayName ?? " "}
                </Text>
              </Box>
              <Box width={modeWidth}>
                <Text dimColor>{entry?.mode.toUpperCase() ?? " "}</Text>
              </Box>
              <Box width={serviceWidth}>
                <Text dimColor wrap="truncate-end">
                  {entry?.serviceTitle ?? " "}
                </Text>
              </Box>
              <Box width={resourceWidth}>
                <Text dimColor wrap="truncate-end">
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
          {selected ? `${selectedIndex + 1} selected` : "0 selected"}
          {viewportStart > 0 ? ` · ${viewportStart} above` : ""}
          {viewportEnd < matches.length
            ? ` · ${matches.length - viewportEnd} below`
            : ""}
        </Text>
      </Box>
    </Frame>
  );
}
