// admin-web/src/components/common/ImageUploadCard.tsx
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Card,
  Stack,
  Group,
  Text,
  Button,
  AspectRatio,
  Image,
  Box,
  Overlay,
  Loader,
  rem,
} from "@mantine/core";
import { FileButton } from "@mantine/core";

type UploadResult =
  | { url: string; path?: string; contentType?: string; bytes?: number }
  | string;

export type ImageUploadCardProps = {
  /** Current image URL (controlled). */
  value?: string | null;
  /** Called after a successful upload or after remove (with null). */
  onChange?: (url: string | null) => void;

  /** Perform the actual upload and return a URL (or object with url). */
  onUpload: (file: File) => Promise<UploadResult>;

  /** Optional server-side cleanup when removing the image. */
  onRemove?: () => Promise<void> | void;

  /** UI hints */
  label?: string;
  hint?: string;

  /** Validation */
  accept?: string[];
  maxBytes?: number; // e.g. 2 * 1024 * 1024

  /** Presentation */
  width?: number | string; // e.g. 300 | '100%'
  ratio?: number;          // width / height, e.g. 16/10 for “wider than tall”
  radius?: number | string;
  disabled?: boolean;
  alt?: string;
};

export default function ImageUploadCard({
  value,
  onChange,
  onUpload,
  onRemove,
  label = "Image",
  hint,
  accept,
  maxBytes,
  width = 340,
  ratio = 16 / 10, // default: wider than tall
  radius = "md",
  disabled = false,
  alt = "image",
}: ImageUploadCardProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);

  const acceptAttr = useMemo(
    () => (accept && accept.length ? accept.join(",") : undefined),
    [accept]
  );

  const validate = (file: File) => {
    if (accept && accept.length && !accept.includes(file.type)) {
      return `Unsupported type: ${file.type || "unknown"}`;
    }
    if (maxBytes && file.size > maxBytes) {
      return `File too large. Max ${(maxBytes / (1024 * 1024)).toFixed(1)}MB`;
    }
    return null;
  };

  const extractUrl = (r: UploadResult) => (typeof r === "string" ? r : r.url);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file || disabled) return;
      setError(null);

      const problem = validate(file);
      if (problem) {
        setError(problem);
        return;
      }

      try {
        setUploading(true);
        const result = await onUpload(file);
        const url = extractUrl(result);
        if (!url) throw new Error("Upload succeeded but no URL returned");
        onChange?.(url);
      } catch (e: any) {
        setError(e?.message || "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [disabled, onUpload, onChange]
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f) await handleFile(f);
    },
    [handleFile, disabled]
  );

  const onRemoveClick = useCallback(async () => {
    if (disabled) return;
    setError(null);
    try {
      setUploading(true);
      await Promise.resolve(onRemove?.());
      onChange?.(null);
    } catch (e: any) {
      setError(e?.message || "Failed to remove");
    } finally {
      setUploading(false);
    }
  }, [disabled, onRemove, onChange]);

  const EmptyState = (
    <Box
      h="100%"
      w="100%"
      style={{
        border: "1px dashed var(--mantine-color-gray-4)",
        borderRadius: rem(8),
        display: "grid",
        placeItems: "center",
      }}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
      }}
      onDrop={onDrop}
      ref={dropRef}
    >
      <Stack gap={6} align="center">
        <Text size="sm" c="dimmed" ta="center">
          Drag & drop image here
          <br /> or click Upload
        </Text>
        <FileButton onChange={handleFile} accept={acceptAttr} disabled={disabled}>
          {(props) => <Button {...props}>Upload</Button>}
        </FileButton>
        {hint ? (
          <Text size="xs" c="dimmed" ta="center" maw={220}>
            {hint}
          </Text>
        ) : null}
      </Stack>
    </Box>
  );

  return (
    <Card withBorder radius={radius} p="sm" w={width}>
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text fw={600}>{label}</Text>
          {hint ? (
            <Text size="xs" c="dimmed">
              {hint}
            </Text>
          ) : null}
        </Group>

        {/* Single AspectRatio controls the whole preview area */}
        <Box pos="relative">
          <AspectRatio ratio={ratio}>
            <>
              {value ? (
                <Image src={value} alt={alt} fit="contain" radius={radius} />
              ) : (
                EmptyState
              )}

              {/* Bottom action bar overlayed inside the preview area */}
              {value ? (
                <Box
                  pos="absolute"
                  left={0}
                  right={0}
                  bottom={0}
                  p="xs"
                >
                  <Group justify="space-between" pos="absolute" bottom={10} left={10} right={10}>
                    <FileButton
                      onChange={handleFile}
                      accept={acceptAttr}
                      disabled={disabled}
                    >
                      {(props) => (
                        <Button
                          {...props}
                          size="xs"
                          disabled={disabled}
                        >
                          Replace
                        </Button>
                      )}
                    </FileButton>
                    <Button
                      color="red"
                      size="xs"
                      onClick={onRemoveClick}
                      disabled={disabled}
                    >
                      Remove
                    </Button>
                  </Group>
                </Box>
              ) : null}
            </>
          </AspectRatio>

          {uploading && (
            <Overlay blur={2} center>
              <Loader />
            </Overlay>
          )}
        </Box>

        {error ? (
          <Text size="xs" c="red.7">
            {error}
          </Text>
        ) : null}
      </Stack>
    </Card>
  );
}
