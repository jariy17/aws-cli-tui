import { Box, Text, useStdout } from "ink";

import { displayValue, projectTable } from "../../rendering/projector.js";

function truncate(value: string, width: number): string {
  if (value.length <= width) return value;
  return `${value.slice(0, Math.max(1, width - 1))}…`;
}

export function TableView({
  rows,
  selectedIndex,
  visibleRowCount,
}: {
  rows: unknown[];
  selectedIndex: number;
  visibleRowCount: number;
}) {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 100;
  const table = projectTable(rows, terminalWidth < 90 ? 3 : 5);
  const contentWidth = Math.max(30, terminalWidth - 8);
  const markerWidth = 2;
  const columnWidth = Math.max(
    10,
    Math.floor((contentWidth - markerWidth) / table.columns.length),
  );
  const viewportStart = Math.max(
    0,
    Math.min(
      selectedIndex - Math.floor(visibleRowCount / 2),
      table.rows.length - visibleRowCount,
    ),
  );
  const viewportEnd = Math.min(
    table.rows.length,
    viewportStart + visibleRowCount,
  );
  const visibleRows = table.rows.slice(viewportStart, viewportEnd);
  const rowSlots = Array.from(
    { length: visibleRowCount },
    (_, index) => visibleRows[index],
  );

  return (
    <Box flexDirection="column">
      <Box>
        <Box width={markerWidth}>
          <Text> </Text>
        </Box>
        {table.columns.map((column) => (
          <Box key={column} width={columnWidth}>
            <Text bold dimColor>
              {truncate(column, columnWidth - 1)}
            </Text>
          </Box>
        ))}
      </Box>
      {rowSlots.map((row, index) => {
        const actualIndex = viewportStart + index;
        const selected = row !== undefined && actualIndex === selectedIndex;
        return (
          <Box
            key={row === undefined ? `empty-${index}` : actualIndex}
            height={1}
          >
            <Box width={markerWidth}>
              <Text color={selected ? "cyan" : "white"}>
                {selected ? "❯ " : "  "}
              </Text>
            </Box>
            {table.columns.map((column) => (
              <Box key={column} width={columnWidth}>
                <Text color={selected ? "cyan" : "white"}>
                  {row === undefined
                    ? " "
                    : truncate(displayValue(row[column]), columnWidth - 1)}
                </Text>
              </Box>
            ))}
          </Box>
        );
      })}
    </Box>
  );
}
