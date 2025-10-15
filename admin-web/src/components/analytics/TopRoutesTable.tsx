// admin-web/src/components/analytics/TopRoutesTable.tsx
import { useState } from "react";
import {
  Paper,
  Title,
  Table,
  Text,
  Group,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowsSort,
  IconArrowUp,
  IconArrowDown,
  IconArrowRight,
  IconInfoCircle,
} from "@tabler/icons-react";

interface RouteData {
  sourceBranch: string;
  destinationBranch: string;
  transferCount: number;
  totalUnits: number;
  avgCompletionTime: number | null; // Seconds
}

interface TopRoutesTableProps {
  data: RouteData[];
}

type SortField = "transferCount" | "totalUnits" | "avgCompletionTime";
type SortDir = "asc" | "desc";

function formatTimeSeconds(seconds: number | null): string {
  if (seconds === null || seconds === 0) return "N/A";

  const hours = seconds / 3600;
  const days = hours / 24;

  if (days >= 1) {
    return `${days.toFixed(1)} days`;
  } else if (hours >= 1) {
    return `${hours.toFixed(1)} hours`;
  } else {
    return `${seconds.toFixed(0)} seconds`;
  }
}

export default function TopRoutesTable({ data }: TopRoutesTableProps) {
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
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    // Handle null values
    if (aVal === null) aVal = 0;
    if (bVal === null) bVal = 0;

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
    <Paper withBorder p="md" radius="md" data-testid="table-top-routes">
      <Group justify="space-between" mb="md">
        <Title order={5}>Top Transfer Routes</Title>
        <Tooltip
          label="Most frequently used transfer routes. Click column headers to sort by transfers, units, or completion time."
          multiline
          w={300}
          withArrow
        >
          <ActionIcon size="sm" variant="subtle" color="gray">
            <IconInfoCircle size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {data.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No route data available
        </Text>
      ) : (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Route</Table.Th>
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
                  <span>Total Units</span>
                  <Tooltip label="Sort by total units">
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      onClick={() => toggleSort("totalUnits")}
                    >
                      <SortIcon active={sortBy === "totalUnits"} dir={sortDir} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Table.Th>
              <Table.Th>
                <Group gap="xs" wrap="nowrap">
                  <span>Avg Time</span>
                  <Tooltip label="Sort by completion time">
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      onClick={() => toggleSort("avgCompletionTime")}
                    >
                      <SortIcon
                        active={sortBy === "avgCompletionTime"}
                        dir={sortDir}
                      />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedData.map((route, index) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm">{route.sourceBranch}</Text>
                    <IconArrowRight size={14} />
                    <Text size="sm">{route.destinationBranch}</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{route.transferCount}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{route.totalUnits}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {formatTimeSeconds(route.avgCompletionTime)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}
