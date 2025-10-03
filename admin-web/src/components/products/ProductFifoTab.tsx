import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { listBranchesApiRequest } from "../../api/branches";
import {
  adjustStockApiRequest,
  getStockLevelsApiRequest,
  receiveStockApiRequest,
} from "../../api/stock";
import { notifications } from "@mantine/notifications";
import { handlePageError } from "../../utils/pageError";

type Branch = { id: string; branchName: string };

type Levels = {
  productStock: { qtyOnHand: number; qtyAllocated: number };
  lots: Array<{
    id: string;
    qtyReceived: number;
    qtyRemaining: number;
    unitCostCents?: number | null;
    sourceRef?: string | null;
    receivedAt: string;
  }>;
};

type Props = {
  productId: string;
  canWriteProducts: boolean;
};

export const ProductFifoTab: React.FC<Props> = ({ productId, canWriteProducts }) => {
  // branches + selection
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [branchId, setBranchId] = useState<string | null>(null);

  // levels for selected branch
  const [levels, setLevels] = useState<Levels | null>(null);
  const [loadingLevels, setLoadingLevels] = useState(false);

  // modal state
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockMode, setStockMode] = useState<"increase" | "decrease">("increase");
  const [stockQty, setStockQty] = useState<number | "">("");
  const [stockCostCents, setStockCostCents] = useState<number | "">("");
  const [stockReason, setStockReason] = useState<string>("");
  const [submittingStock, setSubmittingStock] = useState(false);

  // Load branches
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingBranches(true);
        const res = await listBranchesApiRequest({ limit: 100, includeTotal: false });
        if (!cancelled && res.success) {
          const items = (res.data.items ?? []).map((b: any) => ({
            id: b.id,
            branchName: b.branchName,
          }));
          setBranches(items);
          // Preselect first branch if none selected
          if (!branchId && items.length) setBranchId(items[0].id);
        }
      } catch (e) {
        handlePageError(e, { title: "Failed to load branches" });
      } finally {
        if (!cancelled) setLoadingBranches(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load levels when branch changes
  useEffect(() => {
    if (!branchId) {
      setLevels(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingLevels(true);
        const r = await getStockLevelsApiRequest({ branchId, productId });
        if (!cancelled && r.success) setLevels(r.data);
      } catch (e) {
        handlePageError(e, { title: "Failed to load stock levels" });
      } finally {
        if (!cancelled) setLoadingLevels(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId, productId]);

  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: b.id, label: b.branchName })),
    [branches]
  );

  async function doReceive(qty: number, unitCostCents: number, reason?: string) {
    if (!productId || !branchId) return;
    const key = (crypto as any)?.randomUUID?.() ?? String(Date.now());
    const res = await receiveStockApiRequest({
      branchId,
      productId,
      qty,
      unitCostCents,
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
      idempotencyKeyOptional: key,
    });
    if (res.success) {
      notifications.show({ color: "green", message: "Stock received." });
      const r2 = await getStockLevelsApiRequest({ branchId, productId });
      if (r2.success) setLevels(r2.data);
    }
  }

  async function doAdjust(delta: number, reason?: string) {
    if (!productId || !branchId || delta === 0) return;
    const key = (crypto as any)?.randomUUID?.() ?? String(Date.now());
    const res = await adjustStockApiRequest({
      branchId,
      productId,
      qtyDelta: delta,
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
      idempotencyKeyOptional: key,
    });
    if (res.success) {
      notifications.show({ color: "green", message: "Stock adjusted." });
      const r2 = await getStockLevelsApiRequest({ branchId, productId });
      if (r2.success) setLevels(r2.data);
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={4}>FIFO / Ledger</Title>
        <Group>
          <Select
            label="Branch"
            data={branchOptions}
            value={branchId}
            onChange={setBranchId}
            searchable
            required
            disabled={loadingBranches}
            w={280}
          />
          <Button
            variant="light"
            onClick={() => branchId && getStockLevelsApiRequest({ branchId, productId }).then((r) => r.success && setLevels(r.data))}
            disabled={!branchId || loadingLevels}
          >
            Refresh
          </Button>
          <Button onClick={() => setStockModalOpen(true)} disabled={!branchId || !canWriteProducts}>
            Adjust stock
          </Button>
        </Group>
      </Group>

      {/* Placeholder for ledger table (server endpoint not yet available) */}
      <Alert color="blue" title="Ledger view">
        A full movement ledger endpoint isn’t exposed by the API yet. Below we show the
        current open FIFO lots for the selected branch as context. When a ledger list
        endpoint is available, this tab can render the full stock movement history.
      </Alert>

      {loadingLevels ? (
        <Group gap="sm">
          <Loader size="sm" />
          <Text>Loading levels…</Text>
        </Group>
      ) : branchId && levels ? (
        <Paper withBorder radius="md" p="md">
          <Stack gap="sm">
            <Text size="sm">
              On hand: <b>{levels.productStock.qtyOnHand}</b> (allocated: {levels.productStock.qtyAllocated})
            </Text>
            <Table striped withTableBorder withColumnBorders stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Lot</Table.Th>
                  <Table.Th>Received</Table.Th>
                  <Table.Th>Remaining</Table.Th>
                  <Table.Th>Unit cost (¢)</Table.Th>
                  <Table.Th>Source</Table.Th>
                  <Table.Th>Received at</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {levels.lots.map((lot) => (
                  <Table.Tr key={lot.id}>
                    <Table.Td>
                      <Badge>{lot.id.slice(0, 6)}…</Badge>
                    </Table.Td>
                    <Table.Td>{lot.qtyReceived}</Table.Td>
                    <Table.Td>{lot.qtyRemaining}</Table.Td>
                    <Table.Td>{lot.unitCostCents ?? "—"}</Table.Td>
                    <Table.Td>{lot.sourceRef ?? "—"}</Table.Td>
                    <Table.Td>{new Date(lot.receivedAt).toLocaleString()}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        </Paper>
      ) : (
        <Text c="dimmed">Select a branch to view lots and adjust stock.</Text>
      )}

      {/* Adjust / Receive modal */}
      <Modal
        opened={stockModalOpen}
        onClose={() => {
          if (!submittingStock) {
            setStockModalOpen(false);
            setStockQty("");
            setStockCostCents("");
            setStockReason("");
            setStockMode("increase");
          }
        }}
        title="Adjust stock"
        centered
      >
        <Stack gap="md">
          <SegmentedControl
            value={stockMode}
            onChange={(v) => setStockMode(v as "increase" | "decrease")}
            data={[
              { value: "increase", label: "Increase (receive)" },
              { value: "decrease", label: "Decrease (adjust)" },
            ]}
          />

          <NumberInput
            label="Quantity"
            placeholder="e.g. 1"
            min={1}
            required
            value={stockQty}
            onChange={(v) => setStockQty(typeof v === "number" ? v : v === "" ? "" : Number(v))}
          />

          {stockMode === "increase" && (
            <NumberInput
              label="Unit cost (cents)"
              placeholder="e.g. 1299"
              min={0}
              required
              value={stockCostCents}
              onChange={(v) =>
                setStockCostCents(typeof v === "number" ? v : v === "" ? "" : Number(v))
              }
            />
          )}

          <Textarea
            label="Reason (optional)"
            placeholder={
              stockMode === "increase" ? "e.g. supplier delivery" : "e.g. damaged, shrinkage"
            }
            value={stockReason}
            onChange={(e) => setStockReason(e.currentTarget.value)}
            autosize
            minRows={2}
          />

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setStockModalOpen(false)}
              disabled={submittingStock}
            >
              Cancel
            </Button>
            <Button
              loading={submittingStock}
              onClick={async () => {
                if (!productId || !branchId) {
                  notifications.show({ color: "red", message: "Select a branch first." });
                  return;
                }
                const qty = typeof stockQty === "number" ? stockQty : 0;
                if (qty <= 0) {
                  notifications.show({ color: "red", message: "Quantity must be greater than 0." });
                  return;
                }

                setSubmittingStock(true);
                try {
                  if (stockMode === "increase") {
                    const cost = typeof stockCostCents === "number" ? stockCostCents : -1;
                    if (cost < 0) {
                      notifications.show({
                        color: "red",
                        message: "Unit cost (cents) is required.",
                      });
                      setSubmittingStock(false);
                      return;
                    }
                    await doReceive(qty, cost, stockReason);
                  } else {
                    await doAdjust(-qty, stockReason);
                  }

                  setStockModalOpen(false);
                  setStockQty("");
                  setStockCostCents("");
                  setStockReason("");
                  setStockMode("increase");
                } catch (e) {
                  handlePageError(e, { title: "Stock update failed" });
                } finally {
                  setSubmittingStock(false);
                }
              }}
              disabled={!canWriteProducts}
            >
              Submit
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
