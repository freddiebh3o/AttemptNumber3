// admin-web/src/pages/AuditLogPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  useParams,
  useSearchParams,
  useLocation,
  useNavigationType,
  Link,
} from "react-router-dom";
import {
  Anchor,
  Badge,
  Button,
  CloseButton,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Select,
  Table,
  Text,
  TextInput,
  Title,
  ActionIcon,
  Tooltip,
  ScrollArea,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import {
  IconChevronDown,
  IconChevronUp,
  IconFilter,
  IconLink,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
  IconRefresh,
  IconCopy,
  IconInfoCircle,
} from "@tabler/icons-react";
import { listAuditEventsApiRequest } from "../api/auditLogger";
import { handlePageError } from "../utils/pageError";
import { FilterBar } from "../components/common/FilterBar";
import { notifications } from "@mantine/notifications";
import { buildCommonDatePresets } from "../utils/datePresets";

type AuditEvent =
  NonNullable<
    NonNullable<
      import("../types/openapi").paths["/api/audit/events"]["get"]["responses"]["200"]["content"]["application/json"]
    >["data"]
  >["items"][number];

type AuditEntityType =
  import("../types/openapi").components["schemas"]["AuditEntityType"];
type AuditAction =
  import("../types/openapi").components["schemas"]["AuditAction"];

type AuditFilters = {
  entityType: string;
  action: string;
  actorUserId: string;
  entityId: string;
  occurredFrom: string | null;
  occurredTo: string | null;
};

export default function AuditLogPage() {
  const FILTER_PANEL_ID = "audit-filter-panel";
  const TABLE_ID = "audit-table";
  const RANGE_ID = "audit-range";

  const ENTITY_TYPES: AuditEntityType[] = [
    "PRODUCT",
    "BRANCH",
    "STOCK_LOT",
    "STOCK_LEDGER",
    "PRODUCT_STOCK",
    "USER",
    "ROLE",
    "TENANT",
    "TENANT_BRANDING",
  ];

  const ACTIONS: AuditAction[] = [
    "CREATE",
    "UPDATE",
    "DELETE",
    "STOCK_RECEIVE",
    "STOCK_ADJUST",
    "STOCK_CONSUME",
    "ROLE_ASSIGN",
    "ROLE_REVOKE",
    "LOGIN",
    "LOGOUT",
    "THEME_UPDATE",
    "THEME_LOGO_UPDATE",
  ];

  const isValidEntityType = (v: string | null) =>
    !!v && ENTITY_TYPES.includes(v as AuditEntityType);
  const isValidAction = (v: string | null) =>
    !!v && ACTIONS.includes(v as AuditAction);

  const entityTypeOptions = useMemo(
    () => ENTITY_TYPES.map((v) => ({ value: v, label: v.replaceAll("_", " ") })),
    []
  );
  const actionOptions = useMemo(
    () => ACTIONS.map((v) => ({ value: v, label: v.replaceAll("_", " ") })),
    []
  );

  const emptyAuditFilters: AuditFilters = {
    entityType: "",
    action: "",
    actorUserId: "",
    entityId: "",
    occurredFrom: null,
    occurredTo: null,
  };

  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigationType = useNavigationType();
  const location = useLocation();

  // Data
  const [rows, setRows] = useState<AuditEvent[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorForBoundary, setErrorForBoundary] = useState<
    (Error & { httpStatusCode?: number; correlationId?: string }) | null
  >(null);

  // Filters/controls
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState<number>(20);
  const [appliedFilters, setAppliedFilters] =
    useState<AuditFilters>(emptyAuditFilters);

  // Cursor pagination
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [isPaginating, setIsPaginating] = useState(false);

  // Totals
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Details modal state
  const [detailsFor, setDetailsFor] = useState<AuditEvent | null>(null);

  // --- helpers for truncation/links ---
  const truncateId = (id: string, n = 8) => (id.length > n ? `${id.slice(0, n)}…` : id);

  const actorLink = (userId: string | null | undefined) =>
    userId ? `/${tenantSlug}/users/${encodeURIComponent(userId)}` : null;

  const entityLink = (ev: AuditEvent) => {
    switch (ev.entityType) {
      case "PRODUCT":
        return `/${tenantSlug}/products/${encodeURIComponent(ev.entityId)}`;
      case "USER":
        return `/${tenantSlug}/users/${encodeURIComponent(ev.entityId)}`;
      // Extend as you add detail pages:
      // case "BRANCH": return `/${tenantSlug}/branches/${ev.entityId}`;
      // case "ROLE":   return `/${tenantSlug}/roles/${ev.entityId}`;
      default:
        return null;
    }
  };

  function setUrlFromState(overrides?: {
    cursorId?: string | null;
    limit?: number;
    page?: number;
    entityType?: string | null | undefined;
    action?: string | null | undefined;
    actorUserId?: string | null | undefined;
    entityId?: string | null | undefined;
    occurredFrom?: string | null | undefined;
    occurredTo?: string | null | undefined;
  }) {
    const params = new URLSearchParams();

    const put = (k: string, v: unknown) => {
      if (v === undefined || v === null || v === "") return;
      params.set(k, String(v));
    };

    // Only persist valid enum values
    const currEntityType =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "entityType")
        ? overrides.entityType
        : appliedFilters.entityType || null;
    const entityTypeVal = isValidEntityType(currEntityType ?? null) ? currEntityType : null;

    const currAction =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "action")
        ? overrides.action
        : appliedFilters.action || null;
    const actionVal = isValidAction(currAction ?? null) ? currAction : null;

    const actorVal =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "actorUserId")
        ? overrides.actorUserId
        : appliedFilters.actorUserId || null;

    const entityIdVal =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "entityId")
        ? overrides.entityId
        : appliedFilters.entityId || null;

    const occFromVal =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "occurredFrom")
        ? overrides.occurredFrom
        : appliedFilters.occurredFrom;

    const occToVal =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "occurredTo")
        ? overrides.occurredTo
        : appliedFilters.occurredTo;

    put("limit", overrides?.limit ?? limit);
    put("entityType", entityTypeVal);
    put("action", actionVal);
    put("actorUserId", actorVal);
    put("entityId", entityIdVal);
    put("occurredFrom", occFromVal);
    put("occurredTo", occToVal);

    const cursor =
      overrides?.cursorId === undefined
        ? cursorStack[pageIndex] ?? null
        : overrides.cursorId;
    if (cursor) params.set("cursorId", cursor);

    const pageToWrite = overrides?.page ?? pageIndex + 1;
    put("page", pageToWrite);

    setSearchParams(params, { replace: false });
  }

  function applyAndFetch(values: AuditFilters) {
    const safe: AuditFilters = {
      ...values,
      entityType: isValidEntityType(values.entityType) ? values.entityType : "",
      action: isValidAction(values.action) ? values.action : "",
    };

    setAppliedFilters(safe);
    setUrlFromState({
      cursorId: null,
      entityType: safe.entityType.trim() || null,
      action: safe.action.trim() || null,
      actorUserId: safe.actorUserId.trim() || null,
      entityId: safe.entityId.trim() || null,
      occurredFrom: safe.occurredFrom ?? null,
      occurredTo: safe.occurredTo ?? null,
    });
    resetToFirstPageAndFetch({
      entityTypeOverride: safe.entityType.trim() || null,
      actionOverride: safe.action.trim() || null,
      actorUserIdOverride: safe.actorUserId.trim() || null,
      entityIdOverride: safe.entityId.trim() || null,
      occurredFromOverride: safe.occurredFrom ?? null,
      occurredToOverride: safe.occurredTo ?? null,
    });
  }

  function clearAllFiltersAndFetch() {
    applyAndFetch(emptyAuditFilters);
  }

  async function fetchPageWith(opts?: {
    includeTotal?: boolean;
    cursorId?: string | null;
    limitOverride?: number;
    entityTypeOverride?: string | null | undefined;
    actionOverride?: string | null | undefined;
    actorUserIdOverride?: string | null | undefined;
    entityIdOverride?: string | null | undefined;
    occurredFromOverride?: string | null | undefined;
    occurredToOverride?: string | null | undefined;
  }) {
    setIsLoading(true);
    try {
      const entityTypeParam =
        opts?.entityTypeOverride === undefined
          ? isValidEntityType(appliedFilters.entityType)
            ? appliedFilters.entityType
            : undefined
          : isValidEntityType(opts.entityTypeOverride ?? null)
          ? opts.entityTypeOverride
          : undefined;

      const actionParam =
        opts?.actionOverride === undefined
          ? isValidAction(appliedFilters.action)
            ? appliedFilters.action
            : undefined
          : isValidAction(opts.actionOverride ?? null)
          ? opts.actionOverride
          : undefined;

      const response = await listAuditEventsApiRequest({
        limit: opts?.limitOverride ?? limit,
        cursorId: opts?.cursorId ?? cursorStack[pageIndex] ?? undefined,
        entityType: entityTypeParam ?? undefined,
        action: actionParam ?? undefined,
        actorUserId:
          opts?.actorUserIdOverride === undefined
            ? appliedFilters.actorUserId || undefined
            : opts.actorUserIdOverride || undefined,
        entityId:
          opts?.entityIdOverride === undefined
            ? appliedFilters.entityId || undefined
            : opts.entityIdOverride || undefined,
        occurredFrom:
          opts?.occurredFromOverride === undefined
            ? appliedFilters.occurredFrom || undefined
            : opts.occurredFromOverride || undefined,
        occurredTo:
          opts?.occurredToOverride === undefined
            ? appliedFilters.occurredTo || undefined
            : opts.occurredToOverride || undefined,
        includeTotal: opts?.includeTotal === true,
      });

      if (response.success) {
        const data = response.data;
        const items = data.items ?? [];
        const effectiveLimit = opts?.limitOverride ?? limit;

        setRows(items);

        const serverHasNext = Boolean(data.pageInfo.hasNextPage);
        const serverNextCursor = data.pageInfo.nextCursor ?? null;

        const clientHasNext =
          serverHasNext && items.length === effectiveLimit && !!serverNextCursor;

        setHasNextPage(clientHasNext);
        setNextCursor(clientHasNext ? serverNextCursor : null);

        if (opts?.includeTotal && typeof data.pageInfo.totalCount === "number") {
          setTotalCount(data.pageInfo.totalCount);
        }
      } else {
        const e = Object.assign(new Error("Failed to load audit events"), {
          httpStatusCode: 500,
        });
        setErrorForBoundary(e);
      }
    } catch (err: any) {
      setErrorForBoundary(handlePageError(err, { title: "Error" }));
    } finally {
      setIsLoading(false);
    }
  }

  function resetToFirstPageAndFetch(opts?: {
    limitOverride?: number;
    entityTypeOverride?: string | null | undefined;
    actionOverride?: string | null | undefined;
    actorUserIdOverride?: string | null | undefined;
    entityIdOverride?: string | null | undefined;
    occurredFromOverride?: string | null | undefined;
    occurredToOverride?: string | null | undefined;
  }) {
    setCursorStack([null]);
    setPageIndex(0);
    setUrlFromState({
      cursorId: null,
      page: 1,
      limit: opts?.limitOverride,
      entityType: opts?.entityTypeOverride,
      action: opts?.actionOverride,
      actorUserId: opts?.actorUserIdOverride,
      entityId: opts?.entityIdOverride,
      occurredFrom: opts?.occurredFromOverride,
      occurredTo: opts?.occurredToOverride,
    });
    void fetchPageWith({
      includeTotal: true,
      cursorId: null,
      ...opts,
    });
  }

  // Initial load / tenant change
  useEffect(() => {
    setRows(null);
    setHasNextPage(false);
    setNextCursor(null);
    setTotalCount(null);
    setErrorForBoundary(null);

    const qpPage = Number(searchParams.get("page") ?? "1");
    const initialPageIndex = Number.isFinite(qpPage) && qpPage > 0 ? qpPage - 1 : 0;

    const qpLimit = Number(searchParams.get("limit"));
    const qpEntityTypeRaw = searchParams.get("entityType");
    const qpActionRaw = searchParams.get("action");
    const qpActorUserId = searchParams.get("actorUserId");
    const qpEntityId = searchParams.get("entityId");
    const qpOccurredFrom = searchParams.get("occurredFrom");
    const qpOccurredTo = searchParams.get("occurredTo");
    const qpCursor = searchParams.get("cursorId");

    if (!Number.isNaN(qpLimit) && qpLimit) {
      setLimit(Math.max(1, Math.min(100, qpLimit)));
    }

    const qpEntityType = isValidEntityType(qpEntityTypeRaw) ? qpEntityTypeRaw! : "";
    const qpAction = isValidAction(qpActionRaw) ? qpActionRaw! : "";

    setAppliedFilters({
      entityType: qpEntityType,
      action: qpAction,
      actorUserId: qpActorUserId ?? "",
      entityId: qpEntityId ?? "",
      occurredFrom: qpOccurredFrom ?? null,
      occurredTo: qpOccurredTo ?? null,
    });

    setCursorStack([qpCursor ?? null]);
    setPageIndex(initialPageIndex);

    void fetchPageWith({
      includeTotal: true,
      cursorId: qpCursor ?? null,
      limitOverride:
        !Number.isNaN(qpLimit) && qpLimit ? Math.max(1, Math.min(100, qpLimit)) : undefined,
      entityTypeOverride: qpEntityType || undefined,
      actionOverride: qpAction || undefined,
      actorUserIdOverride: qpActorUserId ?? undefined,
      entityIdOverride: qpEntityId ?? undefined,
      occurredFromOverride: qpOccurredFrom ?? undefined,
      occurredToOverride: qpOccurredTo ?? undefined,
    });
  }, [tenantSlug]);

  // Browser back/forward sync
  useEffect(() => {
    if (navigationType !== "POP") return;
    const sp = new URLSearchParams(location.search);

    const qpLimit = Number(sp.get("limit"));
    const qpEntityTypeRaw = sp.get("entityType");
    const qpActionRaw = sp.get("action");
    const qpActorUserId = sp.get("actorUserId");
    const qpEntityId = sp.get("entityId");
    const qpOccurredFrom = sp.get("occurredFrom");
    const qpOccurredTo = sp.get("occurredTo");
    const qpCursor = sp.get("cursorId");
    const qpPage = Number(sp.get("page") ?? "1");
    const newPageIndex = Number.isFinite(qpPage) && qpPage > 0 ? qpPage - 1 : 0;

    if (!Number.isNaN(qpLimit) && qpLimit) {
      setLimit(Math.max(1, Math.min(100, qpLimit)));
    }

    const qpEntityType = isValidEntityType(qpEntityTypeRaw) ? qpEntityTypeRaw! : "";
    const qpAction = isValidAction(qpActionRaw) ? qpActionRaw! : "";

    setAppliedFilters({
      entityType: qpEntityType,
      action: qpAction,
      actorUserId: qpActorUserId ?? "",
      entityId: qpEntityId ?? "",
      occurredFrom: qpOccurredFrom ?? null,
      occurredTo: qpOccurredTo ?? null,
    });

    setCursorStack([qpCursor ?? null]);
    setPageIndex(newPageIndex);

    void fetchPageWith({
      includeTotal: true,
      cursorId: qpCursor ?? null,
      limitOverride:
        !Number.isNaN(qpLimit) && qpLimit ? Math.max(1, Math.min(100, qpLimit)) : undefined,
      entityTypeOverride: qpEntityType || undefined,
      actionOverride: qpAction || undefined,
      actorUserIdOverride: qpActorUserId ?? undefined,
      entityIdOverride: qpEntityId ?? undefined,
      occurredFromOverride: qpOccurredFrom ?? undefined,
      occurredToOverride: qpOccurredTo ?? undefined,
    });
  }, [location.key, navigationType, tenantSlug]);

  if (errorForBoundary) throw errorForBoundary;

  // Pagination helpers
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

  // Range text
  const shownCount = rows?.length ?? 0;
  const rangeStart = shownCount ? pageIndex * limit + 1 : 0;
  const rangeEnd = shownCount ? rangeStart + shownCount - 1 : 0;
  const rangeText =
    shownCount === 0
      ? "No results"
      : `Showing ${rangeStart}–${rangeEnd}${totalCount != null ? ` of ${totalCount}` : ""}`;

  // Active filter chips
  const activeFilterChips = useMemo(() => {
    const chips: { key: keyof AuditFilters; label: string }[] = [];
    if (appliedFilters.entityType.trim())
      chips.push({ key: "entityType", label: `entity: ${appliedFilters.entityType.trim()}` });
    if (appliedFilters.action.trim())
      chips.push({ key: "action", label: `action: ${appliedFilters.action.trim()}` });
    if (appliedFilters.actorUserId.trim())
      chips.push({ key: "actorUserId", label: `actor: ${appliedFilters.actorUserId.trim()}` });
    if (appliedFilters.entityId.trim())
      chips.push({ key: "entityId", label: `entityId: ${appliedFilters.entityId.trim()}` });
    if (appliedFilters.occurredFrom)
      chips.push({ key: "occurredFrom", label: `from: ${appliedFilters.occurredFrom}` });
    if (appliedFilters.occurredTo)
      chips.push({ key: "occurredTo", label: `to: ${appliedFilters.occurredTo}` });
    return chips;
  }, [appliedFilters]);

  function clearOneChip(key: keyof AuditFilters) {
    const next: AuditFilters = {
      ...appliedFilters,
      entityType: key === "entityType" ? "" : appliedFilters.entityType,
      action: key === "action" ? "" : appliedFilters.action,
      actorUserId: key === "actorUserId" ? "" : appliedFilters.actorUserId,
      entityId: key === "entityId" ? "" : appliedFilters.entityId,
      occurredFrom: key === "occurredFrom" ? null : appliedFilters.occurredFrom,
      occurredTo: key === "occurredTo" ? null : appliedFilters.occurredTo,
    };
    applyAndFetch(next);
  }

  async function copy(text: string, label = "Copied") {
    try {
      await navigator.clipboard.writeText(text);
      notifications.show({ color: "green", message: label });
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      notifications.show({ color: "green", message: label });
    }
  }

  async function copyShareableLink() {
    await copy(window.location.href, "Shareable link copied");
  }

  // Render
  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start w-full">
        <Group justify="space-between" align="start" className="w-full">
          <div>
            <Title order={3}>Audit Log</Title>
            <Text size="sm" c="dimmed">
              {rangeText}
            </Text>
          </div>

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
              rightSection={showFilters ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
              aria-expanded={showFilters}
              aria-controls={FILTER_PANEL_ID}
            >
              Filters
            </Button>

            <Button
              leftSection={<IconRefresh size={16} />}
              title="Refresh"
              onClick={() => resetToFirstPageAndFetch()}
              variant="light"
            >
              Refresh
            </Button>
          </Group>
        </Group>
      </div>

      {/* Filters */}
      <FilterBar<AuditFilters>
        open={showFilters}
        panelId={FILTER_PANEL_ID}
        initialValues={appliedFilters}
        emptyValues={emptyAuditFilters}
        onApply={applyAndFetch}
        onClear={clearAllFiltersAndFetch}
      >
        {({ values, setValues }) => (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Select
              label="Entity type"
              placeholder="Select entity type"
              data={entityTypeOptions}
              searchable
              clearable
              value={values.entityType || null}
              onChange={(val) =>
                setValues((prev) => ({ ...prev, entityType: val ?? "" }))
              }
            />

            <Select
              label="Action"
              placeholder="Select action"
              data={actionOptions}
              searchable
              clearable
              value={values.action || null}
              onChange={(val) =>
                setValues((prev) => ({ ...prev, action: val ?? "" }))
              }
            />

            <TextInput
              label="Actor user id"
              placeholder="UUID"
              value={values.actorUserId}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, actorUserId: e.currentTarget.value }))
              }
            />

            <TextInput
              label="Entity id"
              placeholder="Entity UUID"
              value={values.entityId}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, entityId: e.currentTarget.value }))
              }
            />

            <DatePickerInput
              label="Occurred from"
              placeholder="Start date"
              value={values.occurredFrom}
              onChange={(v) => setValues((prev) => ({ ...prev, occurredFrom: v }))}
              valueFormat="YYYY-MM-DD"
              popoverProps={{ withinPortal: true }}
              presets={buildCommonDatePresets()}
              clearable
            />
            <DatePickerInput
              label="Occurred to"
              placeholder="End date"
              value={values.occurredTo}
              onChange={(v) => setValues((prev) => ({ ...prev, occurredTo: v }))}
              valueFormat="YYYY-MM-DD"
              popoverProps={{ withinPortal: true }}
              presets={buildCommonDatePresets()}
              clearable
            />
          </div>
        )}
      </FilterBar>

      {/* Table */}
      <div className="py-4">
        <Paper withBorder p="md" radius="md" className="bg-white max-h-[80vh] overflow-y-auto">
          <Group justify="space-between" mb="md">
            <Title order={4}>All Events</Title>

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
                  resetToFirstPageAndFetch({ limitOverride: clamped });
                }}
                min={1}
                max={100}
                step={1}
                clampBehavior="strict"
                w={90}
              />
            </Group>
          </Group>

          {rows === null || isLoading ? (
            <div className="flex items-center justify-center p-8" role="status" aria-live="polite">
              <Loader />
              <Text ml="sm">Loading events…</Text>
            </div>
          ) : (
            <>
              <div className="max-h-[65vh] overflow-y-auto" aria-busy={isLoading}>
                {/* Active filter chips */}
                {activeFilterChips.length > 0 && (
                  <Group gap="xs" mb="sm" wrap="wrap" role="region" aria-label="Active filters">
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

                {(rows?.length ?? 0) === 0 ? (
                  <div className="py-16 text-center" role="region" aria-live="polite" aria-atomic="true">
                    <Title order={4} mb="xs">
                      No audit events match your filters
                    </Title>
                    <Text c="dimmed" mb="md">
                      Try adjusting your filters or clear them to see all events.
                    </Text>
                    <Group justify="center">
                      <Button onClick={clearAllFiltersAndFetch}>Clear all filters</Button>
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
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th scope="col">Occurred</Table.Th>
                        <Table.Th scope="col">Actor</Table.Th>
                        <Table.Th scope="col" className="w-[240px]">Entity</Table.Th>
                        <Table.Th scope="col">Action</Table.Th>
                        <Table.Th scope="col">Diff</Table.Th>
                        <Table.Th scope="col">Correlation</Table.Th>
                        <Table.Th scope="col">IP</Table.Th>
                        <Table.Th scope="col" className="w-40">
                          User-Agent
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {rows.map((ev) => {
                        const occurredAt = new Date(ev.createdAt).toLocaleString();
                        const entityLabelBase = `${ev.entityType}${ev.entityName ? ` · ${ev.entityName}` : ""}`;
                        const hasDiff =
                          !!ev.diffJson &&
                          typeof ev.diffJson === "object" &&
                          Object.keys(ev.diffJson as any).length > 0;

                        const actorId = ev.actorUserId ?? null;
                        const actorHref = actorLink(actorId);

                        const entityHref = entityLink(ev);
                        const truncatedEntityId = truncateId(ev.entityId);

                        return (
                          <Table.Tr key={ev.id}>
                            <Table.Td>
                              <Text size="sm">{occurredAt}</Text>
                            </Table.Td>

                            {/* Actor (truncate + underline/blue link if available) */}
                            <Table.Td>
                              {actorId ? (
                                <Tooltip label={actorId} withArrow>
                                  <Text size="sm">
                                    <Anchor
                                      component={Link}
                                      to={actorHref!}
                                      underline="always"
                                      c="blue"
                                      title={actorId}
                                    >
                                      {truncateId(actorId)}
                                    </Anchor>
                                  </Text>
                                </Tooltip>
                              ) : (
                                <Text size="sm">—</Text>
                              )}
                            </Table.Td>

                            {/* Entity (truncate id + underline/blue link if we have one) */}
                            <Table.Td>
                              <Text size="sm" title={`${entityLabelBase} (${ev.entityId})`}>
                                {entityHref ? (
                                  <Anchor
                                    component={Link}
                                    to={entityHref}
                                    underline="always"
                                    c="blue"
                                    title={ev.entityId}
                                  >
                                    {entityLabelBase} ({truncatedEntityId})
                                  </Anchor>
                                ) : (
                                  <>
                                    {entityLabelBase} ({truncatedEntityId})
                                  </>
                                )}
                              </Text>
                            </Table.Td>

                            <Table.Td>
                              <Badge variant="light">{ev.action}</Badge>
                            </Table.Td>

                            <Table.Td>
                              {hasDiff ? (
                                <Button
                                  size="xs"
                                  variant="light"
                                  leftSection={<IconInfoCircle size={14} />}
                                  onClick={() => setDetailsFor(ev)}
                                >
                                  changed
                                </Button>
                              ) : (
                                <Text size="sm">—</Text>
                              )}
                            </Table.Td>

                            {/* Correlation (truncate + ellipsis + copy) */}
                            <Table.Td>
                              <Group gap={6} wrap="nowrap">
                                <Text size="sm" title={ev.correlationId ?? ""}>
                                  {ev.correlationId ? `${ev.correlationId.slice(0, 8)}…` : "—"}
                                </Text>
                                {ev.correlationId && (
                                  <Tooltip label="Copy correlation id" withArrow>
                                    <ActionIcon
                                      variant="subtle"
                                      size="sm"
                                      onClick={() => copy(ev.correlationId!, "Correlation id copied")}
                                      aria-label="Copy correlation id"
                                    >
                                      <IconCopy size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                )}
                              </Group>
                            </Table.Td>

                            <Table.Td>
                              <Text size="sm">{ev.ip ?? "—"}</Text>
                            </Table.Td>

                            <Table.Td>
                              <Text size="sm" lineClamp={1} title={ev.userAgent ?? ""}>
                                {ev.userAgent ?? "—"}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                )}
              </div>

              {/* Pagination */}
              <Group justify="space-between" mt="md">
                <Text id={RANGE_ID} size="sm" c="dimmed" aria-live="polite" aria-atomic="true">
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
                    onClick={goNextPage}
                    disabled={!hasNextPage || isPaginating}
                  >
                    Next
                  </Button>
                </Group>
              </Group>
            </>
          )}
        </Paper>
      </div>

      {/* Details modal */}
      <Modal
        opened={!!detailsFor}
        onClose={() => setDetailsFor(null)}
        title="Audit event details"
        size="lg"
        withinPortal
        scrollAreaComponent={ScrollArea.Autosize}
      >
        {detailsFor && (
          <div className="space-y-3">
            <Group gap="xs" wrap="nowrap">
              <Text fw={600}>Event ID:</Text>
              <Text size="sm">{detailsFor.id}</Text>
              <Tooltip label="Copy event id" withArrow>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => copy(detailsFor.id, "Event id copied")}
                >
                  <IconCopy size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <Text fw={600}>Diff</Text>
            <pre className="bg-gray-50 p-2 rounded-md max-h-56 overflow-auto">
{JSON.stringify(detailsFor.diffJson ?? null, null, 2)}
            </pre>

            <Text fw={600}>Before</Text>
            <pre className="bg-gray-50 p-2 rounded-md max-h-56 overflow-auto">
{JSON.stringify(detailsFor.beforeJson ?? null, null, 2)}
            </pre>

            <Text fw={600}>After</Text>
            <pre className="bg-gray-50 p-2 rounded-md max-h-56 overflow-auto">
{JSON.stringify(detailsFor.afterJson ?? null, null, 2)}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
}
