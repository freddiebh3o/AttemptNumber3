// admin-web/src/pages/RolesPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  useSearchParams,
  useParams,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  NumberInput,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
  rem,
  Grid,
  CloseButton,
  Select,
  MultiSelect,
  SegmentedControl,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import {
  IconArrowsSort,
  IconArrowUp,
  IconArrowDown,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconPencil,
  IconFilter,
  IconChevronDown,
  IconChevronUp,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
  IconLink,
} from "@tabler/icons-react";
import {
  listRolesApiRequest,
  deleteRoleApiRequest,
  listPermissionsApiRequest,
  type PermissionRecord,
  type PermissionKey,
} from "../api/roles";
import type { components } from "../types/openapi";
import { FilterBar } from "../components/common/FilterBar";
import RoleUpsertModal from "../components/roles/RoleUpsertModal";

type RoleRecord = components["schemas"]["RoleRecord"];
type SortField = "name" | "createdAt" | "updatedAt" | "isSystem";
type SortDir = "asc" | "desc";

type RoleFilters = {
  q: string;
  name: string;
  isSystem: "" | "true" | "false";
  createdAtFrom: string | null;
  createdAtTo: string | null;
  updatedAtFrom: string | null;
  updatedAtTo: string | null;
  // NEW: permissions filter
  permissionKeys: PermissionKey[];
  permMatch: "any" | "all";
};

const emptyFilters: RoleFilters = {
  q: "",
  name: "",
  isSystem: "",
  createdAtFrom: null,
  createdAtTo: null,
  updatedAtFrom: null,
  updatedAtTo: null,
  permissionKeys: [],
  permMatch: "any",
};

