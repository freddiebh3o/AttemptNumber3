// admin-web/src/pages/TenantUsersPage.tsx
import { useEffect, useState, useMemo } from "react";
import {
  useParams,
  useSearchParams,
  useLocation,
  useNavigationType,
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
  MultiSelect,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  listTenantUsersApiRequest,
} from "../api/tenantUsers";
import { listRolesApiRequest } from "../api/roles";
import { handlePageError } from "../utils/pageError";
import { useAuthStore } from "../stores/auth";
import {
  IconPlus,
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
  IconEye
} from "@tabler/icons-react";
import { FilterBar } from "../components/common/FilterBar";
import type { components } from "../types/openapi";
import { useNavigate } from "react-router-dom";
import { buildCommonDatePresets } from "../utils/datePresets";

type SortField = "createdAt" | "updatedAt" | "userEmailAddress" | "role";
type SortDir = "asc" | "desc";

type UserRow = components["schemas"]["TenantUserRecord"];

type UserFilters = {
  q: string; // email contains
  roleIds: string[];
  archivedFilter: "active-only" | "archived-only" | "all";
  createdAtFrom: Date | null;
  createdAtTo: Date | null;
  updatedAtFrom: Date | null;
  updatedAtTo: Date | null;
};

const emptyUserFilters: UserFilters = {
  q: "",
  roleIds: [],
  archivedFilter: "active-only",
  createdAtFrom: null,
  createdAtTo: null,
  updatedAtFrom: null,
  updatedAtTo: null,
};

