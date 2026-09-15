import { useInput } from "ink";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type DebugContextValue = {
  visible: boolean;
  command: string | undefined;
  setCommand: (command: string) => void;
};

const DebugContext = createContext<DebugContextValue>({
  visible: false,
  command: undefined,
  setCommand: () => {},
});

export function DebugProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [command, setCommand] = useState<string>();

  useInput((input, key) => {
    if (key.ctrl && input === "g") {
      setVisible((current) => !current);
    }
  });

  const value = useMemo(
    () => ({ visible, command, setCommand }),
    [command, visible],
  );

  return (
    <DebugContext.Provider value={value}>{children}</DebugContext.Provider>
  );
}

export function useDebug(): DebugContextValue {
  return useContext(DebugContext);
}
