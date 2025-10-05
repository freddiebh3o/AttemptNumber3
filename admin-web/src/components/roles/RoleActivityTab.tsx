// admin-web/src/components/roles/RoleActivityTab.tsx
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
  Anchor,
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
import { FilterBar } from "../common/FilterBar";
import { useLocation, useNavigationType, useSearchParams, Link, useParams } from "react-router-dom";
import { buildCommonDatePresets } from "../../utils/datePresets";
import { getRoleActivityApiRequest } from "../../api/roles";

dayjs.extend(relativeTime);

type ViewMode = "table" | "timeline";

type RoleActivityItem = {
  kind: "audit";
  id: string;
  when: string;
  action: string;
  message: string;
  messageParts?: Record<string, unknown>;
  actor?: { userId: string; display: string } | null;
  correlationId?: string | null;
  entityName?: string | null;
};

type Filters = {
  actorIds: string[];
  occurredFrom: string | null; // YYYY-MM-DD
  occurredTo: string | null;   // YYYY-MM-DD
};

const emptyFilters: Filters = {
  actorIds: [],
  occurredFrom: null,
  occurredTo: null,
};

const LOCALSTORAGE_LIMIT_KEY = "role-activity:perPage";

const OWN_KEYS = [
  "mode",
  "limit",
  "page",
  "cursor",
  "actorIds",
  "occurredFrom",
  "occurredTo",
  "filtersOpen",
] as const;

