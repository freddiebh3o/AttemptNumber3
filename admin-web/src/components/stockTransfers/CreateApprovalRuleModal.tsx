// admin-web/src/components/stockTransfers/CreateApprovalRuleModal.tsx
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
  Switch,
  Radio,
  Paper,
  Title,
} from "@mantine/core";
import { IconPlus, IconTrash, IconGripVertical } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  createApprovalRuleApiRequest,
  getApprovalRuleApiRequest,
  updateApprovalRuleApiRequest,
} from "../../api/transferApprovalRules";
import { listBranchesApiRequest } from "../../api/branches";
import { listRolesApiRequest } from "../../api/roles";
import { listTenantUsersApiRequest } from "../../api/tenantUsers";

interface CreateApprovalRuleModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editRuleId?: string;
}

interface RuleCondition {
  conditionType: "TOTAL_QTY_THRESHOLD" | "TOTAL_VALUE_THRESHOLD" | "SOURCE_BRANCH" | "DESTINATION_BRANCH" | "PRODUCT_CATEGORY";
  threshold?: number;
  branchId?: string;
}

interface ApprovalLevel {
  level: number;
  name: string;
  approverType: "role" | "user";
  requiredRoleId?: string;
  requiredUserId?: string;
}

const APPROVAL_MODES = [
  { value: "SEQUENTIAL", label: "Sequential", description: "Approvals must happen in order (1 → 2 → 3)" },
  { value: "PARALLEL", label: "Parallel", description: "All approvals can happen simultaneously" },
  { value: "HYBRID", label: "Hybrid", description: "Mix of sequential and parallel (advanced)" },
];

const CONDITION_TYPES = [
  { value: "TOTAL_QTY_THRESHOLD", label: "Total Quantity Threshold" },
  { value: "TOTAL_VALUE_THRESHOLD", label: "Total Value Threshold (pence)" },
  { value: "SOURCE_BRANCH", label: "Source Branch" },
  { value: "DESTINATION_BRANCH", label: "Destination Branch" },
];

