// admin-web/src/pages/ProductsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useLocation, useNavigationType } from "react-router-dom";
import {
  Button,
  Group,
  Table,
  Title,
  Paper,
  TextInput,
  NumberInput,
  Badge,
  Loader,
  Text,
  Grid,
  rem,
  ActionIcon,
  Tooltip,
  CloseButton,
  Stack
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  listProductsApiRequest,
  deleteProductApiRequest,
} from "../api/products";
import type { ProductRecord } from "../api/apiTypes";
import {
  IconTrash,
  IconPencil,
  IconRefresh,
  IconArrowsSort,
  IconArrowUp,
  IconArrowDown,
  IconFilter,
  IconChevronDown,
  IconChevronUp,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
  IconLink
} from "@tabler/icons-react";
import { handlePageError } from "../utils/pageError";
import { useAuthStore } from "../stores/auth";
import dayjs from "dayjs";
import { FilterBar } from "../components/common/FilterBar";
import { useNavigate } from "react-router-dom";

type SortField =
  | "createdAt"
  | "updatedAt"
  | "productName"
  | "productPriceCents";

type SortDir = "asc" | "desc";

type ProductFilters = {
  q: string;
  minPriceCents: number | "";
  maxPriceCents: number | "";
  createdAtFrom: string | null;
  createdAtTo: string | null;
  updatedAtFrom: string | null;
  updatedAtTo: string | null;
};

const emptyProductFilters: ProductFilters = {
  q: "",
  minPriceCents: "",
  maxPriceCents: "",
  createdAtFrom: null,
  createdAtTo: null,
  updatedAtFrom: null,
  updatedAtTo: null,
};

