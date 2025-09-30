// admin-web/src/pages/TenantUsersPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useLocation, useNavigationType } from "react-router-dom";
import {
  ActionIcon, Badge, Button, CloseButton, Group, Loader, Modal, NumberInput, Paper,
  PasswordInput, Select, Stack, Table, Text, TextInput, Title, rem, Tooltip, Grid
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  listTenantUsersApiRequest,
  createTenantUserApiRequest,
  updateTenantUserApiRequest,
  deleteTenantUserApiRequest,
} from "../api/tenantUsers";
import { handlePageError } from "../utils/pageError";
import { useAuthStore } from "../stores/auth";
import {
  IconPlus, IconPencil, IconTrash, IconRefresh, IconArrowsSort, IconArrowUp, IconArrowDown,
  IconFilter, IconChevronDown, IconChevronUp, IconPlayerTrackNext, IconPlayerTrackPrev, IconLink
} from "@tabler/icons-react";
import { FilterBar } from "../components/FilterBar";

type RoleName = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
type SortField = "createdAt" | "updatedAt" | "userEmailAddress" | "roleName";
type SortDir = "asc" | "desc";

type UserRow = {
  userId: string;
  userEmailAddress: string;
  roleName: RoleName;
  createdAt?: string;
  updatedAt?: string;
};

type UserFilters = {
  q: string;                    // email contains
  roleName: RoleName | "";
  createdAtFrom: string | null; // YYYY-MM-DD
  createdAtTo: string | null;
  updatedAtFrom: string | null;
  updatedAtTo: string | null;
};