export default function CreateApprovalRuleModal({
  opened,
  onClose,
  onSuccess,
  editRuleId,
}: CreateApprovalRuleModalProps) {
  // Form state
  const [ruleName, setRuleName] = useState("");
  const [description, setDescription] = useState("");
  const [approvalMode, setApprovalMode] = useState<"SEQUENTIAL" | "PARALLEL" | "HYBRID">("SEQUENTIAL");
  const [priority, setPriority] = useState<number>(100);
  const [isActive, setIsActive] = useState(true);
  const [conditions, setConditions] = useState<RuleCondition[]>([]);
  const [levels, setLevels] = useState<ApprovalLevel[]>([]);

  // Data for dropdowns
  const [branches, setBranches] = useState<Array<{ value: string; label: string }>>([]);
  const [roles, setRoles] = useState<Array<{ value: string; label: string }>>([]);
  const [users, setUsers] = useState<Array<{ value: string; label: string }>>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingRule, setIsLoadingRule] = useState(false);

  // Load dropdown data when modal opens
  useEffect(() => {
    if (!opened) return;

    async function loadData() {
      setIsLoadingData(true);
      try {
        const [branchesResp, rolesResp, usersResp] = await Promise.all([
          listBranchesApiRequest({ limit: 100, isActive: true }),
          listRolesApiRequest({ limit: 100 }),
          listTenantUsersApiRequest({ limit: 100 }),
        ]);

        if (branchesResp.success) {
          setBranches(
            branchesResp.data.items.map((b) => ({
              value: b.id,
              label: b.branchName,
            }))
          );
        }

        if (rolesResp.success) {
          setRoles(
            rolesResp.data.items.map((r) => ({
              value: r.id,
              label: r.name,
            }))
          );
        }

        if (usersResp.success) {
          setUsers(
            usersResp.data.items.map((u) => ({
              value: u.userId,
              label: u.userEmailAddress ?? "Unknown",
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

  // Load rule data if editing
  useEffect(() => {
    if (!opened || !editRuleId) return;

    async function loadRule() {
      if (!editRuleId) return;

      setIsLoadingRule(true);
      try {
        const response = await getApprovalRuleApiRequest(editRuleId);

        if (response.success) {
          const rule = response.data;
          setRuleName(rule.name);
          setDescription(rule.description ?? "");
          setApprovalMode(rule.approvalMode);
          setPriority(rule.priority);
          setIsActive(rule.isActive);

          setConditions(
            rule.conditions.map((c) => ({
              conditionType: c.conditionType,
              threshold: c.threshold ?? undefined,
              branchId: c.branchId ?? undefined,
            }))
          );

          setLevels(
            rule.levels.map((l) => ({
              level: l.level,
              name: l.name,
              approverType: l.requiredRoleId ? "role" : "user",
              requiredRoleId: l.requiredRoleId ?? undefined,
              requiredUserId: l.requiredUserId ?? undefined,
            }))
          );
        }
      } catch (error: any) {
        notifications.show({
          color: "red",
          message: error?.message ?? "Failed to load rule",
        });
      } finally {
        setIsLoadingRule(false);
      }
    }

    void loadRule();
  }, [opened, editRuleId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!opened) {
      setRuleName("");
      setDescription("");
      setApprovalMode("SEQUENTIAL");
      setPriority(100);
      setIsActive(true);
      setConditions([]);
      setLevels([]);
    }
  }, [opened]);

  // Condition management
  function addCondition() {
    setConditions([...conditions, { conditionType: "TOTAL_QTY_THRESHOLD", threshold: 0 }]);
  }

  function removeCondition(index: number) {
    setConditions(conditions.filter((_, i) => i !== index));
  }

  function updateCondition(index: number, updates: Partial<RuleCondition>) {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setConditions(newConditions);
  }

  // Level management
  function addLevel() {
    const nextLevel = levels.length > 0 ? Math.max(...levels.map((l) => l.level)) + 1 : 1;
    setLevels([
      ...levels,
      { level: nextLevel, name: `Level ${nextLevel}`, approverType: "role", requiredRoleId: "" },
    ]);
  }

  function removeLevel(index: number) {
    const newLevels = levels.filter((_, i) => i !== index);
    // Renumber levels
    newLevels.forEach((level, i) => {
      level.level = i + 1;
    });
    setLevels(newLevels);
  }

  function updateLevel(index: number, updates: Partial<ApprovalLevel>) {
    const newLevels = [...levels];
    newLevels[index] = { ...newLevels[index], ...updates };

    // If changing approver type, clear the other field
    if (updates.approverType === "role") {
      newLevels[index].requiredUserId = undefined;
    } else if (updates.approverType === "user") {
      newLevels[index].requiredRoleId = undefined;
    }

    setLevels(newLevels);
  }

  function moveLevelUp(index: number) {
    if (index === 0) return;
    const newLevels = [...levels];
    [newLevels[index - 1], newLevels[index]] = [newLevels[index], newLevels[index - 1]];
    // Renumber levels
    newLevels.forEach((level, i) => {
      level.level = i + 1;
    });
    setLevels(newLevels);
  }

  function moveLevelDown(index: number) {
    if (index === levels.length - 1) return;
    const newLevels = [...levels];
    [newLevels[index], newLevels[index + 1]] = [newLevels[index + 1], newLevels[index]];
    // Renumber levels
    newLevels.forEach((level, i) => {
      level.level = i + 1;
    });
    setLevels(newLevels);
  }

  async function handleSubmit() {
    // Validation
    if (!ruleName.trim()) {
      notifications.show({ color: "red", message: "Please enter a rule name" });
      return;
    }

    if (conditions.length === 0) {
      notifications.show({ color: "red", message: "Please add at least one condition" });
      return;
    }

    // Validate conditions
    for (const cond of conditions) {
      if (cond.conditionType === "TOTAL_QTY_THRESHOLD" || cond.conditionType === "TOTAL_VALUE_THRESHOLD") {
        if (!cond.threshold || cond.threshold <= 0) {
          notifications.show({ color: "red", message: "Threshold values must be greater than 0" });
          return;
        }
      }
      if (cond.conditionType === "SOURCE_BRANCH" || cond.conditionType === "DESTINATION_BRANCH") {
        if (!cond.branchId) {
          notifications.show({ color: "red", message: "Please select a branch for all branch conditions" });
          return;
        }
      }
    }

    if (levels.length === 0) {
      notifications.show({ color: "red", message: "Please add at least one approval level" });
      return;
    }

    // Validate levels
    for (const level of levels) {
      if (!level.name.trim()) {
        notifications.show({ color: "red", message: "Please provide a name for all approval levels" });
        return;
      }
      if (level.approverType === "role" && !level.requiredRoleId) {
        notifications.show({ color: "red", message: "Please select a role for all role-based approval levels" });
        return;
      }
      if (level.approverType === "user" && !level.requiredUserId) {
        notifications.show({ color: "red", message: "Please select a user for all user-based approval levels" });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: ruleName.trim(),
        description: description.trim() || undefined,
        approvalMode,
        priority,
        isActive,
        conditions: conditions.map((c) => ({
          conditionType: c.conditionType,
          threshold: c.threshold,
          branchId: c.branchId,
        })),
        levels: levels.map((l) => ({
          level: l.level,
          name: l.name.trim(),
          requiredRoleId: l.requiredRoleId,
          requiredUserId: l.requiredUserId,
        })),
      };

      const idempotencyKey = `${editRuleId ? "update" : "create"}-approval-rule-${editRuleId ?? "new"}-${Date.now()}`;

      if (editRuleId) {
        const response = await updateApprovalRuleApiRequest(editRuleId, {
          ...payload,
          idempotencyKeyOptional: idempotencyKey,
        });
        if (response.success) {
          onSuccess();
        }
      } else {
        const response = await createApprovalRuleApiRequest({
          ...payload,
          idempotencyKeyOptional: idempotencyKey,
        });
        if (response.success) {
          onSuccess();
        }
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? `Failed to ${editRuleId ? "update" : "create"} approval rule`,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLoading = isLoadingData || isLoadingRule;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editRuleId ? "Edit Approval Rule" : "Create Approval Rule"}
      size="xl"
    >
      <Stack gap="md">
        {/* Basic Info */}
        <Paper withBorder p="md" radius="md">
          <Title order={5} mb="md">Basic Information</Title>

          <Stack gap="md">
            <TextInput
              label="Rule Name"
              placeholder="e.g. High Value Transfer Approval"
              value={ruleName}
              onChange={(e) => setRuleName(e.currentTarget.value)}
              disabled={isLoading}
              required
              maxLength={100}
            />

            <Textarea
              label="Description (Optional)"
              placeholder="Describe when this rule applies..."
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
              minRows={2}
              maxRows={4}
              maxLength={500}
              disabled={isLoading}
            />

            <Select
              label="Approval Mode"
              placeholder="Select mode"
              data={APPROVAL_MODES}
              value={approvalMode}
              onChange={(v) => setApprovalMode(v as "SEQUENTIAL" | "PARALLEL" | "HYBRID")}
              disabled={isLoading}
              required
            />

            <NumberInput
              label="Priority"
              description="Higher priority rules are evaluated first"
              value={priority}
              onChange={(v) => setPriority(typeof v === "number" ? v : 100)}
              min={0}
              max={1000}
              disabled={isLoading}
            />

            <Switch
              label="Active"
              description="Only active rules are evaluated"
              checked={isActive}
              onChange={(e) => setIsActive(e.currentTarget.checked)}
              disabled={isLoading}
            />
          </Stack>
        </Paper>

        {/* Conditions */}
        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" mb="md">
            <Title order={5}>Conditions</Title>
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={addCondition}
              variant="light"
              disabled={isLoading}
            >
              Add Condition
            </Button>
          </Group>

          {conditions.length === 0 ? (
            <Alert color="blue">Click "Add Condition" to define when this rule applies</Alert>
          ) : (
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Condition Type</Table.Th>
                  <Table.Th>Value</Table.Th>
                  <Table.Th style={{ width: 60 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {conditions.map((cond, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <Select
                        placeholder="Select type"
                        data={CONDITION_TYPES}
                        value={cond.conditionType}
                        onChange={(v) =>
                          updateCondition(index, {
                            conditionType: v as any,
                            threshold: undefined,
                            branchId: undefined,
                          })
                        }
                        disabled={isLoading}
                      />
                    </Table.Td>
                    <Table.Td>
                      {(cond.conditionType === "TOTAL_QTY_THRESHOLD" ||
                        cond.conditionType === "TOTAL_VALUE_THRESHOLD") && (
                        <NumberInput
                          placeholder={
                            cond.conditionType === "TOTAL_QTY_THRESHOLD"
                              ? "Quantity"
                              : "Value in pence"
                          }
                          value={cond.threshold ?? 0}
                          onChange={(v) =>
                            updateCondition(index, {
                              threshold: typeof v === "number" ? v : 0,
                            })
                          }
                          min={1}
                          disabled={isLoading}
                        />
                      )}
                      {(cond.conditionType === "SOURCE_BRANCH" ||
                        cond.conditionType === "DESTINATION_BRANCH") && (
                        <Select
                          placeholder="Select branch"
                          data={branches}
                          value={cond.branchId}
                          onChange={(v) => updateCondition(index, { branchId: v || undefined })}
                          searchable
                          disabled={isLoading}
                        />
                      )}
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        color="red"
                        variant="light"
                        onClick={() => removeCondition(index)}
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
        </Paper>

        {/* Approval Levels */}
        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" mb="md">
            <Title order={5}>Approval Levels</Title>
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={addLevel}
              variant="light"
              disabled={isLoading}
            >
              Add Level
            </Button>
          </Group>

          {levels.length === 0 ? (
            <Alert color="blue">Click "Add Level" to define approval hierarchy</Alert>
          ) : (
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 40 }}></Table.Th>
                  <Table.Th style={{ width: 60 }}>Level</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Approver Type</Table.Th>
                  <Table.Th>Required Approver</Table.Th>
                  <Table.Th style={{ width: 100 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {levels.map((level, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <Stack gap={2}>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          onClick={() => moveLevelUp(index)}
                          disabled={index === 0 || isLoading}
                        >
                          <IconGripVertical size={12} />
                        </ActionIcon>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          onClick={() => moveLevelDown(index)}
                          disabled={index === levels.length - 1 || isLoading}
                        >
                          <IconGripVertical size={12} />
                        </ActionIcon>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>{level.level}</Text>
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        placeholder="e.g. Manager"
                        value={level.name}
                        onChange={(e) => updateLevel(index, { name: e.currentTarget.value })}
                        disabled={isLoading}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Radio.Group
                        value={level.approverType}
                        onChange={(v) => updateLevel(index, { approverType: v as "role" | "user" })}
                      >
                        <Group gap="xs">
                          <Radio value="role" label="Role" disabled={isLoading} />
                          <Radio value="user" label="User" disabled={isLoading} />
                        </Group>
                      </Radio.Group>
                    </Table.Td>
                    <Table.Td>
                      {level.approverType === "role" ? (
                        <Select
                          placeholder="Select role"
                          data={roles}
                          value={level.requiredRoleId}
                          onChange={(v) => updateLevel(index, { requiredRoleId: v || undefined })}
                          searchable
                          disabled={isLoading}
                          data-testid={`approval-level-role-select-${index}`}
                        />
                      ) : (
                        <Select
                          placeholder="Select user"
                          data={users}
                          value={level.requiredUserId}
                          onChange={(v) => updateLevel(index, { requiredUserId: v || undefined })}
                          searchable
                          disabled={isLoading}
                          data-testid={`approval-level-user-select-${index}`}
                        />
                      )}
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        color="red"
                        variant="light"
                        onClick={() => removeLevel(index)}
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
        </Paper>

        {/* Submit */}
        <Group justify="flex-end" gap="xs">
          <Button variant="light" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isSubmitting} disabled={isLoading}>
            {editRuleId ? "Update Rule" : "Create Rule"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
