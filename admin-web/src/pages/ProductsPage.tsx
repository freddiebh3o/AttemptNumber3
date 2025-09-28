// src/pages/ProductsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
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
  ActionIcon,
  Loader,
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
} from "@tabler/icons-react";
import { handlePageError } from "../utils/pageError";
import { useAuthStore } from "../stores/auth";

export default function ProductsPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  // Global memberships (no per-page /me calls)
  const currentUserTenantMemberships = useAuthStore((s) => s.tenantMemberships);

  const [isLoadingProductsList, setIsLoadingProductsList] = useState(false);
  const [productsListRecords, setProductsListRecords] = useState<ProductRecord[] | null>(null);
  const [errorForBoundary, setErrorForBoundary] = useState<
    (Error & { httpStatusCode?: number; correlationId?: string }) | null
  >(null);

  // Create modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createProductNameInputValue, setCreateProductNameInputValue] =
    useState("");
  const [createProductSkuInputValue, setCreateProductSkuInputValue] =
    useState("");
  const [
    createProductPriceCentsInputValue,
    setCreateProductPriceCentsInputValue,
  ] = useState<number | "">("");

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editProductIdValue, setEditProductIdValue] = useState<string | null>(
    null
  );
  const [editProductNameInputValue, setEditProductNameInputValue] =
    useState("");
  const [editProductPriceCentsInputValue, setEditProductPriceCentsInputValue] =
    useState<number | "">("");
  const [editProductEntityVersionValue, setEditProductEntityVersionValue] =
    useState<number | null>(null);

  const isUserAdminOrOwnerForCurrentTenant = useMemo(() => {
    const match = currentUserTenantMemberships.find(
      (m) => m.tenantSlug === tenantSlug
    );
    return match?.roleName === "ADMIN" || match?.roleName === "OWNER";
  }, [currentUserTenantMemberships, tenantSlug]);

  async function loadProductsList() {
    setIsLoadingProductsList(true);
    try {
      const response = await listProductsApiRequest({ limit: 50 });
      if (response.success) {
        setProductsListRecords(response.data.products);
      } else {
        const e = Object.assign(new Error("Failed to load products"), { httpStatusCode: 500 });
        setErrorForBoundary(e);
      }
    } catch (error: any) {
      setErrorForBoundary(handlePageError(error, { title: 'Error' }));
    } finally {
      setIsLoadingProductsList(false);
    }
  }

  useEffect(() => {
    setProductsListRecords(null);
    setErrorForBoundary(null);
    void loadProductsList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  if (errorForBoundary) throw errorForBoundary;

  function openEditModalForProduct(productRecord: ProductRecord) {
    setEditProductIdValue(productRecord.id);
    setEditProductNameInputValue(productRecord.productName);
    setEditProductPriceCentsInputValue(productRecord.productPriceCents);
    setEditProductEntityVersionValue(productRecord.entityVersion);
    setIsEditModalOpen(true);
  }

  async function handleCreateProductSubmit() {
    if (createProductNameInputValue.trim().length === 0) {
      notifications.show({
        color: "red",
        message: "Product name is required.",
      });
      return;
    }
    if (typeof createProductPriceCentsInputValue !== "number") {
      notifications.show({
        color: "red",
        message: "Price must be a number in cents.",
      });
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
        await loadProductsList();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Create failed",
      });
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
        await loadProductsList();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Update failed",
      });
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
        await loadProductsList();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Delete failed",
      });
    }
  }

  return (
    <div>
      <div className="pb-4 border-b border-gray-200 bg-white">
        <Group justify="space-between">
          <Group>
            <Title order={3}>
              All Products
            </Title>
          </Group>
          <Group>
            <Button
              leftSection={<IconRefresh size={16} />}
              title="Refresh"
              onClick={loadProductsList}
              variant="light"
            >
              Refresh
            </Button>

            <Button
              onClick={() => setIsCreateModalOpen(true)}
              disabled={!isUserAdminOrOwnerForCurrentTenant}
            >
              New product
            </Button>
          </Group>
        </Group>
      </div>

      <div className="py-4">
        <Paper withBorder p="md" radius="md" className="bg-white">
          <Group justify="space-between" mb="md">
            <Title order={4}>All Products</Title>
          </Group>

          {productsListRecords === null || isLoadingProductsList ? (
            <div className="flex items-center justify-center p-8">
              <Loader />
            </div>
          ) : (
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>SKU</Table.Th>
                  <Table.Th>Price (cents)</Table.Th>
                  <Table.Th>Version</Table.Th>
                  <Table.Th>Actions</Table.Th>
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
                    <Table.Td>
                      <Group gap="xs">
                        <Button
                          variant="light"
                          size="xs"
                          leftSection={<IconPencil size={16} />}
                          onClick={() => openEditModalForProduct(p)}
                          disabled={!isUserAdminOrOwnerForCurrentTenant}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="light"
                          color="red"
                          size="xs"
                          leftSection={<IconTrash size={16} />}
                          onClick={() => handleDeleteProduct(p.id)}
                          disabled={!isUserAdminOrOwnerForCurrentTenant}
                        >
                          Delete
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
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
            onChange={(e) =>
              setCreateProductNameInputValue(e.currentTarget.value)
            }
          />
          <TextInput
            label="Product SKU"
            value={createProductSkuInputValue}
            onChange={(e) =>
              setCreateProductSkuInputValue(e.currentTarget.value)
            }
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
            onChange={(e) =>
              setEditProductNameInputValue(e.currentTarget.value)
            }
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
