import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useRef, useState } from "react";
import { MemoryRouter, Navigate, Route, Routes, useLocation, useNavigate, } from "react-router";
import { parseInputPairs } from "../cli/input.js";
import { AwsCliExecutor } from "../execution/aws-cli-executor.js";
import { ArnReferenceResolver, GithubSmithyRepository, } from "../model/github-smithy.js";
import { defaultInputValues, inputValueText } from "../model/input-values.js";
import { inferGetInput } from "../rendering/projector.js";
import { useDebug } from "./debug.js";
import { appendResource, formatOperationContext, replaceResource, rootResourcePath, } from "./resource-route.js";
import { configureRoutePath, detailRoutePath, inputRoutePath, listEntryRouteKey, listEntryRoutePath, pagesRoutePath, relatedRoutePath, routePatterns, workingRoutePath, } from "./routes.js";
import { DetailScreen } from "./screens/DetailScreen.js";
import { InputScreen } from "./screens/InputScreen.js";
import { PageScreen } from "./screens/PageScreen.js";
import { RelatedResourcesScreen } from "./screens/RelatedResourcesScreen.js";
import { SearchScreen } from "./screens/SearchScreen.js";
import { StatusScreen } from "./screens/StatusScreen.js";
function isRouteState(value, name) {
    return (typeof value === "object" &&
        value !== null &&
        "name" in value &&
        value.name === name);
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
export function App({ catalog, context, initialMode, }) {
    return (_jsx(MemoryRouter, { initialEntries: [routePatterns.search], children: _jsx(RoutedApp, { catalog: catalog, context: context, ...(initialMode ? { initialMode } : {}) }) }));
}
function RoutedApp({ catalog, context, initialMode, }) {
    const executor = useMemo(() => new AwsCliExecutor(context), [context]);
    const { setCommand } = useDebug();
    const arnResolver = useMemo(() => new ArnReferenceResolver(catalog.services(), new GithubSmithyRepository()), [catalog]);
    const navigate = useNavigate();
    const location = useLocation();
    const activeRequest = useRef(0);
    const [loadingPagePath, setLoadingPagePath] = useState();
    const routeState = location.state;
    const beginRequest = () => {
        activeRequest.current += 1;
        return activeRequest.current;
    };
    const requestIsActive = (requestId) => activeRequest.current === requestId;
    const invalidateRequests = () => {
        activeRequest.current += 1;
        setLoadingPagePath(undefined);
    };
    const goBack = () => {
        invalidateRequests();
        void navigate(-1);
    };
    const showError = (message, behavior = "push") => {
        void navigate(routePatterns.error, {
            replace: behavior === "replace",
            state: { name: "error", message },
        });
    };
    const executeGet = async (entry, input, resourcePath, activeExecutor = executor, behavior = "push", resultPath = detailRoutePath(entry.id)) => {
        const resolvedInput = { ...defaultInputValues(entry), ...input };
        setCommand(activeExecutor.command(entry, resolvedInput));
        const requestId = beginRequest();
        void navigate(workingRoutePath(entry.id), {
            replace: behavior === "replace",
            state: {
                name: "loading",
                message: `Running ${entry.operationName}…`,
            },
        });
        try {
            const result = await activeExecutor.execute(entry, resolvedInput);
            if (!requestIsActive(requestId))
                return;
            void navigate(resultPath, {
                replace: true,
                state: {
                    name: "detail",
                    resourcePath,
                    detail: {
                        entry,
                        value: result.output,
                        source: "get response",
                        input: resolvedInput,
                    },
                },
            });
        }
        catch (error) {
            if (!requestIsActive(requestId))
                return;
            showError(errorMessage(error), "replace");
        }
    };
    const executeList = async (entry, input = {}, resourcePath = rootResourcePath(entry), behavior = "push", includeDefaults = true) => {
        const resolvedInput = includeDefaults
            ? { ...defaultInputValues(entry), ...input }
            : input;
        setCommand(executor.command(entry, resolvedInput));
        const requestId = beginRequest();
        void navigate(workingRoutePath(entry.id), {
            replace: behavior === "replace",
            state: {
                name: "loading",
                message: `Running ${entry.operationName}…`,
            },
        });
        try {
            const firstPage = await executor.execute(entry, resolvedInput);
            if (!requestIsActive(requestId))
                return;
            void navigate(pagesRoutePath(entry.id, 0), {
                replace: true,
                state: {
                    name: "pages",
                    pages: [firstPage],
                    pageIndex: 0,
                    resourcePath,
                },
            });
        }
        catch (error) {
            if (!requestIsActive(requestId))
                return;
            showError(errorMessage(error), "replace");
        }
    };
    const selectOperation = async (entry) => {
        if (!entry.supported || entry.mode === "unsupported")
            return;
        const input = defaultInputValues(entry);
        const resourcePath = rootResourcePath(entry);
        const missingRequired = entry.inputFields.filter((field) => field.required && input[field.name] === undefined);
        if (missingRequired.length > 0) {
            invalidateRequests();
            void navigate(inputRoutePath(entry.id), {
                state: {
                    name: "input",
                    purpose: "required",
                    entry,
                    initialValues: {},
                    resourcePath,
                },
            });
            return;
        }
        if (entry.mode === "get")
            await executeGet(entry, input, resourcePath);
        else
            await executeList(entry, input, resourcePath);
    };
    const renderInput = () => {
        if (!isRouteState(routeState, "input")) {
            return _jsx(Navigate, { to: routePatterns.search, replace: true });
        }
        const inputRoute = routeState;
        return (_jsx(InputScreen, { entry: inputRoute.entry, initialValues: inputRoute.initialValues, resourcePath: inputRoute.resourcePath, purpose: inputRoute.purpose === "configure-list" ? "configure" : "required", onBack: goBack, onSubmit: (values) => {
                try {
                    const pairs = Object.entries(values).map(([name, value]) => `${name}=${inputValueText(value)}`);
                    const configuringList = inputRoute.purpose === "configure-list";
                    const input = parseInputPairs(inputRoute.entry, pairs, {
                        includeDefaults: !configuringList,
                    });
                    if (inputRoute.entry.mode === "get") {
                        void executeGet(inputRoute.entry, input, inputRoute.resourcePath, executor, "replace");
                    }
                    else {
                        void executeList(inputRoute.entry, input, inputRoute.resourcePath, "replace", !configuringList);
                    }
                }
                catch (error) {
                    showError(errorMessage(error));
                }
            } }, location.key));
    };
    const renderPages = () => {
        if (!isRouteState(routeState, "pages")) {
            return _jsx(Navigate, { to: routePatterns.search, replace: true });
        }
        const pageRoute = routeState;
        const currentPage = pageRoute.pages[pageRoute.pageIndex];
        if (!currentPage) {
            return _jsx(Navigate, { to: routePatterns.search, replace: true });
        }
        const replacePage = (pageIndex) => {
            invalidateRequests();
            void navigate(pagesRoutePath(currentPage.entry.id, pageIndex), {
                replace: true,
                state: {
                    ...pageRoute,
                    pageIndex,
                },
            });
        };
        const nextPage = async () => {
            if (pageRoute.pageIndex + 1 < pageRoute.pages.length) {
                replacePage(pageRoute.pageIndex + 1);
                return;
            }
            const nextInput = executor.nextInput(currentPage);
            if (!nextInput)
                return;
            setCommand(executor.command(currentPage.entry, nextInput));
            const requestId = beginRequest();
            setLoadingPagePath(location.pathname);
            try {
                const result = await executor.execute(currentPage.entry, nextInput);
                if (!requestIsActive(requestId))
                    return;
                setLoadingPagePath(undefined);
                const pageIndex = pageRoute.pageIndex + 1;
                void navigate(pagesRoutePath(currentPage.entry.id, pageIndex), {
                    replace: true,
                    state: {
                        name: "pages",
                        pages: [...pageRoute.pages, result],
                        pageIndex,
                        resourcePath: pageRoute.resourcePath,
                    },
                });
            }
            catch (error) {
                if (!requestIsActive(requestId))
                    return;
                setLoadingPagePath(undefined);
                showError(errorMessage(error));
            }
        };
        const showDetail = async (row) => {
            const rowIndex = Math.max(0, currentPage.rows.indexOf(row));
            const entryKey = listEntryRouteKey(row, rowIndex);
            const entryPath = listEntryRoutePath(currentPage.entry.id, pageRoute.pageIndex, entryKey);
            for (const candidate of catalog.findRelatedGet(currentPage.entry)) {
                const inferredInput = inferGetInput(candidate, row, currentPage.input, currentPage.entry);
                if (inferredInput) {
                    await executeGet(candidate, inferredInput, appendResource(replaceResource(pageRoute.resourcePath, candidate.resourceName), entryKey), executor, "push", entryPath);
                    return;
                }
            }
            invalidateRequests();
            void navigate(entryPath, {
                state: {
                    name: "detail",
                    resourcePath: appendResource(pageRoute.resourcePath, entryKey),
                    detail: {
                        entry: currentPage.entry,
                        value: row,
                        source: "list row",
                        input: currentPage.input,
                    },
                },
            });
        };
        return (_jsx(PageScreen, { pages: pageRoute.pages, pageIndex: pageRoute.pageIndex, loading: loadingPagePath === location.pathname, resourcePath: pageRoute.resourcePath, onNext: () => void nextPage(), onPrevious: () => replacePage(Math.max(0, pageRoute.pageIndex - 1)), onBack: goBack, onDetail: (row) => void showDetail(row), ...(currentPage.entry.inputFields.some((field) => !field.required &&
                field.name !== currentPage.entry.pagination?.inputToken)
                ? {
                    onConfigure: () => {
                        invalidateRequests();
                        const initialValues = Object.fromEntries(Object.entries(currentPage.input).filter(([name]) => name !== currentPage.entry.pagination?.inputToken));
                        void navigate(configureRoutePath(currentPage.entry.id), {
                            state: {
                                name: "input",
                                purpose: "configure-list",
                                entry: currentPage.entry,
                                initialValues,
                                resourcePath: pageRoute.resourcePath,
                            },
                        });
                    },
                }
                : {}) }, location.key));
    };
    const renderRelated = () => {
        if (!isRouteState(routeState, "related")) {
            return _jsx(Navigate, { to: routePatterns.search, replace: true });
        }
        const relatedRoute = routeState;
        const openRelated = (relation) => {
            const resourcePath = appendResource(relatedRoute.resourcePath, relation.resourceName);
            if (relation.missingRequired.length > 0) {
                invalidateRequests();
                void navigate(inputRoutePath(relation.entry.id), {
                    state: {
                        name: "input",
                        purpose: "required",
                        entry: relation.entry,
                        initialValues: relation.input,
                        resourcePath,
                    },
                });
            }
            else {
                void executeList(relation.entry, relation.input, resourcePath);
            }
        };
        return (_jsx(RelatedResourcesScreen, { parentName: relatedRoute.parentEntry.resourceName, relations: relatedRoute.relations, resourcePath: relatedRoute.resourcePath, context: formatOperationContext(relatedRoute.parentEntry, relatedRoute.parentInput), onSelect: openRelated, onBack: goBack }, location.key));
    };
    const renderDetail = () => {
        if (!isRouteState(routeState, "detail")) {
            return _jsx(Navigate, { to: routePatterns.search, replace: true });
        }
        const detailRoute = routeState;
        const related = catalog.findRelatedLists(detailRoute.detail.entry, detailRoute.detail.input ?? {}, detailRoute.detail.value);
        const sourceService = catalog
            .services()
            .find((service) => service.cliName === detailRoute.detail.entry.serviceCliName &&
            service.version === detailRoute.detail.entry.serviceVersion) ??
            catalog
                .services()
                .find((service) => service.cliName === detailRoute.detail.entry.serviceCliName);
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
                showError(`No GitHub Smithy source is registered for ${detailRoute.detail.entry.serviceTitle}.`);
                return;
            }
            const requestId = beginRequest();
            void navigate(workingRoutePath(detailRoute.detail.entry.id), {
                state: {
                    name: "loading",
                    message: `Resolving ${occurrence.arn} from GitHub…`,
                },
            });
            try {
                const resolution = await arnResolver.resolve(sourceService, occurrence);
                if (!requestIsActive(requestId))
                    return;
                if (!resolution) {
                    throw new Error(`No unambiguous read operation was found for ${occurrence.arn}.`);
                }
                const referenceExecutor = new AwsCliExecutor({
                    ...context,
                    ...(resolution.region ? { region: resolution.region } : {}),
                });
                await executeGet(resolution.entry, resolution.input, appendResource(detailRoute.resourcePath, resolution.entry.resourceName), referenceExecutor, "replace");
            }
            catch (error) {
                if (!requestIsActive(requestId))
                    return;
                showError(errorMessage(error), "replace");
            }
        };
        return (_jsx(DetailScreen, { detail: detailRoute.detail, resourcePath: detailRoute.resourcePath, onBack: goBack, onCheckArn: checkArn, onOpenArn: (occurrence) => void openArn(occurrence), relatedCount: related.length, ...(related.length > 0
                ? {
                    onRelated: () => {
                        invalidateRequests();
                        void navigate(relatedRoutePath(detailRoute.detail.entry.id), {
                            state: {
                                name: "related",
                                parentEntry: detailRoute.detail.entry,
                                parentInput: detailRoute.detail.input ?? {},
                                relations: related,
                                resourcePath: detailRoute.resourcePath,
                            },
                        });
                    },
                }
                : {}) }, location.key));
    };
    const renderLoading = () => isRouteState(routeState, "loading") ? (_jsx(StatusScreen, { title: "WORKING", message: routeState.message }, location.key)) : (_jsx(Navigate, { to: routePatterns.search, replace: true }));
    const renderError = () => isRouteState(routeState, "error") ? (_jsx(StatusScreen, { title: "REQUEST FAILED", message: routeState.message, error: true, onBack: goBack }, location.key)) : (_jsx(Navigate, { to: routePatterns.search, replace: true }));
    return (_jsxs(Routes, { children: [_jsx(Route, { path: routePatterns.home, element: _jsx(Navigate, { to: routePatterns.search, replace: true }) }), _jsx(Route, { path: routePatterns.search, element: _jsx(SearchScreen, { catalog: catalog, ...(initialMode ? { initialMode } : {}), onSelect: selectOperation }, location.key) }), _jsx(Route, { path: routePatterns.input, element: renderInput() }), _jsx(Route, { path: routePatterns.configure, element: renderInput() }), _jsx(Route, { path: routePatterns.pages, element: renderPages() }), _jsx(Route, { path: routePatterns.listEntry, element: renderDetail() }), _jsx(Route, { path: routePatterns.detail, element: renderDetail() }), _jsx(Route, { path: routePatterns.related, element: renderRelated() }), _jsx(Route, { path: routePatterns.working, element: renderLoading() }), _jsx(Route, { path: routePatterns.error, element: renderError() }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: routePatterns.search, replace: true }) })] }));
}
//# sourceMappingURL=App.js.map