export default function TenantUsersPage() {
  const FILTER_PANEL_ID = "tenant-users-filter-panel";
  const TABLE_ID = "tenant-users-table";
  const RANGE_ID = "tenant-users-range";

  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();

  const canManageUsers = useAuthStore((s) => s.hasPerm("users:manage"));

  // data state
  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [errorForBoundary, setErrorForBoundary] = useState<
    (Error & { httpStatusCode?: number; correlationId?: string }) | null
  >(null);

  // roles for multiselect
  const [availableRoles, setAvailableRoles] = useState<{ value: string; label: string }[]>([]);

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
    useState<UserFilters>(emptyUserFilters);

  if (errorForBoundary) throw errorForBoundary;

  // helpers
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
    roleIds?: string[] | null | undefined;
    archivedFilter?: "active-only" | "archived-only" | "all";
    createdAtFrom?: Date | null | undefined;
    createdAtTo?: Date | null | undefined;
    updatedAtFrom?: Date | null | undefined;
    updatedAtTo?: Date | null | undefined;
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

    const roleIdsVal =
      overrides?.roleIds === undefined
        ? appliedFilters.roleIds
        : overrides.roleIds ?? [];

    const archivedFilterVal =
      overrides?.archivedFilter === undefined
        ? appliedFilters.archivedFilter
        : overrides.archivedFilter;

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
    if (roleIdsVal.length > 0) put("roleIds", roleIdsVal.join(","));
    put("archivedFilter", archivedFilterVal);
    put("createdAtFrom", createdFromVal ? createdFromVal.toISOString().split('T')[0] : null);
    put("createdAtTo", createdToVal ? createdToVal.toISOString().split('T')[0] : null);
    put("updatedAtFrom", updatedFromVal ? updatedFromVal.toISOString().split('T')[0] : null);
    put("updatedAtTo", updatedToVal ? updatedToVal.toISOString().split('T')[0] : null);

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
    roleIdsOverride?: string[] | null | undefined;
    archivedFilterOverride?: "active-only" | "archived-only" | "all";
    createdFromOverride?: Date | null | undefined;
    createdToOverride?: Date | null | undefined;
    updatedFromOverride?: Date | null | undefined;
    updatedToOverride?: Date | null | undefined;
  }) {
    setIsLoading(true);
    try {
      const qParam =
        opts?.qOverride === undefined
          ? appliedFilters.q.trim() || undefined
          : opts.qOverride || undefined;

      const roleIdsParam =
        opts?.roleIdsOverride === undefined
          ? appliedFilters.roleIds.length > 0 ? appliedFilters.roleIds.join(",") : undefined
          : (opts.roleIdsOverride && opts.roleIdsOverride.length > 0) ? opts.roleIdsOverride.join(",") : undefined;

      const archivedFilterParam =
        opts?.archivedFilterOverride === undefined
          ? appliedFilters.archivedFilter
          : opts.archivedFilterOverride;

      const createdFromParam =
        opts?.createdFromOverride === undefined
          ? appliedFilters.createdAtFrom ? appliedFilters.createdAtFrom.toISOString().split('T')[0] : undefined
          : opts.createdFromOverride ? opts.createdFromOverride.toISOString().split('T')[0] : undefined;
      const createdToParam =
        opts?.createdToOverride === undefined
          ? appliedFilters.createdAtTo ? appliedFilters.createdAtTo.toISOString().split('T')[0] : undefined
          : opts.createdToOverride ? opts.createdToOverride.toISOString().split('T')[0] : undefined;

      const updatedFromParam =
        opts?.updatedFromOverride === undefined
          ? appliedFilters.updatedAtFrom ? appliedFilters.updatedAtFrom.toISOString().split('T')[0] : undefined
          : opts.updatedFromOverride ? opts.updatedFromOverride.toISOString().split('T')[0] : undefined;
      const updatedToParam =
        opts?.updatedToOverride === undefined
          ? appliedFilters.updatedAtTo ? appliedFilters.updatedAtTo.toISOString().split('T')[0] : undefined
          : opts.updatedToOverride ? opts.updatedToOverride.toISOString().split('T')[0] : undefined;

      const res = await listTenantUsersApiRequest({
        limit: opts?.limitOverride ?? limit,
        cursorId: opts?.cursorId ?? cursorStack[pageIndex] ?? undefined,
        q: qParam,
        roleIds: roleIdsParam,
        archivedFilter: archivedFilterParam,
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

        // Update rows first
        setRows(data.items);

        // Server flags
        const serverHasNext =
          Boolean(data.pageInfo.hasNextPage) &&
          Boolean(data.pageInfo.nextCursor);

        // Client-side guard: if we received fewer than we asked for, there is no next page
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
        const e = Object.assign(new Error("Failed to load users"), {
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
    roleIdsOverride?: string[] | null | undefined;
    archivedFilterOverride?: "active-only" | "archived-only" | "all";
    createdFromOverride?: Date | null | undefined;
    createdToOverride?: Date | null | undefined;
    updatedFromOverride?: Date | null | undefined;
    updatedToOverride?: Date | null | undefined;
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
      roleIds: opts?.roleIdsOverride,
      archivedFilter: opts?.archivedFilterOverride,
      createdAtFrom: opts?.createdFromOverride,
      createdAtTo: opts?.createdToOverride,
      updatedAtFrom: opts?.updatedFromOverride,
      updatedAtTo: opts?.updatedToOverride,
    });
    void fetchPageWith({ includeTotal: true, cursorId: null, ...opts });
  }

  function applyAndFetch(values: UserFilters) {
    setAppliedFilters(values);
    setUrlFromState({
      cursorId: null,
      q: values.q.trim() || null,
      roleIds: values.roleIds.length > 0 ? values.roleIds : null,
      archivedFilter: values.archivedFilter,
      createdAtFrom: values.createdAtFrom,
      createdAtTo: values.createdAtTo,
      updatedAtFrom: values.updatedAtFrom,
      updatedAtTo: values.updatedAtTo,
    });
    resetToFirstPageAndFetch({
      qOverride: values.q.trim() || null,
      roleIdsOverride: values.roleIds.length > 0 ? values.roleIds : null,
      archivedFilterOverride: values.archivedFilter,
      createdFromOverride: values.createdAtFrom,
      createdToOverride: values.createdAtTo,
      updatedFromOverride: values.updatedAtFrom,
      updatedToOverride: values.updatedAtTo,
    });
  }
  function clearAllFiltersAndFetch() {
    applyAndFetch(emptyUserFilters);
  }

  // Load available roles
  useEffect(() => {
    async function loadRoles() {
      try {
        const res = await listRolesApiRequest({ limit: 100 });
        if (res.success) {
          const roleOptions = res.data.items.map(role => ({
            value: role.id,
            label: role.name,
          }));
          setAvailableRoles(roleOptions);
        }
      } catch (err) {
        console.error('Failed to load roles:', err);
      }
    }
    void loadRoles();
  }, [tenantSlug]);

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
    const qpRoleIds = searchParams.get("roleIds")?.split(",").filter(Boolean) ?? [];
    const qpArchivedFilter = searchParams.get("archivedFilter") as "active-only" | "archived-only" | "all" | null;
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
      roleIds: qpRoleIds,
      archivedFilter: qpArchivedFilter ?? "active-only",
      createdAtFrom: qpCreatedFrom ? new Date(qpCreatedFrom) : null,
      createdAtTo: qpCreatedTo ? new Date(qpCreatedTo) : null,
      updatedAtFrom: qpUpdatedFrom ? new Date(qpUpdatedFrom) : null,
      updatedAtTo: qpUpdatedTo ? new Date(qpUpdatedTo) : null,
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
      roleIdsOverride: qpRoleIds.length > 0 ? qpRoleIds : undefined,
      archivedFilterOverride: qpArchivedFilter ?? undefined,
      createdFromOverride: qpCreatedFrom ? new Date(qpCreatedFrom) : undefined,
      createdToOverride: qpCreatedTo ? new Date(qpCreatedTo) : undefined,
      updatedFromOverride: qpUpdatedFrom ? new Date(qpUpdatedFrom) : undefined,
      updatedToOverride: qpUpdatedTo ? new Date(qpUpdatedTo) : undefined,
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
    const qpRoleIds = sp.get("roleIds")?.split(",").filter(Boolean) ?? [];
    const qpArchivedFilter = sp.get("archivedFilter") as "active-only" | "archived-only" | "all" | null;
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
      roleIds: qpRoleIds,
      archivedFilter: qpArchivedFilter ?? "active-only",
      createdAtFrom: qpCreatedFrom ? new Date(qpCreatedFrom) : null,
      createdAtTo: qpCreatedTo ? new Date(qpCreatedTo) : null,
      updatedAtFrom: qpUpdatedFrom ? new Date(qpUpdatedFrom) : null,
      updatedAtTo: qpUpdatedTo ? new Date(qpUpdatedTo) : null,
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
      roleIdsOverride: qpRoleIds.length > 0 ? qpRoleIds : undefined,
      archivedFilterOverride: qpArchivedFilter ?? undefined,
      createdFromOverride: qpCreatedFrom ? new Date(qpCreatedFrom) : undefined,
      createdToOverride: qpCreatedTo ? new Date(qpCreatedTo) : undefined,
      updatedFromOverride: qpUpdatedFrom ? new Date(qpUpdatedFrom) : undefined,
      updatedToOverride: qpUpdatedTo ? new Date(qpUpdatedTo) : undefined,
    });
  }, [location.key, navigationType, tenantSlug]);

  // sorting
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

  // pagination
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

  // range text
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
    const chips: { key: keyof UserFilters; label: string }[] = [];
    if (appliedFilters.q.trim())
      chips.push({ key: "q", label: `search: "${appliedFilters.q.trim()}"` });
    if (appliedFilters.roleIds.length > 0)
      chips.push({ key: "roleIds", label: `${appliedFilters.roleIds.length} role(s) selected` });
    if (appliedFilters.archivedFilter !== "active-only") {
      const label = appliedFilters.archivedFilter === "archived-only"
        ? "archived users only"
        : "all users (active + archived)";
      chips.push({ key: "archivedFilter", label });
    }
    if (appliedFilters.createdAtFrom)
      chips.push({
        key: "createdAtFrom",
        label: `created ≥ ${appliedFilters.createdAtFrom.toISOString().split('T')[0]}`,
      });
    if (appliedFilters.createdAtTo)
      chips.push({
        key: "createdAtTo",
        label: `created ≤ ${appliedFilters.createdAtTo.toISOString().split('T')[0]}`,
      });
    if (appliedFilters.updatedAtFrom)
      chips.push({
        key: "updatedAtFrom",
        label: `updated ≥ ${appliedFilters.updatedAtFrom.toISOString().split('T')[0]}`,
      });
    if (appliedFilters.updatedAtTo)
      chips.push({
        key: "updatedAtTo",
        label: `updated ≤ ${appliedFilters.updatedAtTo.toISOString().split('T')[0]}`,
      });
    return chips;
  }, [appliedFilters]);

  function clearOneChip(key: keyof UserFilters) {
    const next: UserFilters = {
      ...appliedFilters,
      q: key === "q" ? "" : appliedFilters.q,
      roleIds: key === "roleIds" ? [] : appliedFilters.roleIds,
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
            <Title order={3}>All Users</Title>
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
              title="Add user"
              onClick={() => navigate(`/${tenantSlug}/users/new`)}   // <-- changed
              disabled={!canManageUsers}
            >
              Add user
            </Button>
          </Group>
        </Group>
      </div>

      {/* Filters */}
      <FilterBar<UserFilters>
        open={showFilters}
        panelId={FILTER_PANEL_ID}
        initialValues={appliedFilters}
        emptyValues={emptyUserFilters}
        onApply={applyAndFetch}
        onClear={clearAllFiltersAndFetch}
      >
        {({ values, setValues }) => (
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <TextInput
                label="Search (email contains)"
                placeholder="e.g. ana@acme.com"
                value={values.q}
                onChange={(e) => {
                  const val = e.currentTarget.value;
                  setValues((prev) => ({ ...prev, q: val }));
                }}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <MultiSelect
                label="Roles"
                placeholder="Select roles..."
                data={availableRoles}
                value={values.roleIds}
                onChange={(roleIds) =>
                  setValues((prev) => ({
                    ...prev,
                    roleIds,
                  }))
                }
                searchable
                clearable
                data-testid="role-filter-multiselect"
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Select
                label="Show users"
                data={[
                  { value: 'active-only', label: 'Active users only' },
                  { value: 'archived-only', label: 'Archived users only' },
                  { value: 'all', label: 'All users (active + archived)' },
                ]}
                value={values.archivedFilter}
                onChange={(v) =>
                  setValues((prev) => ({
                    ...prev,
                    archivedFilter: v as 'active-only' | 'archived-only' | 'all',
                  }))
                }
                data-testid="archived-filter-select"
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <DatePickerInput
                label="Created from"
                placeholder="Start date"
                value={values.createdAtFrom}
                onChange={(v) =>
                  setValues({ ...values, createdAtFrom: v as Date | null })
                }
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
                  setValues({ ...values, createdAtTo: v as Date | null })
                }
                popoverProps={{ withinPortal: true }}
                presets={buildCommonDatePresets()}
                clearable
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <DatePickerInput
                label="Updated from"
                placeholder="Start date"
                value={values.updatedAtFrom}
                onChange={(v) =>
                  setValues({ ...values, updatedAtFrom: v as Date | null })
                }
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
                  setValues({ ...values, updatedAtTo: v as Date | null })
                }
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
          className="bg-white max-h-[80vh] overflow-y-auto"
        >
          <Group justify="space-between" mb="md">
            <Title order={4}>All Users</Title>

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
              <Text ml="sm">Loading users…</Text>
            </div>
          ) : (
            <>
              {/* Chips */}
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
                    No users match your filters
                  </Title>
                  <Text c="dimmed" mb="md">
                    Try adjusting your filters or clear them to see all users.
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
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th
                        scope="col"
                        aria-sort={colAriaSort("userEmailAddress")}
                      >
                        <Group gap={4} wrap="nowrap">
                          <span>Email</span>
                          <Tooltip label="Sort by email" withArrow>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              onClick={() => applySort("userEmailAddress")}
                              aria-label={sortButtonLabel(
                                "email",
                                "userEmailAddress"
                              )}
                            >
                              {sortBy === "userEmailAddress" ? (
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

                      <Table.Th scope="col" aria-sort={colAriaSort("role")}>
                        <Group gap={4} wrap="nowrap">
                          <span>Role</span>
                          <Tooltip label="Sort by role" withArrow>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              onClick={() => applySort("role")}
                              aria-label={sortButtonLabel("role", "role")}
                            >
                              {sortBy === "role" ? (
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

                      <Table.Th scope="col">Branches</Table.Th>

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

                      <Table.Th className="flex justify-end">Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>

                  <Table.Tbody>
                    {rows!.map((r) => (
                      <Table.Tr key={r.userId}>
                        <Table.Td>
                          <Group gap="xs">
                            {r.userEmailAddress}
                            {r.isArchived && (
                              <Badge color="gray" data-testid="archived-badge">
                                Archived
                              </Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td className="min-w-[90px]">
                          <Badge>{r.role?.name ?? "—"}</Badge>
                        </Table.Td>
                        <Table.Td className="min-w-[120px]">
                          {r.branches && r.branches.length > 0 ? (
                            <Group gap="xs" wrap="wrap">
                              {r.branches.map((b) => (
                                <Badge
                                  key={b.id}
                                  variant={b.isActive ? "light" : "outline"}
                                  color={b.isActive ? undefined : "gray"}
                                  title={b.isActive ? "Active branch" : "Inactive branch"}
                                >
                                  {b.branchName}
                                </Badge>
                              ))}
                            </Group>
                          ) : (
                            <Text c="dimmed">—</Text>
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
                        <Table.Td className="flex justify-end">
                          <ActionIcon
                            variant="light"
                            size="md"
                            onClick={() => navigate(`/${tenantSlug}/users/${r.userId}`)}
                            title="Edit user"
                          >
                            <IconEye size={16} />
                          </ActionIcon>
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
            </>
          )}
        </Paper>
      </div>
    </div>
  );
}
