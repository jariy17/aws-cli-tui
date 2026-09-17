import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { Frame } from "../components/Frame.js";
import { JsonView, arnOccurrenceKey, findArnOccurrences, } from "../components/JsonView.js";
import { HELP } from "../constants.js";
import { formatOperationContext, formatResourcePath, rootResourcePath, } from "../resource-route.js";
export function DetailScreen({ detail, onBack, onCheckArn, onOpenArn, relatedCount = 0, onRelated, resourcePath, }) {
    const occurrences = useMemo(() => findArnOccurrences(detail.value), [detail.value]);
    const [checkingArns, setCheckingArns] = useState(occurrences.length > 0);
    const [resolvableArns, setResolvableArns] = useState(new Set());
    useEffect(() => {
        let active = true;
        setResolvableArns(new Set());
        setCheckingArns(occurrences.length > 0);
        void Promise.all(occurrences.map(async (occurrence) => ({
            occurrence,
            resolvable: await onCheckArn(occurrence).catch(() => false),
        }))).then((results) => {
            if (!active)
                return;
            setResolvableArns(new Set(results
                .filter((result) => result.resolvable)
                .map((result) => arnOccurrenceKey(result.occurrence))));
            setCheckingArns(false);
        });
        return () => {
            active = false;
        };
    }, [occurrences, onCheckArn]);
    return (_jsx(Frame, { title: formatResourcePath(resourcePath ?? rootResourcePath(detail.entry)), metadata: `${detail.entry.serviceTitle} · ${detail.source === "get response" ? "Full resource" : "List entry"}`, context: formatOperationContext(detail.entry, detail.input ?? {}), help: HELP.detail, children: _jsx(JsonView, { value: detail.value, resolvableArns: resolvableArns, checkingArns: checkingArns, onOpenArn: onOpenArn, relatedCount: relatedCount, ...(onRelated ? { onRelated } : {}), onBack: onBack }) }));
}
//# sourceMappingURL=DetailScreen.js.map