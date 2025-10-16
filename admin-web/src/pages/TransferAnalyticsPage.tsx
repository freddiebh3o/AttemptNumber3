// admin-web/src/pages/TransferAnalyticsPage.tsx
import { useEffect, useState } from "react";
import { Title, Group, Button, Select, Grid, Stack, Loader, Alert, Text, Paper, Collapse, Box, List, ThemeIcon } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconRefresh, IconAlertCircle, IconFilter, IconChevronDown, IconChevronUp, IconHelp, IconCheck } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  getOverviewMetricsApiRequest,
  getVolumeChartDataApiRequest,
  getBranchDependenciesApiRequest,
  getTopRoutesApiRequest,
  getStatusDistributionApiRequest,
  getBottlenecksApiRequest,
  getProductFrequencyApiRequest,
} from "../api/transferAnalytics";
import { listBranchesApiRequest } from "../api/branches";
import TransferMetricsCards from "../components/analytics/TransferMetricsCards";
import TransferVolumeChart from "../components/analytics/TransferVolumeChart";
import StatusDistributionChart from "../components/analytics/StatusDistributionChart";
import BottleneckChart from "../components/analytics/BottleneckChart";
import TopRoutesTable from "../components/analytics/TopRoutesTable";
import BranchDependencyTable from "../components/analytics/BranchDependencyTable";
import ProductFrequencyTable from "../components/analytics/ProductFrequencyTable";
import { FilterBar } from "../components/common/FilterBar";
import { buildCommonDatePresets } from "../utils/datePresets";
import { useParams, useSearchParams } from "react-router-dom";

interface AnalyticsData {
  overviewMetrics: {
    totalTransfers: number;
    activeTransfers: number;
    avgApprovalTime: number;
    avgShipTime: number;
  } | null;
  volumeData: Array<{
    date: string;
    created: number;
    approved: number;
    shipped: number;
    completed: number;
  }>;
  branchDeps: Array<{
    sourceBranch: string;
    destinationBranch: string;
    transferCount: number;
    totalUnits: number;
  }>;
  topRoutes: Array<{
    sourceBranch: string;
    destinationBranch: string;
    transferCount: number;
    totalUnits: number;
    avgCompletionTime: number | null;
  }>;
  statusData: Record<string, number>;
  bottlenecks: {
    approvalStage: number;
    shippingStage: number;
    receiptStage: number;
  } | null;
  productFreq: Array<{
    productName: string;
    transferCount: number;
    totalQty: number;
    topRoutes: string[];
  }>;
}

type AnalyticsFilters = {
  startDate: string; // ISO date string YYYY-MM-DD
  endDate: string; // ISO date string YYYY-MM-DD
  branchId: string;
};

// Default: last 30 days
function getDefaultFilters(): AnalyticsFilters {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);

  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
    branchId: "",
  };
}

const emptyAnalyticsFilters: AnalyticsFilters = getDefaultFilters();

// Parse filters from URL search params
function getFiltersFromUrl(searchParams: URLSearchParams): AnalyticsFilters {
  const defaults = getDefaultFilters();
  return {
    startDate: searchParams.get("startDate") || defaults.startDate,
    endDate: searchParams.get("endDate") || defaults.endDate,
    branchId: searchParams.get("branchId") || "",
  };
}

// Convert filters to URL search params
function filtersToSearchParams(filters: AnalyticsFilters): URLSearchParams {
  const params = new URLSearchParams();
  params.set("startDate", filters.startDate);
  params.set("endDate", filters.endDate);
  if (filters.branchId) {
    params.set("branchId", filters.branchId);
  }
  return params;
}

