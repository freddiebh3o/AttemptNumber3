// admin-web/src/pages/BranchPage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Badge, Button, Group, Loader, Modal, Paper, Stack, Tabs, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAuthStore } from "../stores/auth";
import { handlePageError } from "../utils/pageError";
import {
  createBranchApiRequest,
  updateBranchApiRequest,
  getBranchApiRequest,
  deleteBranchApiRequest,
  restoreBranchApiRequest,
} from "../api/branches";
import { BranchOverviewTab } from "../components/branches/BranchOverviewTab";
import { BranchActivityTab } from "../components/branches/BranchActivityTab";
import { IconArchive } from "@tabler/icons-react";

type TabKey = "overview" | "activity";

export default function BranchPage() {
  const { tenantSlug, branchId } = useParams<{ tenantSlug: string; branchId?: string }>();
  // Treat /branches/new as create mode
  const isNew = !branchId || branchId === "new";
  const isEdit = !isNew;

  const navigate = useNavigate();
  const canManage = useAuthStore((s) => s.hasPerm("branches:manage"));

  // URL tab state
  const [searchParams, setSearchParams] = useSearchParams();
  const qpTab = (searchParams.get("tab") as TabKey | null) ?? "overview";
  const [activeTab, setActiveTab] = useState<TabKey>(qpTab);
  useEffect(() => setActiveTab(qpTab), [qpTab]);
  function setTabInUrl(tab: TabKey) {
    const next = new URLSearchParams();
    next.set("tab", tab);
    setSearchParams(next, { replace: false });
  }

  // Form state
  const [branchSlug, setBranchSlug] = useState("");
  const [branchName, setBranchName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isArchived, setIsArchived] = useState(false);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // trigger refetch after successful update
  const [refreshTick, setRefreshTick] = useState(0);

  // Load on edit
  useEffect(() => {
    if (!isEdit || !branchId) return;
    let cancelled = false;
    (async () => {
      try {
        setNotFound(false);
        setLoading(true);
        const res = await getBranchApiRequest(branchId);
        if (!cancelled && res.success) {
          const b = res.data.branch;
          setBranchSlug(b.branchSlug);
          setBranchName(b.branchName);
          setIsActive(b.isActive);
          setIsArchived(b.isArchived || false);
        }
      } catch (e: any) {
        if (!cancelled && (e?.httpStatusCode === 404 || e?.status === 404)) {
          setNotFound(true);
        } else {
          handlePageError(e, { title: "Failed to load branch" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, branchId, refreshTick]);

  async function handleSave() {
    if (!branchSlug.trim()) {
      notifications.show({ color: "red", message: "Slug is required" });
      return;
    }
    if (!/^[a-z0-9-]{3,40}$/.test(branchSlug.trim())) {
      notifications.show({ color: "red", message: "Slug must be lowercase, numbers, hyphen (3–40 chars)" });
      return;
    }
    if (!branchName.trim()) {
      notifications.show({ color: "red", message: "Name is required" });
      return;
    }

    setSaving(true);
    try {
      const idempotencyKey = (crypto as any)?.randomUUID?.() ?? String(Date.now());
      if (isNew) {
        const res = await createBranchApiRequest({
          branchSlug: branchSlug.trim(),
          branchName: branchName.trim(),
          isActive,
          idempotencyKeyOptional: idempotencyKey,
        });
        if (res.success) {
          notifications.show({ color: "green", message: "Branch created." });
          const newId = res.data.branch.id as string;
          navigate(`/${tenantSlug}/branches/${newId}?tab=overview`, { replace: true });
          return;
        }
      } else {
        const res = await updateBranchApiRequest({
          branchId: branchId!,
          branchSlug: branchSlug.trim(),
          branchName: branchName.trim(),
          isActive,
          idempotencyKeyOptional: idempotencyKey,
        });
        if (res.success) {
          notifications.show({ color: "green", message: "Branch updated." });
          // Stay on page and refresh latest data
          setRefreshTick((t) => t + 1);
          return;
        }
      }
    } catch (e) {
      handlePageError(e, { title: "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreBranch() {
    if (!branchId) return;
    setSaving(true);
    try {
      const key = (crypto as any)?.randomUUID?.() ?? String(Date.now());
      const res = await restoreBranchApiRequest({
        branchId,
        idempotencyKeyOptional: key,
      });
      if (res.success) {
        notifications.show({ color: "green", message: "Branch restored." });
        setRefreshTick((t) => t + 1);
      }
    } catch (e) {
      handlePageError(e, { title: "Restore failed" });
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveBranch() {
    if (!branchId) return;
    setSaving(true);
    setShowArchiveModal(false);
    try {
      const key = (crypto as any)?.randomUUID?.() ?? String(Date.now());
      const res = await deleteBranchApiRequest({
        branchId,
        idempotencyKeyOptional: key,
      });
      if (res.success) {
        notifications.show({ color: "green", message: "Branch archived successfully." });
        setRefreshTick((t) => t + 1);
      }
    } catch (e) {
      handlePageError(e, { title: "Archive failed" });
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || loading;

  if (isEdit && notFound) {
    return (
      <Paper withBorder radius="md" p="md" className="bg-white">
        <Title order={3} mb="xs">Branch not found</Title>
        <Text c="dimmed" mb="md">We couldn’t find a branch with ID <code>{branchId}</code>.</Text>
        <Group>
          <Button variant="light" onClick={() => navigate(`/${tenantSlug}/branches`)}>Go to branches</Button>
          <Button onClick={() => navigate(`/${tenantSlug}/branches/new`)}>Create a new branch</Button>
        </Group>
      </Paper>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Group justify="space-between" align="start">
        <Group gap="sm">
          <Title order={2}>{isEdit ? "Edit branch" : "New branch"}</Title>
          {!isActive && isEdit && <Badge color="gray">Inactive</Badge>}
          {isEdit && isArchived && (
            <Badge color="gray" size="lg" data-testid="archived-badge">
              Archived
            </Badge>
          )}
        </Group>
        <Group>
          <Button variant="default" onClick={() => navigate(-1)} data-testid="cancel-branch-button">Cancel</Button>
          {isEdit && isArchived && canManage && (
            <Button
              onClick={handleRestoreBranch}
              loading={busy}
              color="blue"
              data-testid="restore-btn"
            >
              Restore
            </Button>
          )}
          {isEdit && !isArchived && canManage && (
            <Button
              onClick={() => setShowArchiveModal(true)}
              variant="light"
              color="red"
              leftSection={<IconArchive size={16} />}
              data-testid="archive-branch-btn"
            >
              Archive Branch
            </Button>
          )}
          {!isArchived && (
            <Button onClick={handleSave} loading={busy} disabled={!canManage} data-testid="save-branch-button">
              Save
            </Button>
          )}
        </Group>
      </Group>

      {busy && isEdit ? (
        <Group gap="sm">
          <Loader size="sm" />
          <Text>Loading…</Text>
        </Group>
      ) : (
        <Tabs
          value={activeTab}
          onChange={(v) => {
            const next = (v as TabKey) ?? "overview";
            setActiveTab(next);
            setTabInUrl(next);
          }}
          keepMounted={false}
        >
          <Tabs.List>
            <Tabs.Tab value="overview">Overview</Tabs.Tab>
            {isEdit && branchId && <Tabs.Tab value="activity">Activity</Tabs.Tab>}
          </Tabs.List>

          <Tabs.Panel value="overview" pt="md">
            <BranchOverviewTab
              isEdit={isEdit}
              branchSlug={branchSlug}
              branchName={branchName}
              isActive={isActive}
              onChangeSlug={setBranchSlug}
              onChangeName={setBranchName}
              onChangeIsActive={setIsActive}
            />
          </Tabs.Panel>

          {isEdit && branchId && (
            <Tabs.Panel value="activity" pt="md">
              <BranchActivityTab branchId={branchId} />
            </Tabs.Panel>
          )}
        </Tabs>
      )}

      {/* Archive Confirmation Modal */}
      <Modal
        opened={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        title="Archive Branch?"
        centered
      >
        <Stack gap="md">
          <Text>
            This branch will be hidden from your active branch list but can be restored at any time.
            All stock history, transfers, and user assignments will be preserved.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={() => setShowArchiveModal(false)}
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleArchiveBranch}
              loading={busy}
            >
              Archive
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
