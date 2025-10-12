// admin-web/src/pages/StockTransfersPage.tsx
import { useEffect, useState, useMemo } from "react";
import {
  useParams,
  useNavigate,
  useSearchParams,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import {
  Button,
  Group,
  Table,
  Title,
  Paper,
  Badge,
  Loader,
  Text,
  Tabs,
  Stack,
  ActionIcon,
  Tooltip,
  Box,
  NumberInput,
  TextInput,
  rem,
  CloseButton,
  Grid,
  useMantineTheme,
  useComputedColorScheme,
  Collapse,
} from "@mantine/core";
import {
  IconRefresh,
  IconPlus,
  IconArrowRight,
  IconEye,
  IconCircleCheck,
  IconX,
  IconBan,
  IconFilter,
  IconChevronDown,
  IconChevronUp,
  IconLink,
  IconArrowsSort,
  IconArrowUp,
  IconArrowDown,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
} from "@tabler/icons-react";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { listStockTransfersApiRequest } from "../api/stockTransfers";
import type { StockTransfer } from "../api/stockTransfers";
import { handlePageError } from "../utils/pageError";
import { useAuthStore } from "../stores/auth";
import CreateTransferModal from "../components/stockTransfers/CreateTransferModal";
import { FilterBar } from "../components/common/FilterBar";
import { buildCommonDatePresets } from "../utils/datePresets";

type TransferStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "IN_TRANSIT"
  | "PARTIALLY_RECEIVED"
  | "COMPLETED"
  | "CANCELLED";

type SortField = "requestedAt" | "updatedAt" | "transferNumber" | "status";
type SortDir = "asc" | "desc";

type TransferFilters = {
  q: string; // Transfer number search
  status: string; // Status filter
  requestedAtFrom: string | null;
  requestedAtTo: string | null;
  shippedAtFrom: string | null;
  shippedAtTo: string | null;
};

const emptyTransferFilters: TransferFilters = {
  q: "",
  status: "all",
  requestedAtFrom: null,
  requestedAtTo: null,
  shippedAtFrom: null,
  shippedAtTo: null,
};

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "REQUESTED", label: "Requested" },
  { value: "APPROVED", label: "Approved" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "PARTIALLY_RECEIVED", label: "Partially Received" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

function getStatusColor(status: TransferStatus): string {
  switch (status) {
    case "REQUESTED":
      return "yellow";
    case "APPROVED":
      return "blue";
    case "IN_TRANSIT":
      return "cyan";
    case "PARTIALLY_RECEIVED":
      return "grape";
    case "COMPLETED":
      return "green";
    case "REJECTED":
      return "red";
    case "CANCELLED":
      return "gray";
    default:
      return "gray";
  }
}

export default function StockTransfersPage() {
  const FILTER_PANEL_ID = "stock-transfers-filter-panel";
  const TABLE_ID = "stock-transfers-table";
  const RANGE_ID = "stock-transfers-range";

  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigationType = useNavigationType();
  const location = useLocation();

  const theme = useMantineTheme();
  const colorScheme = useComputedColorScheme('light');

  const canWriteStock = useAuthStore((s) => s.hasPerm("stock:write"));
  const branchMemberships = useAuthStore((s) => s.branchMembershipsCurrentTenant);

  // Data & paging state
  const [isLoading, setIsLoading] = useState(false);
  const [transfers, setTransfers] = useState<StockTransfer[] | null>(null);
  const [errorForBoundary, setErrorForBoundary] = useState<
    (Error & { httpStatusCode?: number; correlationId?: string }) | null
  >(null);

  // Cursor pagination state
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [isPaginating, setIsPaginating] = useState(false);

  // Totals
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Query controls
  const [direction, setDirection] = useState<"inbound" | "outbound">("inbound");
  const [showFilters, setShowFilters] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(true);
  const [limit, setLimit] = useState<number>(20);
  const [sortBy, setSortBy] = useState<SortField>("requestedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Filters
  const [appliedFilters, setAppliedFilters] = useState<TransferFilters>(emptyTransferFilters);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);

  if (errorForBoundary) throw errorForBoundary;

  function applyAndFetch(values: TransferFilters) {
    setAppliedFilters(values);
    setUrlFromState({
      cursorId: null,
      q: values.q.trim() || null,
      status: values.status === "all" ? null : values.status,
      requestedAtFrom: values.requestedAtFrom ?? null,
      requestedAtTo: values.requestedAtTo ?? null,
      shippedAtFrom: values.shippedAtFrom ?? null,
      shippedAtTo: values.shippedAtTo ?? null,
    });
    resetToFirstPageAndFetch({
      qOverride: values.q.trim() || null,
      statusOverride: values.status === "all" ? null : values.status,
      requestedFromOverride: values.requestedAtFrom ?? null,
      requestedToOverride: values.requestedAtTo ?? null,
      shippedFromOverride: values.shippedAtFrom ?? null,
      shippedToOverride: values.shippedAtTo ?? null,
    });
  }

  function clearAllFiltersAndFetch() {
    applyAndFetch(emptyTransferFilters);
  }

  function colAriaSort(field: SortField): "ascending" | "descending" | "none" {
    if (sortBy !== field) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  }

  function nextDir(dir: SortDir) {
    return dir === "asc" ? "desc" : "asc";
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
    direction?: "inbound" | "outbound";
    q?: string | null | undefined;
    status?: string | null | undefined;
    requestedAtFrom?: string | null | undefined;
    requestedAtTo?: string | null | undefined;
    shippedAtFrom?: string | null | undefined;
    shippedAtTo?: string | null | undefined;
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

    const statusVal =
      overrides?.status === undefined
        ? appliedFilters.status === "all"
          ? null
          : appliedFilters.status
        : overrides.status;

    const requestedFromVal =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "requestedAtFrom")
        ? overrides.requestedAtFrom
        : appliedFilters.requestedAtFrom;

    const requestedToVal =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "requestedAtTo")
        ? overrides.requestedAtTo
        : appliedFilters.requestedAtTo;

    const shippedFromVal =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "shippedAtFrom")
        ? overrides.shippedAtFrom
        : appliedFilters.shippedAtFrom;

    const shippedToVal =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "shippedAtTo")
        ? overrides.shippedAtTo
        : appliedFilters.shippedAtTo;

    put("limit", overrides?.limit ?? limit);
    put("sortBy", overrides?.sortBy ?? sortBy);
    put("sortDir", overrides?.sortDir ?? sortDir);
    put("direction", overrides?.direction ?? direction);
    put("q", qVal);
    put("status", statusVal);
    put("requestedAtFrom", requestedFromVal);
    put("requestedAtTo", requestedToVal);
    put("shippedAtFrom", shippedFromVal);
    put("shippedAtTo", shippedToVal);

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
    directionOverride?: "inbound" | "outbound";
    qOverride?: string | null | undefined;
    statusOverride?: string | null | undefined;
    requestedFromOverride?: string | null | undefined;
    requestedToOverride?: string | null | undefined;
    shippedFromOverride?: string | null | undefined;
    shippedToOverride?: string | null | undefined;
  }) {
    setIsLoading(true);
    try {
      const qParam =
        opts?.qOverride === undefined
          ? appliedFilters.q.trim() || undefined
          : opts.qOverride || undefined;

      const statusParam =
        opts?.statusOverride === undefined
          ? appliedFilters.status === "all"
            ? undefined
            : appliedFilters.status
          : opts.statusOverride || undefined;

      const requestedFromParam =
        opts?.requestedFromOverride === undefined
          ? appliedFilters.requestedAtFrom || undefined
          : opts.requestedFromOverride || undefined;

      const requestedToParam =
        opts?.requestedToOverride === undefined
          ? appliedFilters.requestedAtTo || undefined
          : opts.requestedToOverride || undefined;

      const shippedFromParam =
        opts?.shippedFromOverride === undefined
          ? appliedFilters.shippedAtFrom || undefined
          : opts.shippedFromOverride || undefined;

      const shippedToParam =
        opts?.shippedToOverride === undefined
          ? appliedFilters.shippedAtTo || undefined
          : opts.shippedToOverride || undefined;

      const response = await listStockTransfersApiRequest({
        limit: opts?.limitOverride ?? limit,
        cursor: opts?.cursorId ?? cursorStack[pageIndex] ?? undefined,
        direction: opts?.directionOverride ?? direction,
        q: qParam,
        status: statusParam,
        sortBy: opts?.sortByOverride ?? sortBy,
        sortDir: opts?.sortDirOverride ?? sortDir,
        requestedAtFrom: requestedFromParam,
        requestedAtTo: requestedToParam,
        shippedAtFrom: shippedFromParam,
        shippedAtTo: shippedToParam,
        includeTotal: opts?.includeTotal === true,
      });

      if (response.success) {
        const data = response.data;
        const items = data.items ?? [];
        const effectiveLimit = opts?.limitOverride ?? limit;

        setTransfers(items);

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
        const e = Object.assign(new Error("Failed to load transfers"), {
          httpStatusCode: 500,
        });
        setErrorForBoundary(e);
      }
    } catch (error: any) {
      setErrorForBoundary(handlePageError(error, { title: "Error" }));
    } finally {
      setIsLoading(false);
    }
  }

  function resetToFirstPageAndFetch(opts?: {
    sortByOverride?: SortField;
    sortDirOverride?: SortDir;
    limitOverride?: number;
    directionOverride?: "inbound" | "outbound";
    qOverride?: string | null | undefined;
    statusOverride?: string | null | undefined;
    requestedFromOverride?: string | null | undefined;
    requestedToOverride?: string | null | undefined;
    shippedFromOverride?: string | null | undefined;
    shippedToOverride?: string | null | undefined;
  }) {
    setCursorStack([null]);
    setPageIndex(0);
    setUrlFromState({
      cursorId: null,
      page: 1,
      limit: opts?.limitOverride,
      sortBy: opts?.sortByOverride,
      sortDir: opts?.sortDirOverride,
      direction: opts?.directionOverride,
      q: opts?.qOverride,
      status: opts?.statusOverride,
      requestedAtFrom: opts?.requestedFromOverride,
      requestedAtTo: opts?.requestedToOverride,
      shippedAtFrom: opts?.shippedFromOverride,
      shippedAtTo: opts?.shippedToOverride,
    });
    void fetchPageWith({
      includeTotal: true,
      cursorId: null,
      ...opts,
    });
  }

  // Initial load / when tenant changes
  useEffect(() => {
    setTransfers(null);
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
    const qpDirection = searchParams.get("direction") as "inbound" | "outbound" | null;
    const qpQ = searchParams.get("q");
    const qpStatus = searchParams.get("status");
    const qpRequestedFrom = searchParams.get("requestedAtFrom");
    const qpRequestedTo = searchParams.get("requestedAtTo");
    const qpShippedFrom = searchParams.get("shippedAtFrom");
    const qpShippedTo = searchParams.get("shippedAtTo");
    const qpCursor = searchParams.get("cursorId");

    if (!Number.isNaN(qpLimit) && qpLimit)
      setLimit(Math.max(1, Math.min(100, qpLimit)));
    if (qpSortBy) setSortBy(qpSortBy);
    if (qpSortDir) setSortDir(qpSortDir);
    if (qpDirection) setDirection(qpDirection);

    setAppliedFilters({
      q: qpQ ?? "",
      status: qpStatus ?? "all",
      requestedAtFrom: qpRequestedFrom ?? null,
      requestedAtTo: qpRequestedTo ?? null,
      shippedAtFrom: qpShippedFrom ?? null,
      shippedAtTo: qpShippedTo ?? null,
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
      directionOverride: qpDirection ?? undefined,
      qOverride: qpQ ?? undefined,
      statusOverride: qpStatus ?? undefined,
      requestedFromOverride: qpRequestedFrom ?? undefined,
      requestedToOverride: qpRequestedTo ?? undefined,
      shippedFromOverride: qpShippedFrom ?? undefined,
      shippedToOverride: qpShippedTo ?? undefined,
    });
  }, [tenantSlug]);

  // Back/forward support
  useEffect(() => {
    if (navigationType !== "POP") return;

    const sp = new URLSearchParams(location.search);

    const qpLimit = Number(sp.get("limit"));
    const qpSortBy = sp.get("sortBy") as SortField | null;
    const qpSortDir = sp.get("sortDir") as SortDir | null;
    const qpDirection = sp.get("direction") as "inbound" | "outbound" | null;
    const qpQ = sp.get("q");
    const qpStatus = sp.get("status");
    const qpRequestedFrom = sp.get("requestedAtFrom");
    const qpRequestedTo = sp.get("requestedAtTo");
    const qpShippedFrom = sp.get("shippedAtFrom");
    const qpShippedTo = sp.get("shippedAtTo");
    const qpCursor = sp.get("cursorId");
    const qpPage = Number(sp.get("page") ?? "1");
    const newPageIndex = Number.isFinite(qpPage) && qpPage > 0 ? qpPage - 1 : 0;

    if (!Number.isNaN(qpLimit) && qpLimit)
      setLimit(Math.max(1, Math.min(100, qpLimit)));
    if (qpSortBy) setSortBy(qpSortBy);
    if (qpSortDir) setSortDir(qpSortDir);
    if (qpDirection) setDirection(qpDirection);

    setAppliedFilters({
      q: qpQ ?? "",
      status: qpStatus ?? "all",
      requestedAtFrom: qpRequestedFrom ?? null,
      requestedAtTo: qpRequestedTo ?? null,
      shippedAtFrom: qpShippedFrom ?? null,
      shippedAtTo: qpShippedTo ?? null,
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
      directionOverride: qpDirection ?? undefined,
      qOverride: qpQ ?? undefined,
      statusOverride: qpStatus ?? undefined,
      requestedFromOverride: qpRequestedFrom ?? undefined,
      requestedToOverride: qpRequestedTo ?? undefined,
      shippedFromOverride: qpShippedFrom ?? undefined,
      shippedToOverride: qpShippedTo ?? undefined,
    });
  }, [location.key, navigationType, tenantSlug]);

  // Sorting
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

  // Pagination
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
  const shownCount = transfers?.length ?? 0;
  const rangeStart = shownCount ? pageIndex * limit + 1 : 0;
  const rangeEnd = shownCount ? rangeStart + shownCount - 1 : 0;
  const rangeText =
    shownCount === 0
      ? "No results"
      : `Showing ${rangeStart}–${rangeEnd}${
          totalCount != null ? ` of ${totalCount}` : ""
        }`;

  function handleRowClick(transferId: string) {
    navigate(`/${tenantSlug}/stock-transfers/${transferId}`);
  }

  function handleCreateSuccess() {
    setCreateModalOpen(false);
    notifications.show({
      color: "green",
      message: "Transfer request created successfully",
    });
    resetToFirstPageAndFetch();
  }

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
    const chips: { key: keyof TransferFilters; label: string }[] = [];
    if (appliedFilters.q.trim())
      chips.push({ key: "q", label: `search: "${appliedFilters.q.trim()}"` });
    if (appliedFilters.status !== "all")
      chips.push({ key: "status", label: `status: ${appliedFilters.status}` });
    if (appliedFilters.requestedAtFrom)
      chips.push({
        key: "requestedAtFrom",
        label: `requested ≥ ${appliedFilters.requestedAtFrom}`,
      });
    if (appliedFilters.requestedAtTo)
      chips.push({
        key: "requestedAtTo",
        label: `requested ≤ ${appliedFilters.requestedAtTo}`,
      });
    if (appliedFilters.shippedAtFrom)
      chips.push({
        key: "shippedAtFrom",
        label: `shipped ≥ ${appliedFilters.shippedAtFrom}`,
      });
    if (appliedFilters.shippedAtTo)
      chips.push({
        key: "shippedAtTo",
        label: `shipped ≤ ${appliedFilters.shippedAtTo}`,
      });
    return chips;
  }, [appliedFilters]);

  function clearOneChip(key: keyof TransferFilters) {
    const defaults: TransferFilters = {
      ...appliedFilters,
      q: key === "q" ? "" : appliedFilters.q,
      status: key === "status" ? "all" : appliedFilters.status,
      requestedAtFrom:
        key === "requestedAtFrom" ? null : appliedFilters.requestedAtFrom,
      requestedAtTo: key === "requestedAtTo" ? null : appliedFilters.requestedAtTo,
      shippedAtFrom: key === "shippedAtFrom" ? null : appliedFilters.shippedAtFrom,
      shippedAtTo: key === "shippedAtTo" ? null : appliedFilters.shippedAtTo,
    };
    applyAndFetch(defaults);
  }

  function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
    if (!active) return <IconArrowsSort size={16} />;
    return dir === "asc" ? <IconArrowUp size={16} /> : <IconArrowDown size={16} />;
  }

  return (
    <div>
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="start">
          <div>
            <Title order={3}>Stock Transfers</Title>
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
              rightSection={
                showFilters ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />
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
              leftSection={<IconPlus size={16} />}
              onClick={() => setCreateModalOpen(true)}
              disabled={!canWriteStock || branchMemberships.length === 0}
            >
              New Transfer Request
            </Button>
          </Group>
        </Group>

        {/* Transfer Flow Diagram */}
        <Paper
          withBorder
          p="lg"
          radius="md"
          style={{
            backgroundColor:
              colorScheme === 'dark'
                ? theme.colors.dark[6]
                : theme.colors.gray[0],
          }}
        >
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={600} c="dimmed">
                Transfer Workflow
              </Text>
              <Button
                variant="subtle"
                size="xs"
                onClick={() => setShowWorkflow((s) => !s)}
                rightSection={
                  showWorkflow ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                }
              >
                {showWorkflow ? "Hide" : "Show"}
              </Button>
            </Group>

            <Collapse in={showWorkflow}>
              <Box>
              <Group gap="xs" wrap="nowrap" align="center">
                <Tooltip
                  label="Initial request created by destination branch"
                  multiline
                  w={220}
                >
                  <Badge color="yellow" variant="filled" size="lg" style={{ cursor: "help" }}>
                    REQUESTED
                  </Badge>
                </Tooltip>
                <IconArrowRight size={16} color="gray" />

                <Box>
                  <Group gap={4} wrap="nowrap">
                    <Tooltip
                      label="Source branch approves and confirms quantities"
                      multiline
                      w={220}
                    >
                      <Badge color="blue" variant="filled" size="lg" style={{ cursor: "help" }}>
                        APPROVED
                      </Badge>
                    </Tooltip>
                    <Text size="xs" c="dimmed">
                      /
                    </Text>
                    <Tooltip
                      label="Source branch rejects the request (terminal state)"
                      multiline
                      w={220}
                    >
                      <Badge color="red" variant="filled" size="lg" style={{ cursor: "help" }}>
                        <Group gap={4} wrap="nowrap">
                          REJECTED <IconX size={12} />
                        </Group>
                      </Badge>
                    </Tooltip>
                  </Group>
                </Box>
                <IconArrowRight size={16} color="gray" />

                <Tooltip
                  label="Stock shipped from source branch (FIFO deduction applied)"
                  multiline
                  w={220}
                >
                  <Badge color="cyan" variant="filled" size="lg" style={{ cursor: "help" }}>
                    IN TRANSIT
                  </Badge>
                </Tooltip>
                <IconArrowRight size={16} color="gray" />

                <Box>
                  <Group gap={4} wrap="nowrap">
                    <Tooltip
                      label="Destination receives partial quantity (can receive multiple times)"
                      multiline
                      w={220}
                    >
                      <Badge color="grape" variant="filled" size="lg" style={{ cursor: "help" }}>
                        PARTIAL
                      </Badge>
                    </Tooltip>
                    <Text size="xs" c="dimmed">
                      /
                    </Text>
                    <Tooltip
                      label="All items received at destination branch (terminal state)"
                      multiline
                      w={220}
                    >
                      <Badge color="green" variant="filled" size="lg" style={{ cursor: "help" }}>
                        <Group gap={4} wrap="nowrap">
                          COMPLETED <IconCircleCheck size={12} />
                        </Group>
                      </Badge>
                    </Tooltip>
                  </Group>
                </Box>
              </Group>

              <Group gap="xs" mt="sm" align="center">
                <Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
                  Can be cancelled:
                </Text>
                <Tooltip
                  label="Transfer cancelled before completion (terminal state)"
                  multiline
                  w={220}
                >
                  <Badge color="gray" variant="light" size="md" style={{ cursor: "help" }}>
                    <Group gap={4} wrap="nowrap">
                      CANCELLED <IconBan size={12} />
                    </Group>
                  </Badge>
                </Tooltip>
                <Text size="xs" c="dimmed" style={{ fontStyle: "italic" }}>
                  from REQUESTED, APPROVED, or IN_TRANSIT states
                </Text>
              </Group>

              <Text size="xs" c="dimmed" mt="sm">
                <strong>Note:</strong> Stock is deducted from source when shipped (IN_TRANSIT) and
                added to destination when received (PARTIALLY_RECEIVED/COMPLETED). Terminal states
                (marked with icons) cannot be modified.
              </Text>
              </Box>
            </Collapse>
          </Stack>
        </Paper>

        {/* Collapsible Filters */}
        <FilterBar<TransferFilters>
          open={showFilters}
          panelId={FILTER_PANEL_ID}
          initialValues={appliedFilters}
          emptyValues={emptyTransferFilters}
          onApply={applyAndFetch}
          onClear={clearAllFiltersAndFetch}
        >
          {({ values, setValues }) => (
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <TextInput
                  label="Search Transfer Number"
                  placeholder="e.g. TRF-2025-001"
                  value={values.q}
                  onChange={(e) => {
                    const val = e.currentTarget.value;
                    setValues((prev) => ({ ...prev, q: val }));
                  }}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Text size="sm" fw={500} mb={4}>
                  Status
                </Text>
                <select
                  value={values.status}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, status: e.target.value }))
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #ced4da",
                  }}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <DatePickerInput
                  label="Requested from"
                  placeholder="Start date"
                  value={values.requestedAtFrom ? new Date(values.requestedAtFrom) : null}
                  onChange={(v) => {
                    const dateStr = v ? new Date(v).toISOString().split("T")[0] : null;
                    setValues((prev) => ({ ...prev, requestedAtFrom: dateStr }));
                  }}
                  popoverProps={{ withinPortal: true }}
                  presets={buildCommonDatePresets()}
                  clearable
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <DatePickerInput
                  label="Requested to"
                  placeholder="End date"
                  value={values.requestedAtTo ? new Date(values.requestedAtTo) : null}
                  onChange={(v) => {
                    const dateStr = v ? new Date(v).toISOString().split("T")[0] : null;
                    setValues((prev) => ({ ...prev, requestedAtTo: dateStr }));
                  }}
                  popoverProps={{ withinPortal: true }}
                  presets={buildCommonDatePresets()}
                  clearable
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <DatePickerInput
                  label="Shipped from"
                  placeholder="Start date"
                  value={values.shippedAtFrom ? new Date(values.shippedAtFrom) : null}
                  onChange={(v) => {
                    const dateStr = v ? new Date(v).toISOString().split("T")[0] : null;
                    setValues((prev) => ({ ...prev, shippedAtFrom: dateStr }));
                  }}
                  popoverProps={{ withinPortal: true }}
                  presets={buildCommonDatePresets()}
                  clearable
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <DatePickerInput
                  label="Shipped to"
                  placeholder="End date"
                  value={values.shippedAtTo ? new Date(values.shippedAtTo) : null}
                  onChange={(v) => {
                    const dateStr = v ? new Date(v).toISOString().split("T")[0] : null;
                    setValues((prev) => ({ ...prev, shippedAtTo: dateStr }));
                  }}
                  popoverProps={{ withinPortal: true }}
                  presets={buildCommonDatePresets()}
                  clearable
                />
              </Grid.Col>
            </Grid>
          )}
        </FilterBar>

        {/* Table + Controls */}
        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" mb="md">
            <Title order={4}>All Stock Transfers</Title>

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
                w={rem(90)}
              />
            </Group>
          </Group>

          {/* Direction Tabs */}
          <Tabs
            value={direction}
            onChange={(v) => {
              const newDir = v as "inbound" | "outbound";
              setDirection(newDir);
              resetToFirstPageAndFetch({ directionOverride: newDir });
            }}
            mb="md"
          >
            <Tabs.List>
              <Tabs.Tab value="inbound">Inbound (To My Branches)</Tabs.Tab>
              <Tabs.Tab value="outbound">Outbound (From My Branches)</Tabs.Tab>
            </Tabs.List>
          </Tabs>

          {transfers === null || isLoading ? (
            <div className="flex items-center justify-center p-8" role="status" aria-live="polite">
              <Loader />
              <Text ml="sm">Loading transfers…</Text>
            </div>
          ) : (
            <>
              <div className="max-h-[55vh] overflow-y-auto" aria-busy={isLoading}>
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

                {!isLoading && (transfers?.length ?? 0) === 0 ? (
                  <div
                    className="py-16 text-center"
                    role="region"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <Title order={4} mb="xs">
                      No transfers match your filters
                    </Title>
                    <Text c="dimmed" mb="md">
                      Try adjusting your filters or clear them to see all transfers.
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
                        <Table.Th scope="col" aria-sort={colAriaSort("transferNumber")}>
                          <Group gap={4} wrap="nowrap">
                            <span>Transfer #</span>
                            <Tooltip label="Sort by transfer number" withArrow>
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                onClick={() => applySort("transferNumber")}
                                aria-label={sortButtonLabel("transfer number", "transferNumber")}
                              >
                                <SortIcon active={sortBy === "transferNumber"} dir={sortDir} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Th>

                        <Table.Th scope="col">Branches</Table.Th>

                        <Table.Th scope="col" aria-sort={colAriaSort("status")}>
                          <Group gap={4} wrap="nowrap">
                            <span>Status</span>
                            <Tooltip label="Sort by status" withArrow>
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                onClick={() => applySort("status")}
                                aria-label={sortButtonLabel("status", "status")}
                              >
                                <SortIcon active={sortBy === "status"} dir={sortDir} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Th>

                        <Table.Th scope="col">Items</Table.Th>

                        <Table.Th scope="col" aria-sort={colAriaSort("requestedAt")}>
                          <Group gap={4} wrap="nowrap">
                            <span>Requested</span>
                            <Tooltip label="Sort by requested date" withArrow>
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                onClick={() => applySort("requestedAt")}
                                aria-label={sortButtonLabel("requested", "requestedAt")}
                              >
                                <SortIcon active={sortBy === "requestedAt"} dir={sortDir} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Th>

                        <Table.Th>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>

                    <Table.Tbody>
                      {transfers!.map((transfer) => {
                        const itemCount = transfer.items?.length ?? 0;
                        const totalQtyRequested =
                          transfer.items?.reduce((sum, item) => sum + item.qtyRequested, 0) ?? 0;

                        return (
                          <Table.Tr
                            key={transfer.id}
                            style={{ cursor: "pointer" }}
                            onClick={() => handleRowClick(transfer.id)}
                          >
                            <Table.Td>
                              <Text fw={500}>{transfer.transferNumber}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Group gap={4} wrap="nowrap">
                                <Text size="sm">
                                  {transfer.sourceBranch?.branchName ?? "Unknown"}
                                </Text>
                                <IconArrowRight size={14} />
                                <Text size="sm">
                                  {transfer.destinationBranch?.branchName ?? "Unknown"}
                                </Text>
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Badge color={getStatusColor(transfer.status)} variant="filled">
                                <Group gap={4} wrap="nowrap">
                                  {transfer.status.replace(/_/g, " ")}
                                  {transfer.status === "COMPLETED" && <IconCircleCheck size={12} />}
                                  {transfer.status === "REJECTED" && <IconX size={12} />}
                                  {transfer.status === "CANCELLED" && <IconBan size={12} />}
                                </Group>
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">
                                {itemCount} item{itemCount !== 1 ? "s" : ""} ({totalQtyRequested}{" "}
                                qty)
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">
                                {new Date(transfer.requestedAt).toLocaleDateString()}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Tooltip label="View details">
                                <ActionIcon
                                  variant="light"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowClick(transfer.id);
                                  }}
                                >
                                  <IconEye size={16} />
                                </ActionIcon>
                              </Tooltip>
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
      </Stack>

      {/* Create Transfer Modal */}
      <CreateTransferModal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
