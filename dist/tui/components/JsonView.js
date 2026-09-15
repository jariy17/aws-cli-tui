import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useEffect, useMemo, useState } from "react";
export function arnOccurrenceKey(occurrence) {
    return `${occurrence.key ?? ""}\u0000${occurrence.arn}`;
}
function parseJsonLine(text) {
    const keyMatch = /^\s*"((?:\\.|[^"])*)"\s*:/.exec(text);
    const arnMatch = /"(arn:[^"]+)"/.exec(text);
    let key;
    if (keyMatch) {
        try {
            key = JSON.parse(`"${keyMatch[1]}"`);
        }
        catch {
            key = keyMatch[1];
        }
    }
    return {
        text,
        ...(arnMatch?.[1] ? { arn: arnMatch[1] } : {}),
        ...(key ? { key } : {}),
    };
}
export function findArnOccurrences(value) {
    const serialized = JSON.stringify(value, null, 2);
    if (serialized === undefined)
        return [];
    const occurrences = serialized
        .split("\n")
        .map(parseJsonLine)
        .flatMap((line) => line.arn
        ? [
            {
                arn: line.arn,
                ...(line.key ? { key: line.key } : {}),
            },
        ]
        : []);
    return occurrences.filter((occurrence, index, values) => values.findIndex((candidate) => arnOccurrenceKey(candidate) === arnOccurrenceKey(occurrence)) === index);
}
function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(value, maximum));
}
function isJsonEntry(line) {
    if (line.key !== undefined)
        return true;
    const text = line.text.trim().replace(/,$/, "");
    return !["{", "}", "[", "]"].includes(text);
}
function SyntaxLine({ line, selected, linked, }) {
    if (line.arn && linked) {
        const start = line.text.indexOf(line.arn);
        return (_jsxs(Text, { wrap: "truncate-end", ...(selected ? { backgroundColor: "cyan", color: "black" } : {}), children: [line.text.slice(0, start), _jsx(Text, { color: selected ? "black" : "cyan", underline: true, children: line.arn }), line.text.slice(start + line.arn.length)] }));
    }
    const keyMatch = /^(\s*)("[^"]+")(:\s*)(.*)$/.exec(line.text);
    if (!keyMatch) {
        return (_jsx(Text, { color: selected ? "black" : "gray", ...(selected ? { backgroundColor: "cyan" } : {}), wrap: "truncate-end", children: line.text }));
    }
    const [, indentation, key, separator, value] = keyMatch;
    const valueColor = value?.startsWith('"')
        ? "green"
        : /^(true|false|null)/.test(value ?? "")
            ? "magenta"
            : /^-?\d/.test(value ?? "")
                ? "yellow"
                : "gray";
    return (_jsxs(Text, { ...(selected
            ? { color: "black", backgroundColor: "cyan" }
            : {}), wrap: "truncate-end", children: [indentation, _jsx(Text, { color: selected ? "black" : "cyan", children: key }), separator, _jsx(Text, { color: selected ? "black" : valueColor, children: value })] }));
}
export function JsonView({ value, resolvableArns, checkingArns, onOpenArn, onBack, }) {
    const { exit } = useApp();
    const { stdout } = useStdout();
    const terminalHeight = stdout?.rows ?? 24;
    const lineLimit = Math.max(4, terminalHeight - 7);
    const lines = useMemo(() => {
        const serialized = JSON.stringify(value, null, 2);
        return (serialized ?? String(value)).split("\n").map(parseJsonLine);
    }, [value]);
    const entries = useMemo(() => lines.flatMap((line, lineIndex) => isJsonEntry(line) ? [{ lineIndex, line }] : []), [lines]);
    const allReferences = useMemo(() => lines.flatMap((line, lineIndex) => line.arn
        ? [
            {
                lineIndex,
                occurrence: {
                    arn: line.arn,
                    ...(line.key ? { key: line.key } : {}),
                },
            },
        ]
        : []), [lines]);
    const references = useMemo(() => allReferences.filter(({ occurrence }) => resolvableArns.has(arnOccurrenceKey(occurrence))), [allReferences, resolvableArns]);
    const [selectedEntry, setSelectedEntry] = useState(0);
    const [scrollStart, setScrollStart] = useState(0);
    const maximumScroll = Math.max(0, lines.length - lineLimit);
    useEffect(() => {
        setSelectedEntry(0);
        const firstLine = entries[0]?.lineIndex ?? 0;
        setScrollStart(clamp(firstLine - Math.floor(lineLimit / 2), 0, maximumScroll));
    }, [entries, lineLimit, maximumScroll]);
    useInput((input, key) => {
        if (key.ctrl && input === "q") {
            exit();
            return;
        }
        if (key.escape) {
            onBack();
            return;
        }
        if ((key.upArrow ||
            key.downArrow ||
            input.toLowerCase() === "j" ||
            input.toLowerCase() === "k") &&
            entries.length > 0) {
            const direction = key.upArrow || input.toLowerCase() === "k" ? -1 : 1;
            const next = (selectedEntry + direction + entries.length) % entries.length;
            setSelectedEntry(next);
            setScrollStart(clamp(entries[next].lineIndex - Math.floor(lineLimit / 2), 0, maximumScroll));
            return;
        }
        if ((key.pageDown || key.pageUp) && entries.length > 0) {
            const direction = key.pageDown ? 1 : -1;
            const next = clamp(selectedEntry + direction * lineLimit, 0, entries.length - 1);
            setSelectedEntry(next);
            setScrollStart(clamp(entries[next].lineIndex - Math.floor(lineLimit / 2), 0, maximumScroll));
            return;
        }
        const selected = entries[selectedEntry];
        if (key.return && selected?.line.arn) {
            const occurrence = {
                arn: selected.line.arn,
                ...(selected.line.key ? { key: selected.line.key } : {}),
            };
            if (resolvableArns.has(arnOccurrenceKey(occurrence))) {
                onOpenArn(occurrence);
            }
        }
    });
    const selectedLine = entries[selectedEntry]?.lineIndex;
    const selectedOccurrence = entries[selectedEntry]?.line.arn
        ? {
            arn: entries[selectedEntry].line.arn,
            ...(entries[selectedEntry].line.key
                ? { key: entries[selectedEntry].line.key }
                : {}),
        }
        : undefined;
    const selectedIsLinked = selectedOccurrence !== undefined &&
        resolvableArns.has(arnOccurrenceKey(selectedOccurrence));
    const visible = lines.slice(scrollStart, scrollStart + lineLimit);
    return (_jsxs(Box, { flexDirection: "column", children: [visible.map((line, index) => {
                const lineIndex = scrollStart + index;
                return (_jsx(SyntaxLine, { line: line, selected: lineIndex === selectedLine, linked: line.arn !== undefined &&
                        resolvableArns.has(arnOccurrenceKey({
                            arn: line.arn,
                            ...(line.key ? { key: line.key } : {}),
                        })) }, lineIndex));
            }), _jsxs(Text, { dimColor: true, wrap: "truncate-end", children: ["Lines ", scrollStart + 1, "\u2013", Math.min(lines.length, scrollStart + lineLimit), " of ", lines.length, checkingArns
                        ? " · Checking ARN links…"
                        : entries.length > 0
                            ? ` · Entry ${selectedEntry + 1}/${entries.length}${selectedIsLinked ? " · Enter open ARN" : references.length > 0 ? " · Linked ARNs underlined" : ""}`
                            : allReferences.length > 0
                                ? " · No linked ARN resources"
                                : ""] })] }));
}
//# sourceMappingURL=JsonView.js.map