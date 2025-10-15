// admin-web/src/components/analytics/BottleneckChart.tsx
import { Paper, Title, Text, Group, Tooltip as MantineTooltip, ActionIcon } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface BottleneckData {
  approvalStage: number; // Seconds: REQUESTED → APPROVED
  shippingStage: number; // Seconds: APPROVED → IN_TRANSIT
  receiptStage: number; // Seconds: IN_TRANSIT → COMPLETED
}

interface BottleneckChartProps {
  data: BottleneckData;
}

function formatTimeSeconds(seconds: number): string {
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

export default function BottleneckChart({ data }: BottleneckChartProps) {
  const chartData = [
    {
      stage: "Approval",
      time: data.approvalStage / 3600, // Convert to hours
      timeSeconds: data.approvalStage,
    },
    {
      stage: "Shipping",
      time: data.shippingStage / 3600,
      timeSeconds: data.shippingStage,
    },
    {
      stage: "Receipt",
      time: data.receiptStage / 3600,
      timeSeconds: data.receiptStage,
    },
  ];

  // Find the slowest stage
  const maxTime = Math.max(data.approvalStage, data.shippingStage, data.receiptStage);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <Paper p="xs" withBorder shadow="sm">
          <Text size="sm" fw={500}>
            {payload[0].payload.stage} Stage
          </Text>
          <Text size="sm">
            {formatTimeSeconds(payload[0].payload.timeSeconds)}
          </Text>
        </Paper>
      );
    }
    return null;
  };

  return (
    <Paper withBorder p="md" radius="md" data-testid="chart-bottleneck-analysis">
      <Group justify="space-between" mb="md">
        <Title order={5}>Bottleneck Analysis</Title>
        <MantineTooltip
          label={
            <>
              Shows average time spent in each workflow stage. The red bar indicates the slowest stage where delays occur.
              <br /><br />
              <strong>Approval Stage:</strong> Time from request creation to manager approval
              <br />
              <strong>Shipping Stage:</strong> Time from approval to when items are shipped
              <br />
              <strong>Receipt Stage:</strong> Time from shipment to when destination receives and completes the transfer
            </>
          }
          multiline
          w={350}
          withArrow
        >
          <ActionIcon size="sm" variant="subtle" color="gray">
            <IconInfoCircle size={16} />
          </ActionIcon>
        </MantineTooltip>
      </Group>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            tick={{ fontSize: 12 }}
            label={{ value: "Average Time (hours)", position: "insideBottom", offset: -5 }}
          />
          <YAxis
            type="category"
            dataKey="stage"
            tick={{ fontSize: 12 }}
            width={80}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="time" radius={[0, 8, 8, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.timeSeconds === maxTime ? "#ff6b6b" : "#339af0"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <Text size="xs" c="dimmed" mt="xs" ta="center">
        Red bar indicates the slowest stage
      </Text>
    </Paper>
  );
}
