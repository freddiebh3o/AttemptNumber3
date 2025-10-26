// admin-web/src/components/stockTransfers/PdfPreviewModal.tsx
import { useState, useEffect } from "react";
import { Modal, Button, Stack, Group, Text, Loader, Alert } from "@mantine/core";
import { IconDownload, IconPrinter, IconAlertCircle } from "@tabler/icons-react";

interface PdfPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  pdfUrl: string;
  transferNumber: string;
}

export default function PdfPreviewModal({
  opened,
  onClose,
  pdfUrl,
  transferNumber,
}: PdfPreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  function handleLoad() {
    setIsLoading(false);
    setHasError(false);
  }

  function handleError() {
    setIsLoading(false);
    setHasError(true);
  }

  // Fallback: Hide loading state after 3 seconds even if onLoad doesn't fire
  // (PDF iframes don't reliably fire onLoad in some browsers)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [pdfUrl]);

  function handleDownload() {
    // Create a temporary link to trigger download
    const downloadUrl = pdfUrl.replace("action=inline", "action=download");
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${transferNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePrint() {
    // Print the iframe content
    const iframe = document.getElementById("pdf-preview-iframe") as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Dispatch Note - ${transferNumber}`}
      size="xl"
      data-testid="pdf-preview-modal"
    >
      <Stack gap="md">
        {/* Action Buttons */}
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Preview dispatch note PDF
          </Text>
          <Group gap="xs">
            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              onClick={handleDownload}
              data-testid="pdf-download-btn"
            >
              Download
            </Button>
            <Button
              variant="light"
              leftSection={<IconPrinter size={16} />}
              onClick={handlePrint}
              data-testid="pdf-print-btn"
            >
              Print
            </Button>
          </Group>
        </Group>

        {/* Loading State */}
        {isLoading && (
          <Group justify="center" p="xl">
            <Loader size="md" />
            <Text size="sm" c="dimmed">
              Loading PDF...
            </Text>
          </Group>
        )}

        {/* Error State */}
        {hasError && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            title="Failed to load PDF"
            data-testid="pdf-error-alert"
          >
            The dispatch note PDF could not be loaded. Please try again or contact support if the
            problem persists.
          </Alert>
        )}

        {/* PDF Embed */}
        <iframe
          id="pdf-preview-iframe"
          src={pdfUrl}
          style={{
            width: "100%",
            height: "600px",
            border: "1px solid #e9ecef",
            borderRadius: "4px",
            display: isLoading || hasError ? "none" : "block",
          }}
          onLoad={handleLoad}
          onError={handleError}
          data-testid="pdf-preview-iframe"
          title={`Dispatch Note - ${transferNumber}`}
        />

        {/* Close Button */}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} data-testid="pdf-preview-close-btn">
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
