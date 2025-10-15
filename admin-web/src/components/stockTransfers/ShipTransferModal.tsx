// admin-web/src/components/stockTransfers/ShipTransferModal.tsx
import { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Stack,
  Table,
  Text,
  NumberInput,
  Alert,
  Group,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { shipStockTransferApiRequest } from "../../api/stockTransfers";
import type { StockTransfer } from "../../api/stockTransfers";

interface ShipTransferModalProps {
  opened: boolean;
  onClose: () => void;
  transfer: StockTransfer;
  onSuccess: () => void;
}

interface ItemToShip {
  itemId: string;
  productId: string;
  productName: string;
  qtyApproved: number;
  qtyAlreadyShipped: number;
  qtyRemaining: number;
  qtyToShip: number;
}

export default function ShipTransferModal({
  opened,
  onClose,
  transfer,
  onSuccess,
}: ShipTransferModalProps) {
  const [items, setItems] = useState<ItemToShip[]>([]);
  const [isShipping, setIsShipping] = useState(false);

  // Initialize items from transfer
  useEffect(() => {
    if (!opened) return;

    const itemsToShip: ItemToShip[] = transfer.items.map((item) => {
      const qtyApproved = item.qtyApproved ?? 0;
      const qtyShipped = item.qtyShipped ?? 0;
      const qtyRemaining = qtyApproved - qtyShipped;

      return {
        itemId: item.id,
        productId: item.productId,
        productName: item.product?.productName ?? "Unknown",
        qtyApproved,
        qtyAlreadyShipped: qtyShipped,
        qtyRemaining,
        qtyToShip: qtyRemaining, // Default: ship all remaining
      };
    });

    setItems(itemsToShip);
  }, [opened, transfer]);

  function updateQtyToShip(index: number, qty: number) {
    const newItems = [...items];
    newItems[index].qtyToShip = qty;
    setItems(newItems);
  }

  async function handleShip() {
    // Validation: check all quantities
    for (const item of items) {
      if (item.qtyToShip < 0) {
        notifications.show({
          color: "red",
          message: `Invalid quantity for ${item.productName}`,
        });
        return;
      }

      if (item.qtyToShip > item.qtyRemaining) {
        notifications.show({
          color: "red",
          message: `Cannot ship more than remaining quantity for ${item.productName}`,
        });
        return;
      }
    }

    // Filter items to ship (only those with qtyToShip > 0)
    const itemsToShip = items
      .filter((item) => item.qtyToShip > 0)
      .map((item) => ({
        itemId: item.itemId,
        qtyToShip: item.qtyToShip,
      }));

    if (itemsToShip.length === 0) {
      notifications.show({
        color: "red",
        message: "Please enter quantities to ship",
      });
      return;
    }

    setIsShipping(true);
    try {
      const idempotencyKey = `ship-${transfer.id}-${Date.now()}`;
      const response = await shipStockTransferApiRequest(
        transfer.id,
        itemsToShip,
        idempotencyKey
      );

      if (response.success) {
        onSuccess();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Failed to ship transfer",
      });
    } finally {
      setIsShipping(false);
    }
  }

  const hasPartialShipment = items.some(
    (item) => item.qtyToShip > 0 && item.qtyToShip < item.qtyRemaining
  );

  const totalToShip = items.reduce((sum, item) => sum + item.qtyToShip, 0);

  return (
    <Modal opened={opened} onClose={onClose} title="Ship Transfer" size="xl">
      <Stack gap="md">
        <Alert color="blue">
          You can ship partial quantities if needed. Items will be shipped in batches.
        </Alert>

        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Product</Table.Th>
              <Table.Th>Approved Qty</Table.Th>
              <Table.Th>Already Shipped</Table.Th>
              <Table.Th>Remaining</Table.Th>
              <Table.Th>Ship Now</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item, index) => (
              <Table.Tr key={item.itemId}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {item.productName}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{item.qtyApproved}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{item.qtyAlreadyShipped}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {item.qtyRemaining}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    value={item.qtyToShip}
                    onChange={(val) =>
                      updateQtyToShip(index, typeof val === "number" ? val : 0)
                    }
                    min={0}
                    max={item.qtyRemaining}
                    w={100}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {/* Summary */}
        <Group justify="space-between">
          <Text size="sm" fw={500}>
            Total items to ship: {totalToShip} units
          </Text>
        </Group>

        {/* Warnings */}
        {hasPartialShipment && (
          <Alert icon={<IconAlertCircle size={16} />} color="yellow">
            Partial shipment: Some items will not be fully shipped. The transfer will remain
            in APPROVED status until all items are shipped.
          </Alert>
        )}

        <Group justify="flex-end" gap="xs">
          <Button variant="light" onClick={onClose} disabled={isShipping}>
            Cancel
          </Button>
          <Button onClick={handleShip} loading={isShipping}>
            Ship Items
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
