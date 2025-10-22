// admin-web/src/pages/BranchesPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  useParams,
  useSearchParams,
  useLocation,
  useNavigationType,
  useNavigate,
  Link
} from "react-router-dom";
import {
  ActionIcon,
  Badge,
  Button,
  CloseButton,
  Group,
  Loader,
  NumberInput,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  rem,
  Tooltip,
  Grid,
  Select,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconEye,
  IconRefresh,
  IconArrowsSort,
  IconArrowUp,
  IconArrowDown,
  IconFilter,
  IconChevronDown,
  IconChevronUp,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
  IconLink,
} from "@tabler/icons-react";
import {
  listBranchesApiRequest,
} from "../api/branches";
import { handlePageError } from "../utils/pageError";
import { useAuthStore } from "../stores/auth";
import { FilterBar } from "../components/common/FilterBar";
import type { components } from "../types/openapi";
import { buildCommonDatePresets } from "../utils/datePresets";

type BranchRow = components["schemas"]["BranchRecord"];

type SortField = "branchName" | "createdAt" | "updatedAt" | "isActive";
type SortDir = "asc" | "desc";
type ActiveFilter = "" | "true" | "false";
type ArchivedFilter = "active-only" | "archived-only" | "all";

type BranchFilters = {
  q: string; // name contains
  isActive: ActiveFilter;
  archivedFilter: ArchivedFilter;
  createdAtFrom: string | null; // YYYY-MM-DD (UI convenience; server ignores if unsupported)
  createdAtTo: string | null;
  updatedAtFrom: string | null;
  updatedAtTo: string | null;
};

const emptyFilters: BranchFilters = {
  q: "",
  isActive: "",
  archivedFilter: "active-only",
  createdAtFrom: null,
  createdAtTo: null,
  updatedAtFrom: null,
  updatedAtTo: null,
};

