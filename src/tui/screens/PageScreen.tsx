import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useEffect, useMemo, useState } from "react";

import { Frame, frameHeaderHeight } from "../components/Frame.js";
import { TableView } from "../components/TableView.js";
import type { PageResult } from "../../execution/types.js";
import { fuzzyFilterRows } from "../../rendering/projector.js";

export function PageScreen({
  pages,
  pageIndex,
  loading,
  onNext,
  onPrevious,
  onBack,
  onDetail,
}: {
  pages: PageResult[];
  pageIndex: number;
  loading: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onBack: () => void;
  onDetail: (row: unknown) => void;
}) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const page = pages[pageIndex]!;
  const title = `${page.entry.resourceName.toUpperCase()} · PAGE ${pageIndex + 1}`;
  const metadata = `${page.entry.serviceTitle} · ${page.durationMs} ms`;
  const visibleRowCount = Math.max(
    1,
    (stdout?.rows ?? 24) -
      frameHeaderHeight(stdout?.columns ?? 80, title, metadata) -
      5,
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterQuery, setFilterQuery] = useState("");
  const [filterActive, setFilterActive] = useState(false);
  const filteredRows = useMemo(
    () => fuzzyFilterRows(page.rows, filterQuery),
    [filterQuery, page.rows],
  );

  useEffect(() => {
    setSelectedIndex(0);
    setFilterQuery("");
    setFilterActive(false);
  }, [pageIndex]);

  useEffect(() => setSelectedIndex(0), [filterQuery]);

  useInput((input, key) => {
    if (key.ctrl && input === "q") {
      exit();
      return;
    }
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
        setFilterQuery((value) => value.slice(0, -1));
        return;
      }
      if (input && !key.ctrl) {
        setFilterQuery((value) => `${value}${input}`);
      }
      return;
    }
    if (input.startsWith("/")) {
      setFilterActive(true);
      setFilterQuery(input.slice(1));
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
    if ((key.upArrow || input === "k") && filteredRows.length > 0) {
      setSelectedIndex(
        (index) => (index - 1 + filteredRows.length) % filteredRows.length,
      );
      return;
    }
    if ((key.downArrow || input === "j") && filteredRows.length > 0) {
      setSelectedIndex((index) => (index + 1) % filteredRows.length);
      return;
    }
    if (input.toLowerCase() === "n" && !loading) {
      onNext();
      return;
    }
    if (input.toLowerCase() === "b" && !loading) {
      onPrevious();
      return;
    }
    if (key.return && filteredRows[selectedIndex] !== undefined) {
      onDetail(filteredRows[selectedIndex]);
    }
  });

  return (
    <Frame
      title={title}
      metadata={metadata}
      help={[
        "/ Filter",
        "↑/↓ Move",
        "Enter Inspect",
        page.nextToken !== undefined ? "N Next" : undefined,
        pageIndex > 0 ? "B Previous" : undefined,
        filterQuery ? "Esc Clear" : "Esc APIs",
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      <Box>
        <Text color="cyan">/ </Text>
        <Text>{filterQuery}</Text>
        {filterActive && <Text inverse> </Text>}
        <Text dimColor wrap="truncate-end">
          {filterActive
            ? " fuzzy search this API page · Enter apply · Esc clear"
            : filterQuery
              ? ` ${filteredRows.length}/${page.rows.length} rows · / edit · Esc clear`
              : " press / to fuzzy search this API page"}
        </Text>
      </Box>
      <TableView
        rows={filteredRows}
        selectedIndex={selectedIndex}
        visibleRowCount={visibleRowCount}
      />
      <Text dimColor wrap="truncate-end">
        {page.entry.operationName} · Page {pageIndex + 1} ·{" "}
        {filteredRows.length}/{page.rows.length} rows ·{" "}
        {loading
          ? "Loading…"
          : page.nextToken !== undefined
            ? "Next page available"
            : "Final page"}
      </Text>
    </Frame>
  );
}