const emptyUserFilters: UserFilters = {
  q: "",
  roleName: "",
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

  // perms
  const memberships = useAuthStore((s) => s.tenantMemberships);
  const isAdminOrOwner = useMemo(() => {
    const m = memberships.find((x) => x.tenantSlug === tenantSlug);
    return m?.roleName === "OWNER" || m?.roleName === "ADMIN";
  }, [memberships, tenantSlug]);

  // data state
  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [errorForBoundary, setErrorForBoundary] = useState<(Error & { httpStatusCode?: number; correlationId?: string }) | null>(null);

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
  const [appliedFilters, setAppliedFilters] = useState<UserFilters>(emptyUserFilters);

  // modals (keep your existing functionality)
  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<RoleName>("VIEWER");

  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<RoleName>("VIEWER");

  if (errorForBoundary) throw errorForBoundary;

  // helpers
  function nextDir(dir: SortDir) { return dir === "asc" ? "desc" : "asc"; }
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
    roleName?: RoleName | null | undefined;
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

    const roleVal =
      overrides?.roleName === undefined
        ? (appliedFilters.roleName || null)
        : (overrides.roleName || null);

    const createdFromVal =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "createdAtFrom")
        ? overrides.createdAtFrom
        : appliedFilters.createdAtFrom;

    const createdToVal =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "createdAtTo")
        ? overrides.createdAtTo
        : appliedFilters.createdAtTo;

    const updatedFromVal =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "updatedAtFrom")
        ? overrides.updatedAtFrom
        : appliedFilters.updatedAtFrom;

    const updatedToVal =
      overrides && Object.prototype.hasOwnProperty.call(overrides, "updatedAtTo")
        ? overrides.updatedAtTo
        : appliedFilters.updatedAtTo;

    put("limit", overrides?.limit ?? limit);
    put("sortBy", overrides?.sortBy ?? sortBy);
    put("sortDir", overrides?.sortDir ?? sortDir);
    put("q", qVal);
    put("roleName", roleVal);
    put("createdAtFrom", createdFromVal);
    put("createdAtTo", createdToVal);
    put("updatedAtFrom", updatedFromVal);
    put("updatedAtTo", updatedToVal);

    const cursor = overrides?.cursorId === undefined ? (cursorStack[pageIndex] ?? null) : overrides.cursorId;
    if (cursor) params.set("cursorId", cursor);

    const pageToWrite = overrides?.page ?? (pageIndex + 1);
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
    roleNameOverride?: RoleName | null | undefined;
    createdFromOverride?: string | null | undefined;
    createdToOverride?: string | null | undefined;
    updatedFromOverride?: string | null | undefined;
    updatedToOverride?: string | null | undefined;
  }) {
    setIsLoading(true);
    try {
      const qParam =
        opts?.qOverride === undefined ? (appliedFilters.q.trim() || undefined) : (opts.qOverride || undefined);

      const roleParam =
        opts?.roleNameOverride === undefined
          ? (appliedFilters.roleName || undefined)
          : (opts.roleNameOverride || undefined);

      const createdFromParam =
        opts?.createdFromOverride === undefined ? (appliedFilters.createdAtFrom || undefined) : (opts.createdFromOverride || undefined);
      const createdToParam =
        opts?.createdToOverride === undefined ? (appliedFilters.createdAtTo || undefined) : (opts.createdToOverride || undefined);

      const updatedFromParam =
        opts?.updatedFromOverride === undefined ? (appliedFilters.updatedAtFrom || undefined) : (opts.updatedFromOverride || undefined);
      const updatedToParam =
        opts?.updatedToOverride === undefined ? (appliedFilters.updatedAtTo || undefined) : (opts.updatedToOverride || undefined);

      const res = await listTenantUsersApiRequest({
        limit: opts?.limitOverride ?? limit,
        cursorId: opts?.cursorId ?? cursorStack[pageIndex] ?? undefined,
        q: qParam,
        roleName: roleParam as RoleName | undefined,
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
        setNextCursor(data.pageInfo.nextCursor ?? null);
        setHasNextPage(data.pageInfo.hasNextPage);
        if (opts?.includeTotal && typeof data.pageInfo.totalCount === "number") {
          setTotalCount(data.pageInfo.totalCount);
        }
      } else {
        const e = Object.assign(new Error("Failed to load users"), { httpStatusCode: 500 });
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
    roleNameOverride?: RoleName | null | undefined;
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
      roleName: opts?.roleNameOverride,
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
      roleName: values.roleName || null,
      createdAtFrom: values.createdAtFrom ?? null,
      createdAtTo: values.createdAtTo ?? null,
      updatedAtFrom: values.updatedAtFrom ?? null,
      updatedAtTo: values.updatedAtTo ?? null,
    });
    resetToFirstPageAndFetch({
      qOverride: values.q.trim() || null,
      roleNameOverride: values.roleName || null,
      createdFromOverride: values.createdAtFrom ?? null,
      createdToOverride: values.createdAtTo ?? null,
      updatedFromOverride: values.updatedAtFrom ?? null,
      updatedToOverride: values.updatedAtTo ?? null,
    });
  }
  function clearAllFiltersAndFetch() {
    applyAndFetch(emptyUserFilters);
  }

  // initial load / tenant change
  useEffect(() => {
    setRows(null);
    setHasNextPage(false);
    setNextCursor(null);
    setTotalCount(null);
    setErrorForBoundary(null);

    const qpPage = Number(searchParams.get("page") ?? "1");
    const initialPageIndex = Number.isFinite(qpPage) && qpPage > 0 ? qpPage - 1 : 0;

    const qpLimit = Number(searchParams.get("limit"));
    const qpSortBy = searchParams.get("sortBy") as SortField | null;
    const qpSortDir = searchParams.get("sortDir") as SortDir | null;
    const qpQ = searchParams.get("q");
    const qpRole = searchParams.get("roleName") as RoleName | null;
    const qpCreatedFrom = searchParams.get("createdAtFrom");
    const qpCreatedTo = searchParams.get("createdAtTo");
    const qpUpdatedFrom = searchParams.get("updatedAtFrom");
    const qpUpdatedTo = searchParams.get("updatedAtTo");
    const qpCursor = searchParams.get("cursorId");

    if (!Number.isNaN(qpLimit) && qpLimit) setLimit(Math.max(1, Math.min(100, qpLimit)));
    if (qpSortBy) setSortBy(qpSortBy);
    if (qpSortDir) setSortDir(qpSortDir);

    setAppliedFilters({
      q: qpQ ?? "",
      roleName: (qpRole as RoleName) ?? "",
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
      limitOverride: !Number.isNaN(qpLimit) && qpLimit ? Math.max(1, Math.min(100, qpLimit)) : undefined,
      qOverride: qpQ ?? undefined,
      roleNameOverride: (qpRole as RoleName | null) ?? undefined,
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
    const qpRole = sp.get("roleName") as RoleName | null;
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
      roleName: (qpRole as RoleName) ?? "",
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
      limitOverride: !Number.isNaN(qpLimit) && qpLimit ? Math.max(1, Math.min(100, qpLimit)) : undefined,
      qOverride: qpQ ?? undefined,
      roleNameOverride: (qpRole as RoleName | null) ?? undefined,
      createdFromOverride: qpCreatedFrom ?? undefined,
      createdToOverride: qpCreatedTo ?? undefined,
      updatedFromOverride: qpUpdatedFrom ?? undefined,
      updatedToOverride: qpUpdatedTo ?? undefined,
    });
  }, [location.key, navigationType, tenantSlug]);  

  // sorting
  function applySort(nextField: SortField) {
    const next = sortBy === nextField ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    setSortBy(nextField);
    setSortDir(next);
    resetToFirstPageAndFetch({ sortByOverride: nextField, sortDirOverride: next });
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
      setTimeout(() => void fetchPageWith(), 0);
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
      setTimeout(() => void fetchPageWith(), 0);
    } finally {
      setIsPaginating(false);
    }
  }

  // range text
  const shownCount = rows?.length ?? 0;
  const rangeStart = shownCount ? pageIndex * limit + 1 : 0;
  const rangeEnd = shownCount ? rangeStart + shownCount - 1 : 0;
  const rangeText =
    shownCount === 0 ? "No results" : `Showing ${rangeStart}–${rangeEnd}${totalCount != null ? ` of ${totalCount}` : ""}`;

  async function handleCreate() {
    if (!createEmail || !createPassword) {
      notifications.show({ color: "red", message: "Email and password are required" });
      return;
    }
    try {
      const res = await createTenantUserApiRequest({
        email: createEmail,
        password: createPassword,
        roleName: createRole,
        idempotencyKeyOptional: `create-${Date.now()}`,
      });
      if (res.success) {
        notifications.show({ color: "green", message: "User added to tenant" });
        setCreateOpen(false);
        setCreateEmail("");
        setCreatePassword("");
        setCreateRole("VIEWER");
        resetToFirstPageAndFetch();
      }
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message ?? "Create failed" });
    }
  }
  async function handleEdit() {
    if (!editUserId) return;
    try {
      const res = await updateTenantUserApiRequest({
        userId: editUserId,
        ...(editEmail && { email: editEmail }),
        ...(editPassword && { password: editPassword }),
        ...(editRole && { roleName: editRole }),
        idempotencyKeyOptional: `update-${editUserId}-${Date.now()}`,
      });
      if (res.success) {
        notifications.show({ color: "green", message: "User updated" });
        setEditOpen(false);
        resetToFirstPageAndFetch();
      }
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message ?? "Update failed" });
    }
  }
  async function handleDelete(userId: string) {
    try {
      const res = await deleteTenantUserApiRequest({
        userId,
        idempotencyKeyOptional: `delete-${userId}-${Date.now()}`,
      });
      if (res.success) {
        notifications.show({ color: "green", message: "User removed from tenant" });
        resetToFirstPageAndFetch();
      }
    } catch (e: any) {
      notifications.show({ color: "red", message: e?.message ?? "Delete failed" });
    }
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
    const chips: { key: keyof UserFilters; label: string }[] = [];
    if (appliedFilters.q.trim()) chips.push({ key: "q", label: `search: "${appliedFilters.q.trim()}"` });
    if (appliedFilters.roleName) chips.push({ key: "roleName", label: `role: ${appliedFilters.roleName}` });
    if (appliedFilters.createdAtFrom) chips.push({ key: "createdAtFrom", label: `created ≥ ${appliedFilters.createdAtFrom}` });
    if (appliedFilters.createdAtTo) chips.push({ key: "createdAtTo", label: `created ≤ ${appliedFilters.createdAtTo}` });
    if (appliedFilters.updatedAtFrom) chips.push({ key: "updatedAtFrom", label: `updated ≥ ${appliedFilters.updatedAtFrom}` });
    if (appliedFilters.updatedAtTo) chips.push({ key: "updatedAtTo", label: `updated ≤ ${appliedFilters.updatedAtTo}` });
    return chips;
  }, [appliedFilters]);

  function clearOneChip(key: keyof UserFilters) {
    const next: UserFilters = {
      ...appliedFilters,
      q: key === "q" ? "" : appliedFilters.q,
      roleName: key === "roleName" ? "" as const : appliedFilters.roleName,
      createdAtFrom: key === "createdAtFrom" ? null : appliedFilters.createdAtFrom,
      createdAtTo: key === "createdAtTo" ? null : appliedFilters.createdAtTo,
      updatedAtFrom: key === "updatedAtFrom" ? null : appliedFilters.updatedAtFrom,
      updatedAtTo: key === "updatedAtTo" ? null : appliedFilters.updatedAtTo,
    };
    applyAndFetch(next);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start w-full">
        <Group justify="space-between" align="flex-end" className="w-full">
          <Stack gap="xs">
            <Title order={3}>All Users</Title>
            <Text size="sm" c="dimmed" id={RANGE_ID} aria-live="polite" aria-atomic="true">
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

            <Button
              leftSection={<IconPlus size={16} />}
              title="Add user"
              onClick={() => setCreateOpen(true)}
              disabled={!isAdminOrOwner}
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
                  setValues((prev) => ({ ...prev, q: val }))
                }}
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Select
                label="Role"
                placeholder="Any role"
                value={values.roleName || null}
                onChange={(v) =>
                  setValues((prev) => ({
                    ...prev,
                    roleName: (v as RoleName) ?? "",
                  }))
                }
                data={["OWNER", "ADMIN", "EDITOR", "VIEWER"]}
                clearable
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
                clearable
              />
            </Grid.Col>
          </Grid>
        )}
      </FilterBar>


      {/* Table + Controls */}
      <div className="py-4">
        <Paper withBorder p="md" radius="md" className="bg-white max-h-[80vh] overflow-y-auto">
          <Group justify="space-between" mb="md">
            <Title order={4}>All Users</Title>

            <Group align="center" gap="xs">
              <Text size="sm" c="dimmed">Per page</Text>
              <NumberInput
                value={limit}
                onChange={(v) => {
                  const n = typeof v === "number" ? v : v === "" ? 20 : Number(v);
                  const clamped = Math.max(1, Math.min(100, n));
                  setLimit(clamped);
                  resetToFirstPageAndFetch({ limitOverride: clamped });
                }}
                min={1} max={100} step={1} clampBehavior="strict" w={rem(90)}
              />
            </Group>
          </Group>

          {rows === null || isLoading ? (
            <div className="flex items-center justify-center p-8" role="status" aria-live="polite">
              <Loader />
              <Text ml="sm">Loading users…</Text>
            </div>
          ) : (
            <>
              {/* Chips */}
              {activeFilterChips.length > 0 && (
                <Group gap="xs" mb="sm" wrap="wrap" role="region" aria-label="Active filters">
                  {activeFilterChips.map((chip) => (
                    <Badge
                      key={chip.key as string}
                      variant="light"
                      rightSection={
                        <CloseButton
                          aria-label={`Clear ${chip.label}`}
                          onClick={(e) => { e.stopPropagation(); clearOneChip(chip.key); }}
                        />
                      }
                    >
                      {chip.label}
                    </Badge>
                  ))}
                  <Button variant="subtle" size="xs" onClick={clearAllFiltersAndFetch} aria-label="Clear all filters">
                    Clear all
                  </Button>
                </Group>
              )}

              {/* Empty state */}
              {!isLoading && (rows?.length ?? 0) === 0 ? (
                <div className="py-16 text-center" role="region" aria-live="polite" aria-atomic="true">
                  <Title order={4} mb="xs">No users match your filters</Title>
                  <Text c="dimmed" mb="md">Try adjusting your filters or clear them to see all users.</Text>
                  <Group justify="center">
                    <Button onClick={clearAllFiltersAndFetch}>Clear all filters</Button>
                    <Button variant="light" onClick={() => setShowFilters(true)} aria-controls={FILTER_PANEL_ID} aria-expanded={showFilters}>
                      Show filters
                    </Button>
                  </Group>
                </div>
              ) : (
                <Table id={TABLE_ID} striped withTableBorder withColumnBorders stickyHeader aria-describedby={RANGE_ID}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th scope="col" aria-sort={colAriaSort("userEmailAddress")}>
                        <Group gap={4} wrap="nowrap">
                          <span>Email</span>
                          <Tooltip label="Sort by email" withArrow>
                            <ActionIcon
                              variant="subtle" size="sm"
                              onClick={() => applySort("userEmailAddress")}
                              aria-label={sortButtonLabel("email", "userEmailAddress")}
                            >
                              {sortBy === "userEmailAddress" ? (sortDir === "asc" ? <IconArrowUp size={16} /> : <IconArrowDown size={16} />) : <IconArrowsSort size={16} />}
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Th>

                      <Table.Th scope="col" aria-sort={colAriaSort("roleName")}>
                        <Group gap={4} wrap="nowrap">
                          <span>Role</span>
                          <Tooltip label="Sort by role" withArrow>
                            <ActionIcon
                              variant="subtle" size="sm"
                              onClick={() => applySort("roleName")}
                              aria-label={sortButtonLabel("role", "roleName")}
                            >
                              {sortBy === "roleName" ? (sortDir === "asc" ? <IconArrowUp size={16} /> : <IconArrowDown size={16} />) : <IconArrowsSort size={16} />}
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Th>

                      <Table.Th scope="col" aria-sort={colAriaSort("createdAt")}>
                        <Group gap={4} wrap="nowrap">
                          <span>Created</span>
                          <Tooltip label="Sort by created date" withArrow>
                            <ActionIcon
                              variant="subtle" size="sm"
                              onClick={() => applySort("createdAt")}
                              aria-label={sortButtonLabel("created", "createdAt")}
                            >
                              {sortBy === "createdAt" ? (sortDir === "asc" ? <IconArrowUp size={16} /> : <IconArrowDown size={16} />) : <IconArrowsSort size={16} />}
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Th>

                      <Table.Th scope="col" aria-sort={colAriaSort("updatedAt")}>
                        <Group gap={4} wrap="nowrap">
                          <span>Updated</span>
                          <Tooltip label="Sort by updated date" withArrow>
                            <ActionIcon
                              variant="subtle" size="sm"
                              onClick={() => applySort("updatedAt")}
                              aria-label={sortButtonLabel("updated", "updatedAt")}
                            >
                              {sortBy === "updatedAt" ? (sortDir === "asc" ? <IconArrowUp size={16} /> : <IconArrowDown size={16} />) : <IconArrowsSort size={16} />}
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
                        <Table.Td>{r.userEmailAddress}</Table.Td>
                        <Table.Td><Badge>{r.roleName}</Badge></Table.Td>
                        <Table.Td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}</Table.Td>
                        <Table.Td>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "—"}</Table.Td>
                        <Table.Td className="flex justify-end">
                          <Group gap="xs">
                            <ActionIcon
                                variant="light"
                                size="md"
                                onClick={() => console.log('open edit product')}
                                disabled={!isAdminOrOwner}
                              >
                                <IconPencil size={16} />
                              </ActionIcon>
                              <ActionIcon
                                variant="light"
                                color="red"
                                size="md"
                                onClick={() => handleDelete(r.userId)}
                                disabled={!isAdminOrOwner}
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

              {/* Pagination */}
              <Group justify="space-between" mt="md">
                <Text size="sm" c="dimmed" id={RANGE_ID} aria-live="polite" aria-atomic="true">
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
                  <Text size="sm" c="dimmed">Page {pageIndex + 1}</Text>
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

      {/* Create modal */}
      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Add user to tenant">
        <Stack>
          <TextInput label="Email" value={createEmail} onChange={(e) => setCreateEmail(e.currentTarget.value)} />
          <PasswordInput label="Temporary password" value={createPassword} onChange={(e) => setCreatePassword(e.currentTarget.value)} />
          <Select label="Role" value={createRole} onChange={(v) => setCreateRole((v as RoleName) ?? "VIEWER")} data={["OWNER","ADMIN","EDITOR","VIEWER"]} />
          <Group justify="flex-end"><Button onClick={handleCreate}>Create/Attach</Button></Group>
        </Stack>
      </Modal>

      {/* Edit modal */}
      <Modal opened={editOpen} onClose={() => setEditOpen(false)} title="Edit user/membership">
        <Stack>
          <Text size="sm">Leave password blank to keep the same.</Text>
          <TextInput label="Email" value={editEmail} onChange={(e) => setEditEmail(e.currentTarget.value)} />
          <PasswordInput label="New password" value={editPassword} onChange={(e) => setEditPassword(e.currentTarget.value)} />
          <Select label="Role" value={editRole} onChange={(v) => setEditRole((v as RoleName) ?? "VIEWER")} data={["OWNER","ADMIN","EDITOR","VIEWER"]} />
          <Group justify="flex-end"><Button onClick={handleEdit}>Save changes</Button></Group>
        </Stack>
      </Modal>
    </div>
  );
}
