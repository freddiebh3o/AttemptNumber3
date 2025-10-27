// admin-web/src/components/products/ProductActivityTab.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Table,
  Text,
  Title,
  Tooltip,
  Timeline,
  Select,
  MultiSelect,
  Space,
  Stack,
  NumberInput,
  rem,
  CloseButton,
  Anchor 
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import {
  IconRefresh,
  IconFilter,
  IconChevronDown,
  IconChevronUp,
  IconPlayerTrackPrev,
  IconPlayerTrackNext,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { handlePageError } from "../../utils/pageError";
import { getProductActivityApiRequest } from "../../api/products";
import { FilterBar } from "../common/FilterBar";
import { useLocation, useNavigationType, useSearchParams, Link, useParams } from "react-router-dom";
import { buildCommonDatePresets } from "../../utils/datePresets";
import { formatDateTimeReadable } from "../../utils/dateFormatter";
import { formatPenceAsGBP } from "../../utils/money";

dayjs.extend(relativeTime);

type ViewMode = "table" | "timeline";

type UnifiedActivityItem =
  | {
      kind: "audit";
      id: string;
      when: string;
      action: string;
      message: string;
      messageParts?: Record<string, unknown>;
      actor?: { userId: string; display: string } | null;
      correlationId?: string | null;
      entityName?: string | null;
    }
  | {
      kind: "ledger";
      id: string;
      when: string;
      entryKind: "RECEIPT" | "ADJUSTMENT" | "CONSUMPTION" | "REVERSAL";
      qtyDelta: number;
      branchId?: string | null;
      branchName?: string | null;
      reason?: string | null;
      lotId?: string | null;
      message: string;
      messageParts?: Record<string, unknown>;
      actor?: { userId: string; display: string } | null;
      correlationId?: string | null;
    };

type Filters = {
  type: "all" | "audit" | "ledger";
  actorIds: string[];          // user IDs
  occurredFrom: string | null; // YYYY-MM-DD
  occurredTo: string | null;   // YYYY-MM-DD
};

const emptyFilters: Filters = {
  type: "all",
  actorIds: [],
  occurredFrom: null,
  occurredTo: null,
};

const LOCALSTORAGE_LIMIT_KEY = "product-activity:perPage";

// Keys this component controls in the query string
const OWN_KEYS = [
  "mode",
  "limit",
  "page",
  "cursor",
  "type",
  "actorIds",
  "occurredFrom",
  "occurredTo",
  "filtersOpen",
] as const;

function AuditDiffLines({ parts }: { parts: Record<string, any> }) {
  if (!parts) return null;

  const hasKnown =
    parts.name || parts.slug || parts.sku || parts.barcode ||
    parts.isActive !== undefined || parts.salePrice !== undefined ||
    parts.costPrice !== undefined || parts.taxRate !== undefined || parts.unit;

  return (
    <Stack gap={4} mt={6}>
      {parts.name && (
        <Text size="xs" c="dimmed">
          Name: <code>{parts.name.before ?? "—"}</code> → <code>{parts.name.after ?? "—"}</code>
        </Text>
      )}
      {parts.slug && (
        <Text size="xs" c="dimmed">
          Slug: <code>{parts.slug.before ?? "—"}</code> → <code>{parts.slug.after ?? "—"}</code>
        </Text>
      )}
      {parts.sku && (
        <Text size="xs" c="dimmed">
          SKU: <code>{parts.sku.before ?? "—"}</code> → <code>{parts.sku.after ?? "—"}</code>
        </Text>
      )}
      {parts.barcode && (
        <Text size="xs" c="dimmed">
          Barcode: <code>{parts.barcode.before ?? "—"}</code> → <code>{parts.barcode.after ?? "—"}</code>
        </Text>
      )}
      {parts.isActive !== undefined && parts.isActive && (
        <Text size="xs" c="dimmed">
          Active: <code>{String(parts.isActive.before)}</code> → <code>{String(parts.isActive.after)}</code>
        </Text>
      )}
      {parts.salePrice && (
        <Text size="xs" c="dimmed">
          Sale price: <code>{parts.salePrice.before != null ? formatPenceAsGBP(parts.salePrice.before) : "—"}</code> → <code>{parts.salePrice.after != null ? formatPenceAsGBP(parts.salePrice.after) : "—"}</code>
        </Text>
      )}
      {parts.costPrice && (
        <Text size="xs" c="dimmed">
          Cost price: <code>{parts.costPrice.before != null ? formatPenceAsGBP(parts.costPrice.before) : "—"}</code> → <code>{parts.costPrice.after != null ? formatPenceAsGBP(parts.costPrice.after) : "—"}</code>
        </Text>
      )}
      {parts.taxRate && (
        <Text size="xs" c="dimmed">
          Tax rate: <code>{parts.taxRate.before ?? "—"}</code> → <code>{parts.taxRate.after ?? "—"}</code>
        </Text>
      )}
      {parts.unit && (
        <Text size="xs" c="dimmed">
          Unit: <code>{parts.unit.before ?? "—"}</code> → <code>{parts.unit.after ?? "—"}</code>
        </Text>
      )}

      {!hasKnown && parts.changedKeys && (
        <Text size="xs" c="dimmed">{parts.changedKeys} field(s) changed</Text>
      )}
    </Stack>
  );
}

export function ProductActivityTab({ productId }: { productId: string }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navType = useNavigationType();

  const [mode, setMode] = useState<ViewMode>("table");
  const [isLoading, setIsLoading] = useState(false);
  const [isPaginating, setIsPaginating] = useState(false);
  const [rows, setRows] = useState<UnifiedActivityItem[] | null>(null);
  const [errorForBoundary, setErrorForBoundary] = useState<
    (Error & { httpStatusCode?: number; correlationId?: string }) | null
  >(null);

  // Collapsible filters
  const [showFilters, setShowFilters] = useState(false);

  // Applied filters + facet options
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [actorOptions, setActorOptions] = useState<{ value: string; label: string }[]>([]);

  // Simple per-product facet cache to avoid flicker on paging
  const facetCache = useRef<Map<string, { actors: { value: string; label: string }[] }>>(new Map());

  // Cursor pagination
  const [limit, setLimit] = useState<number>(() => {
    const fromLS = Number(localStorage.getItem(LOCALSTORAGE_LIMIT_KEY) || "");
    return Number.isFinite(fromLS) && fromLS > 0 ? Math.max(1, Math.min(100, fromLS)) : 20;
  });
  const [pageIndex, setPageIndex] = useState(0); // 0-based
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]); // first page = null
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Totals
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Range text (+ approx indicator if unknown)
  const shownCount = rows?.length ?? 0;
  const rangeStart = shownCount ? pageIndex * limit + 1 : 0;
  const rangeEnd = shownCount ? rangeStart + shownCount - 1 : 0;
  const approx = totalCount == null ? "≈ " : "";
  const totalPages = totalCount != null ? Math.max(1, Math.ceil(totalCount / limit)) : null;
  const rangeText =
    shownCount === 0
      ? "No results"
      : `${approx}Showing ${rangeStart}–${rangeEnd}${totalCount != null ? ` of ${totalCount}` : ""}`;

  // ---- URL helpers ---------------------------------------------------------
  function writeUrlState(overrides?: {
    page?: number; // 1-based
    cursor?: string | null;
    limit?: number;
    mode?: ViewMode;
    filtersOpen?: boolean;
    type?: Filters["type"];
    actorIds?: string[];
    occurredFrom?: string | null;
    occurredTo?: string | null;
  }) {
    // ✅ Merge with existing params so we don't blow away ?tab=activity (or others)
    const sp = new URLSearchParams(searchParams);

    // First, remove our own keys so we can cleanly rewrite them
    for (const k of OWN_KEYS) sp.delete(k);

    const put = (k: string, v: unknown) => {
      if (v === undefined || v === null || v === "") return;
      sp.set(k, String(v));
    };

    put("mode", overrides?.mode ?? mode);
    put("limit", overrides?.limit ?? limit);

    const page = overrides?.page ?? pageIndex + 1;
    put("page", page);

    const cursor =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "cursor")
        ? overrides.cursor
        : cursorStack[pageIndex] ?? null;
    if (cursor) put("cursor", cursor);

    const fType = overrides?.type ?? filters.type;
    const fActorIds = overrides?.actorIds ?? filters.actorIds;
    const fFrom =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "occurredFrom")
        ? overrides.occurredFrom
        : filters.occurredFrom;
    const fTo =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "occurredTo")
        ? overrides.occurredTo
        : filters.occurredTo;

    put("type", fType);
    if (fActorIds?.length) put("actorIds", fActorIds.join(","));
    put("occurredFrom", fFrom ?? "");
    put("occurredTo", fTo ?? "");
    put("filtersOpen", overrides?.filtersOpen ?? showFilters ? "1" : "0");

    setSearchParams(sp, { replace: false });
  }

  function parseUrlOnMount() {
    const qpMode = (searchParams.get("mode") as ViewMode) || "table";

    const qpLimit = Number(searchParams.get("limit") ?? "");
    const effectiveLimit =
      Number.isFinite(qpLimit) && qpLimit > 0 ? Math.max(1, Math.min(100, qpLimit)) : limit;

    const qpPage = Number(searchParams.get("page") ?? "1");
    const initialPageIndex = Number.isFinite(qpPage) && qpPage > 0 ? qpPage - 1 : 0;

    const qpCursor = searchParams.get("cursor");

    const qpType = (searchParams.get("type") as Filters["type"]) || "all";
    const qpActorIds = (searchParams.get("actorIds") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const qpFrom = searchParams.get("occurredFrom");
    const qpTo = searchParams.get("occurredTo");
    const qpFiltersOpen = searchParams.get("filtersOpen") === "1";

    setMode(qpMode);
    setLimit(effectiveLimit);
    setPageIndex(initialPageIndex);
    setCursorStack([qpCursor ?? null]);
    setShowFilters(qpFiltersOpen);

    setFilters({
      type: qpType,
      actorIds: qpActorIds,
      occurredFrom: qpFrom || null,
      occurredTo: qpTo || null,
    });

    // initial read for per-page preference
    localStorage.setItem(LOCALSTORAGE_LIMIT_KEY, String(effectiveLimit));

    return { cursor: qpCursor ?? null, includeTotal: true };
  }

  // ---- Data fetching -------------------------------------------------------
  async function fetchPage(opts?: {
    cursor?: string | null;
    keepFacets?: boolean;
    limitOverride?: number;
    includeTotal?: boolean; // ask server to compute total
  }) {
    const fetchingJustPagination = opts?.keepFacets === true && !opts?.includeTotal;
    !fetchingJustPagination && setIsLoading(true);
    fetchingJustPagination && setIsPaginating(true);

    try {
      const effectiveLimit = opts?.limitOverride ?? limit;

      // Only include cursor when it’s a string (omit for first page)
      const cursorSpread =
        typeof opts?.cursor === "string" ? { cursor: opts.cursor } : {};

      const res = await getProductActivityApiRequest({
        productId,
        limit: effectiveLimit,
        ...cursorSpread,
        type: filters.type,
        ...(filters.actorIds.length ? { actorIds: filters.actorIds } : {}),
        ...(filters.occurredFrom
          ? { occurredFrom: dayjs(filters.occurredFrom).toISOString() }
          : {}),
        ...(filters.occurredTo
          ? { occurredTo: dayjs(filters.occurredTo).toISOString() }
          : {}),
        includeFacets: !opts?.keepFacets, // hydrate facets for first page / explicit refresh
        includeTotal: opts?.includeTotal === true, // totals on first / explicit refresh / filter change / per-page change
      });

      if (!res.success) throw new Error("Failed to load activity");
      const data = res.data;

      const items = (data.items ?? []) as UnifiedActivityItem[];
      setRows(items);

      const serverHasNext = Boolean(data.pageInfo?.hasNextPage);
      const serverNextCursor = data.pageInfo?.nextCursor ?? null;

      setHasNextPage(serverHasNext && !!serverNextCursor);
      setNextCursor(serverHasNext && serverNextCursor ? serverNextCursor : null);

      // Totals
      if (typeof data.pageInfo?.totalCount === "number") {
        setTotalCount(data.pageInfo.totalCount);
      } else if (opts?.includeTotal) {
        setTotalCount(null);
      }

      // Facets (cache by productId)
      if (!opts?.keepFacets) {
        const fromServer = (data as any).facets?.actors as Array<{ userId: string; display: string }> | undefined;
        if (fromServer) {
          const mapped = fromServer.map((a) => ({ value: a.userId, label: a.display }));
          facetCache.current.set(productId, { actors: mapped });
          setActorOptions(mapped);
        } else {
          // use cache if present
          const cached = facetCache.current.get(productId)?.actors;
          if (cached) setActorOptions(cached);
        }
      }
    } catch (e) {
      setErrorForBoundary(handlePageError(e, { title: "Failed to load activity" }));
    } finally {
      fetchingJustPagination ? setIsPaginating(false) : setIsLoading(false);
    }
  }

  // Reset pagination & fetch page 1 (usually after filters or per-page change)
  function resetToFirstPageAndFetch(opts?: {
    keepFacets?: boolean;
    limitOverride?: number;
  }) {
    setCursorStack([null]);
    setPageIndex(0);

    writeUrlState({
      page: 1,
      cursor: null,
      limit: opts?.limitOverride ?? limit,
      type: filters.type,
      actorIds: filters.actorIds,
      occurredFrom: filters.occurredFrom,
      occurredTo: filters.occurredTo,
      mode,
      filtersOpen: showFilters,
    });

    void fetchPage({
      cursor: null,
      keepFacets: opts?.keepFacets,
      limitOverride: opts?.limitOverride,
      includeTotal: true,
    });
  }

  // Initial load / when product changes
  useEffect(() => {
    setRows(null);
    setErrorForBoundary(null);
    setCursorStack([null]);
    setPageIndex(0);
    setHasNextPage(false);
    setNextCursor(null);
    setTotalCount(null);

    const { cursor, includeTotal } = parseUrlOnMount();

    // hydrate facets if cached
    const cached = facetCache.current.get(productId)?.actors;
    if (cached) setActorOptions(cached);

    void fetchPage({ cursor, includeTotal });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Handle browser back/forward
  useEffect(() => {
    if (navType !== "POP") return;
    const sp = new URLSearchParams(location.search);
    const qpMode = (sp.get("mode") as ViewMode) || "table";
    const qpLimit = Number(sp.get("limit") ?? "");
    const effectiveLimit =
      Number.isFinite(qpLimit) && qpLimit > 0 ? Math.max(1, Math.min(100, qpLimit)) : limit;

    const qpPage = Number(sp.get("page") ?? "1");
    const newIndex = Number.isFinite(qpPage) && qpPage > 0 ? qpPage - 1 : 0;

    const qpCursor = sp.get("cursor");
    const qpType = (sp.get("type") as Filters["type"]) || "all";
    const qpActorIds = (sp.get("actorIds") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const qpFrom = sp.get("occurredFrom");
    const qpTo = sp.get("occurredTo");
    const qpFiltersOpen = sp.get("filtersOpen") === "1";

    setMode(qpMode);
    setLimit(effectiveLimit);
    setFilters({
      type: qpType,
      actorIds: qpActorIds,
      occurredFrom: qpFrom || null,
      occurredTo: qpTo || null,
    });

    setCursorStack([qpCursor ?? null]);
    setPageIndex(newIndex);
    setShowFilters(qpFiltersOpen);

    void fetchPage({
      cursor: qpCursor ?? null,
      keepFacets: true,
      includeTotal: true,
    });
  }, [location.key, navType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch whenever *applied* filters change → go back to page 1 (and update URL)
  useEffect(() => {
    if (rows === null) return; // wait for initial load

    writeUrlState({
      page: 1,
      cursor: null,
      type: filters.type,
      actorIds: filters.actorIds,
      occurredFrom: filters.occurredFrom,
      occurredTo: filters.occurredTo,
    });

    resetToFirstPageAndFetch({ keepFacets: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.type, JSON.stringify(filters.actorIds), filters.occurredFrom, filters.occurredTo]);

  if (errorForBoundary) throw errorForBoundary;

  // Paging actions + URL sync
  async function goNext() {
    if (!hasNextPage || !nextCursor) return;
    const newIndex = pageIndex + 1;
    setCursorStack((prev) => [...prev.slice(0, pageIndex + 1), nextCursor]);
    setPageIndex(newIndex);
    writeUrlState({ cursor: nextCursor, page: newIndex + 1 });
    await fetchPage({ cursor: nextCursor, keepFacets: true });
  }

  async function goPrev() {
    if (pageIndex === 0) return;
    const prevCursor = cursorStack[pageIndex - 1] ?? null;
    const newIndex = pageIndex - 1;
    setPageIndex(newIndex);
    writeUrlState({ cursor: prevCursor, page: newIndex + 1 });
    await fetchPage({ cursor: prevCursor, keepFacets: true });
  }

  // Active filter chips (quick clear)
  const activeFilterChips = useMemo(() => {
    const chips: { key: keyof Filters | "actorIds" | "type"; label: string }[] = [];
    if (filters.type !== "all") chips.push({ key: "type", label: `type: ${filters.type}` });
    if (filters.actorIds.length)
      chips.push({ key: "actorIds", label: `actors: ${filters.actorIds.length}` });
    if (filters.occurredFrom) chips.push({ key: "occurredFrom", label: `from: ${filters.occurredFrom}` });
    if (filters.occurredTo) chips.push({ key: "occurredTo", label: `to: ${filters.occurredTo}` });
    return chips;
  }, [filters]);

  function clearOneChip(key: keyof Filters | "actorIds" | "type") {
    const next: Filters = {
      ...filters,
      type: key === "type" ? "all" : filters.type,
      actorIds: key === "actorIds" ? [] : filters.actorIds,
      occurredFrom: key === "occurredFrom" ? null : filters.occurredFrom,
      occurredTo: key === "occurredTo" ? null : filters.occurredTo,
    };
    setFilters(next);
    // URL + fetch handled by effect
  }

  const header = (
    <Group justify="space-between" align="start">
      <Stack gap="1">
        <Title order={4}>Activity</Title>
        <Text size="sm" c="dimmed" aria-live="polite" aria-atomic="true">
          {rangeText} · Product changes + stock movements
        </Text>
      </Stack>

      <Group gap="sm" align="center">
        <SegmentedControl
          value={mode}
          onChange={(v) => {
            const next = v as ViewMode;
            setMode(next);
            writeUrlState({ mode: next });
          }}
          data={[
            { label: "Table", value: "table" },
            { label: "Timeline", value: "timeline" },
          ]}
          size="sm"
        />
        <Button
          leftSection={<IconFilter size={16} />}
          variant={showFilters ? "filled" : "light"}
          onClick={() => {
            const next = !showFilters;
            setShowFilters(next);
            writeUrlState({ filtersOpen: next });
          }}
          rightSection={showFilters ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          aria-expanded={showFilters}
          aria-controls="product-activity-filters"
        >
          Filters
        </Button>
        <Button
          leftSection={<IconRefresh size={16} />}
          variant="light"
          onClick={() => {
            // explicit refresh = refresh facets + totals
            resetToFirstPageAndFetch({ keepFacets: false });
          }}
          title="Refresh (also refreshes facets & totals)"
        >
          Refresh
        </Button>
      </Group>
    </Group>
  );

  // Collapsible FilterBar (draft -> apply -> updates `filters`)
  const filterPanel = (
    <>
      <FilterBar<Filters>
        open={showFilters}
        panelId="product-activity-filters"
        initialValues={filters}
        emptyValues={emptyFilters}
        onApply={(vals) => {
          setFilters(vals);
        }}
        onClear={() => {
          setFilters(emptyFilters);
        }}
      >
        {({ values, setValues }) => (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select
              label="Type"
              placeholder="All"
              value={values.type}
              onChange={(v) =>
                setValues((prev) => ({
                  ...prev,
                  type: (v as Filters["type"]) ?? "all",
                }))
              }
              data={[
                { value: "all", label: "All" },
                { value: "audit", label: "Product changes" },
                { value: "ledger", label: "Stock movements" },
              ]}
            />

            <MultiSelect
              label="Actor"
              placeholder="All actors"
              data={actorOptions}
              value={values.actorIds}
              onChange={(arr) => setValues((prev) => ({ ...prev, actorIds: arr }))}
              searchable
              clearable
            />

            <DatePickerInput
              label="Occurred from"
              placeholder="Start date"
              value={values.occurredFrom ? new Date(values.occurredFrom) : null}
              onChange={(d) =>
                setValues((prev) => ({
                  ...prev,
                  occurredFrom: d ? dayjs(d).format("YYYY-MM-DD") : null,
                }))
              }
              popoverProps={{ withinPortal: true }}
              presets={buildCommonDatePresets()}
              valueFormat="DD/MM/YYYY"
              clearable
              data-testid="activity-occurred-from-date-picker"
            />

            <DatePickerInput
              label="Occurred to"
              placeholder="End date"
              value={values.occurredTo ? new Date(values.occurredTo) : null}
              onChange={(d) =>
                setValues((prev) => ({
                  ...prev,
                  occurredTo: d ? dayjs(d).format("YYYY-MM-DD") : null,
                }))
              }
              popoverProps={{ withinPortal: true }}
              presets={buildCommonDatePresets()}
              valueFormat="DD/MM/YYYY"
              clearable
              data-testid="activity-occurred-to-date-picker"
            />
          </div>
        )}
      </FilterBar>

      

      <Space h="md" />
    </>
  );

  // Pagination controls (shared for table & timeline)
  const paginationBar = (
    <Group justify="space-between" mt="md">
      <Text size="sm" c="dimmed" aria-live="polite" aria-atomic="true">
        {rangeText}
        {totalPages != null ? ` · Page ${pageIndex + 1} of ${totalPages}` : ` · Page ${pageIndex + 1}`}
      </Text>
      <Group gap="xs">
        <Button
          variant="light"
          leftSection={<IconPlayerTrackPrev size={16} />}
          onClick={goPrev}
          disabled={
            isPaginating ||
            pageIndex === 0 ||
            (pageIndex > 0 && cursorStack[pageIndex - 1] === undefined)
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
          onClick={goNext}
          disabled={!hasNextPage || isPaginating}
        >
          Next
        </Button>
      </Group>
    </Group>
  );

  // Loading skeletons
  const isInitialLoading = rows === null || isLoading;

  if (isInitialLoading) {
    return (
      <Paper withBorder p="md" radius="md" className="bg-white">
        {header}
        {filterPanel}
        <Group justify="center" p="lg" role="status" aria-live="polite">
          <Loader />
          <Text ml="sm">Loading activity…</Text>
        </Group>
      </Paper>
    );
  }

  if (rows.length === 0) {
    return (
      <Paper withBorder p="md" radius="md" className="bg-white">
        {header}
        {filterPanel}
        <div className="py-16 text-center">
          <Title order={5} mb="xs">
            No activity matches your filters
          </Title>
          <Text c="dimmed" mb="md">Try adjusting your filters.</Text>
          <Group justify="center">
            <Button variant="light" onClick={() => setShowFilters(true)} aria-controls="product-activity-filters" aria-expanded={showFilters}>
              Show filters
            </Button>
            <Button onClick={() => resetToFirstPageAndFetch({ keepFacets: false })}>
              Refresh
            </Button>
          </Group>
        </div>
        {paginationBar}
      </Paper>
    );
  }

  // A tiny loading overlay during pagination
  const Overlay = () =>
    isPaginating ? (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60 rounded-md">
        <Loader size="sm" />
      </div>
    ) : null;

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Timeline view
  if (mode === "timeline") {
    return (
      <>
        {header}
        {filterPanel}
        <Paper withBorder p="md" radius="md" className="bg-white relative" >
          <Overlay />
          <Timeline active={-1} bulletSize={12} lineWidth={2}>
            {rows.map((it) => {
              const whenDate = new Date(it.when);
              const whenAbs = formatDateTimeReadable(it.when);
              const whenRel = dayjs(whenDate).fromNow();
              const color = it.kind === "audit" ? "blue" : "grape";
              const pill =
                it.kind === "audit" ? (
                  <Badge size="xs" variant="light">
                    {(it as Extract<UnifiedActivityItem, { kind: "audit" }>).action}
                  </Badge>
                ) : (
                  <Badge size="xs" variant="light" color="grape">
                    {(it as Extract<UnifiedActivityItem, { kind: "ledger" }>).entryKind}
                  </Badge>
                );

              return (
                <Timeline.Item
                  key={`${it.kind}:${it.id}`}
                  color={color}
                  title={
                    <Group gap="xs" wrap="wrap">
                      <Text fw={600}>{it.message}</Text>
                      {pill}
                      {it.actor ? (
                        <Anchor
                          component={Link}
                          to={`/${tenantSlug}/users/${it.actor.userId}`}
                          size="sm"
                          title={`Open ${it.actor.display}`}
                        >
                          {it.actor.display}
                        </Anchor>
                      ) : (
                        <Text size="sm" c="dimmed">—</Text>
                      )}
                      <Tooltip label={`${whenAbs} (${timeZone})`} withArrow>
                        <Text size="sm" c="dimmed">
                          {whenAbs} · {whenRel}
                        </Text>
                      </Tooltip>
                    </Group>
                  }
                >
                  {/* 🔽 Diff lines for audit items */}
                  {it.kind === "audit" && it.messageParts && (
                    <AuditDiffLines parts={it.messageParts as Record<string, any>} />
                  )}
                </Timeline.Item>
              );
            })}
          </Timeline>
        </Paper>
        {paginationBar}
      </>
    );
  }

  // Table view
  return (
    <>
      {header}
      {filterPanel}

      {/* Per-page control (table top-right) */}
      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" align="center" gap="xs" wrap="wrap">
          {/* Left area always exists and takes horizontal space */}
          <Group
            gap="xs"
            mt={activeFilterChips.length > 0 ? "xs" : 0}
            wrap="wrap"
            // make this container occupy available space even if empty
            style={{ flex: 1 }}
          >
            {activeFilterChips.length > 0 && (
              <>
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
                  onClick={() => setFilters(emptyFilters)}
                  aria-label="Clear all filters"
                >
                  Clear all
                </Button>
              </>
            )}
          </Group>

          {/* Right area: per-page control */}
          <Group align="center" gap="xs">
            <Text size="sm" c="dimmed">
              Per page
            </Text>
            <NumberInput
              value={limit}
              onChange={(v) => {
                const n = typeof v === "number" ? v : v === "" ? 20 : Number(v);
                const clamped = Math.max(1, Math.min(100, n));
                setLimit(clamped);
                localStorage.setItem(LOCALSTORAGE_LIMIT_KEY, String(clamped));
                resetToFirstPageAndFetch({ limitOverride: clamped });
              }}
              min={1}
              max={100}
              step={1}
              clampBehavior="strict"
              w={rem(90)}
              aria-label="Results per page"
              aria-controls="product-activity-table"
            />
          </Group>
        </Group>


        <Space h="md" />

        <div className="relative max-h-[60vh] overflow-y-auto">
          <Overlay />
          <Table id="product-activity-table" striped withTableBorder withColumnBorders stickyHeader>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>When</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Summary</Table.Th>
                <Table.Th>Actor</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((it) => {
                const whenDate = new Date(it.when);
                const whenAbs = formatDateTimeReadable(it.when);
                const whenRel = dayjs(whenDate).fromNow();
                return (
                  <Table.Tr key={`${it.kind}:${it.id}`}>
                    <Table.Td data-testid="activity-when-date">
                      <Tooltip label={`${whenAbs} (${timeZone})`} withArrow>
                        <Text size="sm">
                          {whenAbs} · {whenRel}
                        </Text>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td>
                      {it.kind === "audit" ? (
                        <Badge variant="light">
                          {(it as Extract<UnifiedActivityItem, { kind: "audit" }>).action}
                        </Badge>
                      ) : (
                        <Badge variant="light" color="grape">
                          {(it as Extract<UnifiedActivityItem, { kind: "ledger" }>).entryKind}
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{it.message}</Text>

                      {it.kind === "audit" && it.messageParts && (
                        <Stack gap={4} mt={6}>
                          {"name" in it.messageParts && (it.messageParts as any).name && (
                            <Text size="xs" c="dimmed">
                              Name: <code>{(it.messageParts as any).name.before ?? "—"}</code> →{" "}
                              <code>{(it.messageParts as any).name.after ?? "—"}</code>
                            </Text>
                          )}
                          {"slug" in it.messageParts && (it.messageParts as any).slug && (
                            <Text size="xs" c="dimmed">
                              Slug: <code>{(it.messageParts as any).slug.before ?? "—"}</code> →{" "}
                              <code>{(it.messageParts as any).slug.after ?? "—"}</code>
                            </Text>
                          )}
                          {"sku" in it.messageParts && (it.messageParts as any).sku && (
                            <Text size="xs" c="dimmed">
                              SKU: <code>{(it.messageParts as any).sku.before ?? "—"}</code> →{" "}
                              <code>{(it.messageParts as any).sku.after ?? "—"}</code>
                            </Text>
                          )}
                          {"barcode" in it.messageParts && (it.messageParts as any).barcode && (
                            <Text size="xs" c="dimmed">
                              Barcode: <code>{(it.messageParts as any).barcode.before ?? "—"}</code> →{" "}
                              <code>{(it.messageParts as any).barcode.after ?? "—"}</code>
                            </Text>
                          )}
                          {"isActive" in it.messageParts && (it.messageParts as any).isActive && (
                            <Text size="xs" c="dimmed">
                              Active: <code>{String((it.messageParts as any).isActive.before)}</code> →{" "}
                              <code>{String((it.messageParts as any).isActive.after)}</code>
                            </Text>
                          )}
                          {"salePrice" in it.messageParts && (it.messageParts as any).salePrice && (
                            <Text size="xs" c="dimmed">
                              Sale price: <code>{(it.messageParts as any).salePrice.before != null ? formatPenceAsGBP((it.messageParts as any).salePrice.before) : "—"}</code> →{" "}
                              <code>{(it.messageParts as any).salePrice.after != null ? formatPenceAsGBP((it.messageParts as any).salePrice.after) : "—"}</code>
                            </Text>
                          )}
                          {"costPrice" in it.messageParts && (it.messageParts as any).costPrice && (
                            <Text size="xs" c="dimmed">
                              Cost price: <code>{(it.messageParts as any).costPrice.before != null ? formatPenceAsGBP((it.messageParts as any).costPrice.before) : "—"}</code> →{" "}
                              <code>{(it.messageParts as any).costPrice.after != null ? formatPenceAsGBP((it.messageParts as any).costPrice.after) : "—"}</code>
                            </Text>
                          )}
                          {"taxRate" in it.messageParts && (it.messageParts as any).taxRate && (
                            <Text size="xs" c="dimmed">
                              Tax rate: <code>{(it.messageParts as any).taxRate.before ?? "—"}</code> →{" "}
                              <code>{(it.messageParts as any).taxRate.after ?? "—"}</code>
                            </Text>
                          )}
                          {"unit" in it.messageParts && (it.messageParts as any).unit && (
                            <Text size="xs" c="dimmed">
                              Unit: <code>{(it.messageParts as any).unit.before ?? "—"}</code> →{" "}
                              <code>{(it.messageParts as any).unit.after ?? "—"}</code>
                            </Text>
                          )}

                          {/* Fallback: if none of the above keys were present, show changedKeys if provided */}
                          {!(
                            ("name" in it.messageParts) ||
                            ("slug" in it.messageParts) ||
                            ("sku" in it.messageParts) ||
                            ("barcode" in it.messageParts) ||
                            ("isActive" in it.messageParts) ||
                            ("salePrice" in it.messageParts) ||
                            ("costPrice" in it.messageParts) ||
                            ("taxRate" in it.messageParts) ||
                            ("unit" in it.messageParts)
                          ) && (it.messageParts as any).changedKeys && (
                            <Text size="xs" c="dimmed">
                              {(it.messageParts as any).changedKeys} field(s) changed
                            </Text>
                          )}
                        </Stack>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {it.actor ? (
                        <Anchor
                          component={Link}
                          to={`/${tenantSlug}/users/${it.actor.userId}`}
                          size="sm"
                          title={`Open ${it.actor.display}`}
                        >
                          {it.actor.display}
                        </Anchor>
                      ) : (
                        <Text size="sm" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </div>

        {paginationBar}
      </Paper>
    </>
  );
}
