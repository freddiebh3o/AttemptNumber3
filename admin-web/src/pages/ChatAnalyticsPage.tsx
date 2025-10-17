// admin-web/src/pages/ChatAnalyticsPage.tsx
import { useState, useEffect } from 'react';
import {
  Title,
  Paper,
  Group,
  Text,
  Stack,
  Grid,
  RingProgress,
  Table,
  Badge,
  Select,
  LoadingOverlay,
  Button,
  Collapse,
  Box,
  List,
  useMantineTheme,
  useComputedColorScheme,
} from '@mantine/core';
import {
  IconMessages,
  IconUsers,
  IconMessageCircle,
  IconTool,
  IconChartBar,
  IconRefresh,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react';
import { getChatAnalyticsApiRequest, type ChatAnalyticsSummary } from '../api/chatAnalytics';
import { notifications } from '@mantine/notifications';

// Stat card component
function StatCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  subtitle?: string;
}) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between">
        <div>
          <Text c="dimmed" tt="uppercase" fw={700} fz="xs">
            {title}
          </Text>
          <Text fw={700} fz="xl" mt="xs">
            {value}
          </Text>
          {subtitle && (
            <Text fz="xs" c="dimmed" mt={4}>
              {subtitle}
            </Text>
          )}
        </div>
        <RingProgress
          size={80}
          roundCaps
          thickness={8}
          sections={[{ value: 100, color }]}
          label={
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Icon size={22} stroke={1.5} />
            </div>
          }
        />
      </Group>
    </Paper>
  );
}

