// admin-web/src/pages/TransferApprovalRulesPage.tsx
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
  Modal,
  Switch,
  Collapse,
  Box,
  useMantineTheme,
  useComputedColorScheme,
  List,
  Select,
} from "@mantine/core";
import {
  IconRefresh,
  IconPlus,
  IconTrash,
  IconLink,
  IconEdit,
  IconChevronDown,
  IconChevronUp,
  IconArchive,
  IconArchiveOff,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  listApprovalRulesApiRequest,
  deleteApprovalRuleApiRequest,
  updateApprovalRuleApiRequest,
  restoreApprovalRuleApiRequest,
} from "../api/transferApprovalRules";
import type { TransferApprovalRule } from "../api/transferApprovalRules";
import { handlePageError } from "../utils/pageError";
import { useAuthStore } from "../stores/auth";
import CreateApprovalRuleModal from "../components/stockTransfers/CreateApprovalRuleModal";

export default function TransferApprovalRulesPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const canWriteStock = useAuthStore((s) => s.hasPerm("stock:write"));

  // Data state
  const [isLoading, setIsLoading] = useState(false);
  const [rules, setRules] = useState<TransferApprovalRule[] | null>(null);
  const [errorForBoundary, setErrorForBoundary] = useState<
    (Error & { httpStatusCode?: number; correlationId?: string }) | null
  >(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [archivedFilter, setArchivedFilter] = useState<"active-only" | "archived-only" | "all">("active-only");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editRuleId, setEditRuleId] = useState<string | undefined>(undefined);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<TransferApprovalRule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingActiveRuleId, setTogglingActiveRuleId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(true);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [ruleToRestore, setRuleToRestore] = useState<TransferApprovalRule | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const theme = useMantineTheme();
  const colorScheme = useComputedColorScheme('light');

  if (errorForBoundary) throw errorForBoundary;

  async function fetchRules() {
    setIsLoading(true);
    try {
      const response = await listApprovalRulesApiRequest({
        archivedFilter,
        sortBy: "priority",
        sortDir: "desc",
        limit: 100,
      });

      if (response.success) {
        setRules(response.data.items ?? []);
      } else {
        const e = Object.assign(new Error("Failed to load approval rules"), {
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
    setRules(null);
    setErrorForBoundary(null);

    // Read search and archived filter from URL
    const qpSearch = searchParams.get("q");
    if (qpSearch) setSearchQuery(qpSearch);

    const qpArchived = searchParams.get("archived") as "active-only" | "archived-only" | "all";
    if (qpArchived && ["active-only", "archived-only", "all"].includes(qpArchived)) {
      setArchivedFilter(qpArchived);
    }

    void fetchRules();
  }, [tenantSlug]);

  function applyFilters() {
    // Update URL params
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (archivedFilter !== "active-only") params.set("archived", archivedFilter);
    setSearchParams(params, { replace: false });

    void fetchRules();
  }

  function clearFilters() {
    setSearchQuery("");
    setArchivedFilter("active-only");
    setSearchParams(new URLSearchParams(), { replace: false });
    void fetchRules();
  }

  function handleCreateSuccess() {
    setCreateModalOpen(false);
    setEditRuleId(undefined);
    notifications.show({
      color: "green",
      message: editRuleId ? "Approval rule updated successfully" : "Approval rule created successfully",
    });
    void fetchRules();
  }

  function handleEditClick(ruleId: string) {
    setEditRuleId(ruleId);
    setCreateModalOpen(true);
  }

  function openDeleteConfirm(rule: TransferApprovalRule) {
    setRuleToDelete(rule);
    setDeleteConfirmOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!ruleToDelete) return;

    setIsDeleting(true);
    try {
      const idempotencyKey = `delete-approval-rule-${ruleToDelete.id}-${Date.now()}`;
      const response = await deleteApprovalRuleApiRequest(
        ruleToDelete.id,
        idempotencyKey
      );

      if (response.success) {
        notifications.show({
          color: "green",
          message: "Approval rule archived successfully",
        });
        setDeleteConfirmOpen(false);
        setRuleToDelete(null);
        void fetchRules();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Failed to archive approval rule",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  function openRestoreConfirm(rule: TransferApprovalRule) {
    setRuleToRestore(rule);
    setRestoreConfirmOpen(true);
  }

  async function handleRestoreConfirm() {
    if (!ruleToRestore) return;

    setIsRestoring(true);
    try {
      const idempotencyKey = `restore-approval-rule-${ruleToRestore.id}-${Date.now()}`;
      const response = await restoreApprovalRuleApiRequest(
        ruleToRestore.id,
        idempotencyKey
      );

      if (response.success) {
        notifications.show({
          color: "green",
          message: "Approval rule restored successfully",
        });
        setRestoreConfirmOpen(false);
        setRuleToRestore(null);
        void fetchRules();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Failed to restore approval rule",
      });
    } finally {
      setIsRestoring(false);
    }
  }

  async function handleToggleActive(rule: TransferApprovalRule) {
    setTogglingActiveRuleId(rule.id);
    try {
      const idempotencyKey = `toggle-rule-${rule.id}-${Date.now()}`;
      const response = await updateApprovalRuleApiRequest(rule.id, {
        isActive: !rule.isActive,
        idempotencyKeyOptional: idempotencyKey,
      });

      if (response.success) {
        notifications.show({
          color: "green",
          message: `Approval rule ${!rule.isActive ? "activated" : "deactivated"}`,
        });
        void fetchRules();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Failed to update approval rule",
      });
    } finally {
      setTogglingActiveRuleId(null);
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

  const filteredRules = useMemo(() => {
    if (!rules) return [];
    if (!searchQuery.trim()) return rules;

    const lowerQuery = searchQuery.toLowerCase().trim();
    return rules.filter((rule) =>
      rule.name.toLowerCase().includes(lowerQuery) ||
      rule.description?.toLowerCase().includes(lowerQuery)
    );
  }, [rules, searchQuery]);

  function getConditionSummary(rule: TransferApprovalRule): string {
    if (rule.conditions.length === 0) return "No conditions";

    const summaries = rule.conditions.map((cond) => {
      switch (cond.conditionType) {
        case "TOTAL_QTY_THRESHOLD":
          return `Qty > ${cond.threshold}`;
        case "TOTAL_VALUE_THRESHOLD":
          return `Value > £${((cond.threshold ?? 0) / 100).toFixed(2)}`;
        case "SOURCE_BRANCH":
          return `From ${cond.branch?.branchName ?? "Unknown"}`;
        case "DESTINATION_BRANCH":
          return `To ${cond.branch?.branchName ?? "Unknown"}`;
        default:
          return cond.conditionType;
      }
    });

    return summaries.join(", ");
  }

  function getLevelsSummary(rule: TransferApprovalRule): string {
    if (rule.levels.length === 0) return "No levels";

    const sorted = [...rule.levels].sort((a, b) => a.level - b.level);
    const names = sorted.map((l) => l.name);

    return `${rule.levels.length} level${rule.levels.length !== 1 ? "s" : ""}: ${names.join(" → ")}`;
  }

  function getApprovalModeColor(mode: string): string {
    switch (mode) {
      case "SEQUENTIAL":
        return "blue";
      case "PARALLEL":
        return "green";
      case "HYBRID":
        return "orange";
      default:
        return "gray";
    }
  }

  return (
    <div>
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="start">
          <div>
            <Title order={3}>Transfer Approval Rules</Title>
            <Text size="sm" c="dimmed">
              {filteredRules.length} rule{filteredRules.length !== 1 ? "s" : ""}
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
              onClick={() => fetchRules()}
              variant="light"
            >
              Refresh
            </Button>

            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setEditRuleId(undefined);
                setCreateModalOpen(true);
              }}
              disabled={!canWriteStock}
            >
              Create Rule
            </Button>
          </Group>
        </Group>

        {/* Information Section */}
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
                About Transfer Approval Rules
              </Text>
              <Button
                variant="subtle"
                size="xs"
                onClick={() => setShowInfo((s) => !s)}
                rightSection={
                  showInfo ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                }
              >
                {showInfo ? "Hide" : "Show"}
              </Button>
            </Group>

            <Collapse in={showInfo}>
              <Box>
                <Text size="sm" mb="md">
                  Approval rules allow you to require multi-level approvals for stock transfers based on specific conditions.
                  This ensures proper oversight for significant inventory movements.
                </Text>

                <Stack gap="md">
                  <div>
                    <Text size="sm" fw={600} mb="xs">
                      How It Works:
                    </Text>
                    <List size="sm" spacing="xs">
                      <List.Item>
                        <strong>Create rules</strong> with conditions (e.g., total quantity &gt; 100, total value &gt; £1000)
                      </List.Item>
                      <List.Item>
                        <strong>Define approval levels</strong> (e.g., Level 1: Manager, Level 2: Director)
                      </List.Item>
                      <List.Item>
                        <strong>Choose approval mode:</strong>
                        <List withPadding size="sm" spacing="xs" mt={4}>
                          <List.Item>
                            <Text span fw={500}>Sequential:</Text> Approvals must be obtained in order (Level 1 → 2 → 3)
                          </List.Item>
                          <List.Item>
                            <Text span fw={500}>Parallel:</Text> All approvers can approve simultaneously
                          </List.Item>
                          <List.Item>
                            <Text span fw={500}>Hybrid:</Text> Level 1 must approve first, then Level 2+ can approve in parallel
                          </List.Item>
                        </List>
                      </List.Item>
                      <List.Item>
                        When a transfer is created that matches a rule's conditions, it will require the defined approvals before it can be shipped
                      </List.Item>
                      <List.Item>
                        Authorized users will see "Approve Level X" buttons on matching transfers
                      </List.Item>
                    </List>
                  </div>

                  <div>
                    <Text size="sm" fw={600} mb="xs">
                      Rule Priority:
                    </Text>
                    <Text size="sm" c="dimmed">
                      Rules are evaluated in order of priority (higher numbers first). If multiple rules match a transfer,
                      the first matching rule will be applied.
                    </Text>
                  </div>

                  <div>
                    <Text size="sm" fw={600} mb="xs">
                      Example Use Cases:
                    </Text>
                    <List size="sm" spacing="xs">
                      <List.Item>Transfers over 1000 units require manager AND director approval</List.Item>
                      <List.Item>High-value transfers (&gt;£10,000) require finance controller approval</List.Item>
                      <List.Item>Transfers from main warehouse to external locations require logistics approval</List.Item>
                    </List>
                  </div>
                </Stack>
              </Box>
            </Collapse>
          </Stack>
        </Paper>

        {/* Search and Filter */}
        <Paper withBorder p="md" radius="md">
          <Group align="end">
            <TextInput
              label="Search Rules"
              placeholder="Search by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              style={{ flex: 1 }}
            />

            <Select
              label="Show Rules"
              data={[
                { value: "active-only", label: "Active rules only" },
                { value: "archived-only", label: "Archived rules only" },
                { value: "all", label: "All rules (active + archived)" },
              ]}
              value={archivedFilter}
              onChange={(value) => setArchivedFilter(value as "active-only" | "archived-only" | "all")}
              style={{ minWidth: 220 }}
              data-testid="approval-rule-archived-filter-select"
            />

            <Button onClick={applyFilters}>Apply</Button>
            <Button variant="light" onClick={clearFilters}>
              Clear
            </Button>
          </Group>
        </Paper>

        {/* Rules Table */}
        <Paper withBorder p="md" radius="md">
          {rules === null || isLoading ? (
            <div className="flex items-center justify-center p-8" role="status" aria-live="polite">
              <Loader />
              <Text ml="sm">Loading approval rules...</Text>
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="py-16 text-center" role="region" aria-live="polite" aria-atomic="true">
              <Title order={4} mb="xs">
                No approval rules found
              </Title>
              <Text c="dimmed" mb="md">
                {searchQuery
                  ? "Try adjusting your search or create a new rule."
                  : "Create your first approval rule to require multi-level approvals for stock transfers."}
              </Text>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  setEditRuleId(undefined);
                  setCreateModalOpen(true);
                }}
                disabled={!canWriteStock}
              >
                Create Rule
              </Button>
            </div>
          ) : (
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Rule Name</Table.Th>
                  <Table.Th>Description</Table.Th>
                  <Table.Th>Mode</Table.Th>
                  <Table.Th>Active</Table.Th>
                  <Table.Th>Priority</Table.Th>
                  <Table.Th>Conditions</Table.Th>
                  <Table.Th>Approval Levels</Table.Th>
                  <Table.Th style={{ width: 140 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredRules.map((rule) => {
                  const description = rule.description
                    ? rule.description.length > 60
                      ? rule.description.slice(0, 60) + "..."
                      : rule.description
                    : "-";

                  return (
                    <Table.Tr key={rule.id}>
                      <Table.Td>
                        <Group gap="xs">
                          <Text fw={500}>{rule.name}</Text>
                          {rule.isArchived && (
                            <Badge color="gray" variant="light" data-testid="approval-rule-archived-badge">
                              Archived
                            </Badge>
                          )}
                          {!rule.isActive && !rule.isArchived && (
                            <Badge color="yellow" variant="light" data-testid="approval-rule-inactive-badge">
                              Inactive
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
                        <Badge color={getApprovalModeColor(rule.approvalMode)} variant="light">
                          {rule.approvalMode}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Switch
                          checked={rule.isActive}
                          onChange={() => handleToggleActive(rule)}
                          disabled={!canWriteStock || togglingActiveRuleId === rule.id || rule.isArchived}
                          data-testid="approval-rule-active-switch"
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{rule.priority}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label={getConditionSummary(rule)} multiline w={300}>
                          <Badge variant="outline" style={{ cursor: "help" }}>
                            {rule.conditions.length} condition{rule.conditions.length !== 1 ? "s" : ""}
                          </Badge>
                        </Tooltip>
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label={getLevelsSummary(rule)} multiline w={300}>
                          <Badge variant="outline" style={{ cursor: "help" }}>
                            {rule.levels.length} level{rule.levels.length !== 1 ? "s" : ""}
                          </Badge>
                        </Tooltip>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          {!rule.isArchived ? (
                            <>
                              <Tooltip label="Edit rule">
                                <ActionIcon
                                  variant="light"
                                  color="blue"
                                  onClick={() => handleEditClick(rule.id)}
                                  disabled={!canWriteStock}
                                >
                                  <IconEdit size={16} />
                                </ActionIcon>
                              </Tooltip>

                              <Tooltip label="Archive rule">
                                <ActionIcon
                                  variant="light"
                                  color="red"
                                  onClick={() => openDeleteConfirm(rule)}
                                  disabled={!canWriteStock}
                                  data-testid="archive-approval-rule-btn"
                                >
                                  <IconArchive size={16} />
                                </ActionIcon>
                              </Tooltip>
                            </>
                          ) : (
                            <Tooltip label="Restore rule">
                              <ActionIcon
                                variant="light"
                                color="green"
                                onClick={() => openRestoreConfirm(rule)}
                                disabled={!canWriteStock}
                                data-testid="restore-approval-rule-btn"
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

      {/* Create/Edit Rule Modal */}
      <CreateApprovalRuleModal
        opened={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setEditRuleId(undefined);
        }}
        onSuccess={handleCreateSuccess}
        editRuleId={editRuleId}
      />

      {/* Archive Confirmation Modal */}
      <Modal
        opened={deleteConfirmOpen}
        onClose={() => {
          if (!isDeleting) {
            setDeleteConfirmOpen(false);
            setRuleToDelete(null);
          }
        }}
        title="Archive Approval Rule"
        centered
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to archive the approval rule{" "}
            <strong>{ruleToDelete?.name}</strong>?
          </Text>
          <Text size="sm" c="dimmed">
            This approval rule will be completely hidden from the UI and will not be evaluated in the approval workflow.
            All historical data will be preserved and the rule can be restored at any time.
          </Text>

          <Group justify="flex-end" gap="xs">
            <Button variant="light" onClick={() => setDeleteConfirmOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDeleteConfirm} loading={isDeleting}>
              Archive Rule
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
            setRuleToRestore(null);
          }
        }}
        title="Restore Approval Rule"
        centered
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to restore the approval rule{" "}
            <strong>{ruleToRestore?.name}</strong>?
          </Text>
          <Text size="sm" c="dimmed">
            The rule will be restored with its original active/inactive state and will be visible in the active rules list.
          </Text>

          <Group justify="flex-end" gap="xs">
            <Button variant="light" onClick={() => setRestoreConfirmOpen(false)} disabled={isRestoring}>
              Cancel
            </Button>
            <Button color="green" onClick={handleRestoreConfirm} loading={isRestoring}>
              Restore Rule
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
