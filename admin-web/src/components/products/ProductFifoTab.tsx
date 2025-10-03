// admin-web/src/components/products/ProductFifoTab.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
  Grid,
  ActionIcon,
  Tooltip,
  CloseButton,
  rem,
  Badge as MantineBadge,
} from "@mantine/core";
import { MultiSelect } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import {
  IconArrowsSort,
  IconArrowUp,
  IconArrowDown,
  IconFilter,
  IconChevronDown,
  IconChevronUp,
  IconRefresh,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
  IconLink,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  useLocation,
  useNavigationType,
  useSearchParams,
} from "react-router-dom";
import { listBranchesApiRequest } from "../../api/branches";
import {
  adjustStockApiRequest,
  getStockLevelsApiRequest,
  listStockLedgerApiRequest,
} from "../../api/stock";
import { handlePageError } from "../../utils/pageError";
import { FilterBar } from "../common/FilterBar";

type Branch = { id: string; branchName: string };

type Levels = {
  productStock: { qtyOnHand: number; qtyAllocated: number };
  lots: Array<{
    id: string;
    qtyReceived: number;
    qtyRemaining: number;
    unitCostCents?: number | null;
    sourceRef?: string | null;
    receivedAt: string;
  }>;
};

type LedgerRow = {
  id: string;
  branchId: string;
  lotId: string | null;
  kind: "RECEIPT" | "ADJUSTMENT" | "CONSUMPTION" | "REVERSAL";
  qtyDelta: number;
  reason?: string | null;
  actorUserId?: string | null;
  occurredAt: string;
  createdAt: string;
};

type Props = {
  productId: string;
  canWriteProducts: boolean;
};

type SortField = "occurredAt" | "kind" | "qtyDelta";
type SortDir = "asc" | "desc";

type LedgerFilters = {
  kinds: Array<LedgerRow["kind"]>;
  minQty: number | "";
  maxQty: number | "";
  occurredFrom: string | null; // YYYY-MM-DD
  occurredTo: string | null; // YYYY-MM-DD
};

const FILTER_PANEL_ID = "ledger-filter-panel";
const TABLE_ID = "ledger-table";
const RANGE_ID = "ledger-range";

const emptyLedgerFilters: LedgerFilters = {
  kinds: [],
  minQty: "",
  maxQty: "",
  occurredFrom: null,
  occurredTo: null,
};

function nextDir(dir: "asc" | "desc"): "asc" | "desc" {
  return dir === "asc" ? "desc" : "asc";
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <IconArrowsSort size={16} />;
  return dir === "asc" ? (
    <IconArrowUp size={16} />
  ) : (
    <IconArrowDown size={16} />
  );
}

function toIsoStartOfDayUTC(d: string) {
  // d is like "2025-10-01"
  return new Date(`${d}T00:00:00.000Z`).toISOString();
}
function toIsoEndOfDayUTC(d: string) {
  return new Date(`${d}T23:59:59.999Z`).toISOString();
}

