import { Box, Text, useInput, useStdout } from "ink";
import { useMemo, useState } from "react";

import type { RelatedResource } from "../../model/catalog.js";
import { scoreFuzzyText } from "../../search/fuzzy.js";
import { Frame, frameHeaderHeight } from "../components/Frame.js";
import { HELP } from "../constants.js";
import { formatResourcePath, type ResourcePath } from "../resource-route.js";

function inputSummary(relation: RelatedResource): string {
  const inherited =
    relation.inheritedFields.length > 0
      ? `${relation.inheritedFields.join(", ")} ✓`
      : "None inherited";
  if (relation.missingRequired.length > 0) {
    return `${inherited} · Need ${relation.missingRequired.join(", ")}`;
  }
  if (relation.remainingInputs > 0) {
    return `${inherited} · ${relation.remainingInputs} optional`;
  }
  return inherited;
}

export function RelatedResourcesScreen({
  parentName,
  relations,
  resourcePath,
  context,
  onSelect,
  onBack,
}: {
  parentName: string;
  relations: RelatedResource[];
  resourcePath?: ResourcePath;
  context?: string;
  onSelect: (relation: RelatedResource) => void;
  onBack: () => void;
}) {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const terminalHeight = stdout?.rows ?? 24;
  const title = formatResourcePath([
    ...(resourcePath ?? [parentName]),
    "RELATED RESOURCES",
  ]);
  const metadata = `${relations.length} available`;
  const resourceWidth = Math.max(14, Math.floor(terminalWidth * 0.22));
  const apiWidth = Math.max(18, Math.floor(terminalWidth * 0.25));
  const inputWidth = Math.max(18, Math.floor(terminalWidth * 0.25));
  const serviceWidth = Math.max(
    14,
    terminalWidth - resourceWidth - apiWidth - inputWidth - 8,
  );
  const visibleCount = Math.max(
    1,
    terminalHeight -
      frameHeaderHeight(terminalWidth, title, metadata, context) -
      5,
  );
  const [filterQuery, setFilterQuery] = useState("");
  const [filterActive, setFilterActive] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const filteredRelations = useMemo(() => {
    if (!filterQuery) return relations;
    return relations
      .map((relation, index) => {
        const values = [
          relation.resourceName,
          relation.entry.operationName,
          relation.entry.serviceTitle,
        ];
        const scores = values
          .map((value) => scoreFuzzyText(value, filterQuery))
          .filter((score): score is number => score !== undefined);
        return {
          relation,
          index,
          score: scores.length > 0 ? Math.min(...scores) : undefined,
        };
      })
      .filter(
        (
          result,
        ): result is {
          relation: RelatedResource;
          index: number;
          score: number;
        } => result.score !== undefined,
      )
      .sort(
        (left, right) => left.score - right.score || left.index - right.index,
      )
      .map((result) => result.relation);
  }, [filterQuery, relations]);
  const pageCount = Math.max(
    1,
    Math.ceil(filteredRelations.length / visibleCount),
  );
  const currentPage = Math.min(pageIndex, pageCount - 1);
  const pageStart = currentPage * visibleCount;
  const visible = filteredRelations.slice(pageStart, pageStart + visibleCount);
  const selected = visible[selectedIndex];
  const slots = Array.from(
    { length: visibleCount },
    (_, index) => visible[index],
  );

  useInput((input, key) => {
    if (filterActive) {
      if (key.escape) {
        setFilterQuery("");
        setFilterActive(false);
        setSelectedIndex(0);
        setPageIndex(0);
        return;
      }
      if (key.return) {
        setFilterActive(false);
        return;
      }
      if (key.backspace || key.delete) {
        setFilterQuery((value) => value.slice(0, -1));
        setSelectedIndex(0);
        setPageIndex(0);
        return;
      }
      if (input && !key.ctrl) {
        setFilterQuery((value) => `${value}${input}`);
        setSelectedIndex(0);
        setPageIndex(0);
      }
      return;
    }
    if (input.startsWith("/")) {
      setFilterActive(true);
      setFilterQuery(input.slice(1));
      setSelectedIndex(0);
      setPageIndex(0);
      return;
    }
    if (key.escape) {
      if (filterQuery) {
        setFilterQuery("");
        setSelectedIndex(0);
        setPageIndex(0);
        return;
      }
      onBack();
      return;
    }
    if (key.upArrow && visible.length > 0) {
      setSelectedIndex(
        (index) => (index - 1 + visible.length) % visible.length,
      );
      return;
    }
    if (key.downArrow && visible.length > 0) {
      setSelectedIndex((index) => (index + 1) % visible.length);
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
    if (key.return && selected) onSelect(selected);
  });

  return (
    <Frame
      title={title}
      metadata={metadata}
      {...(context ? { context } : {})}
      help={HELP.related}
    >
      <Box flexDirection="column">
        <Box>
          <Text color="cyan">/ </Text>
          <Text>{filterQuery}</Text>
          {filterActive && <Text inverse> </Text>}
          <Text dimColor wrap="truncate-end">
            {filterActive
              ? " fuzzy filter related resources · Enter apply · Esc clear"
              : filterQuery
                ? ` ${filteredRelations.length}/${relations.length} matches · / edit`
                : " press / to filter related resources"}
          </Text>
        </Box>
        <Box columnGap={1}>
          <Box width={2}>
            <Text> </Text>
          </Box>
          <Box width={resourceWidth}>
            <Text bold dimColor>
              RESOURCE
            </Text>
          </Box>
          <Box width={apiWidth}>
            <Text bold dimColor>
              API
            </Text>
          </Box>
          <Box width={serviceWidth}>
            <Text bold dimColor>
              SERVICE
            </Text>
          </Box>
          <Box width={inputWidth}>
            <Text bold dimColor>
              INPUTS
            </Text>
          </Box>
        </Box>
        {slots.map((relation, visibleIndex) => {
          const isSelected =
            relation !== undefined && visibleIndex === selectedIndex;
          return (
            <Box
              key={relation?.entry.id ?? `empty-${visibleIndex}`}
              height={1}
              columnGap={1}
            >
              <Box width={2}>
                <Text color={isSelected ? "cyan" : "white"}>
                  {isSelected ? "❯ " : "  "}
                </Text>
              </Box>
              <Box width={resourceWidth}>
                <Text color={isSelected ? "cyan" : "white"} wrap="truncate-end">
                  {relation?.resourceName ?? " "}
                </Text>
              </Box>
              <Box width={apiWidth}>
                <Text dimColor wrap="truncate-end">
                  {relation?.entry.operationName ?? " "}
                </Text>
              </Box>
              <Box width={serviceWidth}>
                <Text dimColor wrap="truncate-end">
                  {relation?.entry.serviceTitle ?? " "}
                </Text>
              </Box>
              <Box width={inputWidth}>
                <Text dimColor wrap="truncate-end">
                  {relation ? inputSummary(relation) : " "}
                </Text>
              </Box>
            </Box>
          );
        })}
        <Text dimColor wrap="truncate-end">
          {selected
            ? `${selected.source === "smithy" ? "Smithy child resource" : "Compatible modeled collection"} · ${inputSummary(selected)}`
            : "No related List APIs found"}
          {filteredRelations.length > 0
            ? ` · Page ${currentPage + 1}/${pageCount}`
            : " · Page 0/0"}
        </Text>
      </Box>
    </Frame>
  );
}