export default function RolesPage() {
  const FILTER_PANEL_ID = "roles-filter-panel";
  const TABLE_ID = "roles-table";
  const RANGE_ID = "roles-range";

  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigationType = useNavigationType();

  // data
  const [rows, setRows] = useState<RoleRecord[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorForBoundary, setErrorForBoundary] = useState<
    (Error & { httpStatusCode?: number; correlationId?: string }) | null
  >(null);

  // permissions catalogue for multiselect
  const [permLoading, setPermLoading] = useState(false);
  const [permOptions, setPermOptions] = useState<PermissionRecord[]>([]);

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
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // filters
  const [appliedFilters, setAppliedFilters] =
    useState<RoleFilters>(emptyFilters);

  // modal (create/edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRecord | null>(null);

  if (errorForBoundary) throw errorForBoundary;

  const shownCount = rows?.length ?? 0;
  const rangeStart = shownCount ? pageIndex * limit + 1 : 0;
  const rangeEnd = shownCount ? rangeStart + shownCount - 1 : 0;
  const rangeText =
    shownCount === 0
      ? "No results"
      : `Showing ${rangeStart}–${rangeEnd}${
          totalCount != null ? ` of ${totalCount}` : ""
        }`;

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

  const permissionChoices = useMemo(
    () =>
      permOptions
        .slice()
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((p) => ({ value: p.key, label: `${p.key} — ${p.description}` })),
    [permOptions]
  );

  function setUrlFromState(
    over?: Partial<{
      cursorId: string | null;
      page: number;
      limit: number;
      sortBy: SortField;
      sortDir: SortDir;
      q: string | null;
      name: string | null;
      isSystem: "" | "true" | "false" | null;
      createdAtFrom: string | null;
      createdAtTo: string | null;
      updatedAtFrom: string | null;
      updatedAtTo: string | null;
      permissionKeys: PermissionKey[] | null;
      permMatch: "any" | "all" | null;
    }>
  ) {
    const p = new URLSearchParams();
    const put = (k: string, v: any) => {
      if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
    };

    const qVal =
      over?.q === undefined
        ? appliedFilters.q.trim() || null
        : over.q?.toString().trim() || null;
    const nameVal =
      over?.name === undefined
        ? appliedFilters.name.trim() || null
        : over.name?.toString().trim() || null;
    const sysVal =
      over?.isSystem === undefined
        ? appliedFilters.isSystem || null
        : over.isSystem || null;

    const createdFromVal =
      over && Object.prototype.hasOwnProperty.call(over, "createdAtFrom")
        ? over.createdAtFrom
        : appliedFilters.createdAtFrom;
    const createdToVal =
      over && Object.prototype.hasOwnProperty.call(over, "createdAtTo")
        ? over.createdAtTo
        : appliedFilters.createdAtTo;
    const updatedFromVal =
      over && Object.prototype.hasOwnProperty.call(over, "updatedAtFrom")
        ? over.updatedAtFrom
        : appliedFilters.updatedAtFrom;
    const updatedToVal =
      over && Object.prototype.hasOwnProperty.call(over, "updatedAtTo")
        ? over.updatedAtTo
        : appliedFilters.updatedAtTo;

    const permKeysVal =
      over && Object.prototype.hasOwnProperty.call(over, "permissionKeys")
        ? over.permissionKeys ?? []
        : appliedFilters.permissionKeys;
    const permMatchVal =
      over && Object.prototype.hasOwnProperty.call(over, "permMatch")
        ? over.permMatch ?? null
        : appliedFilters.permMatch ?? null;

    put("limit", over?.limit ?? limit);
    put("sortBy", over?.sortBy ?? sortBy);
    put("sortDir", over?.sortDir ?? sortDir);
    put("q", qVal);
    put("name", nameVal);
    put("isSystem", sysVal);
    put("createdAtFrom", createdFromVal);
    put("createdAtTo", createdToVal);
    put("updatedAtFrom", updatedFromVal);
    put("updatedAtTo", updatedToVal);

    if (permKeysVal && permKeysVal.length > 0) {
      p.set("permissionKeys", permKeysVal.join(","));
      if (permMatchVal) p.set("permMatch", permMatchVal);
    }

    const cursor =
      over?.cursorId === undefined
        ? cursorStack[pageIndex] ?? null
        : over.cursorId;
    if (cursor) p.set("cursorId", cursor);

    const pageToWrite = over?.page ?? pageIndex + 1;
    put("page", pageToWrite);

    setSearchParams(p, { replace: false });
  }

  async function fetchPageWith(opts?: {
    includeTotal?: boolean;
    cursorId?: string | null;
    sortByOverride?: SortField;
    sortDirOverride?: SortDir;
    limitOverride?: number;
    qOverride?: string | null | undefined;
    nameOverride?: string | null | undefined;
    isSystemOverride?: "" | "true" | "false" | null | undefined;
    createdFromOverride?: string | null | undefined;
    createdToOverride?: string | null | undefined;
    updatedFromOverride?: string | null | undefined;
    updatedToOverride?: string | null | undefined;
    permissionKeysOverride?: PermissionKey[] | null | undefined;
    permMatchOverride?: "any" | "all" | undefined;
  }) {
    setIsLoading(true);
    try {
      const qParam =
        opts?.qOverride === undefined
          ? appliedFilters.q.trim() || undefined
          : opts.qOverride || undefined;
      const nameParam =
        opts?.nameOverride === undefined
          ? appliedFilters.name.trim() || undefined
          : opts.nameOverride || undefined;
      const sysParam =
        opts?.isSystemOverride === undefined
          ? appliedFilters.isSystem === ""
            ? undefined
            : appliedFilters.isSystem === "true"
          : opts.isSystemOverride == null || opts.isSystemOverride === ""
          ? undefined
          : opts.isSystemOverride === "true";

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

      const permKeysParam =
        opts?.permissionKeysOverride === undefined
          ? appliedFilters.permissionKeys
          : opts.permissionKeysOverride ?? [];
      const permMatchParam =
        opts?.permMatchOverride === undefined
          ? appliedFilters.permMatch
          : opts.permMatchOverride;

      const res = await listRolesApiRequest({
        limit: opts?.limitOverride ?? limit,
        cursorId: opts?.cursorId ?? cursorStack[pageIndex] ?? undefined,
        q: qParam,
        name: nameParam,
        isSystem: sysParam,
        createdAtFrom: createdFromParam,
        createdAtTo: createdToParam,
        updatedAtFrom: updatedFromParam,
        updatedAtTo: updatedToParam,
        sortBy: opts?.sortByOverride ?? sortBy,
        sortDir: opts?.sortDirOverride ?? sortDir,
        includeTotal: opts?.includeTotal === true,
        // NEW:
        permissionKeys:
          Array.isArray(permKeysParam) && permKeysParam.length > 0
            ? permKeysParam
            : undefined,
        permMatch:
          Array.isArray(permKeysParam) && permKeysParam.length > 0
            ? permMatchParam
            : undefined,
      });

      if (res.success) {
        setRows(res.data.items);
        setNextCursor(res.data.pageInfo.nextCursor ?? null);
        setHasNextPage(res.data.pageInfo.hasNextPage);
        if (
          opts?.includeTotal &&
          typeof res.data.pageInfo.totalCount === "number"
        ) {
          setTotalCount(res.data.pageInfo.totalCount);
        }
      } else {
        const e = Object.assign(new Error("Failed to load roles"), {
          httpStatusCode: 500,
        });
        setErrorForBoundary(e);
      }
    } catch (e: any) {
      setErrorForBoundary(e);
    } finally {
      setIsLoading(false);
    }
  }

  function resetToFirstPageAndFetch(opts?: {
    sortByOverride?: SortField;
    sortDirOverride?: SortDir;
    limitOverride?: number;
    qOverride?: string | null | undefined;
    nameOverride?: string | null | undefined;
    isSystemOverride?: "" | "true" | "false" | null | undefined;
    createdFromOverride?: string | null | undefined;
    createdToOverride?: string | null | undefined;
    updatedFromOverride?: string | null | undefined;
    updatedToOverride?: string | null | undefined;
    permissionKeysOverride?: PermissionKey[] | null | undefined;
    permMatchOverride?: "any" | "all" | undefined;
  }) {
    setCursorStack([null]);
    setPageIndex(0);
    setUrlFromState({
      cursorId: null,
      page: 1,
      limit: opts?.limitOverride,
      sortBy: opts?.sortByOverride,
      sortDir: opts?.sortDirOverride,
      q: opts?.qOverride ?? null,
      name: opts?.nameOverride ?? null,
      isSystem: (opts?.isSystemOverride ?? null) as any,
      createdAtFrom: opts?.createdFromOverride ?? null,
      createdAtTo: opts?.createdToOverride ?? null,
      updatedAtFrom: opts?.updatedFromOverride ?? null,
      updatedAtTo: opts?.updatedToOverride ?? null,
      permissionKeys:
        opts?.permissionKeysOverride === undefined
          ? appliedFilters.permissionKeys
          : opts.permissionKeysOverride ?? [],
      permMatch:
        opts?.permMatchOverride === undefined
          ? appliedFilters.permMatch
          : opts.permMatchOverride ?? "any",
    });
    void fetchPageWith({ includeTotal: true, cursorId: null, ...opts });
  }

  function applyAndFetch(values: RoleFilters) {
    setAppliedFilters(values);
    setUrlFromState({
      cursorId: null,
      q: values.q.trim() || null,
      name: values.name.trim() || null,
      isSystem: values.isSystem || null,
      createdAtFrom: values.createdAtFrom ?? null,
      createdAtTo: values.createdAtTo ?? null,
      updatedAtFrom: values.updatedAtFrom ?? null,
      updatedAtTo: values.updatedAtTo ?? null,
      permissionKeys: values.permissionKeys,
      permMatch: values.permissionKeys.length ? values.permMatch : null,
    });
    resetToFirstPageAndFetch({
      qOverride: values.q.trim() || null,
      nameOverride: values.name.trim() || null,
      isSystemOverride: values.isSystem || null,
      createdFromOverride: values.createdAtFrom ?? null,
      createdToOverride: values.createdAtTo ?? null,
      updatedFromOverride: values.updatedAtFrom ?? null,
      updatedToOverride: values.updatedAtTo ?? null,
      permissionKeysOverride: values.permissionKeys,
      permMatchOverride: values.permissionKeys.length
        ? values.permMatch
        : "any",
    });
  }
  function clearAllFiltersAndFetch() {
    applyAndFetch(emptyFilters);
  }

  // Load permission catalogue for the multiselect (once when page opens)
  useEffect(() => {
    let cancelled = false;
    setPermLoading(true);
    listPermissionsApiRequest()
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setPermOptions(res.data.permissions);
        }
      })
      .finally(() => setPermLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

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
    const qpName = searchParams.get("name");
    const qpSystem = searchParams.get("isSystem") as
      | ""
      | "true"
      | "false"
      | null;
    const qpCreatedFrom = searchParams.get("createdAtFrom");
    const qpCreatedTo = searchParams.get("createdAtTo");
    const qpUpdatedFrom = searchParams.get("updatedAtFrom");
    const qpUpdatedTo = searchParams.get("updatedAtTo");
    const qpCursor = searchParams.get("cursorId");

    // NEW: permission filters from URL (CSV)
    const qpPermKeysCSV = searchParams.get("permissionKeys") || "";
    const qpPermKeys = qpPermKeysCSV
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as PermissionKey[];
    const qpPermMatch =
      (searchParams.get("permMatch") as "any" | "all" | null) ?? "any";

    if (!Number.isNaN(qpLimit) && qpLimit)
      setLimit(Math.max(1, Math.min(100, qpLimit)));
    if (qpSortBy) setSortBy(qpSortBy);
    if (qpSortDir) setSortDir(qpSortDir);

    setAppliedFilters({
      q: qpQ ?? "",
      name: qpName ?? "",
      isSystem: (qpSystem as "" | "true" | "false") ?? "",
      createdAtFrom: qpCreatedFrom ?? null,
      createdAtTo: qpCreatedTo ?? null,
      updatedAtFrom: qpUpdatedFrom ?? null,
      updatedAtTo: qpUpdatedTo ?? null,
      permissionKeys: qpPermKeys,
      permMatch: qpPermKeys.length ? qpPermMatch : "any",
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
      nameOverride: qpName ?? undefined,
      isSystemOverride: qpSystem ?? undefined,
      createdFromOverride: qpCreatedFrom ?? undefined,
      createdToOverride: qpCreatedTo ?? undefined,
      updatedFromOverride: qpUpdatedFrom ?? undefined,
      updatedToOverride: qpUpdatedTo ?? undefined,
      permissionKeysOverride: qpPermKeys.length ? qpPermKeys : undefined,
      permMatchOverride: qpPermKeys.length ? qpPermMatch : undefined,
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
    const qpName = sp.get("name");
    const qpSystem = sp.get("isSystem") as "" | "true" | "false" | null;
    const qpCreatedFrom = sp.get("createdAtFrom");
    const qpCreatedTo = sp.get("createdAtTo");
    const qpUpdatedFrom = sp.get("updatedAtFrom");
    const qpUpdatedTo = sp.get("updatedAtTo");
    const qpCursor = sp.get("cursorId");
    const qpPage = Number(sp.get("page") ?? "1");
    const newPageIndex = Number.isFinite(qpPage) && qpPage > 0 ? qpPage - 1 : 0;

    // NEW: permission filters from URL (CSV)
    const qpPermKeysCSV = sp.get("permissionKeys") || "";
    const qpPermKeys = qpPermKeysCSV
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as PermissionKey[];
    const qpPermMatch = (sp.get("permMatch") as "any" | "all" | null) ?? "any";

    if (!Number.isNaN(qpLimit) && qpLimit)
      setLimit(Math.max(1, Math.min(100, qpLimit)));
    if (qpSortBy) setSortBy(qpSortBy);
    if (qpSortDir) setSortDir(qpSortDir);

    setAppliedFilters({
      q: qpQ ?? "",
      name: qpName ?? "",
      isSystem: (qpSystem as "" | "true" | "false") ?? "",
      createdAtFrom: qpCreatedFrom ?? null,
      createdAtTo: qpCreatedTo ?? null,
      updatedAtFrom: qpUpdatedFrom ?? null,
      updatedAtTo: qpUpdatedTo ?? null,
      permissionKeys: qpPermKeys,
      permMatch: qpPermKeys.length ? qpPermMatch : "any",
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
      nameOverride: qpName ?? undefined,
      isSystemOverride: qpSystem ?? undefined,
      createdFromOverride: qpCreatedFrom ?? undefined,
      createdToOverride: qpCreatedTo ?? undefined,
      updatedFromOverride: qpUpdatedFrom ?? undefined,
      updatedToOverride: qpUpdatedTo ?? undefined,
      permissionKeysOverride: qpPermKeys.length ? qpPermKeys : undefined,
      permMatchOverride: qpPermKeys.length ? qpPermMatch : undefined,
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
  
      // Push the cursor for the *next* page now
      setCursorStack((prev) => [...prev.slice(0, pageIndex + 1), nextCursor]);
      setPageIndex(newIndex);
  
      // Reflect it in the URL immediately
      setUrlFromState({ cursorId: nextCursor, page: newIndex + 1 });
  
      // IMPORTANT: fetch using the explicit cursor we just got from the server
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
  
      // IMPORTANT: fetch using the explicit previous cursor
      await fetchPageWith({ cursorId: prevCursor });
    } finally {
      setIsPaginating(false);
    }
  }

  // actions
  async function handleDelete(role: RoleRecord) {
    try {
      const res = await deleteRoleApiRequest(
        role.id,
        `delete-${role.id}-${Date.now()}`
      );
      if (res.success) {
        notifications.show({ color: "green", message: "Role deleted" });
        resetToFirstPageAndFetch();
      }
    } catch (e: any) {
      const msg =
        e?.details?.error?.errorCode === "CONFLICT"
          ? e?.details?.error?.userFacingMessage ?? "Role is in use by users"
          : e?.message ?? "Delete failed";
      notifications.show({ color: "red", message: msg });
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
    const chips: {
      key: keyof RoleFilters | "permissionKeys";
      label: string;
    }[] = [];
    if (appliedFilters.q.trim())
      chips.push({ key: "q", label: `search: "${appliedFilters.q.trim()}"` });
    if (appliedFilters.name.trim())
      chips.push({ key: "name", label: `name: ${appliedFilters.name.trim()}` });
    if (appliedFilters.isSystem)
      chips.push({
        key: "isSystem",
        label: `system: ${appliedFilters.isSystem}`,
      });
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
    if (appliedFilters.permissionKeys.length > 0) {
      chips.push({
        key: "permissionKeys" as const,
        label: `perms (${
          appliedFilters.permMatch
        }): ${appliedFilters.permissionKeys.join(", ")}`,
      });
    }
    return chips;
  }, [appliedFilters]);

  function clearOneChip(key: keyof RoleFilters | "permissionKeys") {
    const next: RoleFilters = {
      ...appliedFilters,
      q: key === "q" ? "" : appliedFilters.q,
      name: key === "name" ? "" : appliedFilters.name,
      isSystem: key === "isSystem" ? "" : appliedFilters.isSystem,
      createdAtFrom:
        key === "createdAtFrom" ? null : appliedFilters.createdAtFrom,
      createdAtTo: key === "createdAtTo" ? null : appliedFilters.createdAtTo,
      updatedAtFrom:
        key === "updatedAtFrom" ? null : appliedFilters.updatedAtFrom,
      updatedAtTo: key === "updatedAtTo" ? null : appliedFilters.updatedAtTo,
      permissionKeys:
        key === "permissionKeys" ? [] : appliedFilters.permissionKeys,
      permMatch: key === "permissionKeys" ? "any" : appliedFilters.permMatch,
    };
    applyAndFetch(next);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start w-full">
        <Group justify="space-between" align="start" className="w-full">
          <Stack gap="1">
            <Title order={3}>Roles</Title>
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
              variant="light"
              onClick={() => resetToFirstPageAndFetch()}
            >
              Refresh
            </Button>

            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              New role
            </Button>
          </Group>
        </Group>
      </div>

      {/* Collapsible Filters */}
      <FilterBar<RoleFilters>
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
                placeholder="Admin, Editor, etc."
                value={values.q}
                onChange={(e) =>
                  setValues({ ...values, q: e.currentTarget.value })
                }
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <TextInput
                label="Exact name"
                placeholder="Admin, Editor, etc."
                value={values.name}
                onChange={(e) =>
                  setValues({ ...values, name: e.currentTarget.value })
                }
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Select
                label="System role"
                placeholder="Any"
                data={[
                  { value: "", label: "Any" },
                  { value: "true", label: "System" },
                  { value: "false", label: "Custom" },
                ]}
                value={values.isSystem}
                onChange={(v) =>
                  setValues({
                    ...values,
                    isSystem: (v ?? "") as RoleFilters["isSystem"], // Select can return null when cleared
                  })
                }
                clearable
                aria-label="Filter by system/custom role"
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <DatePickerInput
                label="Created from"
                placeholder="Start date"
                value={values.createdAtFrom}
                onChange={(v) => setValues({ ...values, createdAtFrom: v })}
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
                onChange={(v) => setValues({ ...values, createdAtTo: v })}
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
                onChange={(v) => setValues({ ...values, updatedAtFrom: v })}
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
                onChange={(v) => setValues({ ...values, updatedAtTo: v })}
                valueFormat="YYYY-MM-DD"
                popoverProps={{ withinPortal: true }}
                clearable
              />
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>

            </Grid.Col>

            {/* NEW: permission multiselect + match mode */}
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <SegmentedControl
                w={150}
                aria-label="Permission match mode"
                value={values.permMatch}
                onChange={(v) =>
                  setValues({
                    ...values,
                    permMatch: (v as "any" | "all") ?? "any",
                  })
                }
                data={[
                  { value: "any", label: "Any" },
                  { value: "all", label: "All" },
                ]}
              />

              <MultiSelect
                label="Permissions (any/all)"
                placeholder={
                  permLoading ? "Loading permissions…" : "Select permissions"
                }
                data={permissionChoices}
                value={values.permissionKeys}
                onChange={(v) =>
                  setValues({ ...values, permissionKeys: v as PermissionKey[] })
                }
                searchable
                clearable
                disabled={permLoading}
                nothingFoundMessage="No permissions"
                maxDropdownHeight={260}
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
            <Title order={4}>All Roles</Title>

            {/* Per page */}
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
              <Text ml="sm">Loading roles…</Text>
            </div>
          ) : (
            <>
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
                    <Badge
                      key={chip.key as string}
                      variant="light"
                      rightSection={
                        <CloseButton
                          aria-label={`Clear ${chip.label}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            clearOneChip(
                              chip.key as keyof RoleFilters | "permissionKeys"
                            );
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
                    No roles match your filters
                  </Title>
                  <Text c="dimmed" mb="md">
                    Try adjusting your filters or clear them to see all roles.
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
                      <Table.Th scope="col" aria-sort={colAriaSort("name")}>
                        <Group gap={4} wrap="nowrap">
                          <span>Name</span>
                          <Tooltip label="Sort by name" withArrow>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              onClick={() => applySort("name")}
                              aria-label={sortButtonLabel("name", "name")}
                            >
                              {sortBy === "name" ? (
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

                      <Table.Th scope="col" className="min-w-[100px]">System</Table.Th>

                      <Table.Th scope="col" className="min-w-[150px]">Permissions</Table.Th>

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
                          <Text fw={600}>{r.name}</Text>
                        </Table.Td>
                        <Table.Td>
                          {r.isSystem ? (
                            <Badge color="gray">System</Badge>
                          ) : (
                            <Badge color="blue">Custom</Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Group gap={6} wrap="wrap">
                            {r.permissions.map((p) => (
                              <Badge key={`${r.id}-${p}`} variant="light">
                                {p}
                              </Badge>
                            ))}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          {new Date(r.createdAt).toLocaleString()}
                        </Table.Td>
                        <Table.Td>
                          {new Date(r.updatedAt).toLocaleString()}
                        </Table.Td>
                        <Table.Td className="text-right">
                          <Group gap="xs" justify="flex-end">
                            <ActionIcon
                              variant="light"
                              onClick={() => {
                                if (!r.isSystem) {
                                  setEditing(r);
                                  setModalOpen(true);
                                }
                              }}
                              disabled={r.isSystem}
                              title={
                                r.isSystem
                                  ? "System roles cannot be edited"
                                  : "Edit role"
                              }
                            >
                              <IconPencil size={16} />
                            </ActionIcon>

                            <ActionIcon
                              variant="light"
                              color="red"
                              onClick={() => handleDelete(r)}
                              disabled={r.isSystem}
                              title={
                                r.isSystem
                                  ? "System roles cannot be deleted"
                                  : "Delete role"
                              }
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

      {/* Create/Edit modal */}
      <RoleUpsertModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        initialRole={editing ?? undefined}
        onSaved={() => {
          // on create/edit, reload first page to reflect changes
          setModalOpen(false);
          setEditing(null);
          resetToFirstPageAndFetch();
        }}
      />
    </div>
  );
}
