// admin-web/src/components/products/ProductStockLevelsTab.tsx
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Group, Loader, Stack, Table, Text, Title } from "@mantine/core";
import { getStockLevelsBulkApiRequest } from "../../api/stock";
import { handlePageError } from "../../utils/pageError";

type Props = { productId: string };

export const ProductStockLevelsTab: React.FC<Props> = ({ productId }) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<
    Array<{
      branchId: string;
      branchName: string;
      productStock: { qtyOnHand: number; qtyAllocated: number };
      lots: Array<{ id: string }>;
    }>
  >([]);

  async function load() {
    setLoading(true);
    try {
      const res = await getStockLevelsBulkApiRequest({ productId });
      if (res.success) {
        setItems(
          (res.data.items ?? []).map((row: any) => ({
            branchId: row.branchId,
            branchName: row.branchName,
            productStock: row.productStock,
            lots: row.lots ?? [],
          }))
        );
      }
    } catch (e) {
      handlePageError(e, { title: "Failed to load stock levels" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={4}>Current stock levels (all branches)</Title>
        <Button variant="light" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </Group>

      {loading ? (
        <Group gap="sm">
          <Loader size="sm" />
          <Text>Loading…</Text>
        </Group>
      ) : items.length === 0 ? (
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
            {items.map((row) => (
              <Table.Tr key={row.branchId}>
                <Table.Td>{row.branchName}</Table.Td>
                <Table.Td>{row.productStock.qtyOnHand}</Table.Td>
                <Table.Td>{row.productStock.qtyAllocated}</Table.Td>
                <Table.Td>
                  <Badge>{row.lots.length}</Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
};
