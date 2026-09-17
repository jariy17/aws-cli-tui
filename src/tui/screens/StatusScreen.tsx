import { Text, useInput } from "ink";

import { Frame } from "../components/Frame.js";

export function StatusScreen({
  title,
  message,
  error = false,
  onBack,
}: {
  title: string;
  message: string;
  error?: boolean;
  onBack?: () => void;
}) {
  useInput((_input, key) => {
    if (key.escape) onBack?.();
  });

  return (
    <Frame title={title} help={onBack ? "Esc Back" : "Working…"}>
      <Text color={error ? "red" : "cyan"}>{message}</Text>
    </Frame>
  );
}
