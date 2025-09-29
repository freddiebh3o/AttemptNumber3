// admin-web/src/pages/ProductsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Button,
  Group,
  Table,
  Title,
  Paper,
  Modal,
  TextInput,
  NumberInput,
  Stack,
  Badge,
  Loader,
  Text,
  Collapse,
  Grid,
  rem,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  listProductsApiRequest,
  createProductApiRequest,
  updateProductApiRequest,
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
} from "@tabler/icons-react";
import { handlePageError } from "../utils/pageError";
import { useAuthStore } from "../stores/auth";

type SortField = "createdAt" | "productName" | "productPriceCents";
type SortDir = "asc" | "desc";

export default function ProductsPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  // Global memberships (no per-page /me calls)
  const currentUserTenantMemberships = useAuthStore((s) => s.tenantMemberships);

  // Data & paging state
  const [isLoadingProductsList, setIsLoadingProductsList] = useState(false);
  const [productsListRecords, setProductsListRecords] = useState<ProductRecord[] | null>(null);
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
  const [limit, setLimit] = useState<number>(12);
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Filters (server-side)
  const [minPriceCents, setMinPriceCents] = useState<number | "">("");

  // Create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createProductNameInputValue, setCreateProductNameInputValue] = useState("");
  const [createProductSkuInputValue, setCreateProductSkuInputValue] = useState("");
  const [createProductPriceCentsInputValue, setCreateProductPriceCentsInputValue] =
    useState<number | "">("");

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editProductIdValue, setEditProductIdValue] = useState<string | null>(null);
  const [editProductNameInputValue, setEditProductNameInputValue] = useState("");
  const [editProductPriceCentsInputValue, setEditProductPriceCentsInputValue] =
    useState<number | "">("");
  const [editProductEntityVersionValue, setEditProductEntityVersionValue] =
    useState<number | null>(null);

  const isUserAdminOrOwnerForCurrentTenant = useMemo(() => {
    const match = currentUserTenantMemberships.find((m) => m.tenantSlug === tenantSlug);
    return match?.roleName === "ADMIN" || match?.roleName === "OWNER";
  }, [currentUserTenantMemberships, tenantSlug]);

  // ---- Data fetching helpers ----
  async function fetchPageWith(opts?: {
    includeTotal?: boolean;
    cursorId?: string | null;
    sortByOverride?: SortField;
    sortDirOverride?: SortDir;
    limitOverride?: number;
    minPriceOverride?: number | undefined;
  }) {
    setIsLoadingProductsList(true);
    try {
      const response = await listProductsApiRequest({
        limit: opts?.limitOverride ?? limit,
        cursorId: opts?.cursorId ?? cursorStack[pageIndex] ?? undefined,
        minPriceCents:
          opts?.minPriceOverride !== undefined
            ? opts.minPriceOverride
            : typeof minPriceCents === "number"
            ? minPriceCents
            : undefined,
        sortBy: opts?.sortByOverride ?? sortBy,
        sortDir: opts?.sortDirOverride ?? sortDir,
        includeTotal: opts?.includeTotal === true,
      });

      if (response.success) {
        const data = response.data;
        setProductsListRecords(data.items);
        setNextCursor(data.pageInfo.nextCursor ?? null);
        setHasNextPage(data.pageInfo.hasNextPage);
        if (opts?.includeTotal && typeof data.pageInfo.totalCount === "number") {
          setTotalCount(data.pageInfo.totalCount);
        }
      } else {
        const e = Object.assign(new Error("Failed to load products"), { httpStatusCode: 500 });
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
    minPriceOverride?: number | undefined;
  }) {
    setCursorStack([null]);
    setPageIndex(0);
    void fetchPageWith({
      includeTotal: true,
      cursorId: null,
      sortByOverride: opts?.sortByOverride,
      sortDirOverride: opts?.sortDirOverride,
      limitOverride: opts?.limitOverride,
      minPriceOverride: opts?.minPriceOverride,
    });
  }

  // Initial load / when tenant changes
  useEffect(() => {
    setProductsListRecords(null);
    setHasNextPage(false);
    setNextCursor(null);
    setCursorStack([null]);
    setPageIndex(0);
    setTotalCount(null);
    setErrorForBoundary(null);
    void fetchPageWith({ includeTotal: true, cursorId: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  if (errorForBoundary) throw errorForBoundary;

  // ---- Sorting from table headers (FIXED: apply next values immediately) ----
  function applySort(nextField: SortField) {
    const nextDir: SortDir =
      sortBy === nextField ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    setSortBy(nextField);
    setSortDir(nextDir);
    resetToFirstPageAndFetch({ sortByOverride: nextField, sortDirOverride: nextDir });
  }

  // ---- Pagination controls with range text ----
  async function goNextPage() {
    if (!hasNextPage || !nextCursor) return;
    setIsPaginating(true);
    try {
      // push next cursor & move forward
      setCursorStack((prev) => [...prev.slice(0, pageIndex + 1), nextCursor]);
      setPageIndex((i) => i + 1);
      setTimeout(() => void fetchPageWith(), 0);
    } finally {
      setIsPaginating(false);
    }
  }

  async function goPrevPage() {
    if (pageIndex === 0) return;
    setIsPaginating(true);
    try {
      setPageIndex((i) => i - 1);
      setTimeout(() => void fetchPageWith(), 0);
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
      : `Showing ${rangeStart}–${rangeEnd}${totalCount != null ? ` of ${totalCount}` : ""}`;

  // ---- UI handlers ----
  function openEditModalForProduct(productRecord: ProductRecord) {
    setEditProductIdValue(productRecord.id);
    setEditProductNameInputValue(productRecord.productName);
    setEditProductPriceCentsInputValue(productRecord.productPriceCents);
    setEditProductEntityVersionValue(productRecord.entityVersion);
    setIsEditModalOpen(true);
  }

  async function handleCreateProductSubmit() {
    if (createProductNameInputValue.trim().length === 0) {
      notifications.show({ color: "red", message: "Product name is required." });
      return;
    }
    if (typeof createProductPriceCentsInputValue !== "number") {
      notifications.show({ color: "red", message: "Price must be a number in cents." });
      return;
    }

    try {
      const idempotencyKeyValue = `create-${Date.now()}`;
      const response = await createProductApiRequest({
        productName: createProductNameInputValue,
        productSku: createProductSkuInputValue,
        productPriceCents: createProductPriceCentsInputValue,
        idempotencyKeyOptional: idempotencyKeyValue,
      });
      if (response.success) {
        notifications.show({ color: "green", message: "Product created." });
        setIsCreateModalOpen(false);
        setCreateProductNameInputValue("");
        setCreateProductSkuInputValue("");
        setCreateProductPriceCentsInputValue("");
        resetToFirstPageAndFetch();
      }
    } catch (error: any) {
      notifications.show({ color: "red", message: error?.message ?? "Create failed" });
    }
  }

  async function handleEditProductSubmit() {
    if (!editProductIdValue || editProductEntityVersionValue == null) return;
    try {
      const idempotencyKeyValue = `update-${editProductIdValue}-${Date.now()}`;
      const response = await updateProductApiRequest({
        productId: editProductIdValue,
        productName: editProductNameInputValue,
        productPriceCents:
          typeof editProductPriceCentsInputValue === "number"
            ? editProductPriceCentsInputValue
            : undefined,
        currentEntityVersion: editProductEntityVersionValue,
        idempotencyKeyOptional: idempotencyKeyValue,
      });
      if (response.success) {
        notifications.show({ color: "green", message: "Product updated." });
        setIsEditModalOpen(false);
        resetToFirstPageAndFetch();
      }
    } catch (error: any) {
      notifications.show({ color: "red", message: error?.message ?? "Update failed" });
    }
  }

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
      notifications.show({ color: "red", message: error?.message ?? "Delete failed" });
    }
  }

  // Small helpers for header sort icon
  function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
    if (!active) return <IconArrowsSort size={16} />;
    return dir === "asc" ? <IconArrowUp size={16} /> : <IconArrowDown size={16} />;
    }

  return (
    <div>
      {/* Header Banner */}
      <div className="pb-4 border-b border-gray-200 bg-white">
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={3}>All Products</Title>
            <Text size="sm" c="dimmed">
              {rangeText}
            </Text>
          </div>
          <Group justify="flex-end" align="center">
            <Button
              leftSection={<IconFilter size={16} />}
              variant={showFilters ? "filled" : "light"}
              onClick={() => setShowFilters((s) => !s)}
              rightSection={showFilters ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
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

            <Button onClick={() => setIsCreateModalOpen(true)} disabled={!isUserAdminOrOwnerForCurrentTenant}>
              New product
            </Button>
          </Group>
        </Group>
      </div>

      {/* Collapsible Filters */}
      <Collapse in={showFilters}>
        <Paper withBorder p="md" radius="md" className="bg-white mt-3">
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
              <NumberInput
                label="Min price (cents)"
                placeholder="e.g. 5000"
                value={minPriceCents}
                min={0}
                onChange={(v) =>
                  setMinPriceCents(typeof v === "number" ? v : v === "" ? "" : Number(v))
                }
              />
            </Grid.Col>

            {/* More filters can go here */}
          </Grid>

          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={() => {
                setMinPriceCents("");
                resetToFirstPageAndFetch({ minPriceOverride: undefined });
              }}
            >
              Clear
            </Button>
            <Button
              onClick={() => {
                resetToFirstPageAndFetch({
                  minPriceOverride:
                    typeof minPriceCents === "number" ? minPriceCents : undefined,
                });
              }}
            >
              Apply filters
            </Button>
          </Group>
        </Paper>
      </Collapse>

      {/* Table + Controls */}
      <div className="py-4">
        <Paper withBorder p="md" radius="md" className="bg-white max-h-[80vh] overflow-y-auto">
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

          {productsListRecords === null || isLoadingProductsList ? (
            <div className="flex items-center justify-center p-8">
              <Loader />
            </div>
          ) : (
            <>
              <div className="max-h-[65vh] overflow-y-auto">
                <Table striped withTableBorder withColumnBorders stickyHeader>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>
                        <Group gap={4} wrap="nowrap">
                          <span>Name</span>
                          <Tooltip label="Sort by name" withArrow>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              onClick={() => applySort("productName")}
                              aria-label="Sort by name"
                            >
                              <SortIcon active={sortBy === "productName"} dir={sortDir} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Th>

                      <Table.Th>SKU</Table.Th>

                      <Table.Th>
                        <Group gap={4} wrap="nowrap">
                          <span>Price (cents)</span>
                          <Tooltip label="Sort by price" withArrow>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              onClick={() => applySort("productPriceCents")}
                              aria-label="Sort by price"
                            >
                              <SortIcon active={sortBy === "productPriceCents"} dir={sortDir} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Th>

                      <Table.Th>
                        <Group gap={4} wrap="nowrap">
                          <span>Version</span>
                          {/* Not sortable server-side */}
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
                          <Badge>{p.entityVersion}</Badge>
                        </Table.Td>
                        <Table.Td className="flex justify-end">
                          <Group gap="xs">
                            <ActionIcon
                              variant="light"
                              size="md"
                              onClick={() => openEditModalForProduct(p)}
                              disabled={!isUserAdminOrOwnerForCurrentTenant}
                            >
                              <IconPencil size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="light"
                              color="red"
                              size="md"
                              onClick={() => handleDeleteProduct(p.id)}
                              disabled={!isUserAdminOrOwnerForCurrentTenant}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>

              {/* Pagination (right) with range */}
              <Group justify="space-between" mt="md">
                <Text size="sm" c="dimmed">
                  {rangeText}
                </Text>
                <Group gap="xs">
                  <Button
                    variant="light"
                    leftSection={<IconPlayerTrackPrev size={16} />}
                    onClick={goPrevPage}
                    disabled={pageIndex === 0 || isPaginating}
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

      {/* Create modal */}
      <Modal
        opened={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create product"
      >
        <Stack>
          <TextInput
            label="Product name"
            value={createProductNameInputValue}
            onChange={(e) => setCreateProductNameInputValue(e.currentTarget.value)}
          />
          <TextInput
            label="Product SKU"
            value={createProductSkuInputValue}
            onChange={(e) => setCreateProductSkuInputValue(e.currentTarget.value)}
          />
          <NumberInput
            label="Price (cents)"
            value={createProductPriceCentsInputValue}
            onChange={(val) =>
              setCreateProductPriceCentsInputValue(
                typeof val === "number" ? val : val === "" ? "" : Number(val)
              )
            }
            min={0}
          />
          <Group justify="flex-end">
            <Button onClick={handleCreateProductSubmit}>Create</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit modal */}
      <Modal
        opened={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit product"
      >
        <Stack>
          <TextInput
            label="Product name"
            value={editProductNameInputValue}
            onChange={(e) => setEditProductNameInputValue(e.currentTarget.value)}
          />
          <NumberInput
            label="Price (cents)"
            value={editProductPriceCentsInputValue}
            onChange={(val) =>
              setEditProductPriceCentsInputValue(
                typeof val === "number" ? val : val === "" ? "" : Number(val)
              )
            }
            min={0}
          />
          <TextInput
            label="Current entity version (for optimistic concurrency)"
            value={String(editProductEntityVersionValue ?? "")}
            readOnly
          />
          <Group justify="flex-end">
            <Button onClick={handleEditProductSubmit}>Save changes</Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
