import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text, useInput, useStdout } from "ink";
import { useMemo, useState } from "react";
import { hasDefaultValue, inputValueText } from "../../model/input-values.js";
import { scoreFuzzyText } from "../../search/fuzzy.js";
import { Frame, frameHeaderHeight } from "../components/Frame.js";
import { HELP } from "../constants.js";
import { formatOperationContext, formatResourcePath, rootResourcePath, } from "../resource-route.js";
function fieldValueText(field, values) {
    if (!field)
        return "";
    const value = values[field.name];
    if (value !== undefined)
        return inputValueText(value);
    return hasDefaultValue(field) ? inputValueText(field.defaultValue) : "";
}
function enumOptions(field) {
    if (!field)
        return [];
    const values = field.enumValues?.length
        ? field.enumValues
        : field.type.toLowerCase() === "boolean"
            ? [true, false]
            : [];
    if (values.length === 0)
        return [];
    return [
        ...values.map((value) => ({
            label: String(value),
            value,
        })),
        ...(!field.required ? [{ label: "— Skip —", skip: true }] : []),
    ];
}
function initialEnumIndex(field, options, values) {
    if (field) {
        const currentValue = values[field.name];
        const defaultIndex = options.findIndex((option) => !option.skip &&
            currentValue !== undefined &&
            String(option.value) === inputValueText(currentValue));
        if (defaultIndex >= 0)
            return defaultIndex;
        if (hasDefaultValue(field)) {
            const modeledDefaultIndex = options.findIndex((option) => !option.skip &&
                String(option.value) === inputValueText(field.defaultValue));
            if (modeledDefaultIndex >= 0)
                return modeledDefaultIndex;
        }
    }
    const skipIndex = options.findIndex((option) => option.skip);
    return skipIndex >= 0 ? skipIndex : 0;
}
function withoutField(values, fieldName) {
    const nextValues = { ...values };
    delete nextValues[fieldName];
    return nextValues;
}
export function InputScreen({ entry, initialValues = {}, resourcePath = rootResourcePath(entry), purpose = "required", onSubmit, onBack, }) {
    const { stdout } = useStdout();
    const terminalWidth = stdout?.columns ?? 80;
    const terminalHeight = stdout?.rows ?? 24;
    const fields = entry.inputFields.filter((field) => field.name !== entry.pagination?.inputToken &&
        (purpose === "configure"
            ? !field.required
            : field.required && initialValues[field.name] === undefined));
    const title = formatResourcePath(resourcePath);
    const metadataLabel = purpose === "configure" ? "Configure" : "Input";
    const initialMetadata = `${entry.serviceTitle} · ${metadataLabel} 1/${fields.length}`;
    const initialContext = formatOperationContext(entry, initialValues);
    const visibleEnumCount = Math.max(3, terminalHeight -
        frameHeaderHeight(terminalWidth, title, initialMetadata, initialContext) -
        10);
    const initialOptions = enumOptions(fields[0]);
    const initialOptionIndex = initialEnumIndex(fields[0], initialOptions, initialValues);
    const [fieldIndex, setFieldIndex] = useState(0);
    const [value, setValue] = useState(() => fieldValueText(fields[0], initialValues));
    const [inputValues, setInputValues] = useState(initialValues);
    const [enumFilter, setEnumFilter] = useState("");
    const [enumFilterActive, setEnumFilterActive] = useState(false);
    const [enumPageIndex, setEnumPageIndex] = useState(() => Math.floor(initialOptionIndex / visibleEnumCount));
    const [enumSelectedIndex, setEnumSelectedIndex] = useState(initialOptionIndex % visibleEnumCount);
    const field = fields[fieldIndex];
    const metadata = `${entry.serviceTitle} · ${metadataLabel} ${fieldIndex + 1}/${fields.length}`;
    const context = formatOperationContext(entry, inputValues);
    const allOptions = useMemo(() => enumOptions(field), [field]);
    const filteredOptions = useMemo(() => {
        if (!enumFilter)
            return allOptions;
        return allOptions.filter((option) => scoreFuzzyText(option.label, enumFilter) !== undefined);
    }, [allOptions, enumFilter]);
    const enumPageCount = Math.max(1, Math.ceil(filteredOptions.length / visibleEnumCount));
    const currentEnumPage = Math.min(enumPageIndex, enumPageCount - 1);
    const visibleOptions = filteredOptions.slice(currentEnumPage * visibleEnumCount, (currentEnumPage + 1) * visibleEnumCount);
    const selectedOption = visibleOptions[enumSelectedIndex] ?? visibleOptions[0];
    const optionSlots = Array.from({ length: visibleEnumCount }, (_, index) => visibleOptions[index]);
    const isEnum = allOptions.length > 0;
    const resetField = (nextIndex, nextValues) => {
        const nextField = fields[nextIndex];
        const nextOptions = enumOptions(nextField);
        const nextSelectedIndex = initialEnumIndex(nextField, nextOptions, nextValues);
        setFieldIndex(nextIndex);
        setValue(fieldValueText(nextField, nextValues));
        setEnumFilter("");
        setEnumFilterActive(false);
        setEnumPageIndex(Math.floor(nextSelectedIndex / visibleEnumCount));
        setEnumSelectedIndex(nextSelectedIndex % visibleEnumCount);
    };
    const advance = (nextValues) => {
        if (fieldIndex === fields.length - 1) {
            onSubmit(nextValues);
        }
        else {
            setInputValues(nextValues);
            resetField(fieldIndex + 1, nextValues);
        }
    };
    const restoreEnumSelection = () => {
        const index = initialEnumIndex(field, enumOptions(field), inputValues);
        setEnumPageIndex(Math.floor(index / visibleEnumCount));
        setEnumSelectedIndex(index % visibleEnumCount);
    };
    useInput((input, key) => {
        if (key.ctrl)
            return;
        if (input.includes("\u001B") || /^(?:\[I|\[O)+$/.test(input))
            return;
        if (isEnum && enumFilterActive) {
            if (key.escape) {
                setEnumFilter("");
                setEnumFilterActive(false);
                restoreEnumSelection();
                return;
            }
            if (key.return) {
                setEnumFilterActive(false);
                return;
            }
            if (key.backspace || key.delete) {
                setEnumFilter((current) => current.slice(0, -1));
                setEnumPageIndex(0);
                setEnumSelectedIndex(0);
                return;
            }
            if (input) {
                setEnumFilter((current) => `${current}${input}`);
                setEnumPageIndex(0);
                setEnumSelectedIndex(0);
            }
            return;
        }
        if (key.escape) {
            if (isEnum && enumFilter) {
                setEnumFilter("");
                restoreEnumSelection();
                return;
            }
            onBack();
            return;
        }
        if (isEnum) {
            if (input.startsWith("/")) {
                setEnumFilter(input.slice(1));
                setEnumFilterActive(true);
                setEnumPageIndex(0);
                setEnumSelectedIndex(0);
                return;
            }
            if (key.upArrow && visibleOptions.length > 0) {
                setEnumSelectedIndex((index) => (index - 1 + visibleOptions.length) % visibleOptions.length);
                return;
            }
            if (key.downArrow && visibleOptions.length > 0) {
                setEnumSelectedIndex((index) => (index + 1) % visibleOptions.length);
                return;
            }
            if (key.leftArrow && currentEnumPage > 0) {
                setEnumPageIndex(currentEnumPage - 1);
                setEnumSelectedIndex(0);
                return;
            }
            if (key.rightArrow && currentEnumPage + 1 < enumPageCount) {
                setEnumPageIndex(currentEnumPage + 1);
                setEnumSelectedIndex(0);
                return;
            }
            if (key.return && selectedOption) {
                advance(selectedOption.skip
                    ? withoutField(inputValues, field.name)
                    : {
                        ...inputValues,
                        [field.name]: selectedOption.value,
                    });
            }
            return;
        }
        if (key.backspace || key.delete) {
            setValue((current) => current.slice(0, -1));
            return;
        }
        if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) {
            return;
        }
        if (key.return && field) {
            if (value.length === 0) {
                if (field.required)
                    return;
                advance(withoutField(inputValues, field.name));
                return;
            }
            advance({ ...inputValues, [field.name]: value });
            return;
        }
        if (input)
            setValue((current) => current + input);
    });
    if (!field)
        return null;
    const displayedDefault = hasDefaultValue(field)
        ? field.sensitive
            ? "***"
            : inputValueText(field.defaultValue)
        : undefined;
    return (_jsxs(Frame, { title: title, metadata: metadata, context: context, help: purpose === "configure"
            ? isEnum
                ? HELP.configureEnum
                : HELP.configureInput
            : isEnum
                ? HELP.enumInput
                : HELP.input, children: [_jsx(Text, { bold: true, children: field.name.toUpperCase() }), _jsxs(Text, { dimColor: true, wrap: "truncate-end", children: [field.type, " \u00B7 ", field.required ? "Required" : "Optional", displayedDefault !== undefined
                        ? ` · Default: ${displayedDefault}`
                        : !field.required && !isEnum
                            ? " · Enter to skip"
                            : "", field.documentation ? ` · ${field.documentation}` : ""] }), isEnum ? (_jsxs(Box, { borderStyle: "single", borderColor: "cyan", flexDirection: "column", paddingX: 1, marginTop: 1, children: [_jsxs(Box, { children: [_jsx(Text, { color: "cyan", children: "/ " }), _jsx(Text, { children: enumFilter }), enumFilterActive && _jsx(Text, { inverse: true, children: " " }), _jsx(Text, { dimColor: true, wrap: "truncate-end", children: enumFilterActive
                                    ? " filter enum values · Enter apply · Esc clear"
                                    : enumFilter
                                        ? ` ${filteredOptions.length}/${allOptions.length} values · / edit`
                                        : " filter enum values" })] }), optionSlots.map((option, index) => {
                        const selected = option !== undefined && index === enumSelectedIndex;
                        const isDefault = option !== undefined &&
                            !option.skip &&
                            hasDefaultValue(field) &&
                            String(option.value) === inputValueText(field.defaultValue);
                        return (_jsxs(Box, { justifyContent: "space-between", children: [_jsx(Text, { color: selected ? "black" : option?.skip ? "gray" : "white", ...(selected ? { backgroundColor: "cyan" } : {}), wrap: "truncate-end", children: option ? `${selected ? "❯" : " "} ${option.label}` : " " }), isDefault && _jsx(Text, { dimColor: true, children: "Default" })] }, option ? `${option.label}-${index}` : `empty-${index}`));
                    }), _jsx(Text, { dimColor: true, children: filteredOptions.length > 0
                            ? `Page ${currentEnumPage + 1}/${enumPageCount}`
                            : "No matching values" })] })) : (_jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "cyan", children: "> " }), _jsx(Text, { children: field.sensitive ? "*".repeat(value.length) : value }), _jsx(Text, { inverse: true, children: " " })] }))] }));
}
//# sourceMappingURL=InputScreen.js.map