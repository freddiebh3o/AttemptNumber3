import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Group, Loader, Select, Stack, Table, Text, Title } from "@mantine/core";
import { listBranchesApiRequest } from "../../api/branches";
import { getStockLevelsApiRequest } from "../../api/stock";
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
};

export const ProductStockLevelsTab: React.FC<Props> = ({ productId }) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);

  // Map of branchId -> Levels snapshot
  const [levelsByBranch, setLevelsByBranch] = useState<Record<string, Levels | null>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

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
  }, []);

  async function loadAllLevels() {
    if (!branches.length) return;
    const loadFlags: Record<string, boolean> = {};
    const results: Record<string, Levels | null> = {};

    try {
      for (const b of branches) {
        loadFlags[b.id] = true;
      }
      setLoadingMap(loadFlags);

      const promises = branches.map(async (b) => {
        try {
          const r = await getStockLevelsApiRequest({ branchId: b.id, productId });
          results[b.id] = r.success ? r.data : null;
        } catch {
          results[b.id] = null;
        } finally {
          loadFlags[b.id] = false;
          setLoadingMap({ ...loadFlags });
        }
      });

      await Promise.all(promises);
      setLevelsByBranch(results);
    } catch (e) {
      handlePageError(e, { title: "Failed to load stock levels" });
    }
  }

  useEffect(() => {
    // fetch when branches first load
    if (branches.length) {
      void loadAllLevels();
    } else {
      setLevelsByBranch({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches, productId]);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={4}>Current stock levels (all branches)</Title>
        <Button variant="light" onClick={loadAllLevels} disabled={!branches.length}>
          Refresh all
        </Button>
      </Group>

      {loadingBranches ? (
        <Group gap="sm">
          <Loader size="sm" />
          <Text>Loading branches…</Text>
        </Group>
      ) : branches.length === 0 ? (
        <Alert title="No branches" color="gray">
          No branches found for this tenant.
        </Alert>
      ) : (
        <Table striped withTableBorder withColumnBorders stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Branch</Table.Th>
              <Table.Th>On hand</Table.Th>
              <Table.Th>Allocated</Table.Th>
              <Table.Th>Open lots</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {branches.map((b) => {
              const loading = loadingMap[b.id];
              const lvl = levelsByBranch[b.id];
              const openLots = lvl?.lots?.length ?? 0;

              return (
                <Table.Tr key={b.id}>
                  <Table.Td>{b.branchName}</Table.Td>
                  <Table.Td>
                    {loading ? (
                      <Group gap="xs">
                        <Loader size="xs" />
                        <Text size="sm">Loading…</Text>
                      </Group>
                    ) : lvl ? (
                      <Text>{lvl.productStock.qtyOnHand}</Text>
                    ) : (
                      <Text c="dimmed">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {loading ? (
                      <Text c="dimmed">—</Text>
                    ) : lvl ? (
                      <Text>{lvl.productStock.qtyAllocated}</Text>
                    ) : (
                      <Text c="dimmed">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {loading ? <Text c="dimmed">—</Text> : <Badge>{openLots}</Badge>}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
};