export const ProductFifoTab: React.FC<Props> = ({
  productId,
  canWriteProducts,
}) => {
  // URL sync
  const [searchParams, setSearchParams] = useSearchParams();
  const navigationType = useNavigationType();
  const location = useLocation();

  // Branches + selection
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [branchId, setBranchId] = useState<string | null>(null);

  // Levels for selected branch
  const [levels, setLevels] = useState<Levels | null>(null);
  const [loadingLevels, setLoadingLevels] = useState(false);

  // Ledger (current page rows only)
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[] | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Cursor pagination state
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]); // page1 cursor=null
  const [pageIndex, setPageIndex] = useState(0); // 0-based
  const [isPaginating, setIsPaginating] = useState(false);

  // Query controls
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState<number>(25);
  const [sortBy, setSortBy] = useState<SortField>("occurredAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Filters
  const [appliedFilters, setAppliedFilters] =
    useState<LedgerFilters>(emptyLedgerFilters);

  // Modal state
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockMode, setStockMode] = useState<"increase" | "decrease">(
    "increase"
  );
  const [stockQty, setStockQty] = useState<number | "">("");
  const [stockCostCents, setStockCostCents] = useState<number | "">("");
  const [stockReason, setStockReason] = useState<string>("");
  const [submittingStock, setSubmittingStock] = useState(false);

  // Load branches
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingBranches(true);
        const res = await listBranchesApiRequest({
          limit: 100,
          includeTotal: false,
        });
        if (!cancelled && res.success) {
          const items = (res.data.items ?? []).map((b: any) => ({
            id: b.id,
            branchName: b.branchName,
          }));
          setBranches(items);
          // From URL or default first
          const qpBranch = searchParams.get("branchId");
          if (qpBranch && items.some((b) => b.id === qpBranch)) {
            setBranchId(qpBranch);
          } else if (!branchId && items.length) {
            setBranchId(items[0].id);
          }
        }
      } catch (e) {
        handlePageError(e, { title: "Failed to load branches" });
      } finally {
        if (!cancelled) setLoadingBranches(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load levels when branch changes
  useEffect(() => {
    if (!branchId) {
      setLevels(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingLevels(true);
        const r = await getStockLevelsApiRequest({ branchId, productId });
        if (!cancelled && r.success) setLevels(r.data);
      } catch (e) {
        handlePageError(e, { title: "Failed to load stock levels" });
      } finally {
        if (!cancelled) setLoadingLevels(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId, productId]);

  // Initial URL → state (and when branchId first becomes available)
  useEffect(() => {
    if (!branchId) return;

    const qpPage = Number(searchParams.get("page") ?? "1");
    const initialPageIndex =
      Number.isFinite(qpPage) && qpPage > 0 ? qpPage - 1 : 0;

    const qpLimit = Number(searchParams.get("limit"));
    const qpSortBy =
      (searchParams.get("sortBy") as SortField | null) ?? "occurredAt";
    const qpSortDir = (searchParams.get("sortDir") as SortDir | null) ?? "desc";

    if (!Number.isNaN(qpLimit) && qpLimit)
      setLimit(Math.max(1, Math.min(100, qpLimit)));
    setSortBy(qpSortBy);
    setSortDir(qpSortDir);

    const qpKinds = searchParams.get("kinds");
    const qpMinQty = searchParams.get("minQty");
    const qpMaxQty = searchParams.get("maxQty");
    const qpFrom = searchParams.get("occurredFrom");
    const qpTo = searchParams.get("occurredTo");
    const qpCursor = searchParams.get("cursorId");

    setAppliedFilters({
      kinds: qpKinds
        ? (qpKinds.split(",").filter(Boolean) as LedgerRow["kind"][])
        : [],
      minQty:
        qpMinQty !== null ? (qpMinQty === "" ? "" : Number(qpMinQty)) : "",
      maxQty:
        qpMaxQty !== null ? (qpMaxQty === "" ? "" : Number(qpMaxQty)) : "",
      occurredFrom: qpFrom ?? null,
      occurredTo: qpTo ?? null,
    });

    setCursorStack([qpCursor ?? null]);
    setPageIndex(initialPageIndex);
    setLedgerRows(null);

    void fetchLedgerPage({
      includeReset: true,
      cursorId: qpCursor ?? null,
      limitOverride:
        !Number.isNaN(qpLimit) && qpLimit
          ? Math.max(1, Math.min(100, qpLimit))
          : undefined,
      sortDirOverride: qpSortDir,
      occurredFromOverride: qpFrom ?? undefined,
      occurredToOverride: qpTo ?? undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  // Respond to browser back/forward
  useEffect(() => {
    if (navigationType !== "POP") return;
    const sp = new URLSearchParams(location.search);

    const qpLimit = Number(sp.get("limit"));
    const qpSortBy = (sp.get("sortBy") as SortField | null) ?? "occurredAt";
    const qpSortDir = (sp.get("sortDir") as SortDir | null) ?? "desc";
    const qpKinds = sp.get("kinds");
    const qpMinQty = sp.get("minQty");
    const qpMaxQty = sp.get("maxQty");
    const qpFrom = sp.get("occurredFrom");
    const qpTo = sp.get("occurredTo");
    const qpCursor = sp.get("cursorId");
    const qpPage = Number(sp.get("page") ?? "1");
    const newPageIndex = Number.isFinite(qpPage) && qpPage > 0 ? qpPage - 1 : 0;

    if (!Number.isNaN(qpLimit) && qpLimit)
      setLimit(Math.max(1, Math.min(100, qpLimit)));
    setSortBy(qpSortBy);
    setSortDir(qpSortDir);

    setAppliedFilters({
      kinds: qpKinds
        ? (qpKinds.split(",").filter(Boolean) as LedgerRow["kind"][])
        : [],
      minQty:
        qpMinQty !== null ? (qpMinQty === "" ? "" : Number(qpMinQty)) : "",
      maxQty:
        qpMaxQty !== null ? (qpMaxQty === "" ? "" : Number(qpMaxQty)) : "",
      occurredFrom: qpFrom ?? null,
      occurredTo: qpTo ?? null,
    });

    setCursorStack([qpCursor ?? null]);
    setPageIndex(newPageIndex);
    setLedgerRows(null);

    void fetchLedgerPage({
      includeReset: true,
      cursorId: qpCursor ?? null,
      limitOverride:
        !Number.isNaN(qpLimit) && qpLimit
          ? Math.max(1, Math.min(100, qpLimit))
          : undefined,
      sortDirOverride: qpSortDir,
      occurredFromOverride: qpFrom ?? undefined,
      occurredToOverride: qpTo ?? undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, navigationType]);

  // Write URL from state
  function setUrlFromState(overrides?: {
    cursorId?: string | null;
    page?: number;
    limit?: number;
    sortBy?: SortField;
    sortDir?: SortDir;
    occurredFrom?: string | null | undefined;
    occurredTo?: string | null | undefined;
    kindsCsv?: string | null | undefined;
    minQty?: number | "" | null | undefined;
    maxQty?: number | "" | null | undefined;
    branchId?: string | null | undefined;
  }) {
    const params = new URLSearchParams();

    const put = (k: string, v: unknown) => {
      if (v === undefined || v === null || v === "") return;
      params.set(k, String(v));
    };

    put("branchId", overrides?.branchId ?? branchId);
    put("limit", overrides?.limit ?? limit);
    put("sortBy", overrides?.sortBy ?? sortBy);
    put("sortDir", overrides?.sortDir ?? sortDir);
    put(
      "occurredFrom",
      overrides?.occurredFrom === undefined
        ? appliedFilters.occurredFrom
        : overrides?.occurredFrom
    );
    put(
      "occurredTo",
      overrides?.occurredTo === undefined
        ? appliedFilters.occurredTo
        : overrides?.occurredTo
    );

    const kindsCsv =
      overrides?.kindsCsv === undefined
        ? appliedFilters.kinds.length
          ? appliedFilters.kinds.join(",")
          : null
        : overrides.kindsCsv || null;
    put("kinds", kindsCsv);

    const minQtyVal =
      overrides?.minQty === undefined
        ? typeof appliedFilters.minQty === "number"
          ? appliedFilters.minQty
          : null
        : overrides.minQty ?? null;
    const maxQtyVal =
      overrides?.maxQty === undefined
        ? typeof appliedFilters.maxQty === "number"
          ? appliedFilters.maxQty
          : null
        : overrides.maxQty ?? null;
    put("minQty", minQtyVal);
    put("maxQty", maxQtyVal);

    const cursor =
      overrides?.cursorId === undefined
        ? cursorStack[pageIndex] ?? null
        : overrides?.cursorId;
    if (cursor) params.set("cursorId", cursor);

    const pageToWrite = overrides?.page ?? pageIndex + 1;
    put("page", pageToWrite);

    setSearchParams(params, { replace: false });
  }

  // Fetch one page (rows are always replaced)
  async function fetchLedgerPage(opts?: {
    includeReset?: boolean;
    cursorId?: string | null;
    limitOverride?: number;
    sortByOverride?: SortField; // currently unused by server (only direction supported)
    sortDirOverride?: SortDir;
    occurredFromOverride?: string | undefined | null;
    occurredToOverride?: string | undefined | null;
  }) {
    if (!branchId) return;
    setLedgerLoading(true);
    try {
      const effectiveCursor =
        opts && Object.prototype.hasOwnProperty.call(opts, "cursorId")
          ? opts.cursorId // use the provided value even if it's null (first page)
          : cursorStack[pageIndex] ?? null;

        const hasFrom = opts && Object.prototype.hasOwnProperty.call(opts, "occurredFromOverride");
        const hasTo   = opts && Object.prototype.hasOwnProperty.call(opts, "occurredToOverride");
        
        const occurredFromStr =
          hasFrom ? (opts!.occurredFromOverride ?? null) : (appliedFilters.occurredFrom ?? null);
        const occurredToStr =
          hasTo   ? (opts!.occurredToOverride   ?? null) : (appliedFilters.occurredTo   ?? null);
        
        const res = await listStockLedgerApiRequest({
          productId,
          branchId,
          limit: opts?.limitOverride ?? limit,
          cursorId: effectiveCursor ?? undefined,
          sortDir: opts?.sortDirOverride ?? sortDir,
          occurredFrom: occurredFromStr ? toIsoStartOfDayUTC(occurredFromStr) : undefined,
          occurredTo:   occurredToStr   ? toIsoEndOfDayUTC(occurredToStr)     : undefined,
        });

      if (res.success) {
        const items = (res.data.items ?? []) as LedgerRow[];
        const effectiveLimit = opts?.limitOverride ?? limit;

        // 🔑 Replace rows for this page
        setLedgerRows(items);

        const serverHasNext = Boolean(res.data.pageInfo?.hasNextPage);
        const serverNextCursor = res.data.pageInfo?.nextCursor ?? null;
        const clientHasNext =
          serverHasNext &&
          items.length === effectiveLimit &&
          !!serverNextCursor;

        setHasNextPage(clientHasNext);
        setNextCursor(clientHasNext ? serverNextCursor : null);
      }
    } catch (e) {
      handlePageError(e, { title: "Failed to load ledger" });
    } finally {
      setLedgerLoading(false);
    }
  }

  // Apply filters (reset page)
  function applyAndFetch(values: LedgerFilters) {
    setAppliedFilters(values);
  
    // reset paging + URL
    setCursorStack([null]);
    setPageIndex(0);
    setUrlFromState({
      cursorId: null,
      page: 1,
      occurredFrom: values.occurredFrom ?? null,
      occurredTo: values.occurredTo ?? null,
      kindsCsv: values.kinds.length ? values.kinds.join(",") : null,
      minQty: typeof values.minQty === "number" ? values.minQty : null,
      maxQty: typeof values.maxQty === "number" ? values.maxQty : null,
    });
  
    // IMPORTANT: pass the submitted values directly, preserving nulls
    void fetchLedgerPage({
      includeReset: true,
      cursorId: null,
      occurredFromOverride: values.occurredFrom === null ? null : values.occurredFrom,
      occurredToOverride: values.occurredTo === null ? null : values.occurredTo,
    });
  }

  function clearAllFiltersAndFetch() {
    applyAndFetch(emptyLedgerFilters);
  }

  // Sorting
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

  function applySort(nextField: SortField) {
    const next = sortBy === nextField ? nextDir(sortDir) : "asc";
    setSortBy(nextField);
    setSortDir(next);

    if (nextField === "occurredAt") {
      // Server-side sort direction only
      setCursorStack([null]);
      setPageIndex(0);
      setUrlFromState({
        cursorId: null,
        page: 1,
        sortBy: nextField,
        sortDir: next,
      });
      void fetchLedgerPage({
        includeReset: true,
        cursorId: null,
        sortDirOverride: next,
      });
    } else {
      // Client-side sort
      setUrlFromState({ sortBy: nextField, sortDir: next });
    }
  }

  // Pagination
  async function goNextPage() {
    if (!hasNextPage || !nextCursor) return;
    setIsPaginating(true);
    try {
      const newIndex = pageIndex + 1;
      setCursorStack((prev) => [...prev.slice(0, pageIndex + 1), nextCursor]);
      setPageIndex(newIndex);
      setUrlFromState({ cursorId: nextCursor, page: newIndex + 1 });
      await fetchLedgerPage({ includeReset: true, cursorId: nextCursor });
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
      await fetchLedgerPage({ includeReset: true, cursorId: prevCursor });
    } finally {
      setIsPaginating(false);
    }
  }

  // Client-side filter & sort (within the current page)
  const displayedRows = useMemo(() => {
    const rows = ledgerRows ?? [];

    // Filter by kinds
    let filtered = appliedFilters.kinds.length
      ? rows.filter((r) => appliedFilters.kinds.includes(r.kind))
      : rows;

    // Qty range
    const min = appliedFilters.minQty;
    if (typeof min === "number")
      filtered = filtered.filter((r) => r.qtyDelta >= min);
    const max = appliedFilters.maxQty;
    if (typeof max === "number")
      filtered = filtered.filter((r) => r.qtyDelta <= max);

    // Client-side sort for kind/qty; date sort direction can still be flipped on page
    const dir = sortDir === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "occurredAt") {
        const da = new Date(a.occurredAt).getTime();
        const db = new Date(b.occurredAt).getTime();
        if (da === db) return a.id.localeCompare(b.id) * dir;
        return (da < db ? -1 : 1) * dir;
      }
      if (sortBy === "kind") {
        if (a.kind === b.kind) return a.id.localeCompare(b.id) * dir;
        return (a.kind < b.kind ? -1 : 1) * dir;
      }
      // qtyDelta
      if (a.qtyDelta === b.qtyDelta) return a.id.localeCompare(b.id) * dir;
      return (a.qtyDelta < b.qtyDelta ? -1 : 1) * dir;
    });

    return sorted;
  }, [ledgerRows, appliedFilters, sortBy, sortDir]);

  // Range text (for current page)
  const shownCount = displayedRows.length ?? 0;
  const rangeStart = shownCount ? pageIndex * limit + 1 : 0;
  const rangeEnd = shownCount ? rangeStart + shownCount - 1 : 0;
  const rangeText =
    shownCount === 0 ? "No results" : `Showing ${rangeStart}–${rangeEnd}`;

  // Active filter chips
  const activeFilterChips = useMemo(() => {
    const chips: {
      key: keyof LedgerFilters | "kinds" | "minQty" | "maxQty";
      label: string;
    }[] = [];
    if (appliedFilters.kinds.length)
      chips.push({
        key: "kinds",
        label: `kind: ${appliedFilters.kinds.join(", ")}`,
      });
    if (typeof appliedFilters.minQty === "number")
      chips.push({ key: "minQty", label: `qty ≥ ${appliedFilters.minQty}` });
    if (typeof appliedFilters.maxQty === "number")
      chips.push({ key: "maxQty", label: `qty ≤ ${appliedFilters.maxQty}` });
    if (appliedFilters.occurredFrom)
      chips.push({
        key: "occurredFrom",
        label: `date ≥ ${appliedFilters.occurredFrom}`,
      });
    if (appliedFilters.occurredTo)
      chips.push({
        key: "occurredTo",
        label: `date ≤ ${appliedFilters.occurredTo}`,
      });
    return chips;
  }, [appliedFilters]);

  function clearOneChip(
    key: keyof LedgerFilters | "kinds" | "minQty" | "maxQty"
  ) {
    const next: LedgerFilters = {
      ...appliedFilters,
      kinds: key === "kinds" ? [] : appliedFilters.kinds,
      minQty: key === "minQty" ? "" : appliedFilters.minQty,
      maxQty: key === "maxQty" ? "" : appliedFilters.maxQty,
      occurredFrom: key === "occurredFrom" ? null : appliedFilters.occurredFrom,
      occurredTo: key === "occurredTo" ? null : appliedFilters.occurredTo,
    };
    applyAndFetch(next);
  }

  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: b.id, label: b.branchName })),
    [branches]
  );

  // Adjust helpers
  async function doAdjust(
    delta: number,
    reason?: string,
    unitCostCents?: number
  ) {
    if (!productId || !branchId || delta === 0) return;
    const key = (crypto as any)?.randomUUID?.() ?? String(Date.now());
    const res = await adjustStockApiRequest({
      branchId,
      productId,
      qtyDelta: delta,
      ...(typeof unitCostCents === "number" ? { unitCostCents } : {}),
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
      idempotencyKeyOptional: key,
    });
    if (res.success) {
      notifications.show({ color: "green", message: "Stock adjusted." });
      const r2 = await getStockLevelsApiRequest({ branchId, productId });
      if (r2.success) setLevels(r2.data);

      // refresh ledger from first page
      setCursorStack([null]);
      setPageIndex(0);
      setUrlFromState({ cursorId: null, page: 1 });
      await fetchLedgerPage({ includeReset: true, cursorId: null });
    }
  }

  async function copyShareableLink() {
    const href = window.location.href;
    try {
      await navigator.clipboard.writeText(href);
      notifications.show({ color: "green", message: "Shareable link copied." });
    } catch {
      // Fallback for older browsers
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

  async function refreshBoth() {
    if (!branchId) return;
  
    // Reset/paginate ledger to first page in URL
    setCursorStack([null]);
    setPageIndex(0);
    setUrlFromState({ cursorId: null, page: 1 });
  
    // Refresh Levels
    try {
      setLoadingLevels(true);
      const levelsRes = await getStockLevelsApiRequest({ branchId, productId });
      if (levelsRes.success) setLevels(levelsRes.data);
    } catch (e) {
      handlePageError(e, { title: "Failed to refresh stock levels" });
    } finally {
      setLoadingLevels(false);
    }
  
    // Refresh Ledger (first page)
    setLedgerRows(null);
    void fetchLedgerPage({ includeReset: true, cursorId: null });
  }

  return (
    <Stack gap="md">
      <Stack justify="space-between" gap="1">
        <Title order={4}>FIFO / Ledger</Title>
        <Group gap="xs" justify="space-between">
          <Select
            label="Branch"
            data={branchOptions}
            value={branchId}
            onChange={(v) => {
              setBranchId(v);
              setUrlFromState({
                branchId: v ?? undefined,
                cursorId: null,
                page: 1,
              });
              setCursorStack([null]);
              setPageIndex(0);
              setLedgerRows(null);
            }}
            searchable
            required
            disabled={loadingBranches}
            w={280}
          />

          <Group gap="xs" justify="space-between">
            <Button
              leftSection={<IconLink size={16} />}
              variant="light"
              onClick={copyShareableLink}
              title="Copy shareable link"
            >
              Copy link
            </Button>

            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              onClick={refreshBoth}
              title="Refresh levels & ledger"
            >
              Refresh
            </Button>

            <Button
              onClick={() => setStockModalOpen(true)}
              disabled={!branchId || !canWriteProducts}
            >
              Adjust stock
            </Button>
          </Group>
        </Group>
      </Stack>

      {/* Levels (context) */}
      {loadingLevels ? (
        <div
          className="flex items-center justify-center p-8"
          role="status"
          aria-live="polite"
        >
          <Group gap="sm">
            <Loader size="sm" />
            <Text>Loading levels…</Text>
          </Group>
        </div>
      ) : branchId && levels ? (
        <Paper withBorder radius="md" p="md">
          <Stack gap="sm">
            <Text size="sm">
              On hand: <b>{levels.productStock.qtyOnHand}</b> (allocated:{" "}
              {levels.productStock.qtyAllocated})
            </Text>
            <Table striped withTableBorder withColumnBorders stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Lot</Table.Th>
                  <Table.Th>Received</Table.Th>
                  <Table.Th>Remaining</Table.Th>
                  <Table.Th>Unit cost (¢)</Table.Th>
                  <Table.Th>Source</Table.Th>
                  <Table.Th>Received at</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {levels.lots.map((lot) => (
                  <Table.Tr key={lot.id}>
                    <Table.Td>
                      <Badge>{lot.id.slice(0, 6)}…</Badge>
                    </Table.Td>
                    <Table.Td>{lot.qtyReceived}</Table.Td>
                    <Table.Td>{lot.qtyRemaining}</Table.Td>
                    <Table.Td>{lot.unitCostCents ?? "—"}</Table.Td>
                    <Table.Td>{lot.sourceRef ?? "—"}</Table.Td>
                    <Table.Td>
                      {new Date(lot.receivedAt).toLocaleString()}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        </Paper>
      ) : (
        <Text c="dimmed">Select a branch to view lots and adjust stock.</Text>
      )}

      {/* Ledger controls + table */}
      <Stack>
        <Group justify="end"> 
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
            fullWidth={false}
            aria-expanded={showFilters}
            aria-controls={FILTER_PANEL_ID}
          >
            Filters
          </Button>
        </Group>

        {/* Collapsible Filters */}
        <FilterBar<LedgerFilters>
          open={showFilters}
          panelId={FILTER_PANEL_ID}
          initialValues={appliedFilters}
          emptyValues={emptyLedgerFilters}
          onApply={applyAndFetch}
          onClear={clearAllFiltersAndFetch}
        >
          {({ values, setValues }) => (
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, md: 5 }}>
                <MultiSelect
                  label="Kind"
                  placeholder="Select kind(s)"
                  data={[
                    { value: "RECEIPT", label: "RECEIPT" },
                    { value: "ADJUSTMENT", label: "ADJUSTMENT" },
                    { value: "CONSUMPTION", label: "CONSUMPTION" },
                    { value: "REVERSAL", label: "REVERSAL" },
                  ]}
                  value={values.kinds as string[]}
                  onChange={(vals) =>
                    setValues((prev) => ({
                      ...prev,
                      kinds: vals as LedgerRow["kind"][],
                    }))
                  }
                  searchable
                  clearable
                />
                <Text size="xs" c="dimmed" mt={4}>
                  (Server sort supports date; kind and qty filters are
                  client-side.)
                </Text>
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
                <NumberInput
                  label="Min qty"
                  placeholder="e.g. -10"
                  value={values.minQty}
                  onChange={(v) =>
                    setValues((prev) => ({
                      ...prev,
                      minQty:
                        typeof v === "number" ? v : v === "" ? "" : Number(v),
                    }))
                  }
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6, md: 2 }}>
                <NumberInput
                  label="Max qty"
                  placeholder="e.g. 10"
                  value={values.maxQty}
                  onChange={(v) =>
                    setValues((prev) => ({
                      ...prev,
                      maxQty:
                        typeof v === "number" ? v : v === "" ? "" : Number(v),
                    }))
                  }
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6, md: 1.5 }}>
                <DatePickerInput
                  label="Date from"
                  placeholder="YYYY-MM-DD"
                  value={values.occurredFrom}
                  onChange={(v) =>
                    setValues((prev) => ({ ...prev, occurredFrom: v }))
                  }
                  valueFormat="YYYY-MM-DD"
                  popoverProps={{ withinPortal: true }}
                  clearable
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6, md: 1.5 }}>
                <DatePickerInput
                  label="Date to"
                  placeholder="YYYY-MM-DD"
                  value={values.occurredTo}
                  onChange={(v) =>
                    setValues((prev) => ({ ...prev, occurredTo: v }))
                  }
                  valueFormat="YYYY-MM-DD"
                  popoverProps={{ withinPortal: true }}
                  clearable
                />
              </Grid.Col>
            </Grid>
          )}
        </FilterBar>

        <Paper
          withBorder
          p="md"
          radius="md"
          className="bg-white max-h-[70vh] overflow-y-auto"
        >
          <Group justify="space-between" mb={activeFilterChips.length > 0 ? "0" : "md"}>
            <Title order={5}>Ledger</Title>

            <Group align="center" gap="xs">
              <Text size="sm" c="dimmed">
                Per page
              </Text>
              <NumberInput
                value={limit}
                onChange={(v) => {
                  const n =
                    typeof v === "number" ? v : v === "" ? 25 : Number(v);
                  const clamped = Math.max(1, Math.min(100, n));
                  setLimit(clamped);
                  // reset pagination
                  setCursorStack([null]);
                  setPageIndex(0);
                  setUrlFromState({ cursorId: null, page: 1, limit: clamped });
                  setLedgerRows(null);
                  void fetchLedgerPage({
                    includeReset: true,
                    cursorId: null,
                    limitOverride: clamped,
                  });
                }}
                min={1}
                max={100}
                step={1}
                clampBehavior="strict"
                w={rem(90)}
              />
            </Group>
          </Group>

          {/* Active filter chips */}
          {activeFilterChips.length > 0 && (
            <Group
              gap="xs"
              mb="sm"
              wrap="wrap"
              role="region"
              aria-label="Active filters"
            >
              {activeFilterChips.map((chip) => (
                <MantineBadge
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
                </MantineBadge>
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

          {ledgerRows === null || ledgerLoading ? (
            <div
              className="flex items-center justify-center p-8"
              role="status"
              aria-live="polite"
            >
              <Loader />
              <Text ml="sm">Loading ledger…</Text>
            </div>
          ) : displayedRows.length === 0 ? (
            <Alert color="gray" title="No movements">
              No ledger entries match your filters.
            </Alert>
          ) : (
            <>
              <div
                className="max-h-[55vh] overflow-y-auto"
                aria-busy={ledgerLoading}
              >
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
                      <Table.Th
                        scope="col"
                        aria-sort={colAriaSort("occurredAt")}
                      >
                        <Group gap={4} wrap="nowrap">
                          <span>Date</span>
                          <Tooltip label="Sort by date" withArrow>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              onClick={() => applySort("occurredAt")}
                              aria-label={sortButtonLabel("date", "occurredAt")}
                              aria-controls={TABLE_ID}
                            >
                              <SortIcon
                                active={sortBy === "occurredAt"}
                                dir={sortDir}
                              />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Th>

                      <Table.Th scope="col" aria-sort={colAriaSort("kind")}>
                        <Group gap={4} wrap="nowrap">
                          <span>Kind</span>
                          <Tooltip label="Sort by kind (client)" withArrow>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              onClick={() => applySort("kind")}
                              aria-label={sortButtonLabel("kind", "kind")}
                              aria-controls={TABLE_ID}
                            >
                              <SortIcon
                                active={sortBy === "kind"}
                                dir={sortDir}
                              />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Th>

                      <Table.Th scope="col" aria-sort={colAriaSort("qtyDelta")}>
                        <Group gap={4} wrap="nowrap">
                          <span>Qty Δ</span>
                          <Tooltip label="Sort by quantity (client)" withArrow>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              onClick={() => applySort("qtyDelta")}
                              aria-label={sortButtonLabel(
                                "quantity",
                                "qtyDelta"
                              )}
                              aria-controls={TABLE_ID}
                            >
                              <SortIcon
                                active={sortBy === "qtyDelta"}
                                dir={sortDir}
                              />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Th>

                      <Table.Th>Lot</Table.Th>
                      <Table.Th>Reason</Table.Th>
                    </Table.Tr>
                  </Table.Thead>

                  <Table.Tbody>
                    {displayedRows.map((row) => (
                      <Table.Tr key={row.id}>
                        <Table.Td>
                          {new Date(row.occurredAt).toLocaleString()}
                        </Table.Td>
                        <Table.Td>{row.kind}</Table.Td>
                        <Table.Td>{row.qtyDelta}</Table.Td>
                        <Table.Td>
                          {row.lotId ? (
                            <Badge>{row.lotId.slice(0, 6)}…</Badge>
                          ) : (
                            "—"
                          )}
                        </Table.Td>
                        <Table.Td>{row.reason ?? "—"}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>

              {/* Pagination + range */}
              <Group justify="space-between" mt="md">
                <Text
                  id={RANGE_ID}
                  size="sm"
                  c="dimmed"
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
            </>
          )}
        </Paper>
      </Stack>

      {/* Adjust modal (increase uses ADJUST with required cost) */}
      <Modal
        opened={stockModalOpen}
        onClose={() => {
          if (!submittingStock) {
            setStockModalOpen(false);
            setStockQty("");
            setStockCostCents("");
            setStockReason("");
            setStockMode("increase");
          }
        }}
        title="Adjust stock"
        centered
      >
        <Stack gap="md">
          <SegmentedControl
            value={stockMode}
            onChange={(v) => setStockMode(v as "increase" | "decrease")}
            data={[
              { value: "increase", label: "Increase (adjust)" },
              { value: "decrease", label: "Decrease (adjust)" },
            ]}
          />

          <NumberInput
            label="Quantity"
            placeholder="e.g. 1"
            min={1}
            required
            value={stockQty}
            onChange={(v) =>
              setStockQty(typeof v === "number" ? v : v === "" ? "" : Number(v))
            }
          />

          {stockMode === "increase" && (
            <NumberInput
              label="Unit cost (cents)"
              placeholder="e.g. 1299"
              min={0}
              required
              value={stockCostCents}
              onChange={(v) =>
                setStockCostCents(
                  typeof v === "number" ? v : v === "" ? "" : Number(v)
                )
              }
            />
          )}

          <Textarea
            label="Reason (optional)"
            placeholder={
              stockMode === "increase"
                ? "e.g. stock take adjustment up"
                : "e.g. damaged, shrinkage"
            }
            value={stockReason}
            onChange={(e) => setStockReason(e.currentTarget.value)}
            autosize
            minRows={2}
          />

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setStockModalOpen(false)}
              disabled={submittingStock}
            >
              Cancel
            </Button>
            <Button
              loading={submittingStock}
              onClick={async () => {
                if (!productId || !branchId) {
                  notifications.show({
                    color: "red",
                    message: "Select a branch first.",
                  });
                  return;
                }
                const qty = typeof stockQty === "number" ? stockQty : 0;
                if (qty <= 0) {
                  notifications.show({
                    color: "red",
                    message: "Quantity must be greater than 0.",
                  });
                  return;
                }

                setSubmittingStock(true);
                try {
                  if (stockMode === "increase") {
                    const cost =
                      typeof stockCostCents === "number" ? stockCostCents : -1;
                    if (cost < 0) {
                      notifications.show({
                        color: "red",
                        message: "Unit cost (cents) is required.",
                      });
                      setSubmittingStock(false);
                      return;
                    }
                    await doAdjust(+qty, stockReason, cost);
                  } else {
                    await doAdjust(-qty, stockReason);
                  }
                  setStockModalOpen(false);
                  setStockQty("");
                  setStockCostCents("");
                  setStockReason("");
                  setStockMode("increase");
                } catch (e) {
                  handlePageError(e, { title: "Stock update failed" });
                } finally {
                  setSubmittingStock(false);
                }
              }}
              disabled={!canWriteProducts}
            >
              Submit
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
