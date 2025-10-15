// admin-web/src/components/analytics/BranchDependencyTable.tsx
import { Paper, Title, Table, Text, Group, Tooltip, ActionIcon } from "@mantine/core";
import { IconArrowRight, IconInfoCircle } from "@tabler/icons-react";

interface DependencyData {
  sourceBranch: string;
  destinationBranch: string;
  transferCount: number;
  totalUnits: number;
}

interface BranchDependencyTableProps {
  data: DependencyData[];
}

export default function BranchDependencyTable({
  data,
}: BranchDependencyTableProps) {
  return (
    <Paper withBorder p="md" radius="md" data-testid="table-branch-dependencies">
      <Group justify="space-between" mb="md">
        <Title order={5}>Branch Dependencies</Title>
        <Tooltip
          label="Shows which branches depend on others for stock. Higher counts indicate stronger dependencies."
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
          No branch dependency data available
        </Text>
      ) : (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Source Branch</Table.Th>
              <Table.Th></Table.Th>
              <Table.Th>Destination Branch</Table.Th>
              <Table.Th>Transfer Count</Table.Th>
              <Table.Th>Total Units</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((dep, index) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {dep.sourceBranch}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group justify="center">
                    <IconArrowRight size={16} color="gray" />
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {dep.destinationBranch}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{dep.transferCount}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{dep.totalUnits}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Text size="xs" c="dimmed" mt="sm">
        Shows the volume of transfers between branches
      </Text>
    </Paper>
  );
}
