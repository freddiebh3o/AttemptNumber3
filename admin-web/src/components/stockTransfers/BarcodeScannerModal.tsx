// admin-web/src/components/stockTransfers/BarcodeScannerModal.tsx
import { useState, useEffect, useRef } from "react";
import {
  Modal,
  Button,
  Stack,
  Group,
  Text,
  Table,
  Alert,
  Badge,
  NumberInput,
  Paper,
  ActionIcon,
  TextInput,
  Loader,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconCheck,
  IconX,
  IconQrcode,
  IconAlertTriangle,
  IconBarcode,
  IconKeyboard,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { Html5Qrcode } from "html5-qrcode";
import { getProductByBarcodeApiRequest } from "../../api/products";
import { receiveStockTransferApiRequest } from "../../api/stockTransfers";
import type { StockTransfer } from "../../api/stockTransfers";

interface BarcodeScannerModalProps {
  opened: boolean;
  onClose: () => void;
  transfer: StockTransfer | null;
  branchId: string;
  onSuccess: () => void;
}

interface ScannedItem {
  productId: string;
  productName: string;
  productSku: string;
  barcode: string;
  qtyScanned: number;
  qtyExpected: number;
  itemId: string;
}

export default function BarcodeScannerModal({
  opened,
  onClose,
  transfer,
  branchId,
  onSuccess,
}: BarcodeScannerModalProps) {
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [manualEntryMode, setManualEntryMode] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = "barcode-scanner-reader";

  // Audio feedback
  const playBeep = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  // Haptic feedback (mobile)
  const vibrate = () => {
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
  };

  // Initialize scanner when modal opens
  useEffect(() => {
    if (opened && !manualEntryMode) {
      // Delay to allow DOM to render (Mantine Modal transition)
      const timer = setTimeout(() => {
        void startScanner();
      }, 300);

      return () => {
        clearTimeout(timer);
        void stopScanner();
      };
    }

    return () => {
      void stopScanner();
    };
  }, [opened, manualEntryMode]);

  async function startScanner() {
    setScannerError(null);

    try {
      const scanner = new Html5Qrcode(readerElementId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" }, // Use rear camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        handleBarcodeScanned,
        undefined // error callback (optional)
      );
    } catch (error: any) {
      console.error("Failed to start scanner:", error);
      setScannerError(
        error?.message || "Failed to start camera. Please check permissions."
      );
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
        scannerRef.current = null;
      } catch (error) {
        console.error("Failed to stop scanner:", error);
      }
    }
  }

  async function handleBarcodeScanned(decodedText: string) {
    // Debounce rapid scans
    if (isLookingUp) return;

    await processBarcode(decodedText);
  }

  async function processBarcode(barcode: string) {
    if (!transfer) return;

    setIsLookingUp(true);

    try {
      // Look up product by barcode
      const response = await getProductByBarcodeApiRequest({
        barcode,
        branchId,
      });

      if (!response.success) {
        notifications.show({
          color: "red",
          message: "Barcode not found",
        });
        return;
      }

      const product = response.data.product;

      // Check if product is in this transfer
      const transferItem = transfer.items.find(
        (item) => item.product?.id === product.id
      );

      if (!transferItem) {
        notifications.show({
          color: "red",
          message: `${product.productName} is not in this transfer`,
        });
        return;
      }

      // Check if already fully received
      const remaining = transferItem.qtyShipped - transferItem.qtyReceived;
      if (remaining <= 0) {
        notifications.show({
          color: "yellow",
          message: `${product.productName} already fully received`,
        });
        return;
      }

      // Add or increment scanned item
      let isOverReceiving = false;
      setScannedItems((prev) => {
        const existing = prev.find((item) => item.productId === product.id);

        if (existing) {
          // Increment qty
          const newQty = existing.qtyScanned + 1;

          // Check if over-receiving
          isOverReceiving = newQty > remaining;

          return prev.map((item) =>
            item.productId === product.id
              ? { ...item, qtyScanned: newQty }
              : item
          );
        } else {
          // Add new item
          return [
            ...prev,
            {
              productId: product.id,
              productName: product.productName,
              productSku: product.productSku,
              barcode: product.barcode || barcode,
              qtyScanned: 1,
              qtyExpected: remaining,
              itemId: transferItem.id,
            },
          ];
        }
      });

      // Feedback
      playBeep();
      vibrate();

      // Show notification - warning if over-receiving, success otherwise
      if (isOverReceiving) {
        notifications.show({
          color: "orange",
          message: `Warning: Scanning more than expected for ${product.productName}`,
          autoClose: 2000,
        });
      } else {
        notifications.show({
          color: "green",
          message: `Scanned: ${product.productName}`,
          autoClose: 1000,
        });
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Failed to lookup barcode",
      });
    } finally {
      setIsLookingUp(false);
    }
  }

  async function handleManualEntry() {
    if (!manualBarcode.trim()) {
      notifications.show({
        color: "red",
        message: "Please enter a barcode",
      });
      return;
    }

    await processBarcode(manualBarcode.trim());
    setManualBarcode("");
  }

  function updateScannedQty(productId: string, qty: number) {
    setScannedItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, qtyScanned: qty } : item
      )
    );
  }

  function removeScannedItem(productId: string) {
    setScannedItems((prev) => prev.filter((item) => item.productId !== productId));
  }

  async function handleSubmit() {
    if (!transfer) return;

    const itemsToReceive = scannedItems.filter((item) => item.qtyScanned > 0);

    if (itemsToReceive.length === 0) {
      notifications.show({
        color: "red",
        message: "Please scan at least one item",
      });
      return;
    }

    // Validate quantities
    for (const item of itemsToReceive) {
      if (item.qtyScanned > item.qtyExpected) {
        const confirm = window.confirm(
          `You are receiving ${item.qtyScanned} of ${item.productName} but only ${item.qtyExpected} were shipped. Continue?`
        );
        if (!confirm) return;
      }
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey = `receive-barcode-${transfer.id}-${Date.now()}`;
      const response = await receiveStockTransferApiRequest(transfer.id, {
        items: itemsToReceive.map((item) => ({
          itemId: item.itemId,
          qtyReceived: item.qtyScanned,
        })),
        idempotencyKeyOptional: idempotencyKey,
      });

      if (response.success) {
        await stopScanner();
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

  async function handleClose() {
    await stopScanner();
    setScannedItems([]);
    setManualEntryMode(false);
    setManualBarcode("");
    onClose();
  }

  if (!transfer) return null;

  const hasScannedItems = scannedItems.length > 0;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconBarcode size={24} />
          <Text fw={600}>Scan to Receive</Text>
        </Group>
      }
      size="xl"
      fullScreen={!manualEntryMode}
      styles={{
        body: { height: manualEntryMode ? "auto" : "calc(100vh - 100px)" },
      }}
    >
      <Stack gap="md" style={{ height: "100%" }}>
        <Alert icon={<IconAlertCircle size={16} />} color="blue">
          <Text size="sm">
            Transfer: <strong>{transfer.transferNumber}</strong>
          </Text>
          <Text size="sm">
            From: <strong>{transfer.sourceBranch?.branchName ?? "Unknown"}</strong>
          </Text>
        </Alert>

        <Group justify="space-between">
          <Button
            leftSection={manualEntryMode ? <IconQrcode size={16} /> : <IconKeyboard size={16} />}
            variant="light"
            onClick={async () => {
              if (!manualEntryMode) {
                await stopScanner();
              }
              setManualEntryMode(!manualEntryMode);
            }}
            disabled={isSubmitting}
          >
            {manualEntryMode ? "Switch to Camera" : "Manual Entry"}
          </Button>
        </Group>

        {manualEntryMode ? (
          <Paper withBorder p="md">
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Enter barcode manually or use a USB barcode scanner
              </Text>
              <Group align="end">
                <TextInput
                  label="Barcode"
                  placeholder="Scan or type barcode..."
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void handleManualEntry();
                    }
                  }}
                  disabled={isLookingUp || isSubmitting}
                  style={{ flex: 1 }}
                  autoFocus
                />
                <Button
                  onClick={handleManualEntry}
                  loading={isLookingUp}
                  disabled={isSubmitting}
                >
                  Add
                </Button>
              </Group>
            </Stack>
          </Paper>
        ) : (
          <Paper withBorder p="md" style={{ flex: 1 }}>
            {scannerError ? (
              <Alert icon={<IconAlertTriangle size={16} />} color="red">
                {scannerError}
              </Alert>
            ) : (
              <Stack gap="md" style={{ height: "100%" }}>
                <div
                  id={readerElementId}
                  style={{
                    width: "100%",
                    height: "400px",
                    border: "2px solid #228be6",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                />
                <Text size="sm" ta="center" c="dimmed">
                  Point camera at barcode
                </Text>
                {isLookingUp && (
                  <Group justify="center">
                    <Loader size="sm" />
                    <Text size="sm">Looking up product...</Text>
                  </Group>
                )}
              </Stack>
            )}
          </Paper>
        )}

        {hasScannedItems && (
          <Paper withBorder p="md">
            <Text size="sm" fw={600} mb="md">
              Scanned Items ({scannedItems.length})
            </Text>
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Product</Table.Th>
                  <Table.Th>Scanned</Table.Th>
                  <Table.Th>Expected</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {scannedItems.map((item) => {
                  const isComplete = item.qtyScanned === item.qtyExpected;
                  const isOver = item.qtyScanned > item.qtyExpected;
                  const isPartial = item.qtyScanned < item.qtyExpected;

                  return (
                    <Table.Tr key={item.productId}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {item.productName}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {item.productSku}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          value={item.qtyScanned}
                          onChange={(v) =>
                            updateScannedQty(
                              item.productId,
                              typeof v === "number" ? v : 0
                            )
                          }
                          min={0}
                          w={80}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{item.qtyExpected}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={isComplete ? "green" : isOver ? "orange" : "blue"}
                          leftSection={
                            isComplete ? (
                              <IconCheck size={12} />
                            ) : isOver ? (
                              <IconAlertTriangle size={12} />
                            ) : null
                          }
                        >
                          {isComplete
                            ? "Complete"
                            : isOver
                            ? "Over"
                            : isPartial
                            ? "Partial"
                            : "Unknown"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() => removeScannedItem(item.productId)}
                          disabled={isSubmitting}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Paper>
        )}

        <Group justify="flex-end" gap="xs">
          <Button variant="light" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          {hasScannedItems && (
            <Button onClick={handleSubmit} loading={isSubmitting} color="green">
              Receive All Scanned Items
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
