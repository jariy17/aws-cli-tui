import { Box, Text } from "ink";

import type { OperationEntry } from "../../model/types.js";
import { COLORS } from "../constants.js";

function Field({
  label,
  value,
  labelWidth,
}: {
  label: string;
  value: string;
  labelWidth: number;
}) {
  return (
    <Box>
      <Box width={labelWidth} flexShrink={0}>
        <Text dimColor>{label}</Text>
      </Box>
      <Box flexGrow={1}>
        <Text wrap="truncate-end">{value}</Text>
      </Box>
    </Box>
  );
}

export function OperationDetail({
  entry,
}: {
  entry: OperationEntry | undefined;
}) {
  const labelWidth = 16;
  const requiredInputs =
    entry?.inputFields
      .filter((field) => field.required)
      .map((field) => field.name)
      .join(", ") || "None";

  return (
    <Box flexDirection="column">
      <Text
        bold
        wrap="truncate-end"
        {...(entry ? { color: COLORS.action } : {})}
      >
        {entry?.displayName ?? "Selected API"}
      </Text>
      <Text> </Text>
      <Field
        label="Service"
        value={entry?.serviceTitle ?? "—"}
        labelWidth={labelWidth}
      />
      <Field
        label="Service command"
        value={entry?.serviceCliName ?? "—"}
        labelWidth={labelWidth}
      />
      <Field
        label="API operation"
        value={entry?.operationName ?? "—"}
        labelWidth={labelWidth}
      />
      <Field
        label="Mode"
        value={entry?.mode.toUpperCase() ?? "—"}
        labelWidth={labelWidth}
      />
      <Field
        label="Required inputs"
        value={entry ? requiredInputs : "—"}
        labelWidth={labelWidth}
      />
      <Field
        label="Pagination"
        value={
          entry ? (entry.pagination ? "Page by page" : "Single response") : "—"
        }
        labelWidth={labelWidth}
      />
    </Box>
  );
}
