import { jsx as _jsx } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { AwsCliExecutor } from "../execution/aws-cli-executor.js";
import { parseInputPairs } from "../cli/input.js";
import { inferGetInput } from "../rendering/projector.js";
import { ArnReferenceResolver, GithubSmithyRepository, } from "../model/github-smithy.js";
import { DetailScreen } from "./screens/DetailScreen.js";
import { InputScreen } from "./screens/InputScreen.js";
import { PageScreen } from "./screens/PageScreen.js";
import { SearchScreen } from "./screens/SearchScreen.js";
import { StatusScreen } from "./screens/StatusScreen.js";
import { useDebug } from "./debug.js";
export function App({ catalog, context, initialMode, }) {
    const executor = useMemo(() => new AwsCliExecutor(context), [context]);
    const { setCommand } = useDebug();
    const arnResolver = useMemo(() => new ArnReferenceResolver(catalog.services(), new GithubSmithyRepository()), [catalog]);
    const [route, setRoute] = useState({ name: "search" });
    const executeGet = async (entry, input, back, activeExecutor = executor) => {
        setCommand(activeExecutor.command(entry, input));
        setRoute({ name: "loading", message: `Running ${entry.operationName}…` });
        try {
            const result = await activeExecutor.execute(entry, input);
            setRoute({
                name: "detail",
                back,
                detail: {
                    entry,
                    value: result.output,
                    source: "get response",
                },
            });
        }
        catch (error) {
            setRoute({
                name: "error",
                message: error instanceof Error ? error.message : String(error),
                back,
            });
        }
    };
    const selectOperation = async (entry) => {
        if (entry.mode === "get") {
            const required = entry.inputFields.filter((field) => field.required);
            if (required.length > 0)
                setRoute({ name: "input", entry });
            else
                await executeGet(entry, {}, { name: "search" });
            return;
        }
        setCommand(executor.command(entry));
        setRoute({ name: "loading", message: `Running ${entry.operationName}…` });
        try {
            const firstPage = await executor.execute(entry);
            setRoute({
                name: "pages",
                pages: [firstPage],
                pageIndex: 0,
                loading: false,
            });
        }
        catch (error) {
            setRoute({
                name: "error",
                message: error instanceof Error ? error.message : String(error),
            });
        }
    };
    if (route.name === "search") {
        return (_jsx(SearchScreen, { catalog: catalog, ...(initialMode ? { initialMode } : {}), onSelect: selectOperation }));
    }
    if (route.name === "input") {
        return (_jsx(InputScreen, { entry: route.entry, onBack: () => setRoute({ name: "search" }), onSubmit: (values) => {
                try {
                    const pairs = Object.entries(values).map(([name, value]) => `${name}=${String(value)}`);
                    const input = parseInputPairs(route.entry, pairs);
                    void executeGet(route.entry, input, { name: "search" });
                }
                catch (error) {
                    setRoute({
                        name: "error",
                        message: error instanceof Error ? error.message : String(error),
                    });
                }
            } }));
    }
    if (route.name === "pages") {
        const currentPage = route.pages[route.pageIndex];
        const nextPage = async () => {
            if (route.pageIndex + 1 < route.pages.length) {
                setRoute({ ...route, pageIndex: route.pageIndex + 1 });
                return;
            }
            const nextInput = executor.nextInput(currentPage);
            if (!nextInput)
                return;
            setCommand(executor.command(currentPage.entry, nextInput));
            setRoute({ ...route, loading: true });
            try {
                const result = await executor.execute(currentPage.entry, nextInput);
                setRoute({
                    name: "pages",
                    pages: [...route.pages, result],
                    pageIndex: route.pageIndex + 1,
                    loading: false,
                });
            }
            catch (error) {
                setRoute({
                    name: "error",
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        };
        const showDetail = async (row) => {
            for (const candidate of catalog.findRelatedGet(currentPage.entry)) {
                const inferredInput = inferGetInput(candidate, row);
                if (inferredInput) {
                    await executeGet(candidate, inferredInput, route);
                    return;
                }
            }
            setRoute({
                name: "detail",
                back: route,
                detail: {
                    entry: currentPage.entry,
                    value: row,
                    source: "list row",
                },
            });
        };
        return (_jsx(PageScreen, { pages: route.pages, pageIndex: route.pageIndex, loading: route.loading, onNext: () => void nextPage(), onPrevious: () => setRoute({ ...route, pageIndex: Math.max(0, route.pageIndex - 1) }), onBack: () => setRoute({ name: "search" }), onDetail: (row) => void showDetail(row) }));
    }
    if (route.name === "detail") {
        const sourceService = catalog
            .services()
            .find((service) => service.cliName === route.detail.entry.serviceCliName &&
            service.version === route.detail.entry.serviceVersion) ??
            catalog
                .services()
                .find((service) => service.cliName === route.detail.entry.serviceCliName);
        const checkArn = async (occurrence) => {
            if (!sourceService)
                return false;
            try {
                return Boolean(await arnResolver.resolve(sourceService, occurrence));
            }
            catch {
                return false;
            }
        };
        const openArn = async (occurrence) => {
            if (!sourceService) {
                setRoute({
                    name: "error",
                    message: `No GitHub Smithy source is registered for ${route.detail.entry.serviceTitle}.`,
                    back: route,
                });
                return;
            }
            setRoute({
                name: "loading",
                message: `Resolving ${occurrence.arn} from GitHub…`,
            });
            try {
                const resolution = await arnResolver.resolve(sourceService, occurrence);
                if (!resolution) {
                    throw new Error(`No unambiguous read operation was found for ${occurrence.arn}.`);
                }
                const referenceExecutor = new AwsCliExecutor({
                    ...context,
                    ...(resolution.region ? { region: resolution.region } : {}),
                });
                await executeGet(resolution.entry, resolution.input, route, referenceExecutor);
            }
            catch (error) {
                setRoute({
                    name: "error",
                    message: error instanceof Error ? error.message : String(error),
                    back: route,
                });
            }
        };
        return (_jsx(DetailScreen, { detail: route.detail, onBack: () => setRoute(route.back), onCheckArn: checkArn, onOpenArn: (occurrence) => void openArn(occurrence) }));
    }
    if (route.name === "loading") {
        return _jsx(StatusScreen, { title: "WORKING", message: route.message });
    }
    return (_jsx(StatusScreen, { title: "REQUEST FAILED", message: route.message, error: true, onBack: () => setRoute(route.back ?? { name: "search" }) }));
}
//# sourceMappingURL=App.js.map