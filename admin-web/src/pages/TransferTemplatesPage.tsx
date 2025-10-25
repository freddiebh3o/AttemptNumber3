// admin-web/src/pages/TransferTemplatesPage.tsx
import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Button,
  Group,
  Table,
  Title,
  Paper,
  Badge,
  Loader,
  Text,
  Stack,
  ActionIcon,
  Tooltip,
  TextInput,
  Select,
  Modal,
} from "@mantine/core";
import {
  IconRefresh,
  IconPlus,
  IconArrowRight,
  IconCopy,
  IconLink,
  IconArchive,
  IconArchiveOff,
  IconEdit,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  listTransferTemplatesApiRequest,
  deleteTransferTemplateApiRequest,
  restoreTransferTemplateApiRequest,
} from "../api/stockTransferTemplates";
import type { StockTransferTemplate } from "../api/stockTransferTemplates";
import { listBranchesApiRequest } from "../api/branches";
import { handlePageError } from "../utils/pageError";
import { useAuthStore } from "../stores/auth";
import CreateTemplateModal from "../components/stockTransfers/CreateTemplateModal";

export default function TransferTemplatesPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const canWriteStock = useAuthStore((s) => s.hasPerm("stock:write"));
  const branchMemberships = useAuthStore((s) => s.branchMembershipsCurrentTenant);

  // Data state
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<StockTransferTemplate[] | null>(null);
  const [errorForBoundary, setErrorForBoundary] = useState<
    (Error & { httpStatusCode?: number; correlationId?: string }) | null
  >(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceBranchFilter, setSourceBranchFilter] = useState("");
  const [destinationBranchFilter, setDestinationBranchFilter] = useState("");
  const [archivedFilter, setArchivedFilter] = useState<"active-only" | "archived-only" | "all">("active-only");

  // Branch data for filters
  const [branches, setBranches] = useState<Array<{ value: string; label: string }>>([]);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | undefined>(undefined);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "duplicate">("create");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<StockTransferTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [templateToRestore, setTemplateToRestore] = useState<StockTransferTemplate | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  if (errorForBoundary) throw errorForBoundary;

  // Load branches for filters
  useEffect(() => {
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
  }, [tenantSlug]);

  async function fetchTemplates() {
    setIsLoading(true);
    try {
      const response = await listTransferTemplatesApiRequest({
        q: searchQuery.trim() || undefined,
        sourceBranchId: sourceBranchFilter || undefined,
        destinationBranchId: destinationBranchFilter || undefined,
        archivedFilter,
        limit: 100,
      });

      if (response.success) {
        setTemplates(response.data.items ?? []);
      } else {
        const e = Object.assign(new Error("Failed to load templates"), {
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

  // Initial load
  useEffect(() => {
    setTemplates(null);
    setErrorForBoundary(null);

    // Read filters from URL
    const qpSearch = searchParams.get("q");
    const qpSource = searchParams.get("sourceBranchId");
    const qpDest = searchParams.get("destinationBranchId");
    const qpArchived = searchParams.get("archived") as "active-only" | "archived-only" | "all";

    if (qpSearch) setSearchQuery(qpSearch);
    if (qpSource) setSourceBranchFilter(qpSource);
    if (qpDest) setDestinationBranchFilter(qpDest);
    if (qpArchived && ["active-only", "archived-only", "all"].includes(qpArchived)) {
      setArchivedFilter(qpArchived);
    }

    void fetchTemplates();
  }, [tenantSlug]);

  function applyFilters() {
    // Update URL params
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (sourceBranchFilter) params.set("sourceBranchId", sourceBranchFilter);
    if (destinationBranchFilter) params.set("destinationBranchId", destinationBranchFilter);
    if (archivedFilter !== "active-only") params.set("archived", archivedFilter);
    setSearchParams(params, { replace: false });

    void fetchTemplates();
  }

  function clearFilters() {
    setSearchQuery("");
    setSourceBranchFilter("");
    setDestinationBranchFilter("");
    setArchivedFilter("active-only");
    setSearchParams(new URLSearchParams(), { replace: false });
    void fetchTemplates();
  }

  function handleCreateSuccess() {
    setCreateModalOpen(false);
    setEditTemplateId(undefined);
    const messages = {
      create: "Template created successfully",
      edit: "Template updated successfully",
      duplicate: "Template duplicated successfully",
    };
    notifications.show({
      color: "green",
      message: messages[modalMode],
    });
    void fetchTemplates();
  }

  function handleEditClick(templateId: string) {
    setModalMode("edit");
    setEditTemplateId(templateId);
    setCreateModalOpen(true);
  }

  function handleDuplicateClick(templateId: string) {
    setModalMode("duplicate");
    setEditTemplateId(templateId);
    setCreateModalOpen(true);
  }

  function openDeleteConfirm(template: StockTransferTemplate) {
    setTemplateToDelete(template);
    setDeleteConfirmOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!templateToDelete) return;

    setIsDeleting(true);
    try {
      const idempotencyKey = `archive-template-${templateToDelete.id}-${Date.now()}`;
      const response = await deleteTransferTemplateApiRequest(
        templateToDelete.id,
        idempotencyKey
      );

      if (response.success) {
        notifications.show({
          color: "green",
          message: "Template archived successfully",
        });
        setDeleteConfirmOpen(false);
        setTemplateToDelete(null);
        void fetchTemplates();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Failed to archive template",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  function openRestoreConfirm(template: StockTransferTemplate) {
    setTemplateToRestore(template);
    setRestoreConfirmOpen(true);
  }

  async function handleRestoreConfirm() {
    if (!templateToRestore) return;

    setIsRestoring(true);
    try {
      const idempotencyKey = `restore-template-${templateToRestore.id}-${Date.now()}`;
      const response = await restoreTransferTemplateApiRequest(
        templateToRestore.id,
        idempotencyKey
      );

      if (response.success) {
        notifications.show({
          color: "green",
          message: "Template restored successfully",
        });
        setRestoreConfirmOpen(false);
        setTemplateToRestore(null);
        void fetchTemplates();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Failed to restore template",
      });
    } finally {
      setIsRestoring(false);
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

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    return templates;
  }, [templates]);

  return (
    <div>
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="start">
          <div>
            <Title order={3}>Stock Transfer Templates</Title>
            <Text size="sm" c="dimmed">
              {filteredTemplates.length} template{filteredTemplates.length !== 1 ? "s" : ""}
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
              leftSection={<IconRefresh size={16} />}
              title="Refresh"
              onClick={() => fetchTemplates()}
              variant="light"
            >
              Refresh
            </Button>

            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setModalMode("create");
                setEditTemplateId(undefined);
                setCreateModalOpen(true);
              }}
              disabled={!canWriteStock || branchMemberships.length === 0}
            >
              New Template
            </Button>
          </Group>
        </Group>

        {/* Filters */}
        <Paper withBorder p="md" radius="md">
          <Stack gap="md">
            <Group align="end">
              <TextInput
                label="Search Templates"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                style={{ flex: 1 }}
              />

              <Select
                label="Source Branch"
                placeholder="Filter by source"
                data={branches}
                value={sourceBranchFilter}
                onChange={(v) => setSourceBranchFilter(v || "")}
                clearable
                searchable
                style={{ minWidth: 180 }}
              />

              <Select
                label="Destination Branch"
                placeholder="Filter by destination"
                data={branches}
                value={destinationBranchFilter}
                onChange={(v) => setDestinationBranchFilter(v || "")}
                clearable
                searchable
                style={{ minWidth: 180 }}
              />

              <Select
                label="Show Templates"
                data={[
                  { value: "active-only", label: "Active templates only" },
                  { value: "archived-only", label: "Archived templates only" },
                  { value: "all", label: "All templates (active + archived)" },
                ]}
                value={archivedFilter}
                onChange={(value) => setArchivedFilter(value as "active-only" | "archived-only" | "all")}
                style={{ minWidth: 220 }}
                data-testid="template-archived-filter-select"
              />

              <Button onClick={applyFilters}>Apply Filters</Button>
              <Button variant="light" onClick={clearFilters}>
                Clear
              </Button>
            </Group>
          </Stack>
        </Paper>

        {/* Templates Table */}
        <Paper withBorder p="md" radius="md">
          {templates === null || isLoading ? (
            <div className="flex items-center justify-center p-8" role="status" aria-live="polite">
              <Loader />
              <Text ml="sm">Loading templates...</Text>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-16 text-center" role="region" aria-live="polite" aria-atomic="true">
              <Title order={4} mb="xs">
                No templates found
              </Title>
              <Text c="dimmed" mb="md">
                {searchQuery || sourceBranchFilter || destinationBranchFilter
                  ? "Try adjusting your filters or create a new template."
                  : "Create your first transfer template to quickly set up recurring stock transfers."}
              </Text>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  setEditTemplateId(undefined);
                  setCreateModalOpen(true);
                }}
                disabled={!canWriteStock}
              >
                Create Template
              </Button>
            </div>
          ) : (
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Template Name</Table.Th>
                  <Table.Th>Description</Table.Th>
                  <Table.Th>Route</Table.Th>
                  <Table.Th>Items</Table.Th>
                  <Table.Th style={{ width: 120 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredTemplates.map((template) => {
                  const itemCount = template.items?.length ?? 0;
                  const productNames = template.items
                    ?.map((item) => item.product?.productName ?? "Unknown")
                    .slice(0, 3)
                    .join(", ");
                  const moreItems = itemCount > 3 ? ` +${itemCount - 3} more` : "";
                  const description = template.description
                    ? template.description.length > 80
                      ? template.description.slice(0, 80) + "..."
                      : template.description
                    : "-";

                  return (
                    <Table.Tr key={template.id}>
                      <Table.Td>
                        <Group gap="xs">
                          <Text fw={500}>{template.name}</Text>
                          {template.isArchived && (
                            <Badge color="gray" variant="light" data-testid="template-archived-badge">
                              Archived
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {description}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Text size="sm">
                            {template.sourceBranch?.branchName ?? "Unknown"}
                          </Text>
                          <IconArrowRight size={14} />
                          <Text size="sm">
                            {template.destinationBranch?.branchName ?? "Unknown"}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label={productNames + moreItems} multiline w={300}>
                          <Badge variant="light" style={{ cursor: "help" }}>
                            {itemCount} item{itemCount !== 1 ? "s" : ""}
                          </Badge>
                        </Tooltip>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          {!template.isArchived ? (
                            <>
                              <Tooltip label="Edit template">
                                <ActionIcon
                                  variant="light"
                                  color="blue"
                                  onClick={() => handleEditClick(template.id)}
                                  disabled={!canWriteStock}
                                  data-testid="edit-template-btn"
                                >
                                  <IconEdit size={16} />
                                </ActionIcon>
                              </Tooltip>

                              <Tooltip label="Duplicate template">
                                <ActionIcon
                                  variant="light"
                                  color="cyan"
                                  onClick={() => handleDuplicateClick(template.id)}
                                  disabled={!canWriteStock}
                                  data-testid={`duplicate-template-${template.id}`}
                                >
                                  <IconCopy size={16} />
                                </ActionIcon>
                              </Tooltip>

                              <Tooltip label="Archive template">
                                <ActionIcon
                                  variant="light"
                                  color="red"
                                  onClick={() => openDeleteConfirm(template)}
                                  disabled={!canWriteStock}
                                  data-testid="archive-template-btn"
                                >
                                  <IconArchive size={16} />
                                </ActionIcon>
                              </Tooltip>
                            </>
                          ) : (
                            <Tooltip label="Restore template">
                              <ActionIcon
                                variant="light"
                                color="green"
                                onClick={() => openRestoreConfirm(template)}
                                disabled={!canWriteStock}
                                data-testid="restore-template-btn"
                              >
                                <IconArchiveOff size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Stack>

      {/* Create/Edit Template Modal */}
      <CreateTemplateModal
        opened={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setEditTemplateId(undefined);
        }}
        onSuccess={handleCreateSuccess}
        editTemplateId={editTemplateId}
        mode={modalMode}
      />

      {/* Archive Confirmation Modal */}
      <Modal
        opened={deleteConfirmOpen}
        onClose={() => {
          if (!isDeleting) {
            setDeleteConfirmOpen(false);
            setTemplateToDelete(null);
          }
        }}
        title="Archive Template"
        centered
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to archive the template{" "}
            <strong>{templateToDelete?.name}</strong>?
          </Text>
          <Text size="sm" c="dimmed">
            This template will be hidden from your active template list and cannot be used to create new transfers.
            All historical data will be preserved and the template can be restored at any time.
          </Text>

          <Group justify="flex-end" gap="xs">
            <Button variant="light" onClick={() => setDeleteConfirmOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDeleteConfirm} loading={isDeleting}>
              Archive Template
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Restore Confirmation Modal */}
      <Modal
        opened={restoreConfirmOpen}
        onClose={() => {
          if (!isRestoring) {
            setRestoreConfirmOpen(false);
            setTemplateToRestore(null);
          }
        }}
        title="Restore Template"
        centered
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to restore the template{" "}
            <strong>{templateToRestore?.name}</strong>?
          </Text>
          <Text size="sm" c="dimmed">
            The template will be restored and visible in the active templates list. You will be able to use it to create new transfers.
          </Text>

          <Group justify="flex-end" gap="xs">
            <Button variant="light" onClick={() => setRestoreConfirmOpen(false)} disabled={isRestoring}>
              Cancel
            </Button>
            <Button color="green" onClick={handleRestoreConfirm} loading={isRestoring}>
              Restore Template
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
