// admin-web/src/components/stockTransfers/ReceiveTransferModal.tsx
import { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Stack,
  Group,
  Text,
  NumberInput,
  Table,
  Alert,
  Progress,
} from "@mantine/core";
import { IconAlertCircle, IconCheck } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { receiveStockTransferApiRequest } from "../../api/stockTransfers";
import type { StockTransfer } from "../../api/stockTransfers";

interface ReceiveTransferModalProps {
  opened: boolean;
  onClose: () => void;
  transfer: StockTransfer | null;
  onSuccess: () => void;
}

interface ReceiveItem {
  itemId: string;
  qtyToReceive: number;
  maxQty: number;
}

export default function ReceiveTransferModal({
  opened,
  onClose,
  transfer,
  onSuccess,
}: ReceiveTransferModalProps) {
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize receive items when modal opens
  useEffect(() => {
    if (!opened || !transfer) return;

    // Calculate max qty that can be received for each item
    setReceiveItems(
      transfer.items
        .map((item) => {
          const remaining = item.qtyShipped - item.qtyReceived;
          return {
            itemId: item.id,
            qtyToReceive: remaining, // Default to receiving all remaining
            maxQty: remaining,
          };
        })
        .filter((item) => item.maxQty > 0) // Only show items with qty to receive
    );
  }, [opened, transfer]);

  function updateReceiveQty(itemId: string, qty: number) {
    setReceiveItems(
      receiveItems.map((item) =>
        item.itemId === itemId ? { ...item, qtyToReceive: qty } : item
      )
    );
  }

  async function handleSubmit() {
    if (!transfer) return;

    // Validation
    const itemsToReceive = receiveItems.filter((item) => item.qtyToReceive > 0);

    if (itemsToReceive.length === 0) {
      notifications.show({
        color: "red",
        message: "Please specify quantity to receive for at least one item",
      });
      return;
    }

    // Check that quantities are valid
    for (const item of itemsToReceive) {
      if (item.qtyToReceive > item.maxQty) {
        notifications.show({
          color: "red",
          message: "Cannot receive more than shipped quantity",
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = `receive-${transfer.id}-${Date.now()}`;
      const response = await receiveStockTransferApiRequest(transfer.id, {
        items: itemsToReceive.map((item) => ({
          itemId: item.itemId,
          qtyReceived: item.qtyToReceive,
        })),
        idempotencyKeyOptional: idempotencyKey,
      });

      if (response.success) {
        onSuccess();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Failed to receive items",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!transfer) return null;

  const hasItemsToReceive = receiveItems.length > 0;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Receive Transfer Items"
      size="lg"
    >
      <Stack gap="md">
        <Alert icon={<IconAlertCircle size={16} />} color="blue">
          <Text size="sm">
            Transfer: <strong>{transfer.transferNumber}</strong>
          </Text>
          <Text size="sm">
            From: <strong>{transfer.sourceBranch?.branchName ?? "Unknown"}</strong>
          </Text>
        </Alert>

        {!hasItemsToReceive ? (
          <Alert icon={<IconCheck size={16} />} color="green">
            All items have been fully received. This transfer is complete.
          </Alert>
        ) : (
          <>
            <Text size="sm" c="dimmed">
              Specify how much of each item you are receiving. You can receive items
              in multiple batches if needed.
            </Text>

            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Product</Table.Th>
                  <Table.Th style={{ width: 100 }}>Shipped</Table.Th>
                  <Table.Th style={{ width: 100 }}>Already Received</Table.Th>
                  <Table.Th style={{ width: 100 }}>Remaining</Table.Th>
                  <Table.Th style={{ width: 120 }}>Receive Now</Table.Th>
                  <Table.Th style={{ width: 150 }}>Progress</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {transfer.items.map((item) => {
                  const receiveItem = receiveItems.find(
                    (ri) => ri.itemId === item.id
                  );
                  const remaining = item.qtyShipped - item.qtyReceived;
                  const progressPercent =
                    item.qtyShipped > 0
                      ? (item.qtyReceived / item.qtyShipped) * 100
                      : 0;

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
                        <Text size="sm">{item.qtyShipped}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{item.qtyReceived}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500} c={remaining > 0 ? "blue" : "gray"}>
                          {remaining}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {receiveItem ? (
                          <NumberInput
                            value={receiveItem.qtyToReceive}
                            onChange={(v) =>
                              updateReceiveQty(
                                item.id,
                                typeof v === "number" ? v : 0
                              )
                            }
                            min={0}
                            max={receiveItem.maxQty}
                          />
                        ) : (
                          <Text size="sm" c="dimmed">
                            Complete
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Progress
                          value={progressPercent}
                          size="sm"
                          color={progressPercent === 100 ? "green" : "blue"}
                        />
                        <Text size="xs" c="dimmed" mt={4}>
                          {progressPercent.toFixed(0)}%
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </>
        )}

        <Group justify="flex-end" gap="xs">
          <Button variant="light" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          {hasItemsToReceive && (
            <Button onClick={handleSubmit} loading={isSubmitting} color="green">
              Receive Items
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
