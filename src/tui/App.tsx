import { useMemo, useRef, useState } from "react";
import {
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";

import { parseInputPairs } from "../cli/input.js";
import { AwsCliExecutor } from "../execution/aws-cli-executor.js";
import type { AwsContext, PageResult } from "../execution/types.js";
import { SmithyCatalog, type RelatedResource } from "../model/catalog.js";
import {
  ArnReferenceResolver,
  GithubSmithyRepository,
  type ArnOccurrence,
} from "../model/github-smithy.js";
import { defaultInputValues, inputValueText } from "../model/input-values.js";
import type { OperationEntry, SupportedOperationMode } from "../model/types.js";
import { inferGetInput } from "../rendering/projector.js";
import { useDebug } from "./debug.js";
import {
  appendResource,
  formatOperationContext,
  replaceResource,
  rootResourcePath,
  type ResourcePath,
} from "./resource-route.js";
import {
  configureRoutePath,
  detailRoutePath,
  inputRoutePath,
  listEntryRouteKey,
  listEntryRoutePath,
  pagesRoutePath,
  relatedRoutePath,
  routePatterns,
  workingRoutePath,
} from "./routes.js";
import { DetailScreen, type DetailState } from "./screens/DetailScreen.js";
import { InputScreen } from "./screens/InputScreen.js";
import { PageScreen } from "./screens/PageScreen.js";
import { RelatedResourcesScreen } from "./screens/RelatedResourcesScreen.js";
import { SearchScreen } from "./screens/SearchScreen.js";
import { StatusScreen } from "./screens/StatusScreen.js";

type PageRouteState = {
  name: "pages";
  pages: PageResult[];
  pageIndex: number;
  resourcePath: ResourcePath;
};

type DetailRouteState = {
  name: "detail";
  detail: DetailState;
  resourcePath: ResourcePath;
};

type InputRouteState = {
  name: "input";
  purpose: "required" | "configure-list";
  entry: OperationEntry;
  initialValues: Record<string, unknown>;
  resourcePath: ResourcePath;
};

type RelatedRouteState = {
  name: "related";
  parentEntry: OperationEntry;
  parentInput: Record<string, unknown>;
  relations: RelatedResource[];
  resourcePath: ResourcePath;
};

type RouteState =
  | InputRouteState
  | PageRouteState
  | DetailRouteState
  | RelatedRouteState
  | { name: "loading"; message: string }
  | { name: "error"; message: string };

type RouteStateName = RouteState["name"];
type NavigationBehavior = "push" | "replace";

function isRouteState<Name extends RouteStateName>(
  value: unknown,
  name: Name,
): value is Extract<RouteState, { name: Name }> {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    value.name === name
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function App({
  catalog,
  context,
  initialMode,
}: {
  catalog: SmithyCatalog;
  context: AwsContext;
  initialMode?: SupportedOperationMode;
}) {
  return (
    <MemoryRouter initialEntries={[routePatterns.search]}>
      <RoutedApp
        catalog={catalog}
        context={context}
        {...(initialMode ? { initialMode } : {})}
      />
    </MemoryRouter>
  );
}

function RoutedApp({
  catalog,
  context,
  initialMode,
}: {
  catalog: SmithyCatalog;
  context: AwsContext;
  initialMode?: SupportedOperationMode;
}) {
  const executor = useMemo(() => new AwsCliExecutor(context), [context]);
  const { setCommand } = useDebug();
  const arnResolver = useMemo(
    () =>
      new ArnReferenceResolver(
        catalog.services(),
        new GithubSmithyRepository(),
      ),
    [catalog],
  );
  const navigate = useNavigate();
  const location = useLocation();
  const activeRequest = useRef(0);
  const [loadingPagePath, setLoadingPagePath] = useState<string>();
  const routeState: unknown = location.state;

  const beginRequest = (): number => {
    activeRequest.current += 1;
    return activeRequest.current;
  };

  const requestIsActive = (requestId: number): boolean =>
    activeRequest.current === requestId;

  const invalidateRequests = () => {
    activeRequest.current += 1;
    setLoadingPagePath(undefined);
  };

  const goBack = () => {
    invalidateRequests();
    void navigate(-1);
  };

  const showError = (
    message: string,
    behavior: NavigationBehavior = "push",
  ) => {
    void navigate(routePatterns.error, {
      replace: behavior === "replace",
      state: { name: "error", message } satisfies RouteState,
    });
  };

  const executeGet = async (
    entry: OperationEntry,
    input: Record<string, unknown>,
    resourcePath: ResourcePath,
    activeExecutor = executor,
    behavior: NavigationBehavior = "push",
    resultPath = detailRoutePath(entry.id),
  ) => {
    const resolvedInput = { ...defaultInputValues(entry), ...input };
    setCommand(activeExecutor.command(entry, resolvedInput));
    const requestId = beginRequest();
    void navigate(workingRoutePath(entry.id), {
      replace: behavior === "replace",
      state: {
        name: "loading",
        message: `Running ${entry.operationName}…`,
      } satisfies RouteState,
    });
    try {
      const result = await activeExecutor.execute(entry, resolvedInput);
      if (!requestIsActive(requestId)) return;
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
        } satisfies RouteState,
      });
    } catch (error) {
      if (!requestIsActive(requestId)) return;
      showError(errorMessage(error), "replace");
    }
  };

  const executeList = async (
    entry: OperationEntry,
    input: Record<string, unknown> = {},
    resourcePath = rootResourcePath(entry),
    behavior: NavigationBehavior = "push",
    includeDefaults = true,
  ) => {
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
      } satisfies RouteState,
    });
    try {
      const firstPage = await executor.execute(entry, resolvedInput);
      if (!requestIsActive(requestId)) return;
      void navigate(pagesRoutePath(entry.id, 0), {
        replace: true,
        state: {
          name: "pages",
          pages: [firstPage],
          pageIndex: 0,
          resourcePath,
        } satisfies RouteState,
      });
    } catch (error) {
      if (!requestIsActive(requestId)) return;
      showError(errorMessage(error), "replace");
    }
  };

  const selectOperation = async (entry: OperationEntry) => {
    if (!entry.supported || entry.mode === "unsupported") return;
    const input = defaultInputValues(entry);
    const resourcePath = rootResourcePath(entry);
    const missingRequired = entry.inputFields.filter(
      (field) => field.required && input[field.name] === undefined,
    );
    if (missingRequired.length > 0) {
      invalidateRequests();
      void navigate(inputRoutePath(entry.id), {
        state: {
          name: "input",
          purpose: "required",
          entry,
          initialValues: {},
          resourcePath,
        } satisfies RouteState,
      });
      return;
    }
    if (entry.mode === "get") await executeGet(entry, input, resourcePath);
    else await executeList(entry, input, resourcePath);
  };

  const renderInput = () => {
    if (!isRouteState(routeState, "input")) {
      return <Navigate to={routePatterns.search} replace />;
    }
    const inputRoute = routeState;
    return (
      <InputScreen
        key={location.key}
        entry={inputRoute.entry}
        initialValues={inputRoute.initialValues}
        resourcePath={inputRoute.resourcePath}
        purpose={
          inputRoute.purpose === "configure-list" ? "configure" : "required"
        }
        onBack={goBack}
        onSubmit={(values) => {
          try {
            const pairs = Object.entries(values).map(
              ([name, value]) => `${name}=${inputValueText(value)}`,
            );
            const configuringList = inputRoute.purpose === "configure-list";
            const input = parseInputPairs(inputRoute.entry, pairs, {
              includeDefaults: !configuringList,
            });
            if (inputRoute.entry.mode === "get") {
              void executeGet(
                inputRoute.entry,
                input,
                inputRoute.resourcePath,
                executor,
                "replace",
              );
            } else {
              void executeList(
                inputRoute.entry,
                input,
                inputRoute.resourcePath,
                "replace",
                !configuringList,
              );
            }
          } catch (error) {
            showError(errorMessage(error));
          }
        }}
      />
    );
  };

  const renderPages = () => {
    if (!isRouteState(routeState, "pages")) {
      return <Navigate to={routePatterns.search} replace />;
    }
    const pageRoute = routeState;
    const currentPage = pageRoute.pages[pageRoute.pageIndex];
    if (!currentPage) {
      return <Navigate to={routePatterns.search} replace />;
    }

    const replacePage = (pageIndex: number) => {
      invalidateRequests();
      void navigate(pagesRoutePath(currentPage.entry.id, pageIndex), {
        replace: true,
        state: {
          ...pageRoute,
          pageIndex,
        } satisfies RouteState,
      });
    };

    const nextPage = async () => {
      if (pageRoute.pageIndex + 1 < pageRoute.pages.length) {
        replacePage(pageRoute.pageIndex + 1);
        return;
      }
      const nextInput = executor.nextInput(currentPage);
      if (!nextInput) return;

      setCommand(executor.command(currentPage.entry, nextInput));
      const requestId = beginRequest();
      setLoadingPagePath(location.pathname);
      try {
        const result = await executor.execute(currentPage.entry, nextInput);
        if (!requestIsActive(requestId)) return;
        setLoadingPagePath(undefined);
        const pageIndex = pageRoute.pageIndex + 1;
        void navigate(pagesRoutePath(currentPage.entry.id, pageIndex), {
          replace: true,
          state: {
            name: "pages",
            pages: [...pageRoute.pages, result],
            pageIndex,
            resourcePath: pageRoute.resourcePath,
          } satisfies RouteState,
        });
      } catch (error) {
        if (!requestIsActive(requestId)) return;
        setLoadingPagePath(undefined);
        showError(errorMessage(error));
      }
    };

    const showDetail = async (row: unknown) => {
      const rowIndex = Math.max(0, currentPage.rows.indexOf(row));
      const entryKey = listEntryRouteKey(row, rowIndex);
      const entryPath = listEntryRoutePath(
        currentPage.entry.id,
        pageRoute.pageIndex,
        entryKey,
      );
      for (const candidate of catalog.findRelatedGet(currentPage.entry)) {
        const inferredInput = inferGetInput(
          candidate,
          row,
          currentPage.input,
          currentPage.entry,
        );
        if (inferredInput) {
          await executeGet(
            candidate,
            inferredInput,
            appendResource(
              replaceResource(pageRoute.resourcePath, candidate.resourceName),
              entryKey,
            ),
            executor,
            "push",
            entryPath,
          );
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
        } satisfies RouteState,
      });
    };

    return (
      <PageScreen
        key={location.key}
        pages={pageRoute.pages}
        pageIndex={pageRoute.pageIndex}
        loading={loadingPagePath === location.pathname}
        resourcePath={pageRoute.resourcePath}
        onNext={() => void nextPage()}
        onPrevious={() => replacePage(Math.max(0, pageRoute.pageIndex - 1))}
        onBack={goBack}
        onDetail={(row) => void showDetail(row)}
        {...(currentPage.entry.inputFields.some(
          (field) =>
            !field.required &&
            field.name !== currentPage.entry.pagination?.inputToken,
        )
          ? {
              onConfigure: () => {
                invalidateRequests();
                const initialValues = Object.fromEntries(
                  Object.entries(currentPage.input).filter(
                    ([name]) =>
                      name !== currentPage.entry.pagination?.inputToken,
                  ),
                );
                void navigate(configureRoutePath(currentPage.entry.id), {
                  state: {
                    name: "input",
                    purpose: "configure-list",
                    entry: currentPage.entry,
                    initialValues,
                    resourcePath: pageRoute.resourcePath,
                  } satisfies RouteState,
                });
              },
            }
          : {})}
      />
    );
  };

  const renderRelated = () => {
    if (!isRouteState(routeState, "related")) {
      return <Navigate to={routePatterns.search} replace />;
    }
    const relatedRoute = routeState;
    const openRelated = (relation: RelatedResource) => {
      const resourcePath = appendResource(
        relatedRoute.resourcePath,
        relation.resourceName,
      );
      if (relation.missingRequired.length > 0) {
        invalidateRequests();
        void navigate(inputRoutePath(relation.entry.id), {
          state: {
            name: "input",
            purpose: "required",
            entry: relation.entry,
            initialValues: relation.input,
            resourcePath,
          } satisfies RouteState,
        });
      } else {
        void executeList(relation.entry, relation.input, resourcePath);
      }
    };

    return (
      <RelatedResourcesScreen
        key={location.key}
        parentName={relatedRoute.parentEntry.resourceName}
        relations={relatedRoute.relations}
        resourcePath={relatedRoute.resourcePath}
        context={formatOperationContext(
          relatedRoute.parentEntry,
          relatedRoute.parentInput,
        )}
        onSelect={openRelated}
        onBack={goBack}
      />
    );
  };

  const renderDetail = () => {
    if (!isRouteState(routeState, "detail")) {
      return <Navigate to={routePatterns.search} replace />;
    }
    const detailRoute = routeState;
    const related = catalog.findRelatedLists(
      detailRoute.detail.entry,
      detailRoute.detail.input ?? {},
      detailRoute.detail.value,
    );
    const sourceService =
      catalog
        .services()
        .find(
          (service) =>
            service.cliName === detailRoute.detail.entry.serviceCliName &&
            service.version === detailRoute.detail.entry.serviceVersion,
        ) ??
      catalog
        .services()
        .find(
          (service) =>
            service.cliName === detailRoute.detail.entry.serviceCliName,
        );
    const checkArn = async (occurrence: ArnOccurrence): Promise<boolean> => {
      if (!sourceService) return false;
      try {
        return Boolean(await arnResolver.resolve(sourceService, occurrence));
      } catch {
        return false;
      }
    };
    const openArn = async (occurrence: ArnOccurrence) => {
      if (!sourceService) {
        showError(
          `No GitHub Smithy source is registered for ${detailRoute.detail.entry.serviceTitle}.`,
        );
        return;
      }

      const requestId = beginRequest();
      void navigate(workingRoutePath(detailRoute.detail.entry.id), {
        state: {
          name: "loading",
          message: `Resolving ${occurrence.arn} from GitHub…`,
        } satisfies RouteState,
      });
      try {
        const resolution = await arnResolver.resolve(sourceService, occurrence);
        if (!requestIsActive(requestId)) return;
        if (!resolution) {
          throw new Error(
            `No unambiguous read operation was found for ${occurrence.arn}.`,
          );
        }
        const referenceExecutor = new AwsCliExecutor({
          ...context,
          ...(resolution.region ? { region: resolution.region } : {}),
        });
        await executeGet(
          resolution.entry,
          resolution.input,
          appendResource(
            detailRoute.resourcePath,
            resolution.entry.resourceName,
          ),
          referenceExecutor,
          "replace",
        );
      } catch (error) {
        if (!requestIsActive(requestId)) return;
        showError(errorMessage(error), "replace");
      }
    };

    return (
      <DetailScreen
        key={location.key}
        detail={detailRoute.detail}
        resourcePath={detailRoute.resourcePath}
        onBack={goBack}
        onCheckArn={checkArn}
        onOpenArn={(occurrence) => void openArn(occurrence)}
        relatedCount={related.length}
        {...(related.length > 0
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
                  } satisfies RouteState,
                });
              },
            }
          : {})}
      />
    );
  };

  const renderLoading = () =>
    isRouteState(routeState, "loading") ? (
      <StatusScreen
        key={location.key}
        title="WORKING"
        message={routeState.message}
      />
    ) : (
      <Navigate to={routePatterns.search} replace />
    );

  const renderError = () =>
    isRouteState(routeState, "error") ? (
      <StatusScreen
        key={location.key}
        title="REQUEST FAILED"
        message={routeState.message}
        error
        onBack={goBack}
      />
    ) : (
      <Navigate to={routePatterns.search} replace />
    );

  return (
    <Routes>
      <Route
        path={routePatterns.home}
        element={<Navigate to={routePatterns.search} replace />}
      />
      <Route
        path={routePatterns.search}
        element={
          <SearchScreen
            key={location.key}
            catalog={catalog}
            {...(initialMode ? { initialMode } : {})}
            onSelect={selectOperation}
          />
        }
      />
      <Route path={routePatterns.input} element={renderInput()} />
      <Route path={routePatterns.configure} element={renderInput()} />
      <Route path={routePatterns.pages} element={renderPages()} />
      <Route path={routePatterns.listEntry} element={renderDetail()} />
      <Route path={routePatterns.detail} element={renderDetail()} />
      <Route path={routePatterns.related} element={renderRelated()} />
      <Route path={routePatterns.working} element={renderLoading()} />
      <Route path={routePatterns.error} element={renderError()} />
      <Route
        path="*"
        element={<Navigate to={routePatterns.search} replace />}
      />
    </Routes>
  );
}