export default function BranchesPage() {
  const FILTER_PANEL_ID = "branches-filter-panel";
  const TABLE_ID = "branches-table";
  const RANGE_ID = "branches-range";

  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();

  const canManageBranches = useAuthStore((s) => s.hasPerm("branches:manage"));

  // data state
  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState<BranchRow[] | null>(null);
  const [errorForBoundary, setErrorForBoundary] = useState<
    (Error & { httpStatusCode?: number; correlationId?: string }) | null
  >(null);

  // pagination/cursor
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [isPaginating, setIsPaginating] = useState(false);

  // totals
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // query controls
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState<number>(20);
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // filters
  const [appliedFilters, setAppliedFilters] =
    useState<BranchFilters>(emptyFilters);

  if (errorForBoundary) throw errorForBoundary;

  function nextDir(dir: SortDir) {
    return dir === "asc" ? "desc" : "asc";
  }
  function colAriaSort(field: SortField): "ascending" | "descending" | "none" {
    if (sortBy !== field) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  }
  function sortButtonLabel(label: string, field: SortField) {
    if (sortBy === field) {
      const curr = sortDir === "asc" ? "ascending" : "descending";
      const next = nextDir(sortDir) === "asc" ? "ascending" : "descending";
      return `Sort by ${label}, currently ${curr}. Activate to sort ${next}.`;
    }
    return `Sort by ${label}. Activate to sort ascending.`;
  }

  function setUrlFromState(overrides?: {
    cursorId?: string | null;
    limit?: number;
    sortBy?: SortField;
    sortDir?: SortDir;
    q?: string | null | undefined;
    isActive?: ActiveFilter | null | undefined;
    archivedFilter?: ArchivedFilter | null | undefined;
    createdAtFrom?: string | null | undefined;
    createdAtTo?: string | null | undefined;
    updatedAtFrom?: string | null | undefined;
    updatedAtTo?: string | null | undefined;
    page?: number;
  }) {
    const params = new URLSearchParams();
    const put = (k: string, v: unknown) => {
      if (v === undefined || v === null || v === "") return;
      params.set(k, String(v));
    };

    const qVal =
      overrides?.q === undefined
        ? appliedFilters.q.trim() || null
        : overrides.q?.toString().trim() || null;

    const activeVal =
      overrides?.isActive === undefined
        ? appliedFilters.isActive || null
        : overrides.isActive ?? null;

    const archivedVal =
      overrides?.archivedFilter === undefined
        ? appliedFilters.archivedFilter
        : overrides.archivedFilter ?? "active-only";

    const createdFromVal =
      overrides &&
      Object.prototype.hasOwnProperty.call(overrides, "createdAtFrom")
        ? overrides.createdAtFrom
        : appliedFilters.createdAtFrom;

    const createdToVal =
      overrides &&
      Object.prototype.hasOwnProperty.call(overrides, "createdAtTo")
        ? overrides.createdAtTo
        : appliedFilters.createdAtTo;

    const updatedFromVal =
      overrides &&
      Object.prototype.hasOwnProperty.call(overrides, "updatedAtFrom")
        ? overrides.updatedAtFrom
        : appliedFilters.updatedAtFrom;

    const updatedToVal =
      overrides &&
      Object.prototype.hasOwnProperty.call(overrides, "updatedAtTo")
        ? overrides.updatedAtTo
        : appliedFilters.updatedAtTo;

    put("limit", overrides?.limit ?? limit);
    put("sortBy", overrides?.sortBy ?? sortBy);
    put("sortDir", overrides?.sortDir ?? sortDir);
    put("q", qVal);
    put("isActive", activeVal);
    put("archivedFilter", archivedVal);
    put("createdAtFrom", createdFromVal);
    put("createdAtTo", createdToVal);
    put("updatedAtFrom", updatedFromVal);
    put("updatedAtTo", updatedToVal);

    const cursor =
      overrides?.cursorId === undefined
        ? cursorStack[pageIndex] ?? null
        : overrides.cursorId;
    if (cursor) params.set("cursorId", cursor);

    const pageToWrite = overrides?.page ?? pageIndex + 1;
    put("page", pageToWrite);

    setSearchParams(params, { replace: false });
  }

  async function fetchPageWith(opts?: {
    includeTotal?: boolean;
    cursorId?: string | null;
    sortByOverride?: SortField;
    sortDirOverride?: SortDir;
    limitOverride?: number;
    qOverride?: string | null | undefined;
    isActiveOverride?: ActiveFilter | null | undefined;
    archivedFilterOverride?: ArchivedFilter | null | undefined;
    createdFromOverride?: string | null | undefined;
    createdToOverride?: string | null | undefined;
    updatedFromOverride?: string | null | undefined;
    updatedToOverride?: string | null | undefined;
  }) {
    setIsLoading(true);
    try {
      const qParam =
        opts?.qOverride === undefined
          ? appliedFilters.q.trim() || undefined
          : opts.qOverride || undefined;

      const isActiveParam =
        opts?.isActiveOverride === undefined
          ? appliedFilters.isActive === ""
            ? undefined
            : appliedFilters.isActive === "true"
          : opts.isActiveOverride == null || opts.isActiveOverride === ""
          ? undefined
          : opts.isActiveOverride === "true";

      const archivedFilterParam =
        opts?.archivedFilterOverride === undefined
          ? appliedFilters.archivedFilter
          : opts.archivedFilterOverride ?? "active-only";

      const createdFromParam =
        opts?.createdFromOverride === undefined
          ? appliedFilters.createdAtFrom || undefined
          : opts.createdFromOverride || undefined;

      const createdToParam =
        opts?.createdToOverride === undefined
          ? appliedFilters.createdAtTo || undefined
          : opts.createdToOverride || undefined;

      const updatedFromParam =
        opts?.updatedFromOverride === undefined
          ? appliedFilters.updatedAtFrom || undefined
          : opts.updatedFromOverride || undefined;

      const updatedToParam =
        opts?.updatedToOverride === undefined
          ? appliedFilters.updatedAtTo || undefined
          : opts.updatedToOverride || undefined;

      const res = await listBranchesApiRequest({
        limit: opts?.limitOverride ?? limit,
        cursorId: opts?.cursorId ?? cursorStack[pageIndex] ?? undefined,
        q: qParam,
        isActive: isActiveParam,
        archivedFilter: archivedFilterParam,
        // If your backend doesn't accept the date filters, they'll simply be ignored client-side.
        createdAtFrom: createdFromParam,
        createdAtTo: createdToParam,
        updatedAtFrom: updatedFromParam,
        updatedAtTo: updatedToParam,
        sortBy: opts?.sortByOverride ?? sortBy,
        sortDir: opts?.sortDirOverride ?? sortDir,
        includeTotal: opts?.includeTotal === true,
      });

      if (res.success) {
        const data = res.data;

        setRows(data.items);

        const serverHasNext =
          Boolean(data.pageInfo.hasNextPage) &&
          Boolean(data.pageInfo.nextCursor);

        const requested = opts?.limitOverride ?? limit;
        const clientSeesEnd = data.items.length < requested;

        const saneHasNext = serverHasNext && !clientSeesEnd;

        setHasNextPage(saneHasNext);
        setNextCursor(saneHasNext ? data.pageInfo.nextCursor ?? null : null);

        if (
          opts?.includeTotal &&
          typeof data.pageInfo.totalCount === "number"
        ) {
          setTotalCount(data.pageInfo.totalCount);
        }
      } else {
        const e = Object.assign(new Error("Failed to load branches"), {
          httpStatusCode: 500,
        });
        setErrorForBoundary(e);
      }
    } catch (e: any) {
      setErrorForBoundary(handlePageError(e, { title: "Error" }));
    } finally {
      setIsLoading(false);
    }
  }

  function resetToFirstPageAndFetch(opts?: {
    sortByOverride?: SortField;
    sortDirOverride?: SortDir;
    limitOverride?: number;
    qOverride?: string | null | undefined;
    isActiveOverride?: ActiveFilter | null | undefined;
    archivedFilterOverride?: ArchivedFilter | null | undefined;
    createdFromOverride?: string | null | undefined;
    createdToOverride?: string | null | undefined;
    updatedFromOverride?: string | null | undefined;
    updatedToOverride?: string | null | undefined;
  }) {
    setCursorStack([null]);
    setPageIndex(0);
    setUrlFromState({
      cursorId: null,
      page: 1,
      limit: opts?.limitOverride,
      sortBy: opts?.sortByOverride,
      sortDir: opts?.sortDirOverride,
      q: opts?.qOverride,
      isActive: opts?.isActiveOverride ?? null,
      archivedFilter: opts?.archivedFilterOverride ?? null,
      createdAtFrom: opts?.createdFromOverride,
      createdAtTo: opts?.createdToOverride,
      updatedAtFrom: opts?.updatedFromOverride,
      updatedAtTo: opts?.updatedToOverride,
    });
    void fetchPageWith({ includeTotal: true, cursorId: null, ...opts });
  }

  function applyAndFetch(values: BranchFilters) {
    setAppliedFilters(values);
    setUrlFromState({
      cursorId: null,
      q: values.q.trim() || null,
      isActive: values.isActive || null,
      archivedFilter: values.archivedFilter,
      createdAtFrom: values.createdAtFrom ?? null,
      createdAtTo: values.createdAtTo ?? null,
      updatedAtFrom: values.updatedAtFrom ?? null,
      updatedAtTo: values.updatedAtTo ?? null,
    });
    resetToFirstPageAndFetch({
      qOverride: values.q.trim() || null,
      isActiveOverride: values.isActive || null,
      archivedFilterOverride: values.archivedFilter,
      createdFromOverride: values.createdAtFrom ?? null,
      createdToOverride: values.createdAtTo ?? null,
      updatedFromOverride: values.updatedAtFrom ?? null,
      updatedToOverride: values.updatedAtTo ?? null,
    });
  }
  function clearAllFiltersAndFetch() {
    applyAndFetch(emptyFilters);
  }

  // initial load / tenant change
  useEffect(() => {
    setRows(null);
    setHasNextPage(false);
    setNextCursor(null);
    setTotalCount(null);
    setErrorForBoundary(null);

    const qpPage = Number(searchParams.get("page") ?? "1");
    const initialPageIndex =
      Number.isFinite(qpPage) && qpPage > 0 ? qpPage - 1 : 0;

    const qpLimit = Number(searchParams.get("limit"));
    const qpSortBy = searchParams.get("sortBy") as SortField | null;
    const qpSortDir = searchParams.get("sortDir") as SortDir | null;
    const qpQ = searchParams.get("q");
    const qpActive = searchParams.get("isActive") as ActiveFilter | null;
    const qpArchived = searchParams.get("archivedFilter") as ArchivedFilter | null;
    const qpCreatedFrom = searchParams.get("createdAtFrom");
    const qpCreatedTo = searchParams.get("createdAtTo");
    const qpUpdatedFrom = searchParams.get("updatedAtFrom");
    const qpUpdatedTo = searchParams.get("updatedAtTo");
    const qpCursor = searchParams.get("cursorId");

    if (!Number.isNaN(qpLimit) && qpLimit)
      setLimit(Math.max(1, Math.min(100, qpLimit)));
    if (qpSortBy) setSortBy(qpSortBy);
    if (qpSortDir) setSortDir(qpSortDir);

    setAppliedFilters({
      q: qpQ ?? "",
      isActive: (qpActive as ActiveFilter) ?? "",
      archivedFilter: qpArchived ?? "active-only",
      createdAtFrom: qpCreatedFrom ?? null,
      createdAtTo: qpCreatedTo ?? null,
      updatedAtFrom: qpUpdatedFrom ?? null,
      updatedAtTo: qpUpdatedTo ?? null,
    });

    setCursorStack([qpCursor ?? null]);
    setPageIndex(initialPageIndex);

    void fetchPageWith({
      includeTotal: true,
      cursorId: qpCursor ?? null,
      sortByOverride: qpSortBy ?? undefined,
      sortDirOverride: qpSortDir ?? undefined,
      limitOverride:
        !Number.isNaN(qpLimit) && qpLimit
          ? Math.max(1, Math.min(100, qpLimit))
          : undefined,
      qOverride: qpQ ?? undefined,
      isActiveOverride: (qpActive as ActiveFilter | null) ?? undefined,
      archivedFilterOverride: qpArchived ?? undefined,
      createdFromOverride: qpCreatedFrom ?? undefined,
      createdToOverride: qpCreatedTo ?? undefined,
      updatedFromOverride: qpUpdatedFrom ?? undefined,
      updatedToOverride: qpUpdatedTo ?? undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  // back/forward support
  useEffect(() => {
    if (navigationType !== "POP") return;

    const sp = new URLSearchParams(location.search);
    const qpLimit = Number(sp.get("limit"));
    const qpSortBy = sp.get("sortBy") as SortField | null;
    const qpSortDir = sp.get("sortDir") as SortDir | null;
    const qpQ = sp.get("q");
    const qpActive = sp.get("isActive") as ActiveFilter | null;
    const qpArchived = sp.get("archivedFilter") as ArchivedFilter | null;
    const qpCreatedFrom = sp.get("createdAtFrom");
    const qpCreatedTo = sp.get("createdAtTo");
    const qpUpdatedFrom = sp.get("updatedAtFrom");
    const qpUpdatedTo = sp.get("updatedAtTo");
    const qpCursor = sp.get("cursorId");
    const qpPage = Number(sp.get("page") ?? "1");
    const newPageIndex = Number.isFinite(qpPage) && qpPage > 0 ? qpPage - 1 : 0;

    if (!Number.isNaN(qpLimit) && qpLimit)
      setLimit(Math.max(1, Math.min(100, qpLimit)));
    if (qpSortBy) setSortBy(qpSortBy);
    if (qpSortDir) setSortDir(qpSortDir);

    setAppliedFilters({
      q: qpQ ?? "",
      isActive: (qpActive as ActiveFilter) ?? "",
      archivedFilter: qpArchived ?? "active-only",
      createdAtFrom: qpCreatedFrom ?? null,
      createdAtTo: qpCreatedTo ?? null,
      updatedAtFrom: qpUpdatedFrom ?? null,
      updatedAtTo: qpUpdatedTo ?? null,
    });

    setCursorStack([qpCursor ?? null]);
    setPageIndex(newPageIndex);

    void fetchPageWith({
      includeTotal: true,
      cursorId: qpCursor ?? null,
      sortByOverride: qpSortBy ?? undefined,
      sortDirOverride: qpSortDir ?? undefined,
      limitOverride:
        !Number.isNaN(qpLimit) && qpLimit
          ? Math.max(1, Math.min(100, qpLimit))
          : undefined,
      qOverride: qpQ ?? undefined,
      isActiveOverride: (qpActive as ActiveFilter | null) ?? undefined,
      archivedFilterOverride: qpArchived ?? undefined,
      createdFromOverride: qpCreatedFrom ?? undefined,
      createdToOverride: qpCreatedTo ?? undefined,
      updatedFromOverride: qpUpdatedFrom ?? undefined,
      updatedToOverride: qpUpdatedTo ?? undefined,
    });
  }, [location.key, navigationType, tenantSlug]);

  function applySort(nextField: SortField) {
    const next =
      sortBy === nextField ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    setSortBy(nextField);
    setSortDir(next);
    resetToFirstPageAndFetch({
      sortByOverride: nextField,
      sortDirOverride: next,
    });
  }

  async function goNextPage() {
    if (!hasNextPage || !nextCursor) return;
    setIsPaginating(true);
    try {
      const newIndex = pageIndex + 1;
      setCursorStack((prev) => [...prev.slice(0, pageIndex + 1), nextCursor]);
      setPageIndex(newIndex);
      setUrlFromState({ cursorId: nextCursor, page: newIndex + 1 });
      await fetchPageWith({ cursorId: nextCursor });
    } finally {
      setIsPaginating(false);
    }
  }
  async function goPrevPage() {
    if (pageIndex === 0) return;
    setIsPaginating(true);
    try {
      const prevCursor = cursorStack[pageIndex - 1] ?? null;
      const newIndex = pageIndex - 1;
      setPageIndex(newIndex);
      setUrlFromState({ cursorId: prevCursor, page: newIndex + 1 });
      await fetchPageWith({ cursorId: prevCursor });
    } finally {
      setIsPaginating(false);
    }
  }

  const shownCount = rows?.length ?? 0;
  const rangeStart = shownCount ? pageIndex * limit + 1 : 0;
  const rangeEnd = shownCount ? rangeStart + shownCount - 1 : 0;
  const rangeText =
    shownCount === 0
      ? "No results"
      : `Showing ${rangeStart}–${rangeEnd}${
          totalCount != null ? ` of ${totalCount}` : ""
        }`;

  async function copyShareableLink() {
    const href = window.location.href;
    try {
      await navigator.clipboard.writeText(href);
      notifications.show({ color: "green", message: "Shareable link copied." });
    } catch {
      const ta = document.createElement("textarea");
      ta.value = href;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      notifications.show({ color: "green", message: "Shareable link copied." });
    }
  }

  const activeFilterChips = useMemo(() => {
    const chips: { key: keyof BranchFilters; label: string }[] = [];
    if (appliedFilters.q.trim())
      chips.push({ key: "q", label: `search: "${appliedFilters.q.trim()}"` });
    if (appliedFilters.isActive) {
      chips.push({
        key: "isActive",
        label:
          appliedFilters.isActive === "true" ? "status: Active" : "status: Inactive",
      });
    }
    if (appliedFilters.archivedFilter && appliedFilters.archivedFilter !== "active-only") {
      chips.push({
        key: "archivedFilter",
        label:
          appliedFilters.archivedFilter === "archived-only"
            ? "Archived branches only"
            : "All branches (active + archived)",
      });
    }
    if (appliedFilters.createdAtFrom)
      chips.push({
        key: "createdAtFrom",
        label: `created ≥ ${appliedFilters.createdAtFrom}`,
      });
    if (appliedFilters.createdAtTo)
      chips.push({
        key: "createdAtTo",
        label: `created ≤ ${appliedFilters.createdAtTo}`,
      });
    if (appliedFilters.updatedAtFrom)
      chips.push({
        key: "updatedAtFrom",
        label: `updated ≥ ${appliedFilters.updatedAtFrom}`,
      });
    if (appliedFilters.updatedAtTo)
      chips.push({
        key: "updatedAtTo",
        label: `updated ≤ ${appliedFilters.updatedAtTo}`,
      });
    return chips;
  }, [appliedFilters]);

  function clearOneChip(key: keyof BranchFilters) {
    const next: BranchFilters = {
      ...appliedFilters,
      q: key === "q" ? "" : appliedFilters.q,
      isActive: key === "isActive" ? "" : appliedFilters.isActive,
      archivedFilter: key === "archivedFilter" ? "active-only" : appliedFilters.archivedFilter,
      createdAtFrom:
        key === "createdAtFrom" ? null : appliedFilters.createdAtFrom,
      createdAtTo: key === "createdAtTo" ? null : appliedFilters.createdAtTo,
      updatedAtFrom:
        key === "updatedAtFrom" ? null : appliedFilters.updatedAtFrom,
      updatedAtTo: key === "updatedAtTo" ? null : appliedFilters.updatedAtTo,
    };
    applyAndFetch(next);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start w-full">
        <Group justify="space-between" align="start" className="w-full">
          <Stack gap="1">
            <Title order={3}>Branches</Title>
            <Text
              size="sm"
              c="dimmed"
              id={RANGE_ID}
              aria-live="polite"
              aria-atomic="true"
            >
              {rangeText}
            </Text>
          </Stack>
          <Group gap="xs">
            <Button
              leftSection={<IconLink size={16} />}
              variant="light"
              title="Copy shareable link"
              onClick={copyShareableLink}
            >
              Copy link
            </Button>

            <Button
              leftSection={<IconFilter size={16} />}
              variant={showFilters ? "filled" : "light"}
              onClick={() => setShowFilters((s) => !s)}
              rightSection={
                showFilters ? (
                  <IconChevronUp size={16} />
                ) : (
                  <IconChevronDown size={16} />
                )
              }
              aria-expanded={showFilters}
              aria-controls={FILTER_PANEL_ID}
              data-testid="branches-filter-button"
            >
              Filters
            </Button>

            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              onClick={() => resetToFirstPageAndFetch()}
            >
              Refresh
            </Button>

            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => navigate(`/${tenantSlug}/branches/new`)}
              disabled={!canManageBranches}
              data-testid="new-branch-button"
            >
              New branch
            </Button>
          </Group>
        </Group>
      </div>

      {/* Filters */}
      <FilterBar<BranchFilters>
        open={showFilters}
        panelId={FILTER_PANEL_ID}
        initialValues={appliedFilters}
        emptyValues={emptyFilters}
        onApply={applyAndFetch}
        onClear={clearAllFiltersAndFetch}
      >
        {({ values, setValues }) => (
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <TextInput
                label="Search (name contains)"
                placeholder="e.g. London"
                value={values.q}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setValues((prev) => ({ ...prev, q: value }));
                }}
                data-testid="branches-search-input"
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Select
                label="Status"
                placeholder="Any"
                data={[
                  { value: "", label: "Any" },
                  { value: "true", label: "Active" },
                  { value: "false", label: "Inactive" },
                ]}
                value={values.isActive}
                onChange={(v) =>
                  setValues({
                    ...values,
                    isActive: (v ?? "") as ActiveFilter,
                  })
                }
                clearable
                aria-label="Filter by status"
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Select
                label="Archive Filter"
                data={[
                  { value: "active-only", label: "Active branches only" },
                  { value: "archived-only", label: "Archived branches only" },
                  { value: "all", label: "All branches (active + archived)" },
                ]}
                value={values.archivedFilter}
                onChange={(v) =>
                  setValues({
                    ...values,
                    archivedFilter: (v ?? "active-only") as ArchivedFilter,
                  })
                }
                aria-label="Filter by archive status"
                data-testid="archived-filter-select"
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <DatePickerInput
                label="Created from"
                placeholder="Start date"
                value={values.createdAtFrom}
                onChange={(v) =>
                  setValues((prev) => ({ ...prev, createdAtFrom: v }))
                }
                valueFormat="YYYY-MM-DD"
                popoverProps={{ withinPortal: true }}
                presets={buildCommonDatePresets()}
                clearable
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <DatePickerInput
                label="Created to"
                placeholder="End date"
                value={values.createdAtTo}
                onChange={(v) =>
                  setValues((prev) => ({ ...prev, createdAtTo: v }))
                }
                valueFormat="YYYY-MM-DD"
                presets={buildCommonDatePresets()}
                popoverProps={{ withinPortal: true }}
                clearable
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <DatePickerInput
                label="Updated from"
                placeholder="Start date"
                value={values.updatedAtFrom}
                onChange={(v) =>
                  setValues((prev) => ({ ...prev, updatedAtFrom: v }))
                }
                valueFormat="YYYY-MM-DD"
                popoverProps={{ withinPortal: true }}
                presets={buildCommonDatePresets()}
                clearable
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <DatePickerInput
                label="Updated to"
                placeholder="End date"
                value={values.updatedAtTo}
                onChange={(v) =>
                  setValues((prev) => ({ ...prev, updatedAtTo: v }))
                }
                valueFormat="YYYY-MM-DD"
                popoverProps={{ withinPortal: true }}
                presets={buildCommonDatePresets()}
                clearable
              />
            </Grid.Col>
          </Grid>
        )}
      </FilterBar>

      {/* Table + Controls */}
      <div className="py-4">
        <Paper
          withBorder
          p="md"
          radius="md"
        >
          <Group justify="space-between" mb="md">
            <Title order={4}>All Branches</Title>

            <Group align="center" gap="xs">
              <Text size="sm" c="dimmed">
                Per page
              </Text>
              <NumberInput
                value={limit}
                onChange={(v) => {
                  const n =
                    typeof v === "number" ? v : v === "" ? 20 : Number(v);
                  const clamped = Math.max(1, Math.min(100, n));
                  setLimit(clamped);
                  resetToFirstPageAndFetch({ limitOverride: clamped });
                }}
                min={1}
                max={100}
                step={1}
                clampBehavior="strict"
                w={rem(90)}
              />
            </Group>
          </Group>

          {rows === null || isLoading ? (
            <div
              className="flex items-center justify-center p-8"
              role="status"
              aria-live="polite"
            >
              <Loader />
              <Text ml="sm">Loading branches…</Text>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {/** Chips */}
              {activeFilterChips.length > 0 && (
                <Group
                  gap="xs"
                  mb="sm"
                  wrap="wrap"
                  role="region"
                  aria-label="Active filters"
                >
                  {activeFilterChips.map((chip) => (
                    <Badge
                      key={chip.key as string}
                      variant="light"
                      rightSection={
                        <CloseButton
                          aria-label={`Clear ${chip.label}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            clearOneChip(chip.key);
                          }}
                        />
                      }
                    >
                      {chip.label}
                    </Badge>
                  ))}
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={clearAllFiltersAndFetch}
                    aria-label="Clear all filters"
                  >
                    Clear all
                  </Button>
                </Group>
              )}

              {/* Empty state */}
              {!isLoading && (rows?.length ?? 0) === 0 ? (
                <div
                  className="py-16 text-center"
                  role="region"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <Title order={4} mb="xs">
                    No branches match your filters
                  </Title>
                  <Text c="dimmed" mb="md">
                    Try adjusting your filters or clear them to see all branches.
                  </Text>
                  <Group justify="center">
                    <Button onClick={clearAllFiltersAndFetch}>
                      Clear all filters
                    </Button>
                    <Button
                      variant="light"
                      onClick={() => setShowFilters(true)}
                      aria-controls={FILTER_PANEL_ID}
                      aria-expanded={showFilters}
                    >
                      Show filters
                    </Button>
                  </Group>
                </div>
              ) : (
                <Table
                  id={TABLE_ID}
                  striped
                  withTableBorder
                  withColumnBorders
                  stickyHeader
                  aria-describedby={RANGE_ID}
                  data-testid="branches-table"
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th
                        scope="col"
                        aria-sort={colAriaSort("branchName")}
                      >
                        <Group gap={4} wrap="nowrap">
                          <span>Name</span>
                          <Tooltip label="Sort by name" withArrow>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              onClick={() => applySort("branchName")}
                              aria-label={sortButtonLabel(
                                "name",
                                "branchName"
                              )}
                            >
                              {sortBy === "branchName" ? (
                                sortDir === "asc" ? (
                                  <IconArrowUp size={16} />
                                ) : (
                                  <IconArrowDown size={16} />
                                )
                              ) : (
                                <IconArrowsSort size={16} />
                              )}
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Th>

                      <Table.Th scope="col" aria-sort={colAriaSort("isActive")}>
                        <Group gap={4} wrap="nowrap">
                          <span>Status</span>
                          <Tooltip label="Sort by status" withArrow>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              onClick={() => applySort("isActive")}
                              aria-label={sortButtonLabel("status", "isActive")}
                            >
                              {sortBy === "isActive" ? (
                                sortDir === "asc" ? (
                                  <IconArrowUp size={16} />
                                ) : (
                                  <IconArrowDown size={16} />
                                )
                              ) : (
                                <IconArrowsSort size={16} />
                              )}
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Th>

                      <Table.Th
                        scope="col"
                        aria-sort={colAriaSort("createdAt")}
                      >
                        <Group gap={4} wrap="nowrap">
                          <span>Created</span>
                          <Tooltip label="Sort by created date" withArrow>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              onClick={() => applySort("createdAt")}
                              aria-label={sortButtonLabel(
                                "created",
                                "createdAt"
                              )}
                            >
                              {sortBy === "createdAt" ? (
                                sortDir === "asc" ? (
                                  <IconArrowUp size={16} />
                                ) : (
                                  <IconArrowDown size={16} />
                                )
                              ) : (
                                <IconArrowsSort size={16} />
                              )}
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Th>

                      <Table.Th
                        scope="col"
                        aria-sort={colAriaSort("updatedAt")}
                      >
                        <Group gap={4} wrap="nowrap">
                          <span>Updated</span>
                          <Tooltip label="Sort by updated date" withArrow>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              onClick={() => applySort("updatedAt")}
                              aria-label={sortButtonLabel(
                                "updated",
                                "updatedAt"
                              )}
                            >
                              {sortBy === "updatedAt" ? (
                                sortDir === "asc" ? (
                                  <IconArrowUp size={16} />
                                ) : (
                                  <IconArrowDown size={16} />
                                )
                              ) : (
                                <IconArrowsSort size={16} />
                              )}
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Th>

                      <Table.Th className="text-right">Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>

                  <Table.Tbody>
                    {rows!.map((r) => (
                      <Table.Tr key={r.id}>
                        <Table.Td>
                          <Group gap="xs">
                            <Text fw={600}>{(r as any).branchName ?? (r as any).name ?? "—"}</Text>
                            {(r as any).isArchived && (
                              <Badge color="gray" size="sm" data-testid="archived-badge">
                                Archived
                              </Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          {(r as any).isActive ? (
                            <Badge color="green">Active</Badge>
                          ) : (
                            <Badge color="gray">Inactive</Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {r.createdAt
                            ? new Date(r.createdAt).toLocaleString()
                            : "—"}
                        </Table.Td>
                        <Table.Td>
                          {r.updatedAt
                            ? new Date(r.updatedAt).toLocaleString()
                            : "—"}
                        </Table.Td>
                        <Table.Td className="text-right">
                          <Group gap="xs" justify="flex-end">
                            <ActionIcon
                              component={Link}
                              to={`/${tenantSlug}/branches/${r.id}`}
                              variant="light"
                              title="View branch"
                              data-testid="view-branch-btn"
                            >
                              <IconEye size={16} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}

              {/* Pagination */}
              <Group justify="space-between" mt="md">
                <Text
                  size="sm"
                  c="dimmed"
                  id={RANGE_ID}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {rangeText}
                </Text>
                <Group gap="xs">
                  <Button
                    variant="light"
                    leftSection={<IconPlayerTrackPrev size={16} />}
                    onClick={goPrevPage}
                    disabled={
                      isPaginating ||
                      pageIndex === 0 ||
                      (pageIndex > 0 &&
                        cursorStack[pageIndex - 1] === undefined)
                    }
                  >
                    Prev
                  </Button>
                  <Text size="sm" c="dimmed">
                    Page {pageIndex + 1}
                  </Text>
                  <Button
                    variant="light"
                    rightSection={<IconPlayerTrackNext size={16} />}
                    onClick={goNextPage}
                    disabled={!hasNextPage || isPaginating}
                  >
                    Next
                  </Button>
                </Group>
              </Group>
            </div>
          )}
        </Paper>
      </div>
    </div>
  );
}