export default function TransferAnalyticsPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const FILTER_PANEL_ID = "analytics-filter-panel";

  // Filters - initialize from URL or defaults
  const [showFilters, setShowFilters] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFilters>(() =>
    getFiltersFromUrl(searchParams)
  );

  // Branch options
  const [branches, setBranches] = useState<Array<{ value: string; label: string }>>([]);

  // Analytics data
  const [data, setData] = useState<AnalyticsData>({
    overviewMetrics: null,
    volumeData: [],
    branchDeps: [],
    topRoutes: [],
    statusData: {},
    bottlenecks: null,
    productFreq: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load branches on mount
  useEffect(() => {
    async function loadBranches() {
      try {
        const response = await listBranchesApiRequest({ limit: 100, isActive: true });
        if (response.success) {
          setBranches([
            { value: "", label: "All Branches" },
            ...response.data.items.map((b) => ({
              value: b.id,
              label: b.branchName,
            })),
          ]);
        }
      } catch (error: any) {
        console.error("Failed to load branches:", error);
      }
    }

    void loadBranches();
  }, []);

  // Fetch all analytics data with specific filters
  async function fetchAnalytics(filters: AnalyticsFilters) {
    setIsLoading(true);
    setError(null);

    try {
      const params = {
        startDate: filters.startDate,
        endDate: filters.endDate,
        branchId: filters.branchId || undefined,
      };

      // Fetch all 7 endpoints in parallel
      const [
        overviewResp,
        volumeResp,
        branchDepsResp,
        topRoutesResp,
        statusResp,
        bottlenecksResp,
        productFreqResp,
      ] = await Promise.all([
        getOverviewMetricsApiRequest(params),
        getVolumeChartDataApiRequest(params),
        getBranchDependenciesApiRequest(params),
        getTopRoutesApiRequest({ ...params, limit: 10 }),
        getStatusDistributionApiRequest(params),
        getBottlenecksApiRequest(params),
        getProductFrequencyApiRequest({ ...params, limit: 10 }),
      ]);

      // Extract data from responses
      setData({
        overviewMetrics: overviewResp.success ? overviewResp.data : null,
        volumeData: volumeResp.success ? volumeResp.data : [],
        branchDeps: branchDepsResp.success ? branchDepsResp.data : [],
        topRoutes: topRoutesResp.success ? topRoutesResp.data : [],
        statusData: statusResp.success ? statusResp.data : {},
        bottlenecks: bottlenecksResp.success ? bottlenecksResp.data : null,
        productFreq: productFreqResp.success ? productFreqResp.data : [],
      });

      // Check if any request failed
      const failedRequests = [
        overviewResp,
        volumeResp,
        branchDepsResp,
        topRoutesResp,
        statusResp,
        bottlenecksResp,
        productFreqResp,
      ].filter((r) => !r.success);

      if (failedRequests.length > 0) {
        setError(`${failedRequests.length} analytics queries failed to load`);
      }
    } catch (error: any) {
      setError(error?.message ?? "Failed to load analytics data");
      notifications.show({
        color: "red",
        message: error?.message ?? "Failed to load analytics data",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Fetch data when filters change
  useEffect(() => {
    void fetchAnalytics(appliedFilters);
  }, [appliedFilters.startDate, appliedFilters.endDate, appliedFilters.branchId, tenantSlug]);

  function applyAndFetch(values: AnalyticsFilters) {
    // Update URL search params
    setSearchParams(filtersToSearchParams(values));
    // Update applied filters (will trigger fetchAnalytics via useEffect)
    setAppliedFilters(values);
  }

  function clearAllFiltersAndFetch() {
    const defaults = getDefaultFilters();
    setSearchParams(filtersToSearchParams(defaults));
    setAppliedFilters(defaults);
  }

  return (
    <div>
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={3}>Transfer Analytics</Title>
            <Text size="sm" c="dimmed">
              Insights and trends for stock transfers
            </Text>
          </div>

          <Group gap="xs">
            <Button
              leftSection={<IconHelp size={16} />}
              variant={showHelp ? "filled" : "light"}
              onClick={() => setShowHelp((s) => !s)}
              rightSection={
                showHelp ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />
              }
            >
              Help
            </Button>

            <Button
              leftSection={<IconFilter size={16} />}
              variant={showFilters ? "filled" : "light"}
              onClick={() => setShowFilters((s) => !s)}
              rightSection={
                showFilters ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />
              }
              aria-expanded={showFilters}
              aria-controls={FILTER_PANEL_ID}
            >
              Filters
            </Button>

            <Button
              leftSection={<IconRefresh size={16} />}
              onClick={() => applyAndFetch(appliedFilters)}
              loading={isLoading}
              variant="light"
            >
              Refresh
            </Button>
          </Group>
        </Group>

        {/* Help Section */}
        <Collapse in={showHelp}>
          <Paper withBorder p="md" radius="md" bg="blue.0">
            <Stack gap="md">
              <div>
                <Title order={5} mb="xs">Understanding Transfer Analytics</Title>
                <Text size="sm" c="dimmed">
                  This dashboard provides insights into your stock transfer patterns, performance, and bottlenecks.
                </Text>
              </div>

              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" fw={600} mb="xs">Key Metrics</Text>
                  <List size="sm" spacing="xs">
                    <List.Item icon={<ThemeIcon size={20} radius="xl" color="blue"><IconCheck size={12} /></ThemeIcon>}>
                      <strong>Total Transfers:</strong> All transfers created in the selected period
                    </List.Item>
                    <List.Item icon={<ThemeIcon size={20} radius="xl" color="blue"><IconCheck size={12} /></ThemeIcon>}>
                      <strong>Active Transfers:</strong> Transfers currently in progress (REQUESTED, APPROVED, IN_TRANSIT)
                    </List.Item>
                    <List.Item icon={<ThemeIcon size={20} radius="xl" color="blue"><IconCheck size={12} /></ThemeIcon>}>
                      <strong>Avg Approval Time:</strong> Average time from request to approval
                    </List.Item>
                    <List.Item icon={<ThemeIcon size={20} radius="xl" color="blue"><IconCheck size={12} /></ThemeIcon>}>
                      <strong>Avg Ship Time:</strong> Average time from approval to shipment
                    </List.Item>
                  </List>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Text size="sm" fw={600} mb="xs">Charts & Tables</Text>
                  <List size="sm" spacing="xs">
                    <List.Item icon={<ThemeIcon size={20} radius="xl" color="blue"><IconCheck size={12} /></ThemeIcon>}>
                      <strong>Volume Chart:</strong> Shows transfer creation trends over time
                    </List.Item>
                    <List.Item icon={<ThemeIcon size={20} radius="xl" color="blue"><IconCheck size={12} /></ThemeIcon>}>
                      <strong>Status Distribution:</strong> Breakdown of transfers by current status
                    </List.Item>
                    <List.Item icon={<ThemeIcon size={20} radius="xl" color="blue"><IconCheck size={12} /></ThemeIcon>}>
                      <strong>Bottlenecks:</strong> Identifies stages with longest average delays
                    </List.Item>
                    <List.Item icon={<ThemeIcon size={20} radius="xl" color="blue"><IconCheck size={12} /></ThemeIcon>}>
                      <strong>Top Routes:</strong> Most frequently used transfer routes between branches
                    </List.Item>
                    <List.Item icon={<ThemeIcon size={20} radius="xl" color="blue"><IconCheck size={12} /></ThemeIcon>}>
                      <strong>Branch Dependencies:</strong> Shows which branches depend on others for stock
                    </List.Item>
                    <List.Item icon={<ThemeIcon size={20} radius="xl" color="blue"><IconCheck size={12} /></ThemeIcon>}>
                      <strong>Product Frequency:</strong> Most frequently transferred products
                    </List.Item>
                  </List>
                </Grid.Col>
              </Grid>

              <Box>
                <Text size="sm" fw={600} mb="xs">Tips</Text>
                <List size="sm" spacing="xs">
                  <List.Item>Use date filters to focus on specific time periods (e.g., last 30 days, last quarter)</List.Item>
                  <List.Item>The branch filter applies only to overview metrics (affects source or destination)</List.Item>
                  <List.Item>Hover over chart elements for detailed values</List.Item>
                  <List.Item>Share filtered views by copying the URL - filters are saved in the link</List.Item>
                </List>
              </Box>
            </Stack>
          </Paper>
        </Collapse>

        {/* Collapsible Filters */}
        <FilterBar<AnalyticsFilters>
          open={showFilters}
          panelId={FILTER_PANEL_ID}
          initialValues={appliedFilters}
          emptyValues={emptyAnalyticsFilters}
          onApply={applyAndFetch}
          onClear={clearAllFiltersAndFetch}
        >
          {({ values, setValues }) => (
            <>
              <Grid gutter="md">
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <DatePickerInput
                    label="Start Date"
                    placeholder="Select start date"
                    value={values.startDate ? new Date(values.startDate) : null}
                    onChange={(v) => {
                      const dateStr = v ? new Date(v).toISOString().split("T")[0] : null;
                      setValues((prev) => ({ ...prev, startDate: dateStr || emptyAnalyticsFilters.startDate }));
                    }}
                    popoverProps={{ withinPortal: true }}
                    presets={buildCommonDatePresets()}
                    clearable={false}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <DatePickerInput
                    label="End Date"
                    placeholder="Select end date"
                    value={values.endDate ? new Date(values.endDate) : null}
                    onChange={(v) => {
                      const dateStr = v ? new Date(v).toISOString().split("T")[0] : null;
                      setValues((prev) => ({ ...prev, endDate: dateStr || emptyAnalyticsFilters.endDate }));
                    }}
                    popoverProps={{ withinPortal: true }}
                    presets={buildCommonDatePresets()}
                    clearable={false}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Select
                    label="Branch Filter"
                    placeholder="All branches"
                    data={branches}
                    value={values.branchId}
                    onChange={(v) => setValues((prev) => ({ ...prev, branchId: v || "" }))}
                    searchable
                    clearable
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Stack gap={0}>
                    <Text size="sm" fw={500} style={{ height: '20px' }}>&nbsp;</Text>
                    <Text size="xs" c="dimmed" mt={4}>
                      Branch filter applies to overview metrics only
                    </Text>
                  </Stack>
                </Grid.Col>
              </Grid>
            </>
          )}
        </FilterBar>

        {/* Error Alert */}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && (
          <Group justify="center" py="xl">
            <Loader />
            <Text>Loading analytics...</Text>
          </Group>
        )}

        {/* Analytics Dashboard */}
        {!isLoading && (
          <Stack gap="lg">
            {/* Overview Metrics Cards */}
            {data.overviewMetrics && (
              <TransferMetricsCards data={data.overviewMetrics} />
            )}

            {/* Volume Chart */}
            <TransferVolumeChart data={data.volumeData} />

            {/* Status and Bottlenecks */}
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <StatusDistributionChart data={data.statusData} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                {data.bottlenecks && <BottleneckChart data={data.bottlenecks} />}
              </Grid.Col>
            </Grid>

            {/* Top Routes Table */}
            <TopRoutesTable data={data.topRoutes} />

            {/* Branch Dependencies */}
            <BranchDependencyTable data={data.branchDeps} />

            {/* Product Frequency */}
            <ProductFrequencyTable data={data.productFreq} />
          </Stack>
        )}
      </Stack>
    </div>
  );
}