export default function ProductsPage() {
  const FILTER_PANEL_ID = "products-filter-panel";
  const TABLE_ID = "products-table";
  const RANGE_ID = "products-range";
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const navigationType = useNavigationType(); 
  const location = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  // Global memberships (no per-page /me calls)
  const canWriteProducts = useAuthStore((s) => s.hasPerm("products:write"));

  // Data & paging state
  const [isLoadingProductsList, setIsLoadingProductsList] = useState(false);
  const [productsListRecords, setProductsListRecords] = useState<
    ProductRecord[] | null
  >(null);
  const [errorForBoundary, setErrorForBoundary] = useState<
    (Error & { httpStatusCode?: number; correlationId?: string }) | null
  >(null);

  // Cursor pagination state
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]); // page 1 cursor = null
  const [pageIndex, setPageIndex] = useState(0); // 0-based page index
  const [isPaginating, setIsPaginating] = useState(false);

  // Totals
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Query controls
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState<number>(20);
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Filters
  const [appliedFilters, setAppliedFilters] =
    useState<ProductFilters>(emptyProductFilters);

  function applyAndFetch(values: ProductFilters) {
    setAppliedFilters(values);
    setUrlFromState({
      cursorId: null,
      q: values.q.trim() || null,
      minPriceCents: typeof values.minPriceCents === "number" ? values.minPriceCents : null,
      maxPriceCents: typeof values.maxPriceCents === "number" ? values.maxPriceCents : null,
      createdAtFrom: values.createdAtFrom ?? null,
      createdAtTo: values.createdAtTo ?? null,
      updatedAtFrom: values.updatedAtFrom ?? null,
      updatedAtTo: values.updatedAtTo ?? null,
    });
    resetToFirstPageAndFetch({
      qOverride: values.q.trim() || null,
      minPriceOverride: typeof values.minPriceCents === "number" ? values.minPriceCents : null,
      maxPriceOverride: typeof values.maxPriceCents === "number" ? values.maxPriceCents : null,
      createdFromOverride: values.createdAtFrom ?? null,
      createdToOverride: values.createdAtTo ?? null,
      updatedFromOverride: values.updatedAtFrom ?? null,
      updatedToOverride: values.updatedAtTo ?? null,
    });
  }
  
  function clearAllFiltersAndFetch() {
    applyAndFetch(emptyProductFilters);
  }

  function colAriaSort(field: SortField): "ascending" | "descending" | "none" {
    if (sortBy !== field) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  }
  function nextDir(dir: SortDir) { return dir === "asc" ? "desc" : "asc"; }
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
    minPriceCents?: number | null | undefined;
    maxPriceCents?: number | null | undefined;
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

    // fallbacks to currently-applied filters if overrides are not provided
    const qVal =
      overrides?.q === undefined
        ? appliedFilters.q.trim() || null
        : overrides.q?.toString().trim() || null;

    const minVal =
      overrides?.minPriceCents === undefined
        ? typeof appliedFilters.minPriceCents === "number"
          ? appliedFilters.minPriceCents
          : null
        : overrides.minPriceCents;

    const maxVal =
      overrides?.maxPriceCents === undefined
        ? typeof appliedFilters.maxPriceCents === "number"
          ? appliedFilters.maxPriceCents
          : null
        : overrides.maxPriceCents;

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
    put("minPriceCents", minVal);
    put("maxPriceCents", maxVal);
    put("createdAtFrom", createdFromVal);
    put("createdAtTo", createdToVal);
    put("updatedAtFrom", updatedFromVal);
    put("updatedAtTo", updatedToVal);

    const cursor =
      overrides?.cursorId === undefined
        ? cursorStack[pageIndex] ?? null
        : overrides.cursorId;
    if (cursor) params.set("cursorId", cursor);

    const pageToWrite = overrides?.page ?? (pageIndex + 1);
    put("page", pageToWrite);

    setSearchParams(params, { replace: false });
  }

  // ---- Data fetching helpers ----
  async function fetchPageWith(opts?: {
    includeTotal?: boolean;
    cursorId?: string | null;
    sortByOverride?: SortField;
    sortDirOverride?: SortDir;
    limitOverride?: number;
    qOverride?: string | null | undefined;
    minPriceOverride?: number | null | undefined;
    maxPriceOverride?: number | null | undefined;
    createdFromOverride?: string | null | undefined;
    createdToOverride?: string | null | undefined;
    updatedFromOverride?: string | null | undefined;
    updatedToOverride?: string | null | undefined;
  }) {
    setIsLoadingProductsList(true);
    try {
      const qParam =
        opts?.qOverride === undefined
          ? appliedFilters.q.trim() || undefined
          : opts.qOverride || undefined;

      const minParam =
        opts?.minPriceOverride === undefined
          ? typeof appliedFilters.minPriceCents === "number"
            ? appliedFilters.minPriceCents
            : undefined
          : opts.minPriceOverride == null
          ? undefined
          : opts.minPriceOverride;

      const maxParam =
        opts?.maxPriceOverride === undefined
          ? typeof appliedFilters.maxPriceCents === "number"
            ? appliedFilters.maxPriceCents
            : undefined
          : opts.maxPriceOverride == null
          ? undefined
          : opts.maxPriceOverride;

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

      const response = await listProductsApiRequest({
        limit: opts?.limitOverride ?? limit,
        cursorId: opts?.cursorId ?? cursorStack[pageIndex] ?? undefined,
        q: qParam,
        minPriceCents: minParam,
        maxPriceCents: maxParam,
        createdAtFrom: createdFromParam,
        createdAtTo: createdToParam,
        updatedAtFrom: updatedFromParam,
        updatedAtTo: updatedToParam,
        sortBy: opts?.sortByOverride ?? sortBy,
        sortDir: opts?.sortDirOverride ?? sortDir,
        includeTotal: opts?.includeTotal === true,
      });

      if (response.success) {
        const data = response.data;
        const items = data.items ?? [];
        const effectiveLimit = opts?.limitOverride ?? limit;
      
        // Save rows first
        setProductsListRecords(items);
      
        // Derive next page more defensively, mirroring Roles
        const serverHasNext = Boolean(data.pageInfo.hasNextPage);
        const serverNextCursor = data.pageInfo.nextCursor ?? null;
      
        // Only trust "hasNextPage" if we actually got a full page AND a cursor
        const clientHasNext =
          serverHasNext && items.length === effectiveLimit && !!serverNextCursor;
      
        setHasNextPage(clientHasNext);
        setNextCursor(clientHasNext ? serverNextCursor : null);
      
        if (opts?.includeTotal && typeof data.pageInfo.totalCount === "number") {
          setTotalCount(data.pageInfo.totalCount);
        }
      } else {
        const e = Object.assign(new Error("Failed to load products"), {
          httpStatusCode: 500,
        });
        setErrorForBoundary(e);
      }
    } catch (error: any) {
      setErrorForBoundary(handlePageError(error, { title: "Error" }));
    } finally {
      setIsLoadingProductsList(false);
    }
  }

  function resetToFirstPageAndFetch(opts?: {
    sortByOverride?: SortField;
    sortDirOverride?: SortDir;
    limitOverride?: number;
    qOverride?: string | null | undefined;
    minPriceOverride?: number | null | undefined;
    maxPriceOverride?: number | null | undefined;
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
      minPriceCents: opts?.minPriceOverride,
      maxPriceCents: opts?.maxPriceOverride,
      createdAtFrom: opts?.createdFromOverride,
      createdAtTo: opts?.createdToOverride,
      updatedAtFrom: opts?.updatedFromOverride,
      updatedAtTo: opts?.updatedToOverride,
    });
    void fetchPageWith({
      includeTotal: true,
      cursorId: null,
      ...opts,
    });
  }

  // Initial load / when tenant changes
  useEffect(() => {
    setProductsListRecords(null);
    setHasNextPage(false);
    setNextCursor(null);
    setTotalCount(null);
    setErrorForBoundary(null);

    const qpPage = Number(searchParams.get("page") ?? "1");
    const initialPageIndex = Number.isFinite(qpPage) && qpPage > 0 ? qpPage - 1 : 0;

    // Parse URL params
    const qpLimit = Number(searchParams.get("limit"));
    const qpSortBy = searchParams.get("sortBy") as SortField | null;
    const qpSortDir = searchParams.get("sortDir") as SortDir | null;
    const qpQ = searchParams.get("q");
    const qpMin = searchParams.get("minPriceCents");
    const qpMax = searchParams.get("maxPriceCents");
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
      minPriceCents: qpMin !== null ? (qpMin === "" ? "" : Number(qpMin)) : "",
      maxPriceCents: qpMax !== null ? (qpMax === "" ? "" : Number(qpMax)) : "",
      createdAtFrom: qpCreatedFrom ?? null,
      createdAtTo: qpCreatedTo ?? null,
      updatedAtFrom: qpUpdatedFrom ?? null,
      updatedAtTo: qpUpdatedTo ?? null,
    });

    // Use the cursor from URL as the starting point
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
      minPriceOverride:
        qpMin !== null ? (qpMin ? Number(qpMin) : null) : undefined,
      maxPriceOverride:
        qpMax !== null ? (qpMax ? Number(qpMax) : null) : undefined,
      createdFromOverride: qpCreatedFrom ?? undefined,
      createdToOverride: qpCreatedTo ?? undefined,
      updatedFromOverride: qpUpdatedFrom ?? undefined,
      updatedToOverride: qpUpdatedTo ?? undefined,
    });
  }, [tenantSlug]);

  useEffect(() => {
    if (navigationType !== 'POP') return; // only browser back/forward
  
    const sp = new URLSearchParams(location.search);
  
    const qpLimit = Number(sp.get("limit"));
    const qpSortBy = sp.get("sortBy") as SortField | null;
    const qpSortDir = sp.get("sortDir") as SortDir | null;
    const qpQ = sp.get("q");
    const qpMin = sp.get("minPriceCents");
    const qpMax = sp.get("maxPriceCents");
    const qpCreatedFrom = sp.get("createdAtFrom");
    const qpCreatedTo = sp.get("createdAtTo");
    const qpUpdatedFrom = sp.get("updatedAtFrom");
    const qpUpdatedTo = sp.get("updatedAtTo");
    const qpCursor = sp.get("cursorId");
    const qpPage = Number(sp.get("page") ?? "1");
    const newPageIndex = Number.isFinite(qpPage) && qpPage > 0 ? qpPage - 1 : 0;
  
    if (!Number.isNaN(qpLimit) && qpLimit) setLimit(Math.max(1, Math.min(100, qpLimit)));
    if (qpSortBy) setSortBy(qpSortBy);
    if (qpSortDir) setSortDir(qpSortDir);
  
    setAppliedFilters({
      q: qpQ ?? "",
      minPriceCents: qpMin !== null ? (qpMin === "" ? "" : Number(qpMin)) : "",
      maxPriceCents: qpMax !== null ? (qpMax === "" ? "" : Number(qpMax)) : "",
      createdAtFrom: qpCreatedFrom ?? null,
      createdAtTo: qpCreatedTo ?? null,
      updatedAtFrom: qpUpdatedFrom ?? null,
      updatedAtTo: qpUpdatedTo ?? null,
    });
  
    // seed stack minimally; we may not know earlier cursors
    setCursorStack([qpCursor ?? null]);
    setPageIndex(newPageIndex);
  
    void fetchPageWith({
      includeTotal: true,
      cursorId: qpCursor ?? null,
      sortByOverride: qpSortBy ?? undefined,
      sortDirOverride: qpSortDir ?? undefined,
      limitOverride: !Number.isNaN(qpLimit) && qpLimit ? Math.max(1, Math.min(100, qpLimit)) : undefined,
      qOverride: qpQ ?? undefined,
      minPriceOverride: qpMin !== null ? (qpMin ? Number(qpMin) : null) : undefined,
      maxPriceOverride: qpMax !== null ? (qpMax ? Number(qpMax) : null) : undefined,
      createdFromOverride: qpCreatedFrom ?? undefined,
      createdToOverride: qpCreatedTo ?? undefined,
      updatedFromOverride: qpUpdatedFrom ?? undefined,
      updatedToOverride: qpUpdatedTo ?? undefined,
    });
  }, [location.key, navigationType, tenantSlug]);

  if (errorForBoundary) throw errorForBoundary;

  // ---- Sorting from table headers ----
  function applySort(nextField: SortField) {
    const nextDir: SortDir =
      sortBy === nextField ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    setSortBy(nextField);
    setSortDir(nextDir);
    resetToFirstPageAndFetch({
      sortByOverride: nextField,
      sortDirOverride: nextDir,
    });
  }

  // ---- Pagination controls with range text ----
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

  // Range text helpers
  const shownCount = productsListRecords?.length ?? 0;
  const rangeStart = shownCount ? pageIndex * limit + 1 : 0;
  const rangeEnd = shownCount ? rangeStart + shownCount - 1 : 0;
  const rangeText =
    shownCount === 0
      ? "No results"
      : `Showing ${rangeStart}–${rangeEnd}${
          totalCount != null ? ` of ${totalCount}` : ""
        }`;

  // ---- UI handlers ----
  async function handleDeleteProduct(productId: string) {
    try {
      const idempotencyKeyValue = `delete-${productId}-${Date.now()}`;
      const response = await deleteProductApiRequest({
        productId,
        idempotencyKeyOptional: idempotencyKeyValue,
      });
      if (response.success) {
        notifications.show({ color: "green", message: "Product deleted." });
        resetToFirstPageAndFetch();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Delete failed",
      });
    }
  }

  // Small helpers for header sort icon
  function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
    if (!active) return <IconArrowsSort size={16} />;
    return dir === "asc" ? (
      <IconArrowUp size={16} />
    ) : (
      <IconArrowDown size={16} />
    );
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

  const activeFilterChips = useMemo(() => {
    const chips: { key: keyof ProductFilters; label: string }[] = [];
    if (appliedFilters.q.trim()) chips.push({ key: "q", label: `search: "${appliedFilters.q.trim()}"` });
    if (typeof appliedFilters.minPriceCents === "number") chips.push({ key: "minPriceCents", label: `min: ${appliedFilters.minPriceCents}` });
    if (typeof appliedFilters.maxPriceCents === "number") chips.push({ key: "maxPriceCents", label: `max: ${appliedFilters.maxPriceCents}` });
    if (appliedFilters.createdAtFrom) chips.push({ key: "createdAtFrom", label: `created ≥ ${appliedFilters.createdAtFrom}` });
    if (appliedFilters.createdAtTo) chips.push({ key: "createdAtTo", label: `created ≤ ${appliedFilters.createdAtTo}` });
    if (appliedFilters.updatedAtFrom) chips.push({ key: "updatedAtFrom", label: `updated ≥ ${appliedFilters.updatedAtFrom}` });
    if (appliedFilters.updatedAtTo) chips.push({ key: "updatedAtTo", label: `updated ≤ ${appliedFilters.updatedAtTo}` });
    return chips;
  }, [appliedFilters]);

  function clearOneChip(key: keyof ProductFilters) {
    const defaults: ProductFilters = {
      ...appliedFilters,
      q: key === "q" ? "" : appliedFilters.q,
      minPriceCents: key === "minPriceCents" ? "" : appliedFilters.minPriceCents,
      maxPriceCents: key === "maxPriceCents" ? "" : appliedFilters.maxPriceCents,
      createdAtFrom: key === "createdAtFrom" ? null : appliedFilters.createdAtFrom,
      createdAtTo: key === "createdAtTo" ? null : appliedFilters.createdAtTo,
      updatedAtFrom: key === "updatedAtFrom" ? null : appliedFilters.updatedAtFrom,
      updatedAtTo: key === "updatedAtTo" ? null : appliedFilters.updatedAtTo,
    };
    applyAndFetch(defaults);
  }

  return (
    <div>
      {/* Header Banner */}
      <div className="flex justify-between items-start w-full">
        <Group justify="space-between" align="start" className="w-full">
          <Stack gap="1"> 
            <Title order={3}>All Products</Title>
            <Text size="sm" c="dimmed">
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

            <Button
              onClick={() => navigate(`/${tenantSlug}/products/new`)} 
              disabled={!canWriteProducts}
            >
              New product
            </Button>
          </Group>
        </Group>
      </div>

      {/* Collapsible Filters */}
      <FilterBar<ProductFilters>
        open={showFilters}
        panelId={FILTER_PANEL_ID}
        initialValues={appliedFilters}
        emptyValues={emptyProductFilters}
        onApply={applyAndFetch}
        onClear={clearAllFiltersAndFetch}
      >
        {({ values, setValues }) => (
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <TextInput
                label="Search (name or SKU)"
                placeholder="e.g. anvil or ACME-SKU-001"
                value={values.q}
                onChange={(e) => {
                  const val = e.currentTarget.value;   // buffer first
                  setValues((prev) => ({ ...prev, q: val }));
                }}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <NumberInput
                label="Min price (cents)"
                placeholder="e.g. 5000"
                value={values.minPriceCents}
                min={0}
                onChange={(v) =>
                  setValues((prev) => ({
                    ...prev,
                    minPriceCents:
                      typeof v === "number" ? v : v === "" ? "" : Number(v),
                  }))
                }
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <NumberInput
                label="Max price (cents)"
                placeholder="e.g. 20000"
                value={values.maxPriceCents}
                min={0}
                onChange={(v) =>
                  setValues((prev) => ({
                    ...prev,
                    maxPriceCents:
                      typeof v === "number" ? v : v === "" ? "" : Number(v),
                  }))
                }
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
                presets={[
                  {
                    value: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
                    label: "Yesterday",
                  },
                  { value: dayjs().format("YYYY-MM-DD"), label: "Today" },
                  {
                    value: dayjs().add(1, "day").format("YYYY-MM-DD"),
                    label: "Tomorrow",
                  },
                  {
                    value: dayjs().add(1, "month").format("YYYY-MM-DD"),
                    label: "Next month",
                  },
                  {
                    value: dayjs().add(1, "year").format("YYYY-MM-DD"),
                    label: "Next year",
                  },
                  {
                    value: dayjs()
                      .subtract(1, "month")
                      .format("YYYY-MM-DD"),
                    label: "Last month",
                  },
                  {
                    value: dayjs().subtract(1, "year").format("YYYY-MM-DD"),
                    label: "Last year",
                  },
                ]}
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
                popoverProps={{ withinPortal: true }}
                presets={[
                  {
                    value: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
                    label: "Yesterday",
                  },
                  { value: dayjs().format("YYYY-MM-DD"), label: "Today" },
                  {
                    value: dayjs().add(1, "day").format("YYYY-MM-DD"),
                    label: "Tomorrow",
                  },
                  {
                    value: dayjs().add(1, "month").format("YYYY-MM-DD"),
                    label: "Next month",
                  },
                  {
                    value: dayjs().add(1, "year").format("YYYY-MM-DD"),
                    label: "Next year",
                  },
                  {
                    value: dayjs()
                      .subtract(1, "month")
                      .format("YYYY-MM-DD"),
                    label: "Last month",
                  },
                  {
                    value: dayjs().subtract(1, "year").format("YYYY-MM-DD"),
                    label: "Last year",
                  },
                ]}
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
                presets={[
                  {
                    value: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
                    label: "Yesterday",
                  },
                  { value: dayjs().format("YYYY-MM-DD"), label: "Today" },
                  {
                    value: dayjs().add(1, "day").format("YYYY-MM-DD"),
                    label: "Tomorrow",
                  },
                  {
                    value: dayjs()
                      .subtract(1, "month")
                      .format("YYYY-MM-DD"),
                    label: "Last month",
                  },
                  {
                    value: dayjs().subtract(1, "year").format("YYYY-MM-DD"),
                    label: "Last year",
                  },
                ]}
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
                presets={[
                  {
                    value: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
                    label: "Yesterday",
                  },
                  { value: dayjs().format("YYYY-MM-DD"), label: "Today" },
                  {
                    value: dayjs().add(1, "day").format("YYYY-MM-DD"),
                    label: "Tomorrow",
                  },
                  {
                    value: dayjs().add(1, "month").format("YYYY-MM-DD"),
                    label: "Next month",
                  },
                  {
                    value: dayjs().add(1, "year").format("YYYY-MM-DD"),
                    label: "Next year",
                  },
                ]}
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
          className="bg-white max-h-[80vh] overflow-y-auto"
        >
          <Group justify="space-between" mb="md">
            <Title order={4}>All Products</Title>

            {/* Results per page (right) */}
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

          {productsListRecords === null || isLoadingProductsList ? (
            <div className="flex items-center justify-center p-8" role="status" aria-live="polite">
              <Loader />
              <Text ml="sm">Loading products…</Text>
            </div>
          ) : (
            <>
              <div className="max-h-[65vh] overflow-y-auto" aria-busy={isLoadingProductsList}>
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
                
                {!isLoadingProductsList && (productsListRecords?.length ?? 0) === 0 ? (
                  <div className="py-16 text-center" role="region" aria-live="polite" aria-atomic="true">
                    <Title order={4} mb="xs">No products match your filters</Title>
                    <Text c="dimmed" mb="md">
                      Try adjusting your filters or clear them to see all products.
                    </Text>
                    <Group justify="center">
                      <Button onClick={clearAllFiltersAndFetch}>Clear all filters</Button>
                      <Button variant="light" onClick={() => setShowFilters(true)} aria-controls={FILTER_PANEL_ID} aria-expanded={showFilters}>
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
                        <Table.Th scope="col" aria-sort={colAriaSort("productName")}>
                          <Group gap={4} wrap="nowrap">
                            <span>Name</span>
                            <Tooltip label="Sort by name" withArrow>
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                onClick={() => applySort("productName")}
                                aria-label="Sort by name"
                              >
                                <SortIcon
                                  active={sortBy === "productName"}
                                  dir={sortDir}
                                />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Th>

                        <Table.Th scope="col">SKU</Table.Th>

                        <Table.Th scope="col" aria-sort={colAriaSort("productPriceCents")}>
                          <Group gap={4} wrap="nowrap">
                            <span>Price (cents)</span>
                            <Tooltip label="Sort by price" withArrow>
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                onClick={() => applySort("productPriceCents")}
                                aria-label={sortButtonLabel("price", "productPriceCents")}
                                aria-controls={TABLE_ID}
                              >
                                <SortIcon
                                  active={sortBy === "productPriceCents"}
                                  dir={sortDir}
                                />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Th>

                        <Table.Th scope="col" aria-sort={colAriaSort("createdAt")}>
                          <Group gap={4} wrap="nowrap">
                            <span>Created</span>
                            <Tooltip label="Sort by created date" withArrow>
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                onClick={() => applySort("createdAt")}
                                aria-label={sortButtonLabel("created", "createdAt")}
                                aria-controls={TABLE_ID}
                              >
                                <SortIcon
                                  active={sortBy === "createdAt"}
                                  dir={sortDir}
                                />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Th>

                        <Table.Th scope="col" aria-sort={colAriaSort("updatedAt")}>
                          <Group gap={4} wrap="nowrap">
                            <span>Updated</span>
                            <Tooltip label="Sort by updated date" withArrow>
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                onClick={() => applySort("updatedAt")}
                                aria-label={sortButtonLabel("updated", "updatedAt")}
                                aria-controls={TABLE_ID}
                              >
                                <SortIcon
                                  active={sortBy === "updatedAt"}
                                  dir={sortDir}
                                />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Th>

                        <Table.Th>
                          <Group gap={4} wrap="nowrap">
                            <span>Version</span>
                          </Group>
                        </Table.Th>

                        <Table.Th className="flex justify-end">Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>

                    <Table.Tbody>
                      {productsListRecords.map((p) => (
                        <Table.Tr key={p.id}>
                          <Table.Td>{p.productName}</Table.Td>
                          <Table.Td>{p.productSku}</Table.Td>
                          <Table.Td>{p.productPriceCents}</Table.Td>
                          <Table.Td>
                            <Text size="sm">
                              {new Date(p.createdAt).toLocaleString()}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">
                              {new Date(p.updatedAt).toLocaleString()}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge>{p.entityVersion}</Badge>
                          </Table.Td>
                          <Table.Td className="flex justify-end">
                            <Group gap="xs">
                              <ActionIcon
                                variant="light"
                                size="md"
                                onClick={() => navigate(`/${tenantSlug}/products/${p.id}`)}
                                disabled={!canWriteProducts}
                                title="Edit product"
                              >
                                <IconPencil size={16} />
                              </ActionIcon>
                              <ActionIcon
                                variant="light"
                                color="red"
                                size="md"
                                onClick={() => handleDeleteProduct(p.id)}
                                disabled={!canWriteProducts}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </div>

              {/* Pagination (right) with range */}
              <Group justify="space-between" mt="md">
                <Text id={RANGE_ID} size="sm" c="dimmed" aria-live="polite" aria-atomic="true">
                  {rangeText}
                </Text>
                <Group gap="xs">
                  <Button
                    variant="light"
                    leftSection={<IconPlayerTrackPrev size={16} />}
                    onClick={goPrevPage}
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
    </div>
  );
}
