// admin-web/src/components/stockTransfers/CreateTransferModal.tsx
import { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Select,
  Textarea,
  Stack,
  Group,
  Text,
  NumberInput,
  ActionIcon,
  Table,
  Alert,
} from "@mantine/core";
import { IconPlus, IconTrash, IconAlertCircle } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { createStockTransferApiRequest } from "../../api/stockTransfers";
import { listBranchesApiRequest } from "../../api/branches";
import { listProductsApiRequest } from "../../api/products";
import { useAuthStore } from "../../stores/auth";

interface CreateTransferModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialValues?: {
    sourceBranchId?: string;
    destinationBranchId?: string;
    items?: Array<{
      productId: string;
      productName: string;
      qtyRequested: number;
    }>;
  };
}

interface TransferItem {
  productId: string;
  productName: string;
  qtyRequested: number;
}

export default function CreateTransferModal({
  opened,
  onClose,
  onSuccess,
  initialValues,
}: CreateTransferModalProps) {
  const branchMemberships = useAuthStore((s) => s.branchMembershipsCurrentTenant);

  const [sourceBranchId, setSourceBranchId] = useState<string>("");
  const [destinationBranchId, setDestinationBranchId] = useState<string>("");
  const [requestNotes, setRequestNotes] = useState("");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [items, setItems] = useState<TransferItem[]>([]);

  const [branches, setBranches] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [products, setProducts] = useState<
    Array<{ value: string; label: string; name: string }>
  >([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Load branches and products when modal opens
  useEffect(() => {
    if (!opened) return;

    async function loadData() {
      setIsLoadingData(true);
      try {
        const [branchesResp, productsResp] = await Promise.all([
          listBranchesApiRequest({ limit: 100, isActive: true }),
          listProductsApiRequest({ limit: 100 }),
        ]);

        if (branchesResp.success) {
          setBranches(
            branchesResp.data.items.map((b) => ({
              value: b.id,
              label: b.branchName,
            }))
          );
        }

        if (productsResp.success) {
          setProducts(
            productsResp.data.items.map((p) => ({
              value: p.id,
              label: `${p.productName} (${p.productSku})`,
              name: p.productName,
            }))
          );
        }
      } catch (error: any) {
        notifications.show({
          color: "red",
          message: error?.message ?? "Failed to load data",
        });
      } finally {
        setIsLoadingData(false);
      }
    }

    void loadData();
  }, [opened]);

  // Initialize from template values if provided
  useEffect(() => {
    if (opened && initialValues) {
      if (initialValues.sourceBranchId) {
        setSourceBranchId(initialValues.sourceBranchId);
      }
      if (initialValues.destinationBranchId) {
        setDestinationBranchId(initialValues.destinationBranchId);
      }
      if (initialValues.items && initialValues.items.length > 0) {
        setItems(initialValues.items);
      }
    }
  }, [opened, initialValues]);

  // Reset form when modal closes
  useEffect(() => {
    if (!opened) {
      setSourceBranchId("");
      setDestinationBranchId("");
      setRequestNotes("");
      setPriority("NORMAL");
      setItems([]);
    }
  }, [opened]);

  function addItem() {
    setItems([...items, { productId: "", productName: "", qtyRequested: 1 }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof TransferItem, value: any) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // If updating productId, also update productName
    if (field === "productId") {
      const product = products.find((p) => p.value === value);
      if (product) {
        newItems[index].productName = product.name;
      }
    }

    setItems(newItems);
  }

  async function handleSubmit() {
    // Validation
    if (!sourceBranchId) {
      notifications.show({
        color: "red",
        message: "Please select a source branch",
      });
      return;
    }

    if (!destinationBranchId) {
      notifications.show({
        color: "red",
        message: "Please select a destination branch",
      });
      return;
    }

    if (sourceBranchId === destinationBranchId) {
      notifications.show({
        color: "red",
        message: "Source and destination branches must be different",
      });
      return;
    }

    if (items.length === 0) {
      notifications.show({
        color: "red",
        message: "Please add at least one item",
      });
      return;
    }

    // Check all items have products and quantities
    for (const item of items) {
      if (!item.productId) {
        notifications.show({
          color: "red",
          message: "Please select a product for all items",
        });
        return;
      }
      if (item.qtyRequested <= 0) {
        notifications.show({
          color: "red",
          message: "Quantity must be greater than 0",
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = `create-transfer-${Date.now()}`;
      const response = await createStockTransferApiRequest({
        sourceBranchId,
        destinationBranchId,
        requestNotes: requestNotes.trim() || undefined,
        priority: priority,
        items: items.map((item) => ({
          productId: item.productId,
          qtyRequested: item.qtyRequested,
        })),
        idempotencyKeyOptional: idempotencyKey,
      });

      if (response.success) {
        onSuccess();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Failed to create transfer",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const userBranchIds = new Set(branchMemberships.map((b) => b.branchId));
  const availableBranches = branches.filter((b) => userBranchIds.has(b.value));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Create Transfer Request"
      size="xl"
    >
      <Stack gap="md">
        {availableBranches.length === 0 && !isLoadingData && (
          <Alert icon={<IconAlertCircle size={16} />} color="yellow">
            You are not a member of any branches. Please contact your administrator.
          </Alert>
        )}

        <Select
          label="Source Branch (Sending From)"
          placeholder="Select branch"
          data={branches}
          value={sourceBranchId}
          onChange={(v) => setSourceBranchId(v || "")}
          searchable
          disabled={isLoadingData}
          required
        />

        <Select
          label="Destination Branch (Sending To)"
          placeholder="Select branch"
          data={availableBranches}
          value={destinationBranchId}
          onChange={(v) => setDestinationBranchId(v || "")}
          searchable
          disabled={isLoadingData}
          required
        />

        <div>
          <Group justify="space-between" mb="xs">
            <Text fw={500} size="sm">
              Items
            </Text>
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={addItem}
              variant="light"
            >
              Add Item
            </Button>
          </Group>

          {items.length === 0 ? (
            <Alert color="blue">
              Click "Add Item" to add products to this transfer
            </Alert>
          ) : (
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Product</Table.Th>
                  <Table.Th style={{ width: 120 }}>Quantity</Table.Th>
                  <Table.Th style={{ width: 60 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <Select
                        placeholder="Select product"
                        data={products}
                        value={item.productId}
                        onChange={(v) => updateItem(index, "productId", v || "")}
                        searchable
                        disabled={isLoadingData}
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        placeholder="Qty"
                        value={item.qtyRequested}
                        onChange={(v) =>
                          updateItem(
                            index,
                            "qtyRequested",
                            typeof v === "number" ? v : 1
                          )
                        }
                        min={1}
                      />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        color="red"
                        variant="light"
                        onClick={() => removeItem(index)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </div>

        <Select
          label="Priority"
          placeholder="Select priority"
          data={[
            { value: "URGENT", label: "🔥 Urgent (stock-out)" },
            { value: "HIGH", label: "⬆️ High (promotional)" },
            { value: "NORMAL", label: "➖ Normal" },
            { value: "LOW", label: "⬇️ Low (overstock)" },
          ]}
          value={priority}
          onChange={(v) => setPriority(v as "LOW" | "NORMAL" | "HIGH" | "URGENT")}
          required
        />

        <Textarea
          label="Request Notes (Optional)"
          placeholder="Why do you need this stock transfer?"
          value={requestNotes}
          onChange={(e) => setRequestNotes(e.currentTarget.value)}
          minRows={3}
          maxLength={1000}
        />

        <Group justify="flex-end" gap="xs">
          <Button variant="light" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isSubmitting} data-testid="create-transfer-button">
            Create Transfer Request
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
