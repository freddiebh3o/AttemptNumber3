// admin-web/src/pages/StockTransferDetailPage.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Button,
  Group,
  Table,
  Title,
  Paper,
  Badge,
  Loader,
  Text,
  Stack,
  Timeline,
  Alert,
  Progress,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconX,
  IconTruck,
  IconPackage,
  IconClock,
  IconAlertCircle,
  IconArrowBack,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  getStockTransferApiRequest,
  shipStockTransferApiRequest,
  cancelStockTransferApiRequest,
} from "../api/stockTransfers";
import type { StockTransfer } from "../api/stockTransfers";
import { handlePageError } from "../utils/pageError";
import { useAuthStore } from "../stores/auth";
import ReviewTransferModal from "../components/stockTransfers/ReviewTransferModal";
import ReceiveTransferModal from "../components/stockTransfers/ReceiveTransferModal";
import ReverseTransferModal from "../components/stockTransfers/ReverseTransferModal";

type TransferStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "IN_TRANSIT"
  | "PARTIALLY_RECEIVED"
  | "COMPLETED"
  | "CANCELLED";

function getStatusColor(status: TransferStatus): string {
  switch (status) {
    case "REQUESTED":
      return "yellow";
    case "APPROVED":
      return "blue";
    case "IN_TRANSIT":
      return "cyan";
    case "PARTIALLY_RECEIVED":
      return "grape";
    case "COMPLETED":
      return "green";
    case "REJECTED":
      return "red";
    case "CANCELLED":
      return "gray";
    default:
      return "gray";
  }
}

