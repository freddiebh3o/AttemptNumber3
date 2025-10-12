// admin-web/src/components/stockTransfers/ReviewTransferModal.tsx
import { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Textarea,
  Stack,
  Group,
  Text,
  NumberInput,
  Table,
  Radio,
  Alert,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { reviewStockTransferApiRequest } from "../../api/stockTransfers";
import type { StockTransfer } from "../../api/stockTransfers";

interface ReviewTransferModalProps {
  opened: boolean;
  onClose: () => void;
  transfer: StockTransfer | null;
  onSuccess: () => void;
}

interface ApprovedItem {
  itemId: string;
  qtyApproved: number;
}

export default function ReviewTransferModal({
  opened,
  onClose,
  transfer,
  onSuccess,
}: ReviewTransferModalProps) {
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [reviewNotes, setReviewNotes] = useState("");
  const [approvedItems, setApprovedItems] = useState<ApprovedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize approved items when modal opens
  useEffect(() => {
    if (!opened || !transfer) return;

    // Default to requested quantities
    setApprovedItems(
      transfer.items.map((item) => ({
        itemId: item.id,
        qtyApproved: item.qtyRequested,
      }))
    );
    setAction("approve");
    setReviewNotes("");
  }, [opened, transfer]);

  function updateApprovedQty(itemId: string, qty: number) {
    setApprovedItems(
      approvedItems.map((item) =>
        item.itemId === itemId ? { ...item, qtyApproved: qty } : item
      )
    );
  }

  async function handleSubmit() {
    if (!transfer) return;

    // Validation
    if (action === "reject" && !reviewNotes.trim()) {
      notifications.show({
        color: "red",
        message: "Please provide a reason for rejection",
      });
      return;
    }

    if (action === "approve") {
      // Check that all approved quantities are valid
      for (const item of approvedItems) {
        if (item.qtyApproved < 0) {
          notifications.show({
            color: "red",
            message: "Approved quantities cannot be negative",
          });
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = `review-${transfer.id}-${Date.now()}`;
      const response = await reviewStockTransferApiRequest(transfer.id, {
        action,
        reviewNotes: reviewNotes.trim() || undefined,
        items: action === "approve" ? approvedItems : undefined,
        idempotencyKeyOptional: idempotencyKey,
      });

      if (response.success) {
        onSuccess();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Failed to review transfer",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!transfer) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Review Transfer Request"
      size="lg"
    >
      <Stack gap="md">
        <Alert icon={<IconAlertCircle size={16} />} color="blue">
          <Text size="sm">
            Transfer: <strong>{transfer.transferNumber}</strong>
          </Text>
          <Text size="sm">
            From: <strong>{transfer.sourceBranch?.branchName ?? "Unknown"}</strong> →{" "}
            <strong>{transfer.destinationBranch?.branchName ?? "Unknown"}</strong>
          </Text>
        </Alert>

        <Radio.Group
          label="Decision"
          value={action}
          onChange={(v) => setAction(v as "approve" | "reject")}
        >
          <Group mt="xs">
            <Radio value="approve" label="Approve" />
            <Radio value="reject" label="Reject" />
          </Group>
        </Radio.Group>

        {action === "approve" && (
          <div>
            <Text fw={500} size="sm" mb="xs">
              Adjust Approved Quantities
            </Text>
            <Text size="sm" c="dimmed" mb="md">
              You can approve less than the requested quantity. Set to 0 to exclude
              an item.
            </Text>
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Product</Table.Th>
                  <Table.Th style={{ width: 100 }}>Requested</Table.Th>
                  <Table.Th style={{ width: 120 }}>Approved</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {transfer.items.map((item) => {
                  const approvedItem = approvedItems.find(
                    (ai) => ai.itemId === item.id
                  );

                  return (
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {item.product?.productName ?? "Unknown"}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {item.product?.productSku ?? "-"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{item.qtyRequested}</Text>
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          value={approvedItem?.qtyApproved ?? 0}
                          onChange={(v) =>
                            updateApprovedQty(
                              item.id,
                              typeof v === "number" ? v : 0
                            )
                          }
                          min={0}
                          max={item.qtyRequested}
                        />
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </div>
        )}

        <Textarea
          label={action === "reject" ? "Rejection Reason" : "Review Notes (Optional)"}
          placeholder={
            action === "reject"
              ? "Why are you rejecting this transfer?"
              : "Any notes about this approval?"
          }
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.currentTarget.value)}
          minRows={3}
          maxLength={1000}
          required={action === "reject"}
        />

        {transfer.requestNotes && (
          <div>
            <Text size="sm" fw={500} mb="xs">
              Request Notes:
            </Text>
            <Alert color="gray">{transfer.requestNotes}</Alert>
          </div>
        )}

        <Group justify="flex-end" gap="xs">
          <Button variant="light" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            color={action === "reject" ? "red" : "blue"}
          >
            {action === "reject" ? "Reject Transfer" : "Approve Transfer"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
