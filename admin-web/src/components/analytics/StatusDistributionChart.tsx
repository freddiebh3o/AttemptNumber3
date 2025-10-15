// admin-web/src/components/analytics/StatusDistributionChart.tsx
import { Paper, Title, Text, Group, Tooltip as MantineTooltip, ActionIcon } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

interface StatusDistributionChartProps {
  data: Record<string, number>; // e.g., { REQUESTED: 10, APPROVED: 5, ... }
}

// Status colors matching the badge colors in the UI
const STATUS_COLORS: Record<string, string> = {
  REQUESTED: "#fab005", // yellow
  APPROVED: "#339af0", // blue
  IN_TRANSIT: "#22b8cf", // cyan
  PARTIALLY_RECEIVED: "#ae3ec9", // grape
  COMPLETED: "#51cf66", // green
  REJECTED: "#ff6b6b", // red
  CANCELLED: "#868e96", // gray
};

export default function StatusDistributionChart({
  data,
}: StatusDistributionChartProps) {
  // Convert record to array for Recharts
  const chartData = Object.entries(data).map(([status, count]) => ({
    name: status.replace(/_/g, " "),
    value: count,
    status,
  }));

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  // Custom label with percentage
  const renderLabel = (props: any) => {
    const { name, percent } = props;
    return `${name} (${(percent * 100).toFixed(0)}%)`;
  };

  return (
    <Paper withBorder p="md" radius="md" className="h-full" data-testid="chart-status-distribution">
      <Group justify="space-between" mb="md">
        <Title order={5}>Status Distribution</Title>
        <MantineTooltip
          label="Breakdown of all transfers by their current status. Shows where transfers are in the workflow."
          multiline
          w={280}
          withArrow
        >
          <ActionIcon size="sm" variant="subtle" color="gray">
            <IconInfoCircle size={16} />
          </ActionIcon>
        </MantineTooltip>
      </Group>

      {total === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No transfer data available
        </Text>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderLabel}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry) => (
                <Cell
                  key={`cell-${entry.status}`}
                  fill={STATUS_COLORS[entry.status] || "#868e96"}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value} transfers`, "Count"]}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => value.replace(/_/g, " ")}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
}