export function ChatAnalyticsPage() {
  const [analytics, setAnalytics] = useState<ChatAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<string>('30'); // days
  const [showHelp, setShowHelp] = useState(true);

  const theme = useMantineTheme();
  const colorScheme = useComputedColorScheme('light');

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const days = parseInt(dateRange, 10);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const response = await getChatAnalyticsApiRequest({
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });

      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load chat analytics',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  if (loading || !analytics) {
    return (
      <LoadingOverlay visible />
    );
  }

  const avgMessages = analytics.averageMessagesPerConversation
    ? analytics.averageMessagesPerConversation.toFixed(1)
    : '0';

  return (
    <Stack gap="xl">
      {/* Header */}
      <Group justify="space-between">
        <div>
          <Title order={2}>Chat Analytics</Title>
          <Text c="dimmed" size="sm" mt={4}>
            AI Chatbot usage statistics and insights
          </Text>
        </div>
        <Group gap="xs">
          <Select
            data={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
            value={dateRange}
            onChange={(value) => value && setDateRange(value)}
            w={150}
            data-testid="date-range-select"
          />
          <Button
            leftSection={<IconRefresh size={16} />}
            title="Refresh"
            onClick={() => loadAnalytics()}
            variant="light"
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {/* Help Section */}
      <Paper
        withBorder
        p="lg"
        radius="md"
        style={{
          backgroundColor:
            colorScheme === 'dark'
              ? theme.colors.dark[6]
              : theme.colors.gray[0],
        }}
      >
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text size="sm" fw={600} c="dimmed">
              Available AI Tools
            </Text>
            <Button
              variant="subtle"
              size="xs"
              onClick={() => setShowHelp((s) => !s)}
              rightSection={
                showHelp ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
              }
            >
              {showHelp ? 'Hide' : 'Show'}
            </Button>
          </Group>

          <Collapse in={showHelp}>
            <Box>
              <Text size="sm" mb="md">
                The AI chatbot has access to the following tools to help answer your questions and perform tasks:
              </Text>

              <Stack gap="md">
                <div>
                  <Text size="sm" fw={600} mb="xs">
                    Product Tools (4):
                  </Text>
                  <List size="sm" spacing="xs">
                    <List.Item><strong>countAllProducts:</strong> Get total count of all products</List.Item>
                    <List.Item><strong>searchProducts:</strong> Search for products by name or SKU</List.Item>
                    <List.Item><strong>getProductDetails:</strong> Get detailed information about a specific product</List.Item>
                    <List.Item><strong>getProductStockAtBranch:</strong> Get current stock level for a product at a specific branch</List.Item>
                  </List>
                </div>

                <div>
                  <Text size="sm" fw={600} mb="xs">
                    Stock Management Tools (4):
                  </Text>
                  <List size="sm" spacing="xs">
                    <List.Item><strong>getStockLevelsAtBranch:</strong> Get current stock levels for all products at a branch</List.Item>
                    <List.Item><strong>viewRecentStockMovements:</strong> View recent stock movements from the ledger</List.Item>
                    <List.Item><strong>findLowStockProducts:</strong> Find products with low stock across branches</List.Item>
                    <List.Item><strong>getProductFifoLots:</strong> Get FIFO lot details for a product</List.Item>
                  </List>
                </div>

                <div>
                  <Text size="sm" fw={600} mb="xs">
                    Transfer Tools (4):
                  </Text>
                  <List size="sm" spacing="xs">
                    <List.Item><strong>countStockTransfers:</strong> Get total count of stock transfers</List.Item>
                    <List.Item><strong>searchStockTransfers:</strong> Search and list stock transfers</List.Item>
                    <List.Item><strong>getTransferDetails:</strong> Get detailed information about a specific transfer</List.Item>
                    <List.Item><strong>checkTransferApprovalProgress:</strong> Check approval progress for a transfer</List.Item>
                  </List>
                </div>

                <div>
                  <Text size="sm" fw={600} mb="xs">
                    Analytics Tools (3):
                  </Text>
                  <List size="sm" spacing="xs">
                    <List.Item><strong>getTransferMetrics:</strong> Get transfer statistics (volume, cycle time, completion rates)</List.Item>
                    <List.Item><strong>getBranchPerformance:</strong> Get branch performance metrics (inbound/outbound volume, fill rates)</List.Item>
                    <List.Item><strong>getStockValueByBranch:</strong> Get total stock value by branch using FIFO cost</List.Item>
                  </List>
                </div>

                <div>
                  <Text size="sm" fw={600} mb="xs">
                    Branch Tools (2):
                  </Text>
                  <List size="sm" spacing="xs">
                    <List.Item><strong>listBranches:</strong> List all branches in the organization</List.Item>
                    <List.Item><strong>getBranchDetails:</strong> Get detailed information about a branch</List.Item>
                  </List>
                </div>

                <div>
                  <Text size="sm" fw={600} mb="xs">
                    User Tools (4):
                  </Text>
                  <List size="sm" spacing="xs">
                    <List.Item><strong>searchUsers:</strong> Search for users by email or name</List.Item>
                    <List.Item><strong>getUserDetails:</strong> Get detailed information about a specific user</List.Item>
                    <List.Item><strong>listRoles:</strong> List all roles with their permissions</List.Item>
                    <List.Item><strong>checkUserPermission:</strong> Check if a user has a specific permission</List.Item>
                  </List>
                </div>

                <div>
                  <Text size="sm" fw={600} mb="xs">
                    Template Tools (2):
                  </Text>
                  <List size="sm" spacing="xs">
                    <List.Item><strong>listTransferTemplates:</strong> List transfer templates for quick transfer creation</List.Item>
                    <List.Item><strong>getTemplateDetails:</strong> Get full details of a transfer template</List.Item>
                  </List>
                </div>

                <div>
                  <Text size="sm" fw={600} mb="xs">
                    Approval Tools (2):
                  </Text>
                  <List size="sm" spacing="xs">
                    <List.Item><strong>listApprovalRules:</strong> List approval rules that determine when transfers need approval</List.Item>
                    <List.Item><strong>explainTransferApprovalNeeds:</strong> Explain why a transfer requires approval</List.Item>
                  </List>
                </div>
              </Stack>

              <Text size="xs" c="dimmed" mt="md">
                <strong>Total: 23 tools</strong> available to help you manage your inventory and answer questions about your business.
              </Text>
            </Box>
          </Collapse>
        </Stack>
      </Paper>

      {/* Key Metrics */}
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Conversations"
            value={analytics.totalConversations}
            icon={IconMessageCircle}
            color="blue"
            subtitle={`${dateRange} days`}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Messages"
            value={analytics.totalMessages}
            icon={IconMessages}
            color="green"
            subtitle={`User + Assistant`}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Active Users"
            value={analytics.uniqueUsers}
            icon={IconUsers}
            color="violet"
            subtitle="Unique users"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Avg Messages/Conv"
            value={avgMessages}
            icon={IconChartBar}
            color="orange"
            subtitle="Conversation length"
          />
        </Grid.Col>
      </Grid>

      {/* Top Tools */}
      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" mb="md">
          <div>
            <Group gap="xs">
              <IconTool size={20} />
              <Title order={4}>Most Used Tools</Title>
            </Group>
            <Text size="sm" c="dimmed" mt={4}>
              Top 5 tools used by the AI assistant
            </Text>
          </div>
          <Badge size="lg" variant="light" color="blue">
            {analytics.totalToolCalls} total calls
          </Badge>
        </Group>

        <Table data-testid="top-tools-table">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Rank</Table.Th>
              <Table.Th>Tool Name</Table.Th>
              <Table.Th>Usage Count</Table.Th>
              <Table.Th>Percentage</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {analytics.topTools.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text c="dimmed" ta="center" py="xl">
                    No tool usage data yet
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              analytics.topTools.map((tool, index) => {
                const percentage = ((tool.count / analytics.totalToolCalls) * 100).toFixed(1);
                return (
                  <Table.Tr key={tool.name}>
                    <Table.Td>
                      <Badge variant="filled" color="blue" size="lg">
                        #{index + 1}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>{tool.name}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color="gray">
                        {tool.count} calls
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text>{percentage}%</Text>
                    </Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Daily Breakdown */}
      {analytics.dailyData.length > 0 && (
        <Paper withBorder p="md" radius="md">
          <Title order={4} mb="md">
            Daily Breakdown
          </Title>
          <Table striped highlightOnHover data-testid="daily-data-table">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Conversations</Table.Th>
                <Table.Th>Messages</Table.Th>
                <Table.Th>Users</Table.Th>
                <Table.Th>Avg Msgs/Conv</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {analytics.dailyData.slice().reverse().map((day) => {
                // Calculate average on-the-fly if not available
                const avgForDay = day.avgMessagesPerConversation
                  ? day.avgMessagesPerConversation.toFixed(1)
                  : day.totalConversations > 0
                  ? (day.totalMessages / day.totalConversations).toFixed(1)
                  : '-';

                return (
                  <Table.Tr key={day.id}>
                    <Table.Td>
                      <Text fw={500}>
                        {new Date(day.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                    </Table.Td>
                    <Table.Td>{day.totalConversations}</Table.Td>
                    <Table.Td>{day.totalMessages}</Table.Td>
                    <Table.Td>{day.uniqueUsers}</Table.Td>
                    <Table.Td>{avgForDay}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </Stack>
);
}
