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
  Modal,
  Textarea,
  Select,
  Box,
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
  IconShieldCheck,
  IconShieldX,
  IconQrcode,
  IconFileText,
  IconRefresh,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import {
  getStockTransferApiRequest,
  cancelStockTransferApiRequest,
  getApprovalProgressApiRequest,
  submitApprovalApiRequest,
  updateTransferPriorityApiRequest,
  getDispatchNotePdfUrl,
  regenerateDispatchNotePdfApiRequest,
} from "../api/stockTransfers";
import type { StockTransfer } from "../api/stockTransfers";
import { handlePageError } from "../utils/pageError";
import { useAuthStore } from "../stores/auth";
import ReviewTransferModal from "../components/stockTransfers/ReviewTransferModal";
import ReceiveTransferModal from "../components/stockTransfers/ReceiveTransferModal";
import ReverseTransferModal from "../components/stockTransfers/ReverseTransferModal";
import BarcodeScannerModal from "../components/stockTransfers/BarcodeScannerModal";
import ShipTransferModal from "../components/stockTransfers/ShipTransferModal";
import PdfPreviewModal from "../components/stockTransfers/PdfPreviewModal";
import { useFeatureFlag } from "../hooks/useFeatureFlag";
import PriorityBadge from "../components/common/PriorityBadge";
import { formatDateUK, formatDateTimeUK } from "../utils/dateFormatter";

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
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const currentUserRoleId = useAuthStore((s) => {
    const currentTenantSlug = s.currentTenant?.tenantSlug;
    if (!currentTenantSlug) return undefined;
    const membership = s.tenantMemberships.find((m) => m.tenantSlug === currentTenantSlug);
    return membership?.role?.id;
  });

  // Feature flags
  const barcodeScanningEnabled = useFeatureFlag("barcodeScanningEnabled");

  const [isLoading, setIsLoading] = useState(false);
  const [transfer, setTransfer] = useState<StockTransfer | null>(null);
  const [errorForBoundary, setErrorForBoundary] = useState<
    (Error & { httpStatusCode?: number; correlationId?: string }) | null
  >(null);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [reverseModalOpen, setReverseModalOpen] = useState(false);
  const [shipModalOpen, setShipModalOpen] = useState(false);
  const [pdfPreviewModalOpen, setPdfPreviewModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRegeneratingPdf, setIsRegeneratingPdf] = useState(false);

  // Approval state
  const [approvalProgress, setApprovalProgress] = useState<{
    requiresApproval: boolean;
    records: Array<{
      id: string;
      transferId: string;
      level: number;
      levelName: string;
      status: "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";
      requiredRoleId: string | null;
      requiredUserId: string | null;
      approvedByUserId: string | null;
      approvedAt: string | null;
      notes: string | null;
      requiredRole?: { id: string; name: string } | null;
      requiredUser?: { id: string; userEmailAddress: string } | null;
      approvedByUser?: { id: string; userEmailAddress: string } | null;
      createdAt: string;
      updatedAt: string;
    }>;
  } | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<{ level: number; approve: boolean } | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  // Priority edit state
  const [editPriorityModalOpen, setEditPriorityModalOpen] = useState(false);
  const [newPriority, setNewPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);

  async function fetchTransfer() {
    if (!transferId) return;

    setIsLoading(true);
    try {
      const response = await getStockTransferApiRequest(transferId);

      if (response.success) {
        setTransfer(response.data);

        // Fetch approval progress if it's a multi-level approval transfer
        if (response.data.requiresMultiLevelApproval) {
          void fetchApprovalProgress();
        }
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

  async function fetchApprovalProgress() {
    if (!transferId) return;

    try {
      const response = await getApprovalProgressApiRequest(transferId);

      if (response.success) {
        setApprovalProgress(response.data);
      }
    } catch (error: any) {
      // Silently fail - approval progress is supplementary
      console.error("Failed to load approval progress:", error);
    }
  }

  useEffect(() => {
    setTransfer(null);
    setApprovalProgress(null);
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

  // Determine which actions are available based on initiation type
  // PUSH: destination reviews (they receive the stock)
  // PULL: source reviews (they're being asked to send stock)
  const reviewingBranchId = transfer?.initiationType === "PUSH"
    ? transfer?.destinationBranchId
    : transfer?.sourceBranchId;
  const isMemberOfReviewingBranch = reviewingBranchId
    ? userBranchIds.has(reviewingBranchId)
    : false;

  const canApprove =
    canWriteStock &&
    isMemberOfReviewingBranch &&
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
    isMemberOfDestination &&
    transfer?.status === "COMPLETED" &&
    !transfer?.reversedByTransferId;

  const canEditPriority =
    canWriteStock &&
    (isMemberOfSource || isMemberOfDestination) &&
    (transfer?.status === "REQUESTED" || transfer?.status === "APPROVED");

  // PDF permissions
  const hasPdfAvailable =
    transfer?.dispatchNotePdfUrl &&
    (transfer?.status === "IN_TRANSIT" ||
      transfer?.status === "PARTIALLY_RECEIVED" ||
      transfer?.status === "COMPLETED");

  const canRegeneratePdf = canWriteStock && hasPdfAvailable;

  // Check if transfer has partially shipped items
  const hasPartialShipment = transfer?.items.some(
    (item) => item.qtyShipped > 0 && item.qtyShipped < (item.qtyApproved ?? 0)
  );

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

  function handleShipSuccess() {
    setShipModalOpen(false);
    notifications.show({
      color: "green",
      message: "Transfer shipped successfully",
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

  function handleScannerSuccess() {
    setScannerModalOpen(false);
    notifications.show({
      color: "green",
      message: "Items received successfully via barcode scan",
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

  async function handleRegeneratePdf() {
    if (!transfer) return;

    setIsRegeneratingPdf(true);
    try {
      const idempotencyKey = `regenerate-pdf-${transfer.id}-${Date.now()}`;
      const response = await regenerateDispatchNotePdfApiRequest(
        transfer.id,
        idempotencyKey
      );

      if (response.success) {
        notifications.show({
          color: "green",
          message: "Dispatch note PDF regenerated successfully",
        });
        void fetchTransfer();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Failed to regenerate PDF",
      });
    } finally {
      setIsRegeneratingPdf(false);
    }
  }

  function openApprovalModal(level: number, approve: boolean) {
    setApprovalAction({ level, approve });
    setApprovalNotes("");
    setApprovalModalOpen(true);
  }

  async function handleApprovalSubmit() {
    if (!approvalAction || !transferId) return;

    setIsSubmittingApproval(true);
    try {
      const idempotencyKey = `approve-transfer-${transferId}-level-${approvalAction.level}-${Date.now()}`;
      const response = await submitApprovalApiRequest(
        transferId,
        approvalAction.level,
        {
          notes: approvalNotes.trim() || undefined,
          idempotencyKeyOptional: idempotencyKey,
        }
      );

      if (response.success) {
        notifications.show({
          color: "green",
          message: `Level ${approvalAction.level} ${approvalAction.approve ? "approved" : "rejected"} successfully`,
        });
        setApprovalModalOpen(false);
        setApprovalAction(null);
        setApprovalNotes("");
        void fetchTransfer();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Failed to submit approval",
      });
    } finally {
      setIsSubmittingApproval(false);
    }
  }

  async function handlePriorityUpdate() {
    if (!transferId) return;

    setIsUpdatingPriority(true);
    try {
      const response = await updateTransferPriorityApiRequest(transferId, newPriority);

      if (response.success) {
        notifications.show({
          color: "green",
          message: "Transfer priority updated successfully",
        });
        setEditPriorityModalOpen(false);
        void fetchTransfer();
      }
    } catch (error: any) {
      notifications.show({
        color: "red",
        message: error?.message ?? "Failed to update priority",
      });
    } finally {
      setIsUpdatingPriority(false);
    }
  }

  function openEditPriorityModal() {
    if (transfer) {
      setNewPriority(transfer.priority as "LOW" | "NORMAL" | "HIGH" | "URGENT");
      setEditPriorityModalOpen(true);
    }
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
                <Badge color={getStatusColor(transfer.status)} variant="filled" size="lg" data-testid="transfer-status-badge">
                  {transfer.status.replace(/_/g, " ")}
                </Badge>
                <PriorityBadge priority={transfer.priority as "LOW" | "NORMAL" | "HIGH" | "URGENT"} size="lg" />
                <Badge
                  color={transfer.initiationType === "PUSH" ? "blue" : "grape"}
                  variant="light"
                  size="lg"
                  data-testid="transfer-initiation-type"
                >
                  {transfer.initiationType === "PUSH" ? "PUSH (Send)" : "PULL (Request)"}
                </Badge>
              </Group>

              {/* Initiated By Branch */}
              {transfer.initiatedByBranchId && (
                <Group gap="xs">
                  <Text size="sm" c="dimmed">Initiated by:</Text>
                  <Badge
                    color="gray"
                    variant="dot"
                    data-testid="initiated-by-branch"
                  >
                    {transfer.initiationType === "PUSH"
                      ? transfer.sourceBranch?.branchName
                      : transfer.destinationBranch?.branchName}
                  </Badge>
                </Group>
              )}

              {/* Expected Delivery Date */}
              {transfer.expectedDeliveryDate && (
                <Group gap="xs">
                  <Text size="sm" c="dimmed">Expected Delivery:</Text>
                  <Text size="sm" fw={500} data-testid="transfer-expected-delivery">
                    {formatDateUK(transfer.expectedDeliveryDate)}
                  </Text>
                </Group>
              )}
            </Stack>
          </div>
          <Group gap="xs">
            {hasPdfAvailable && (
              <Button
                variant="light"
                color="blue"
                leftSection={<IconFileText size={16} />}
                onClick={() => setPdfPreviewModalOpen(true)}
                data-testid="view-dispatch-note-btn"
              >
                View Dispatch Note
              </Button>
            )}
            {canRegeneratePdf && (
              <Button
                variant="light"
                color="gray"
                leftSection={<IconRefresh size={16} />}
                onClick={handleRegeneratePdf}
                loading={isRegeneratingPdf}
                data-testid="regenerate-pdf-btn"
              >
                Regenerate PDF
              </Button>
            )}
            {canEditPriority && (
              <Button
                variant="light"
                onClick={openEditPriorityModal}
              >
                Edit Priority
              </Button>
            )}
            {canApprove && (
              <Button
                leftSection={<IconCheck size={16} />}
                onClick={() => setReviewModalOpen(true)}
              >
                {transfer.initiationType === "PUSH"
                  ? "Approve Receipt"
                  : "Approve Request"}
              </Button>
            )}
            {canShip && (
              <Button
                leftSection={<IconTruck size={16} />}
                onClick={() => setShipModalOpen(true)}
              >
                {hasPartialShipment ? "Ship Remaining Items" : "Ship Transfer"}
              </Button>
            )}
            {canReceive && (
              <>
                {barcodeScanningEnabled && (
                  <Button
                    leftSection={<IconQrcode size={16} />}
                    onClick={() => setScannerModalOpen(true)}
                    color="green"
                    variant="filled"
                  >
                    Scan to Receive
                  </Button>
                )}
                <Button
                  leftSection={<IconPackage size={16} />}
                  onClick={() => setReceiveModalOpen(true)}
                  color="green"
                  variant={barcodeScanningEnabled ? "light" : "filled"}
                >
                  {barcodeScanningEnabled ? "Manual Receive" : "Receive Items"}
                </Button>
              </>
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

        {/* Reversal Links Section */}
        {(transfer.reversalOf || transfer.reversedBy) && (
          <Paper withBorder p="md" radius="md">
            <Stack gap="md">
              <Title order={5}>Reversal Information</Title>

              {/* Link to original transfer (if this is a reversal) */}
              {transfer.reversalOf && (
                <Box data-testid="reversal-of-section">
                  <Group gap="xs" mb="xs">
                    <IconArrowBack size={16} />
                    <Text size="sm" fw={500}>
                      This is a reversal of:{" "}
                      <Button
                        component="a"
                        href={`/${tenantSlug}/stock-transfers/${transfer.reversalOf.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/${tenantSlug}/stock-transfers/${transfer.reversalOf!.id}`);
                        }}
                        variant="subtle"
                        size="compact-sm"
                        data-testid="reversal-of-link"
                      >
                        {transfer.reversalOf.transferNumber}
                      </Button>
                    </Text>
                  </Group>
                  {transfer.reversalReason && (
                    <Text size="sm" c="dimmed" data-testid="reversal-reason">
                      Reason: {transfer.reversalReason}
                    </Text>
                  )}
                </Box>
              )}

              {/* Link to reversal transfer (if this was reversed) */}
              {transfer.reversedBy && (
                <Box data-testid="reversed-by-section">
                  <Group gap="xs" mb="xs">
                    <IconAlertCircle size={16} />
                    <Text size="sm" fw={500}>
                      This transfer has been reversed by:{" "}
                      <Button
                        component="a"
                        href={`/${tenantSlug}/stock-transfers/${transfer.reversedBy.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/${tenantSlug}/stock-transfers/${transfer.reversedBy!.id}`);
                        }}
                        variant="subtle"
                        size="compact-sm"
                        data-testid="reversed-by-link"
                      >
                        {transfer.reversedBy.transferNumber}
                      </Button>
                    </Text>
                  </Group>
                  {transfer.reversedBy.reversalReason && (
                    <Text size="sm" c="dimmed" data-testid="reversed-by-reason">
                      Reason: {transfer.reversedBy.reversalReason}
                    </Text>
                  )}
                </Box>
              )}
            </Stack>
          </Paper>
        )}

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

        {/* Approval Progress Section */}
        {transfer.requiresMultiLevelApproval && approvalProgress && (
          <Paper withBorder p="md" radius="md">
            <Title order={5} mb="md">
              Approval Progress
            </Title>

            {approvalProgress.records.length === 0 ? (
              <Alert color="blue">No approval levels defined for this transfer</Alert>
            ) : (
              <Stack gap="md">
                {approvalProgress.records.map((record) => {
                  const isApproved = record.status === "APPROVED";
                  const isRejected = record.status === "REJECTED";
                  const isPending = record.status === "PENDING";
                  const isSkipped = record.status === "SKIPPED";

                  // Check if current user can approve this level
                  const canApproveLevel =
                    canWriteStock &&
                    isPending &&
                    ((record.requiredRoleId && record.requiredRoleId === currentUserRoleId) ||
                      (record.requiredUserId && record.requiredUserId === currentUserId));

                  return (
                    <Paper key={record.id} withBorder p="md" radius="sm">
                      <Group justify="space-between" align="start">
                        <div>
                          <Group gap="xs" mb="xs">
                            <Text fw={600}>Level {record.level}: {record.levelName}</Text>
                            <Badge
                              color={
                                isApproved
                                  ? "green"
                                  : isRejected
                                  ? "red"
                                  : isSkipped
                                  ? "gray"
                                  : "yellow"
                              }
                              variant={isPending ? "light" : "filled"}
                            >
                              {record.status}
                            </Badge>
                          </Group>

                          <Text size="sm" c="dimmed" mb="xs">
                            Required:{" "}
                            {record.requiredRole
                              ? `${record.requiredRole.name} role`
                              : record.requiredUser
                              ? record.requiredUser.userEmailAddress
                              : "Unknown"}
                          </Text>

                          {(isApproved || isRejected) && (
                            <>
                              <Text size="sm">
                                {isApproved ? "Approved" : "Rejected"} by:{" "}
                                {record.approvedByUser?.userEmailAddress ?? "Unknown"}
                              </Text>
                              {record.approvedAt && (
                                <Text size="sm" c="dimmed">
                                  {formatDateTimeUK(record.approvedAt)}
                                </Text>
                              )}
                              {record.notes && (
                                <Alert icon={<IconAlertCircle size={16} />} color="blue" mt="xs">
                                  {record.notes}
                                </Alert>
                              )}
                            </>
                          )}
                        </div>

                        {canApproveLevel && (
                          <Group gap="xs">
                            <Button
                              size="xs"
                              color="green"
                              leftSection={<IconShieldCheck size={14} />}
                              onClick={() => openApprovalModal(record.level, true)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="xs"
                              color="red"
                              variant="light"
                              leftSection={<IconShieldX size={14} />}
                              onClick={() => openApprovalModal(record.level, false)}
                            >
                              Reject
                            </Button>
                          </Group>
                        )}
                      </Group>
                    </Paper>
                  );
                })}

                {/* Progress Summary */}
                <div>
                  <Text size="sm" fw={500} mb="xs">
                    Overall Progress
                  </Text>
                  <Progress
                    value={
                      (approvalProgress.records.filter((r) => r.status === "APPROVED").length /
                        approvalProgress.records.length) *
                      100
                    }
                    size="lg"
                    color="green"
                  />
                  <Text size="xs" c="dimmed" mt="xs">
                    {approvalProgress.records.filter((r) => r.status === "APPROVED").length} of{" "}
                    {approvalProgress.records.length} levels approved
                  </Text>
                </div>
              </Stack>
            )}
          </Paper>
        )}

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
                {formatDateTimeUK(transfer.requestedAt)}
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
                  {formatDateTimeUK(transfer.reviewedAt)}
                </Text>
                <Text size="sm">
                  By: {transfer.reviewedByUser?.userEmailAddress ?? "Unknown"}
                </Text>
              </Timeline.Item>
            )}

            {transfer.shippedAt && (
              <Timeline.Item bullet={<IconTruck size={12} />} title="Shipped">
                <Text size="sm" c="dimmed">
                  {formatDateTimeUK(transfer.shippedAt)}
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
                  {formatDateTimeUK(transfer.completedAt)}
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
          <Stack gap="md">
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

                  const hasShipmentBatches = item.shipmentBatches && item.shipmentBatches.length > 0;

                  return (
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Stack gap="xs">
                          <Text size="sm">{item.product?.productName ?? "Unknown"}</Text>
                          {hasShipmentBatches && (
                            <Text size="xs" c="dimmed">
                              {item.shipmentBatches!.length} shipment batch(es)
                            </Text>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td>{item.product?.productSku ?? "-"}</Table.Td>
                      <Table.Td>{item.qtyRequested}</Table.Td>
                      <Table.Td>{item.qtyApproved ?? "-"}</Table.Td>
                      <Table.Td>
                        <Stack gap="xs">
                          <Text size="sm">{item.qtyShipped}</Text>
                          {hasShipmentBatches && (
                            <Progress
                              value={(item.qtyShipped / (item.qtyApproved ?? 1)) * 100}
                              size="xs"
                              color={item.qtyShipped >= (item.qtyApproved ?? 0) ? "green" : "yellow"}
                            />
                          )}
                        </Stack>
                      </Table.Td>
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

            {/* Shipment Batches Details */}
            {transfer.items.some((item) => item.shipmentBatches && item.shipmentBatches.length > 0) && (
              <Paper withBorder p="sm" radius="sm">
                <Title order={6} mb="sm">
                  Shipment History
                </Title>
                <Stack gap="md">
                  {transfer.items.map((item) => {
                    if (!item.shipmentBatches || item.shipmentBatches.length === 0) return null;

                    return (
                      <div key={item.id}>
                        <Text size="sm" fw={500} mb="xs">
                          {item.product?.productName ?? "Unknown"}
                        </Text>
                        <Table withTableBorder>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Batch</Table.Th>
                              <Table.Th>Qty Shipped</Table.Th>
                              <Table.Th>Shipped At</Table.Th>
                              <Table.Th>Shipped By</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {item.shipmentBatches.map((batch, idx) => (
                              <Table.Tr key={idx}>
                                <Table.Td>
                                  <Text size="xs">Batch #{batch.batchNumber}</Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="xs">{batch.qty} units</Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="xs">
                                    {formatDateTimeUK(batch.shippedAt)}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="xs">{batch.shippedByUserId}</Text>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </div>
                    );
                  })}
                </Stack>
              </Paper>
            )}
          </Stack>
        </Paper>

        {/* Notes */}
        {(transfer.requestNotes || transfer.reviewNotes || transfer.orderNotes) && (
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
              {transfer.orderNotes && (
                <div>
                  <Text size="sm" fw={500} mb="xs">
                    Order Notes:
                  </Text>
                  <Alert icon={<IconAlertCircle size={16} />} color="grape" data-testid="transfer-order-notes">
                    {transfer.orderNotes}
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

      <ShipTransferModal
        opened={shipModalOpen}
        onClose={() => setShipModalOpen(false)}
        transfer={transfer}
        onSuccess={handleShipSuccess}
      />

      <ReceiveTransferModal
        opened={receiveModalOpen}
        onClose={() => setReceiveModalOpen(false)}
        transfer={transfer}
        onSuccess={handleReceiveSuccess}
      />

      <BarcodeScannerModal
        opened={scannerModalOpen}
        onClose={() => setScannerModalOpen(false)}
        transfer={transfer}
        branchId={transfer.destinationBranchId}
        onSuccess={handleScannerSuccess}
      />

      <ReverseTransferModal
        opened={reverseModalOpen}
        onClose={() => setReverseModalOpen(false)}
        transfer={transfer}
        onSuccess={handleReverseSuccess}
      />

      {/* PDF Preview Modal */}
      {transfer?.dispatchNotePdfUrl && (
        <PdfPreviewModal
          opened={pdfPreviewModalOpen}
          onClose={() => setPdfPreviewModalOpen(false)}
          pdfUrl={getDispatchNotePdfUrl(transfer.id, "inline")}
          transferNumber={transfer.transferNumber}
        />
      )}

      {/* Priority Edit Modal */}
      <Modal
        opened={editPriorityModalOpen}
        onClose={() => {
          if (!isUpdatingPriority) {
            setEditPriorityModalOpen(false);
          }
        }}
        title="Update Transfer Priority"
        centered
      >
        <Stack gap="md">
          <Select
            label="New Priority"
            placeholder="Select priority"
            data={[
              { value: "URGENT", label: "🔥 Urgent (stock-out)" },
              { value: "HIGH", label: "⬆️ High (promotional)" },
              { value: "NORMAL", label: "➖ Normal" },
              { value: "LOW", label: "⬇️ Low (overstock)" },
            ]}
            value={newPriority}
            onChange={(v) => setNewPriority(v as "LOW" | "NORMAL" | "HIGH" | "URGENT")}
            disabled={isUpdatingPriority}
          />

          <Group justify="flex-end" gap="xs">
            <Button
              variant="light"
              onClick={() => setEditPriorityModalOpen(false)}
              disabled={isUpdatingPriority}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePriorityUpdate}
              loading={isUpdatingPriority}
            >
              Update Priority
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Approval Modal */}
      <Modal
        opened={approvalModalOpen}
        onClose={() => {
          if (!isSubmittingApproval) {
            setApprovalModalOpen(false);
            setApprovalAction(null);
            setApprovalNotes("");
          }
        }}
        title={
          approvalAction
            ? approvalAction.approve
              ? `Approve Level ${approvalAction.level}`
              : `Reject Level ${approvalAction.level}`
            : "Approval"
        }
        centered
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to {approvalAction?.approve ? "approve" : "reject"} this
            approval level?
          </Text>

          <Textarea
            label={`Notes (${approvalAction?.approve ? "Optional" : "Recommended"})`}
            placeholder="Add any comments or reasons..."
            value={approvalNotes}
            onChange={(e) => setApprovalNotes(e.currentTarget.value)}
            minRows={3}
            maxRows={6}
            maxLength={500}
            disabled={isSubmittingApproval}
          />

          <Group justify="flex-end" gap="xs">
            <Button
              variant="light"
              onClick={() => {
                setApprovalModalOpen(false);
                setApprovalAction(null);
                setApprovalNotes("");
              }}
              disabled={isSubmittingApproval}
            >
              Cancel
            </Button>
            <Button
              color={approvalAction?.approve ? "green" : "red"}
              onClick={handleApprovalSubmit}
              loading={isSubmittingApproval}
            >
              {approvalAction?.approve ? "Approve" : "Reject"}
            </Button>
          </Group>
        </Stack>
      </Modal>
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
