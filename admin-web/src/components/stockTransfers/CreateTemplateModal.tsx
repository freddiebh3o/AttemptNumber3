// admin-web/src/components/stockTransfers/CreateTemplateModal.tsx
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
  TextInput,
} from "@mantine/core";
import { IconPlus, IconTrash, IconAlertCircle } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  createTransferTemplateApiRequest,
  getTransferTemplateApiRequest,
} from "../../api/stockTransferTemplates";
import { listBranchesApiRequest } from "../../api/branches";
import { listProductsApiRequest } from "../../api/products";
import { useAuthStore } from "../../stores/auth";

interface CreateTemplateModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editTemplateId?: string;
}

interface TemplateItem {
  productId: string;
  productName: string;
  defaultQty: number;
}

export default function CreateTemplateModal({
  opened,
  onClose,
  onSuccess,
  editTemplateId,
}: CreateTemplateModalProps) {
  const branchMemberships = useAuthStore((s) => s.branchMembershipsCurrentTenant);

  const [templateName, setTemplateName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceBranchId, setSourceBranchId] = useState<string>("");
  const [destinationBranchId, setDestinationBranchId] = useState<string>("");
  const [items, setItems] = useState<TemplateItem[]>([]);

  const [branches, setBranches] = useState<Array<{ value: string; label: string }>>([]);
  const [products, setProducts] = useState<
    Array<{ value: string; label: string; name: string }>
  >([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);

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

  // Load template data if editing (for duplication)
  useEffect(() => {
    if (!opened || !editTemplateId) return;

    async function loadTemplate() {
      if (!editTemplateId) return; // TypeScript guard

      setIsLoadingTemplate(true);
      try {
        const response = await getTransferTemplateApiRequest(editTemplateId);

        if (response.success) {
          const template = response.data;
          setTemplateName(template.name);
          setDescription(template.description ?? "");
          setSourceBranchId(template.sourceBranchId);
          setDestinationBranchId(template.destinationBranchId);
          setItems(
            template.items.map((item) => ({
              productId: item.productId,
              productName: item.product?.productName ?? "Unknown",
              defaultQty: item.defaultQty,
            }))
          );
        }
      } catch (error: any) {
        notifications.show({
          color: "red",
          message: error?.message ?? "Failed to load template",
        });
      } finally {
        setIsLoadingTemplate(false);
      }
    }

    void loadTemplate();
  }, [opened, editTemplateId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!opened) {
      setTemplateName("");
      setDescription("");
      setSourceBranchId("");
      setDestinationBranchId("");
      setItems([]);
    }
  }, [opened]);

  function addItem() {
    setItems([...items, { productId: "", productName: "", defaultQty: 1 }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof TemplateItem, value: any) {
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
    if (!templateName.trim()) {
      notifications.show({
        color: "red",
        message: "Please enter a template name",
      });
      return;
    }

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
      if (item.defaultQty <= 0) {
        notifications.show({
          color: "red",
          message: "Default quantity must be greater than 0",
        });
        return;
      }
    }

    // Note: If in edit mode, we're actually viewing a template for duplication
    // The backend doesn't support direct updates, so we always create a new template
    setIsSubmitting(true);
    try {
      const idempotencyKey = `create-template-${Date.now()}`;

      const payload = {
        name: templateName.trim(),
        description: description.trim() || undefined,
        sourceBranchId,
        destinationBranchId,
        items: items.map((item) => ({
          productId: item.productId,
          defaultQty: item.defaultQty,
        })),
        idempotencyKeyOptional: idempotencyKey,
      };

      const response = await createTransferTemplateApiRequest(payload);

      if (response.success) {
        onSuccess();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Failed to create template",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const userBranchIds = new Set(branchMemberships.map((b) => b.branchId));
  const availableBranches = branches.filter((b) => userBranchIds.has(b.value));

  const isLoading = isLoadingData || isLoadingTemplate;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editTemplateId ? "Duplicate Transfer Template" : "Create Transfer Template"}
      size="xl"
    >
      <Stack gap="md">
        {availableBranches.length === 0 && !isLoading && (
          <Alert icon={<IconAlertCircle size={16} />} color="yellow">
            You are not a member of any branches. Please contact your administrator.
          </Alert>
        )}

        <TextInput
          label="Template Name"
          placeholder="e.g. Weekly Warehouse to Store Transfer"
          value={templateName}
          onChange={(e) => setTemplateName(e.currentTarget.value)}
          disabled={isLoading}
          required
          maxLength={100}
        />

        <Textarea
          label="Description (Optional)"
          placeholder="Describe the purpose of this template..."
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          minRows={2}
          maxRows={4}
          maxLength={500}
          disabled={isLoading}
        />

        <Select
          label="Source Branch (Sending From)"
          placeholder="Select branch"
          data={branches}
          value={sourceBranchId}
          onChange={(v) => setSourceBranchId(v || "")}
          searchable
          disabled={isLoading}
          required
        />

        <Select
          label="Destination Branch (Sending To)"
          placeholder="Select branch"
          data={availableBranches}
          value={destinationBranchId}
          onChange={(v) => setDestinationBranchId(v || "")}
          searchable
          disabled={isLoading}
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
              disabled={isLoading}
            >
              Add Item
            </Button>
          </Group>

          {items.length === 0 ? (
            <Alert color="blue">Click "Add Item" to add products to this template</Alert>
          ) : (
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Product</Table.Th>
                  <Table.Th style={{ width: 140 }}>Default Quantity</Table.Th>
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
                        disabled={isLoading}
                        data-testid={`template-item-product-select-${index}`}
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        placeholder="Qty"
                        value={item.defaultQty}
                        onChange={(v) =>
                          updateItem(index, "defaultQty", typeof v === "number" ? v : 1)
                        }
                        min={1}
                        disabled={isLoading}
                        data-testid={`template-item-quantity-input-${index}`}
                      />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        color="red"
                        variant="light"
                        onClick={() => removeItem(index)}
                        disabled={isLoading}
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

        <Group justify="flex-end" gap="xs">
          <Button variant="light" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isSubmitting} disabled={isLoading}>
            {editTemplateId ? "Duplicate Template" : "Create Template"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
