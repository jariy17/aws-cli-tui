import { useEffect, useMemo, useState } from "react";

import { Frame } from "../components/Frame.js";
import {
  JsonView,
  arnOccurrenceKey,
  findArnOccurrences,
} from "../components/JsonView.js";
import { HELP } from "../constants.js";
import type { ArnOccurrence } from "../../model/github-smithy.js";
import type { OperationEntry } from "../../model/types.js";

export type DetailState = {
  entry: OperationEntry;
  value: unknown;
  source: "list row" | "get response";
};

export function DetailScreen({
  detail,
  onBack,
  onCheckArn,
  onOpenArn,
}: {
  detail: DetailState;
  onBack: () => void;
  onCheckArn: (occurrence: ArnOccurrence) => Promise<boolean>;
  onOpenArn: (occurrence: ArnOccurrence) => void;
}) {
  const occurrences = useMemo(
    () => findArnOccurrences(detail.value),
    [detail.value],
  );
  const [checkingArns, setCheckingArns] = useState(occurrences.length > 0);
  const [resolvableArns, setResolvableArns] = useState<ReadonlySet<string>>(
    new Set(),
  );

  useEffect(() => {
    let active = true;
    setResolvableArns(new Set());
    setCheckingArns(occurrences.length > 0);
    void Promise.all(
      occurrences.map(async (occurrence) => ({
        occurrence,
        resolvable: await onCheckArn(occurrence).catch(() => false),
      })),
    ).then((results) => {
      if (!active) return;
      setResolvableArns(
        new Set(
          results
            .filter((result) => result.resolvable)
            .map((result) => arnOccurrenceKey(result.occurrence)),
        ),
      );
      setCheckingArns(false);
    });
    return () => {
      active = false;
    };
  }, [occurrences, onCheckArn]);

  return (
    <Frame
      title="RESOURCE DETAIL"
      metadata={`${detail.entry.serviceTitle} · ${detail.entry.operationName}`}
      help={HELP.detail}
    >
      <JsonView
        value={detail.value}
        resolvableArns={resolvableArns}
        checkingArns={checkingArns}
        onOpenArn={onOpenArn}
        onBack={onBack}
      />
    </Frame>
  );
}
