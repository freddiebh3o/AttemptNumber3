// admin-web/src/components/stockTransfers/SelectTemplateModal.tsx
import { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Stack,
  Group,
  Text,
  TextInput,
  Select,
  Loader,
  Badge,
  Paper,
  Title,
} from "@mantine/core";
import { IconArrowRight, IconSearch } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { listTransferTemplatesApiRequest } from "../../api/stockTransferTemplates";
import type { StockTransferTemplate } from "../../api/stockTransferTemplates";
import { listBranchesApiRequest } from "../../api/branches";

interface SelectTemplateModalProps {
  opened: boolean;
  onClose: () => void;
  onSelectTemplate: (template: StockTransferTemplate) => void;
}

export default function SelectTemplateModal({
  opened,
  onClose,
  onSelectTemplate,
}: SelectTemplateModalProps) {
  const [templates, setTemplates] = useState<StockTransferTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<StockTransferTemplate | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [sourceBranchFilter, setSourceBranchFilter] = useState("");
  const [destinationBranchFilter, setDestinationBranchFilter] = useState("");

  const [branches, setBranches] = useState<Array<{ value: string; label: string }>>([]);

  // Load branches for filters
  useEffect(() => {
    if (!opened) return;

    async function loadBranches() {
      try {
        const response = await listBranchesApiRequest({ limit: 100, isActive: true });
        if (response.success) {
          setBranches([
            { value: "", label: "All Branches" },
            ...response.data.items.map((b) => ({
              value: b.id,
              label: b.branchName,
            })),
          ]);
        }
      } catch (error: any) {
        // Silently fail - filters just won't work
      }
    }
    void loadBranches();
  }, [opened]);

  // Load templates
  useEffect(() => {
    if (!opened) return;

    async function loadTemplates() {
      setIsLoading(true);
      try {
        const response = await listTransferTemplatesApiRequest({
          q: searchQuery.trim() || undefined,
          sourceBranchId: sourceBranchFilter || undefined,
          destinationBranchId: destinationBranchFilter || undefined,
          limit: 100,
        });

        if (response.success) {
          setTemplates(response.data.items ?? []);
        }
      } catch (error: any) {
        notifications.show({
          color: "red",
          message: error?.message ?? "Failed to load templates",
        });
      } finally {
        setIsLoading(false);
      }
    }

    void loadTemplates();
  }, [opened, searchQuery, sourceBranchFilter, destinationBranchFilter]);

  // Reset when modal closes
  useEffect(() => {
    if (!opened) {
      setSearchQuery("");
      setSourceBranchFilter("");
      setDestinationBranchFilter("");
      setSelectedTemplate(null);
    }
  }, [opened]);

  function handleSelect() {
    if (!selectedTemplate) {
      notifications.show({
        color: "red",
        message: "Please select a template",
      });
      return;
    }

    onSelectTemplate(selectedTemplate);
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Select Transfer Template"
      size="xl"
    >
      <Stack gap="md">
        {/* Filters */}
        <Group align="end">
          <TextInput
            label="Search"
            placeholder="Search by name..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            style={{ flex: 1 }}
          />

          <Select
            label="Source Branch"
            placeholder="Any"
            data={branches}
            value={sourceBranchFilter}
            onChange={(v) => setSourceBranchFilter(v || "")}
            clearable
            searchable
            style={{ flex: 1 }}
          />

          <Select
            label="Destination Branch"
            placeholder="Any"
            data={branches}
            value={destinationBranchFilter}
            onChange={(v) => setDestinationBranchFilter(v || "")}
            clearable
            searchable
            style={{ flex: 1 }}
          />
        </Group>

        {/* Templates List */}
        <div style={{ maxHeight: "400px", overflowY: "auto" }}>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader />
              <Text ml="sm">Loading templates...</Text>
            </div>
          ) : templates.length === 0 ? (
            <Paper withBorder p="xl" radius="md" style={{ textAlign: "center" }}>
              <Text c="dimmed">No templates found matching your filters.</Text>
            </Paper>
          ) : (
            <Stack gap="xs">
              {templates.map((template) => {
                const isSelected = selectedTemplate?.id === template.id;
                const itemCount = template.items?.length ?? 0;
                const productNames = template.items
                  ?.map((item) => item.product?.productName ?? "Unknown")
                  .join(", ");

                return (
                  <Paper
                    key={template.id}
                    withBorder
                    p="md"
                    radius="md"
                    style={{
                      cursor: "pointer",
                      backgroundColor: isSelected ? "var(--mantine-color-blue-0)" : undefined,
                      borderColor: isSelected ? "var(--mantine-color-blue-5)" : undefined,
                      borderWidth: isSelected ? 2 : 1,
                    }}
                    onClick={() => setSelectedTemplate(template)}
                    data-testid={`template-card-${template.id}`}
                  >
                    <Stack gap="xs">
                      <Group justify="space-between" align="start">
                        <div style={{ flex: 1 }}>
                          <Title order={6}>{template.name}</Title>
                          {template.description && (
                            <Text size="sm" c="dimmed" mt={4}>
                              {template.description}
                            </Text>
                          )}
                        </div>
                        <Badge variant="light" size="lg">
                          {itemCount} item{itemCount !== 1 ? "s" : ""}
                        </Badge>
                      </Group>

                      <Group gap={4} wrap="nowrap">
                        <Text size="sm" fw={500}>
                          {template.sourceBranch?.branchName ?? "Unknown"}
                        </Text>
                        <IconArrowRight size={14} />
                        <Text size="sm" fw={500}>
                          {template.destinationBranch?.branchName ?? "Unknown"}
                        </Text>
                      </Group>

                      <Text size="xs" c="dimmed" lineClamp={1}>
                        Products: {productNames}
                      </Text>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </div>

        <Group justify="flex-end" gap="xs">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={!selectedTemplate} data-testid="use-template-button">
            Use Template
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
