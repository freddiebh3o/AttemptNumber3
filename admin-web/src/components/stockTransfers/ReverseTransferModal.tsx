// admin-web/src/components/stockTransfers/ReverseTransferModal.tsx
import { useState } from "react";
import {
  Modal,
  Button,
  Stack,
  Group,
  Text,
  Textarea,
  Alert,
  Table,
  Paper,
  Divider,
} from "@mantine/core";
import { IconAlertCircle, IconArrowRight, IconArrowBack } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { reverseStockTransferApiRequest } from "../../api/stockTransfers";
import type { StockTransfer } from "../../api/stockTransfers";

interface ReverseTransferModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transfer: StockTransfer;
}

export default function ReverseTransferModal({
  opened,
  onClose,
  onSuccess,
  transfer,
}: ReverseTransferModalProps) {
  const [reversalReason, setReversalReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      const idempotencyKey = `reverse-transfer-${transfer.id}-${Date.now()}`;
      const response = await reverseStockTransferApiRequest(transfer.id, {
        reversalReason: reversalReason.trim() || undefined,
        idempotencyKeyOptional: idempotencyKey,
      });

      if (response.success) {
        onSuccess();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Failed to reverse transfer",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Reverse Stock Transfer"
      size="lg"
    >
      <Stack gap="md">
        <Alert icon={<IconAlertCircle size={16} />} color="orange" title="Warning">
          Reversing this transfer will create a new transfer in the opposite direction to undo the
          stock movement. This action cannot be undone.
        </Alert>

        {/* Original Transfer Details */}
        <Paper withBorder p="md" radius="md">
          <Text size="sm" fw={600} mb="xs">
            Original Transfer Details
          </Text>

          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Transfer Number:
              </Text>
              <Text size="sm" fw={500}>
                {transfer.transferNumber}
              </Text>
            </Group>

            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Status:
              </Text>
              <Text size="sm" fw={500}>
                {transfer.status}
              </Text>
            </Group>

            <Divider />

            <Group justify="space-between" align="center">
              <Text size="sm" c="dimmed">
                Current Route:
              </Text>
              <Group gap={4} wrap="nowrap">
                <Text size="sm" fw={500}>
                  {transfer.sourceBranch?.branchName ?? "Unknown"}
                </Text>
                <IconArrowRight size={14} />
                <Text size="sm" fw={500}>
                  {transfer.destinationBranch?.branchName ?? "Unknown"}
                </Text>
              </Group>
            </Group>

            <Group justify="space-between" align="center">
              <Text size="sm" c="dimmed">
                Reversal Route:
              </Text>
              <Group gap={4} wrap="nowrap">
                <Text size="sm" fw={500} c="orange">
                  {transfer.destinationBranch?.branchName ?? "Unknown"}
                </Text>
                <IconArrowBack size={14} color="orange" />
                <Text size="sm" fw={500} c="orange">
                  {transfer.sourceBranch?.branchName ?? "Unknown"}
                </Text>
              </Group>
            </Group>

            <Divider />

            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Requested At:
              </Text>
              <Text size="sm">
                {new Date(transfer.requestedAt).toLocaleString()}
              </Text>
            </Group>

            {transfer.completedAt && (
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Completed At:
                </Text>
                <Text size="sm">
                  {new Date(transfer.completedAt).toLocaleString()}
                </Text>
              </Group>
            )}
          </Stack>
        </Paper>

        {/* Items Summary */}
        <Paper withBorder p="md" radius="md">
          <Text size="sm" fw={600} mb="xs">
            Items to Reverse
          </Text>

          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Product</Table.Th>
                <Table.Th>Quantity Received</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {transfer.items.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Text size="sm">{item.product?.productName ?? "Unknown"}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {item.qtyReceived}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>

        {/* Reversal Reason */}
        <Textarea
          label="Reversal Reason (Optional but Recommended)"
          placeholder="Why is this transfer being reversed?"
          value={reversalReason}
          onChange={(e) => setReversalReason(e.currentTarget.value)}
          minRows={3}
          maxLength={1000}
        />

        <Alert icon={<IconAlertCircle size={16} />} color="blue">
          A new transfer will be created from {transfer.destinationBranch?.branchName} to{" "}
          {transfer.sourceBranch?.branchName} with the same quantities that were received.
        </Alert>

        <Group justify="flex-end" gap="xs">
          <Button variant="light" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button color="orange" onClick={handleSubmit} loading={isSubmitting}>
            Reverse Transfer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
