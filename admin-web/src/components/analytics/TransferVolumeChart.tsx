// admin-web/src/components/analytics/TransferVolumeChart.tsx
import { Paper, Title, Text, Group, Tooltip as MantineTooltip, ActionIcon } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatDateUK } from "../../utils/dateFormatter";

interface VolumeDataPoint {
  date: string; // YYYY-MM-DD
  created: number;
  approved: number;
  shipped: number;
  completed: number;
}

interface TransferVolumeChartProps {
  data: VolumeDataPoint[];
}

export default function TransferVolumeChart({ data }: TransferVolumeChartProps) {
  // Format date for display using British format (dd/mm/yyyy)
  const chartData = data.map((point) => ({
    ...point,
    displayDate: formatDateUK(point.date),
  }));

  return (
    <Paper withBorder p="md" radius="md" data-testid="chart-transfer-volume">
      <Group justify="space-between" mb="md">
        <Title order={5}>Transfer Volume Over Time</Title>
        <MantineTooltip
          label="Shows the number of transfers created, approved, shipped, and completed each day. Use this to identify busy periods and workflow velocity."
          multiline
          w={300}
          withArrow
        >
          <ActionIcon size="sm" variant="subtle" color="gray">
            <IconInfoCircle size={16} />
          </ActionIcon>
        </MantineTooltip>
      </Group>

      {data.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No transfer data available for the selected period
        </Text>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ fontSize: 12 }}
              formatter={(value: number) => value.toFixed(0)}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="created"
              stroke="#339af0"
              name="Created"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="approved"
              stroke="#51cf66"
              name="Approved"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="shipped"
              stroke="#ff6b6b"
              name="Shipped"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="completed"
              stroke="#7950f2"
              name="Completed"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
}
