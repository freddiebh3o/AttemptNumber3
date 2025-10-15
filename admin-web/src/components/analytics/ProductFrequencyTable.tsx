// admin-web/src/components/analytics/ProductFrequencyTable.tsx
import { useState } from "react";
import {
  Paper,
  Title,
  Table,
  Text,
  Group,
  ActionIcon,
  Tooltip,
  Badge,
} from "@mantine/core";
import { IconArrowsSort, IconArrowUp, IconArrowDown, IconInfoCircle } from "@tabler/icons-react";

interface ProductFrequencyData {
  productName: string;
  transferCount: number;
  totalQty: number;
  topRoutes: string[]; // Top 3 routes for this product
}

interface ProductFrequencyTableProps {
  data: ProductFrequencyData[];
}

type SortField = "transferCount" | "totalQty";
type SortDir = "asc" | "desc";

export default function ProductFrequencyTable({
  data,
}: ProductFrequencyTableProps) {
  const [sortBy, setSortBy] = useState<SortField>("transferCount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  }

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    const multiplier = sortDir === "asc" ? 1 : -1;
    return (aVal > bVal ? 1 : aVal < bVal ? -1 : 0) * multiplier;
  });

  function SortIcon({
    active,
    dir,
  }: {
    active: boolean;
    dir: SortDir;
  }) {
    if (!active) return <IconArrowsSort size={14} />;
    return dir === "asc" ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />;
  }

  return (
    <Paper withBorder p="md" radius="md" data-testid="table-product-frequency">
      <Group justify="space-between" mb="md">
        <Title order={5}>Most Transferred Products</Title>
        <Tooltip
          label="Products that are transferred most frequently. Top routes show the most common source-destination pairs for each product."
          multiline
          w={320}
          withArrow
        >
          <ActionIcon size="sm" variant="subtle" color="gray">
            <IconInfoCircle size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {data.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No product frequency data available
        </Text>
      ) : (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Product Name</Table.Th>
              <Table.Th>
                <Group gap="xs" wrap="nowrap">
                  <span>Transfers</span>
                  <Tooltip label="Sort by transfer count">
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      onClick={() => toggleSort("transferCount")}
                    >
                      <SortIcon
                        active={sortBy === "transferCount"}
                        dir={sortDir}
                      />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Table.Th>
              <Table.Th>
                <Group gap="xs" wrap="nowrap">
                  <span>Total Qty</span>
                  <Tooltip label="Sort by total quantity">
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      onClick={() => toggleSort("totalQty")}
                    >
                      <SortIcon active={sortBy === "totalQty"} dir={sortDir} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Table.Th>
              <Table.Th>Top Routes</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedData.map((product, index) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {product.productName}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{product.transferCount}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{product.totalQty}</Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {product.topRoutes.map((route, idx) => (
                      <Badge key={idx} size="sm" variant="light">
                        {route}
                      </Badge>
                    ))}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Text size="xs" c="dimmed" mt="sm">
        Showing top 3 routes for each product
      </Text>
    </Paper>
  );
}