export function RoleActivityTab({ roleId }: { roleId: string }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navType = useNavigationType();

  const [mode, setMode] = useState<ViewMode>("table");
  const [isLoading, setIsLoading] = useState(false);
  const [isPaginating, setIsPaginating] = useState(false);
  const [rows, setRows] = useState<RoleActivityItem[] | null>(null);
  const [errorForBoundary, setErrorForBoundary] = useState<
    (Error & { httpStatusCode?: number; correlationId?: string }) | null
  >(null);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [actorOptions, setActorOptions] = useState<{ value: string; label: string }[]>([]);

  const facetCache = useRef<Map<string, { actors: { value: string; label: string }[] }>>(new Map());

  const [limit, setLimit] = useState<number>(() => {
    const fromLS = Number(localStorage.getItem(LOCALSTORAGE_LIMIT_KEY) || "");
    return Number.isFinite(fromLS) && fromLS > 0 ? Math.max(1, Math.min(100, fromLS)) : 20;
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const shownCount = rows?.length ?? 0;
  const rangeStart = shownCount ? pageIndex * limit + 1 : 0;
  const rangeEnd = shownCount ? rangeStart + shownCount - 1 : 0;
  const approx = totalCount == null ? "≈ " : "";
  const totalPages = totalCount != null ? Math.max(1, Math.ceil(totalCount / limit)) : null;
  const rangeText =
    shownCount === 0
      ? "No results"
      : `${approx}Showing ${rangeStart}–${rangeEnd}${totalCount != null ? ` of ${totalCount}` : ""}`;

  function writeUrlState(overrides?: {
    page?: number;
    cursor?: string | null;
    limit?: number;
    mode?: ViewMode;
    filtersOpen?: boolean;
    actorIds?: string[];
    occurredFrom?: string | null;
    occurredTo?: string | null;
  }) {
    const sp = new URLSearchParams(searchParams);
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

    const fActorIds = overrides?.actorIds ?? filters.actorIds;
    const fFrom =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "occurredFrom")
        ? overrides.occurredFrom
        : filters.occurredFrom;
    const fTo =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "occurredTo")
        ? overrides.occurredTo
        : filters.occurredTo;

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
      actorIds: qpActorIds,
      occurredFrom: qpFrom || null,
      occurredTo: qpTo || null,
    });

    localStorage.setItem(LOCALSTORAGE_LIMIT_KEY, String(effectiveLimit));
    return { cursor: qpCursor ?? null, includeTotal: true };
  }

  async function fetchPage(opts?: {
    cursor?: string | null;
    keepFacets?: boolean;
    limitOverride?: number;
    includeTotal?: boolean;
  }) {
    const fetchingJustPagination = opts?.keepFacets === true && !opts?.includeTotal;
    !fetchingJustPagination && setIsLoading(true);
    fetchingJustPagination && setIsPaginating(true);

    try {
      const effectiveLimit = opts?.limitOverride ?? limit;
      const cursorSpread = typeof opts?.cursor === "string" ? { cursor: opts.cursor } : {};

      const res = await getRoleActivityApiRequest({
        roleId,
        limit: effectiveLimit,
        ...cursorSpread,
        ...(filters.actorIds.length ? { actorIds: filters.actorIds } : {}),
        ...(filters.occurredFrom
          ? { occurredFrom: dayjs(filters.occurredFrom).toISOString() }
          : {}),
        ...(filters.occurredTo
          ? { occurredTo: dayjs(filters.occurredTo).toISOString() }
          : {}),
        includeFacets: !opts?.keepFacets,
        includeTotal: opts?.includeTotal === true,
      });

      if (!res.success) throw new Error("Failed to load activity");
      const data = res.data;

      const items = (data.items ?? []) as RoleActivityItem[];
      setRows(items);

      const serverHasNext = Boolean(data.pageInfo?.hasNextPage);
      const serverNextCursor = data.pageInfo?.nextCursor ?? null;
      setHasNextPage(serverHasNext && !!serverNextCursor);
      setNextCursor(serverHasNext && serverNextCursor ? serverNextCursor : null);

      if (typeof data.pageInfo?.totalCount === "number") {
        setTotalCount(data.pageInfo.totalCount);
      } else if (opts?.includeTotal) {
        setTotalCount(null);
      }

      if (!opts?.keepFacets) {
        const fromServer = (data as any).facets?.actors as Array<{ userId: string; display: string }> | undefined;
        if (fromServer) {
          const mapped = fromServer.map((a) => ({ value: a.userId, label: a.display }));
          facetCache.current.set(roleId, { actors: mapped });
          setActorOptions(mapped);
        } else {
          const cached = facetCache.current.get(roleId)?.actors;
          if (cached) setActorOptions(cached);
        }
      }
    } catch (e) {
      setErrorForBoundary(handlePageError(e, { title: "Failed to load activity" }));
    } finally {
      fetchingJustPagination ? setIsPaginating(false) : setIsLoading(false);
    }
  }

  function resetToFirstPageAndFetch(opts?: { keepFacets?: boolean; limitOverride?: number }) {
    setCursorStack([null]);
    setPageIndex(0);

    writeUrlState({
      page: 1,
      cursor: null,
      limit: opts?.limitOverride ?? limit,
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

  // initial
  useEffect(() => {
    setRows(null);
    setErrorForBoundary(null);
    setCursorStack([null]);
    setPageIndex(0);
    setHasNextPage(false);
    setNextCursor(null);
    setTotalCount(null);

    const { cursor, includeTotal } = parseUrlOnMount();
    const cached = facetCache.current.get(roleId)?.actors;
    if (cached) setActorOptions(cached);
    void fetchPage({ cursor, includeTotal });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId]);

  // browser back/forward
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

  // re-fetch when applied filters change
  useEffect(() => {
    if (rows === null) return;
    writeUrlState({
      page: 1,
      cursor: null,
      actorIds: filters.actorIds,
      occurredFrom: filters.occurredFrom,
      occurredTo: filters.occurredTo,
    });
    resetToFirstPageAndFetch({ keepFacets: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters.actorIds), filters.occurredFrom, filters.occurredTo]);

  if (errorForBoundary) throw errorForBoundary;

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

  const activeFilterChips = useMemo(() => {
    const chips: { key: keyof Filters | "actorIds"; label: string }[] = [];
    if (filters.actorIds.length) chips.push({ key: "actorIds", label: `actors: ${filters.actorIds.length}` });
    if (filters.occurredFrom) chips.push({ key: "occurredFrom", label: `from: ${filters.occurredFrom}` });
    if (filters.occurredTo) chips.push({ key: "occurredTo", label: `to: ${filters.occurredTo}` });
    return chips;
  }, [filters]);

  function clearOneChip(key: keyof Filters | "actorIds") {
    const next: Filters = {
      ...filters,
      actorIds: key === "actorIds" ? [] : filters.actorIds,
      occurredFrom: key === "occurredFrom" ? null : filters.occurredFrom,
      occurredTo: key === "occurredTo" ? null : filters.occurredTo,
    };
    setFilters(next);
  }

  const header = (
    <Group justify="space-between" align="start">
      <Stack gap="1">
        <Title order={4}>Activity</Title>
        <Text size="sm" c="dimmed" aria-live="polite" aria-atomic="true">
          {rangeText} · Role changes
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
          aria-controls="role-activity-filters"
        >
          Filters
        </Button>
        <Button
          leftSection={<IconRefresh size={16} />}
          variant="light"
          onClick={() => resetToFirstPageAndFetch({ keepFacets: false })}
          title="Refresh (also refreshes facets & totals)"
        >
          Refresh
        </Button>
      </Group>
    </Group>
  );

  const filterPanel = (
    <>
      <FilterBar<Filters>
        open={showFilters}
        panelId="role-activity-filters"
        initialValues={filters}
        emptyValues={emptyFilters}
        onApply={(vals) => setFilters(vals)}
        onClear={() => setFilters(emptyFilters)}
      >
        {({ values, setValues }) => (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              valueFormat="YYYY-MM-DD"
              clearable
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
              valueFormat="YYYY-MM-DD"
              clearable
            />
          </div>
        )}
      </FilterBar>
      <Space h="md" />
    </>
  );

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
          disabled={isPaginating || pageIndex === 0 || (pageIndex > 0 && cursorStack[pageIndex - 1] === undefined)}
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

  const isInitialLoading = rows === null || isLoading;
  const Overlay = () =>
    isPaginating ? (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60 rounded-md">
        <Loader size="sm" />
      </div>
    ) : null;

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
          <Title order={5} mb="xs">No activity matches your filters</Title>
          <Text c="dimmed" mb="md">Try adjusting your filters.</Text>
          <Group justify="center">
            <Button variant="light" onClick={() => setShowFilters(true)} aria-controls="role-activity-filters" aria-expanded={showFilters}>
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

  if (mode === "timeline") {
    return (
      <>
        {header}
        {filterPanel}
        <Paper withBorder p="md" radius="md" className="bg-white relative">
          <Overlay />
          <Timeline active={-1} bulletSize={12} lineWidth={2}>
            {rows.map((it) => {
              const whenDate = new Date(it.when);
              const whenAbs = whenDate.toLocaleString();
              const whenRel = dayjs(whenDate).fromNow();
              return (
                <Timeline.Item
                  key={`audit:${it.id}`}
                  color="blue"
                  title={
                    <Group gap="xs" wrap="wrap">
                      <Text fw={600}>{it.message}</Text>
                      <Badge size="xs" variant="light">{it.action}</Badge>
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
                />
              );
            })}
          </Timeline>
        </Paper>
        {paginationBar}
      </>
    );
  }

  // table
  return (
    <>
      {header}
      {filterPanel}

      <Paper withBorder p="md" radius="md" className="bg-white max-h-[70vh] overflow-y-auto">
        <Group justify="space-between" align="center" gap="xs" wrap="wrap">
          <Group gap="xs" mt={activeFilterChips.length > 0 ? "xs" : 0} wrap="wrap" style={{ flex: 1 }}>
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

          <Group align="center" gap="xs">
            <Text size="sm" c="dimmed">Per page</Text>
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
              aria-controls="role-activity-table"
            />
          </Group>
        </Group>

        <Space h="md" />

        <div className="relative">
          <Overlay />
          <Table id="role-activity-table" striped withTableBorder withColumnBorders stickyHeader>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>When</Table.Th>
                <Table.Th>Action</Table.Th>
                <Table.Th>Summary</Table.Th>
                <Table.Th>Actor</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((it) => {
                const whenDate = new Date(it.when);
                const whenAbs = whenDate.toLocaleString();
                const whenRel = dayjs(whenDate).fromNow();
                return (
                  <Table.Tr key={`audit:${it.id}`}>
                    <Table.Td>
                      <Tooltip label={`${whenAbs} (${timeZone})`} withArrow>
                        <Text size="sm">
                          {whenAbs} · {whenRel}
                        </Text>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light">{it.action}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{it.message}</Text>
                      {it.messageParts && (
                        <Stack gap={4} mt={6}>
                          {/* rename */}
                          {"name" in it.messageParts && (it.messageParts as any).name && (
                            <Text size="xs" c="dimmed">
                              Name: <code>{(it.messageParts as any).name.before ?? "—"}</code> →{" "}
                              <code>{(it.messageParts as any).name.after ?? "—"}</code>
                            </Text>
                          )}

                          {/* description */}
                          {"description" in it.messageParts && (it.messageParts as any).description && (
                            <Text size="xs" c="dimmed">
                              Description: <code>{(it.messageParts as any).description.before ?? "—"}</code> →{" "}
                              <code>{(it.messageParts as any).description.after ?? "—"}</code>
                            </Text>
                          )}

                          {/* permissions */}
                          {"permissions" in it.messageParts && (it.messageParts as any).permissions && (
                            <Group gap={6} align="center" wrap="wrap">
                              {((it.messageParts as any).permissions.added as string[] | undefined)?.slice(0, 5).map((k) => (
                                <Badge key={`add:${it.id}:${k}`} color="green" variant="light" title="Added">
                                  + {k}
                                </Badge>
                              ))}
                              {((it.messageParts as any).permissions.removed as string[] | undefined)?.slice(0, 5).map((k) => (
                                <Badge key={`rem:${it.id}:${k}`} color="red" variant="light" title="Removed">
                                  − {k}
                                </Badge>
                              ))}

                              {/* indicate truncation if there were many */}
                              {((it.messageParts as any).permissions.preview?.truncatedAdded ?? 0) > 0 && (
                                <Badge variant="outline" title="More added permissions not shown">
                                  +{(it.messageParts as any).permissions.preview.truncatedAdded} more
                                </Badge>
                              )}
                              {((it.messageParts as any).permissions.preview?.truncatedRemoved ?? 0) > 0 && (
                                <Badge variant="outline" title="More removed permissions not shown">
                                  −{(it.messageParts as any).permissions.preview.truncatedRemoved} more
                                </Badge>
                              )}
                            </Group>
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
