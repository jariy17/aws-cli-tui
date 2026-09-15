import { Text, useApp, useInput } from "ink";

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
  const { exit } = useApp();
  useInput((input, key) => {
    if (key.ctrl && input === "q") exit();
    else if (key.escape) onBack?.();
  });

  return (
    <Frame
      title={title}
      help={onBack ? "Esc back · Ctrl+Q quit" : "Ctrl+Q quit"}
    >
      <Text color={error ? "red" : "cyan"}>{message}</Text>
    </Frame>
  );
}
