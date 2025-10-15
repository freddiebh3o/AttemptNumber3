// admin-web/src/components/analytics/TransferMetricsCards.tsx
import { Grid, Paper, Text, Stack, Group, Tooltip, ActionIcon } from "@mantine/core";
import {
  IconTruck,
  IconHourglass,
  IconCheck,
  IconClock,
  IconInfoCircle,
} from "@tabler/icons-react";

interface MetricsData {
  totalTransfers: number;
  activeTransfers: number;
  avgApprovalTime: number; // Seconds
  avgShipTime: number; // Seconds
}

interface TransferMetricsCardsProps {
  data: MetricsData;
}

function formatTimeSeconds(seconds: number): string {
  if (seconds === 0) return "0 seconds";

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

export default function TransferMetricsCards({ data }: TransferMetricsCardsProps) {
  const metrics = [
    {
      title: "Total Transfers",
      testId: "metric-total-transfers",
      value: data.totalTransfers,
      icon: <IconTruck size={24} />,
      color: "blue",
      tooltip: "Total number of transfers created during the selected date range",
    },
    {
      title: "Active Transfers",
      testId: "metric-active-transfers",
      value: data.activeTransfers,
      icon: <IconHourglass size={24} />,
      color: "yellow",
      tooltip: "Transfers currently in progress (REQUESTED, APPROVED, IN_TRANSIT, or PARTIALLY_RECEIVED status)",
    },
    {
      title: "Avg Approval Time",
      testId: "metric-avg-approval-time",
      value: formatTimeSeconds(data.avgApprovalTime),
      icon: <IconCheck size={24} />,
      color: "green",
      tooltip: "Average time between transfer request and approval (calculated from completed transfers only)",
    },
    {
      title: "Avg Ship Time",
      testId: "metric-avg-ship-time",
      value: formatTimeSeconds(data.avgShipTime),
      icon: <IconClock size={24} />,
      color: "cyan",
      tooltip: "Average time between approval and shipment (calculated from completed transfers only)",
    },
  ];

  return (
    <Grid>
      {metrics.map((metric) => (
        <Grid.Col key={metric.title} span={{ base: 12, xs: 6, md: 3 }}>
          <Paper withBorder p="md" radius="md" data-testid={metric.testId}>
            <Group justify="space-between" align="flex-start">
              <Stack gap="xs" style={{ flex: 1 }}>
                <Group gap="xs" align="center">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    {metric.title}
                  </Text>
                  <Tooltip label={metric.tooltip} multiline w={250} withArrow position="top">
                    <ActionIcon size="xs" variant="subtle" color="gray">
                      <IconInfoCircle size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <Text size="xl" fw={700}>
                  {metric.value}
                </Text>
              </Stack>
              <div style={{ color: `var(--mantine-color-${metric.color}-6)` }}>
                {metric.icon}
              </div>
            </Group>
          </Paper>
        </Grid.Col>
      ))}
    </Grid>
  );
}