export default function StockTransferDetailPage() {
  const { tenantSlug, transferId } = useParams<{
    tenantSlug: string;
    transferId: string;
  }>();
  const navigate = useNavigate();

  const canWriteStock = useAuthStore((s) => s.hasPerm("stock:write"));
  const branchMemberships = useAuthStore((s) => s.branchMembershipsCurrentTenant);

  const [isLoading, setIsLoading] = useState(false);
  const [transfer, setTransfer] = useState<StockTransfer | null>(null);
  const [errorForBoundary, setErrorForBoundary] = useState<
    (Error & { httpStatusCode?: number; correlationId?: string }) | null
  >(null);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [reverseModalOpen, setReverseModalOpen] = useState(false);
  const [isShipping, setIsShipping] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  async function fetchTransfer() {
    if (!transferId) return;

    setIsLoading(true);
    try {
      const response = await getStockTransferApiRequest(transferId);

      if (response.success) {
        setTransfer(response.data);
      } else {
        const e = Object.assign(new Error("Failed to load transfer"), {
          httpStatusCode: 500,
        });
        setErrorForBoundary(e);
      }
    } catch (error: any) {
      setErrorForBoundary(handlePageError(error, { title: "Error" }));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setTransfer(null);
    setErrorForBoundary(null);
    void fetchTransfer();
  }, [tenantSlug, transferId]);

  if (errorForBoundary) throw errorForBoundary;

  // Check if user is member of source/destination branches
  const userBranchIds = new Set(branchMemberships.map((b) => b.branchId));
  const isMemberOfSource = transfer
    ? userBranchIds.has(transfer.sourceBranchId)
    : false;
  const isMemberOfDestination = transfer
    ? userBranchIds.has(transfer.destinationBranchId)
    : false;

  // Determine which actions are available
  const canApprove =
    canWriteStock &&
    isMemberOfSource &&
    transfer?.status === "REQUESTED";

  const canShip =
    canWriteStock &&
    isMemberOfSource &&
    transfer?.status === "APPROVED";

  const canReceive =
    canWriteStock &&
    isMemberOfDestination &&
    (transfer?.status === "IN_TRANSIT" || transfer?.status === "PARTIALLY_RECEIVED");

  const canCancel =
    canWriteStock &&
    transfer?.status === "REQUESTED";

  const canReverse =
    canWriteStock &&
    isMemberOfSource &&
    transfer?.status === "COMPLETED" &&
    !transfer?.reversedById;

  async function handleShip() {
    if (!transfer) return;

    setIsShipping(true);
    try {
      const idempotencyKey = `ship-${transfer.id}-${Date.now()}`;
      const response = await shipStockTransferApiRequest(
        transfer.id,
        idempotencyKey
      );

      if (response.success) {
        notifications.show({
          color: "green",
          message: "Transfer shipped successfully",
        });
        void fetchTransfer();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Failed to ship transfer",
      });
    } finally {
      setIsShipping(false);
    }
  }

  async function handleCancel() {
    if (!transfer) return;

    setIsCancelling(true);
    try {
      const idempotencyKey = `cancel-${transfer.id}-${Date.now()}`;
      const response = await cancelStockTransferApiRequest(
        transfer.id,
        idempotencyKey
      );

      if (response.success) {
        notifications.show({
          color: "green",
          message: "Transfer cancelled successfully",
        });
        void fetchTransfer();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Failed to cancel transfer",
      });
    } finally {
      setIsCancelling(false);
    }
  }

  function handleReviewSuccess() {
    setReviewModalOpen(false);
    notifications.show({
      color: "green",
      message: "Transfer reviewed successfully",
    });
    void fetchTransfer();
  }

  function handleReceiveSuccess() {
    setReceiveModalOpen(false);
    notifications.show({
      color: "green",
      message: "Items received successfully",
    });
    void fetchTransfer();
  }

  function handleReverseSuccess() {
    setReverseModalOpen(false);
    notifications.show({
      color: "green",
      message: "Transfer reversed successfully",
    });
    void fetchTransfer();
  }

  if (transfer === null || isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader />
        <Text ml="sm">Loading transfer details...</Text>
      </div>
    );
  }

  return (
    <div>
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="start">
          <div>
            <Group gap="xs" mb="xs">
              <Button
                variant="subtle"
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => navigate(`/${tenantSlug}/stock-transfers`)}
              >
                Back to Transfers
              </Button>
            </Group>
            <Stack gap="xs">
              <Group gap="md" align="center">
                <Title order={3}>{transfer.transferNumber}</Title>
                <Badge color={getStatusColor(transfer.status)} variant="filled" size="lg">
                  {transfer.status.replace(/_/g, " ")}
                </Badge>
              </Group>

              {/* Reversal Info Badges */}
              {transfer.isReversal && transfer.reversalOfId && (
                <Badge color="orange" variant="light" size="md">
                  This is a reversal of another transfer
                </Badge>
              )}

              {transfer.reversedById && (
                <Badge color="red" variant="light" size="md">
                  This transfer has been reversed
                </Badge>
              )}
            </Stack>
          </div>
          <Group gap="xs">
            {canApprove && (
              <Button
                leftSection={<IconCheck size={16} />}
                onClick={() => setReviewModalOpen(true)}
              >
                Review Transfer
              </Button>
            )}
            {canShip && (
              <Button
                leftSection={<IconTruck size={16} />}
                onClick={handleShip}
                loading={isShipping}
              >
                Ship Transfer
              </Button>
            )}
            {canReceive && (
              <Button
                leftSection={<IconPackage size={16} />}
                onClick={() => setReceiveModalOpen(true)}
                color="green"
              >
                Receive Items
              </Button>
            )}
            {canReverse && (
              <Button
                leftSection={<IconArrowBack size={16} />}
                onClick={() => setReverseModalOpen(true)}
                color="orange"
                variant="light"
              >
                Reverse Transfer
              </Button>
            )}
            {canCancel && (
              <Button
                leftSection={<IconX size={16} />}
                color="red"
                variant="light"
                onClick={handleCancel}
                loading={isCancelling}
              >
                Cancel Transfer
              </Button>
            )}
          </Group>
        </Group>

        {/* Branch Information */}
        <Paper withBorder p="md" radius="md">
          <Title order={5} mb="md">
            Transfer Route
          </Title>
          <Group gap="lg" align="center">
            <div>
              <Text size="sm" c="dimmed">
                Source Branch
              </Text>
              <Text fw={500}>{transfer.sourceBranch?.branchName ?? "Unknown"}</Text>
            </div>
            <IconArrowRight size={24} />
            <div>
              <Text size="sm" c="dimmed">
                Destination Branch
              </Text>
              <Text fw={500}>{transfer.destinationBranch?.branchName ?? "Unknown"}</Text>
            </div>
          </Group>
        </Paper>

        {/* Timeline */}
        <Paper withBorder p="md" radius="md">
          <Title order={5} mb="md">
            Timeline
          </Title>
          <Timeline active={getTimelineActive(transfer.status)} bulletSize={24} lineWidth={2}>
            <Timeline.Item
              bullet={<IconClock size={12} />}
              title="Requested"
            >
              <Text size="sm" c="dimmed">
                {new Date(transfer.requestedAt).toLocaleString()}
              </Text>
              <Text size="sm">
                By: {transfer.requestedByUser?.userEmailAddress ?? "Unknown"}
              </Text>
            </Timeline.Item>

            {transfer.reviewedAt && (
              <Timeline.Item
                bullet={
                  transfer.status === "REJECTED" ? (
                    <IconX size={12} />
                  ) : (
                    <IconCheck size={12} />
                  )
                }
                title={transfer.status === "REJECTED" ? "Rejected" : "Approved"}
                color={transfer.status === "REJECTED" ? "red" : "blue"}
              >
                <Text size="sm" c="dimmed">
                  {new Date(transfer.reviewedAt).toLocaleString()}
                </Text>
                <Text size="sm">
                  By: {transfer.reviewedByUser?.userEmailAddress ?? "Unknown"}
                </Text>
              </Timeline.Item>
            )}

            {transfer.shippedAt && (
              <Timeline.Item bullet={<IconTruck size={12} />} title="Shipped">
                <Text size="sm" c="dimmed">
                  {new Date(transfer.shippedAt).toLocaleString()}
                </Text>
                <Text size="sm">
                  By: {transfer.shippedByUser?.userEmailAddress ?? "Unknown"}
                </Text>
              </Timeline.Item>
            )}

            {transfer.completedAt && (
              <Timeline.Item
                bullet={<IconPackage size={12} />}
                title="Completed"
                color="green"
              >
                <Text size="sm" c="dimmed">
                  {new Date(transfer.completedAt).toLocaleString()}
                </Text>
              </Timeline.Item>
            )}
          </Timeline>
        </Paper>

        {/* Items Table */}
        <Paper withBorder p="md" radius="md">
          <Title order={5} mb="md">
            Transfer Items
          </Title>
          <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Product</Table.Th>
                <Table.Th>SKU</Table.Th>
                <Table.Th>Requested</Table.Th>
                <Table.Th>Approved</Table.Th>
                <Table.Th>Shipped</Table.Th>
                <Table.Th>Received</Table.Th>
                <Table.Th>Progress</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {transfer.items.map((item) => {
                const progressPercent =
                  item.qtyShipped > 0
                    ? (item.qtyReceived / item.qtyShipped) * 100
                    : 0;

                return (
                  <Table.Tr key={item.id}>
                    <Table.Td>{item.product?.productName ?? "Unknown"}</Table.Td>
                    <Table.Td>{item.product?.productSku ?? "-"}</Table.Td>
                    <Table.Td>{item.qtyRequested}</Table.Td>
                    <Table.Td>{item.qtyApproved ?? "-"}</Table.Td>
                    <Table.Td>{item.qtyShipped}</Table.Td>
                    <Table.Td>{item.qtyReceived}</Table.Td>
                    <Table.Td>
                      {item.qtyShipped > 0 ? (
                        <Progress value={progressPercent} size="sm" />
                      ) : (
                        <Text size="sm" c="dimmed">
                          Not shipped
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>

        {/* Notes */}
        {(transfer.requestNotes || transfer.reviewNotes) && (
          <Paper withBorder p="md" radius="md">
            <Title order={5} mb="md">
              Notes
            </Title>
            <Stack gap="md">
              {transfer.requestNotes && (
                <div>
                  <Text size="sm" fw={500} mb="xs">
                    Request Notes:
                  </Text>
                  <Alert icon={<IconAlertCircle size={16} />} color="blue">
                    {transfer.requestNotes}
                  </Alert>
                </div>
              )}
              {transfer.reviewNotes && (
                <div>
                  <Text size="sm" fw={500} mb="xs">
                    Review Notes:
                  </Text>
                  <Alert
                    icon={<IconAlertCircle size={16} />}
                    color={transfer.status === "REJECTED" ? "red" : "green"}
                  >
                    {transfer.reviewNotes}
                  </Alert>
                </div>
              )}
            </Stack>
          </Paper>
        )}
      </Stack>

      {/* Modals */}
      <ReviewTransferModal
        opened={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        transfer={transfer}
        onSuccess={handleReviewSuccess}
      />

      <ReceiveTransferModal
        opened={receiveModalOpen}
        onClose={() => setReceiveModalOpen(false)}
        transfer={transfer}
        onSuccess={handleReceiveSuccess}
      />

      <ReverseTransferModal
        opened={reverseModalOpen}
        onClose={() => setReverseModalOpen(false)}
        transfer={transfer}
        onSuccess={handleReverseSuccess}
      />
    </div>
  );
}

function getTimelineActive(status: TransferStatus): number {
  switch (status) {
    case "REQUESTED":
      return 0;
    case "APPROVED":
      return 1;
    case "REJECTED":
      return 1;
    case "IN_TRANSIT":
    case "PARTIALLY_RECEIVED":
      return 2;
    case "COMPLETED":
      return 3;
    case "CANCELLED":
      return 0;
    default:
      return 0;
  }
}
