import { Box, Text, useStdout } from "ink";
import type { ReactNode } from "react";

import { COLORS } from "../constants.js";
import { useDebug } from "../debug.js";

export function frameHeaderHeight(
  columns: number,
  title: string,
  metadata?: string,
): number {
  const titleText = `>_ AWS TUI · ${title}`;
  return metadata !== undefined &&
    titleText.length + metadata.length + 9 > columns
    ? 4
    : 3;
}

export function Frame({
  title,
  metadata,
  help,
  children,
}: {
  title: string;
  metadata?: string;
  help: string;
  children: ReactNode;
}) {
  const { stdout } = useStdout();
  const debug = useDebug();
  const columns = stdout?.columns ?? 80;
  const titleText = `>_ AWS TUI · ${title}`;
  const stackHeader = frameHeaderHeight(columns, title, metadata) === 4;

  return (
    <Box flexDirection="column" width="100%">
      <Box
        borderStyle="single"
        borderColor={COLORS.accent}
        paddingX={1}
        flexDirection={stackHeader ? "column" : "row"}
        justifyContent={stackHeader ? "flex-start" : "space-between"}
        width="100%"
      >
        <Text bold color={COLORS.accent} wrap="truncate-end">
          {titleText}
        </Text>
        {metadata && (
          <Text dimColor wrap="truncate-end">
            {metadata}
          </Text>
        )}
      </Box>
      <Box flexDirection="column" paddingX={1}>
        {children}
      </Box>
      <Box paddingX={1}>
        <Text dimColor wrap="truncate-end">
          {help}
        </Text>
      </Box>
      <Box paddingX={1} height={1}>
        {debug.visible && (
          <Text color="yellow" wrap="truncate-end">
            DEBUG · {debug.command ?? "No AWS CLI command has run yet."}
          </Text>
        )}
      </Box>
    </Box>
  );
}
