// admin-web/src/components/roles/RoleUpsertModal.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  TextInput,
  Textarea,
  Stack,
  Group,
  Button,
  Checkbox,
  ScrollArea,
  Loader,
  Text,
  Badge,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  listPermissionsApiRequest,
  createRoleApiRequest,
  updateRoleApiRequest,
  type RoleRecord,
  type PermissionRecord,
} from "../../api/roles";
import type { components } from "../../types/openapi";

// alias for the enum-literal union
type PermissionKey = components["schemas"]["PermissionKey"];

type Props = {
  opened: boolean;
  onClose: () => void;
  initialRole?: RoleRecord | null; // null/undefined => create
  onSaved?: (role: RoleRecord) => void;
};

export default function RoleUpsertModal({
  opened,
  onClose,
  initialRole,
  onSaved,
}: Props) {
  const isEdit = Boolean(initialRole);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [perms, setPerms] = useState<PermissionRecord[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(initialRole?.name ?? "");
  const [description, setDescription] = useState(
    initialRole?.description ?? ""
  );
  const [selected, setSelected] = useState<PermissionKey[]>(
    (initialRole?.permissions ?? []) as PermissionKey[]
  );

  useEffect(() => {
    setName(initialRole?.name ?? "");
    setDescription(initialRole?.description ?? "");
    setSelected((initialRole?.permissions ?? []) as PermissionKey[]);
  }, [
    initialRole?.id,
    initialRole?.name,
    initialRole?.description,
    initialRole?.permissions,
  ]);

  // load catalogue
  useEffect(() => {
    if (!opened) return;
    setLoadingPerms(true);
    listPermissionsApiRequest()
      .then((res) => {
        if (res.success) setPerms(res.data.permissions);
      })
      .catch(() => {
        notifications.show({
          color: "red",
          message: "Failed to load permissions",
        });
      })
      .finally(() => setLoadingPerms(false));
  }, [opened]);

  const sortedPerms = useMemo(
    () => [...perms].sort((a, b) => a.key.localeCompare(b.key)),
    [perms]
  );

  const allKeys = useMemo<PermissionKey[]>(
    () => sortedPerms.map((p) => p.key as PermissionKey),
    [sortedPerms]
  );
  const allSelected = selected.length === allKeys.length && allKeys.length > 0;
  const someSelected = selected.length > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? [] : [...allKeys]);
  }

  async function handleSubmit() {
    // basic client validation
    if (!name.trim()) {
      notifications.show({ color: "red", message: "Name is required" });
      return;
    }
    setSubmitting(true);
    try {
      if (!isEdit) {
        const resp = await createRoleApiRequest(
          {
            name: name.trim(),
            description: description.trim() || null,
            permissionKeys: selected,
          },
          `role-create-${Date.now()}`
        );
        if (resp.success) {
          notifications.show({ color: "green", message: "Role created" });
          onSaved?.(resp.data.role);
          onClose();
        }
      } else {
        const resp = await updateRoleApiRequest(
          initialRole!.id,
          {
            name: name.trim() || undefined,
            description: (description.trim() || null) as string | null,
            permissionKeys: selected,
          },
          `role-update-${initialRole!.id}-${Date.now()}`
        );
        if (resp.success) {
          notifications.show({ color: "green", message: "Role updated" });
          onSaved?.(resp.data.role);
          onClose();
        }
      }
    } catch (e: any) {
      const msg = e?.message ?? "Save failed";
      notifications.show({ color: "red", message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  const title = isEdit ? (
    <Group gap="xs">
      Edit role <Badge variant="light">{initialRole!.name}</Badge>
      {initialRole?.isSystem && <Badge color="gray">System</Badge>}
    </Group>
  ) : (
    "Create role"
  );

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="lg" centered>
      <Stack gap="md">
        <TextInput
          label="Name"
          placeholder="e.g. Content Editor"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          disabled={submitting}
          required
        />
        <Textarea
          label="Description"
          placeholder="Optional description"
          value={description ?? ""}
          onChange={(e) => setDescription(e.currentTarget.value)}
          disabled={submitting}
          minRows={2}
        />

        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Text fw={500}>Permissions</Text>
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={toggleAll}
              label="Select all"
            />
          </Group>

          <div className="border rounded-md">
            <ScrollArea.Autosize mah={220} type="auto" offsetScrollbars>
              {loadingPerms ? (
                <Group p="md" justify="center">
                  <Loader />
                  <Text>Loading permissions…</Text>
                </Group>
              ) : (
                <Stack p="md" gap="xs">
                  {/* --- UPDATED: render from sortedPerms --- */}
                  {sortedPerms.map((p) => {
                    const key = p.key as PermissionKey;
                    const checked = selected.includes(key);
                    return (
                      <Checkbox
                        key={p.id}
                        label={`${p.key} — ${p.description}`}
                        checked={checked}
                        onChange={(e) => {
                          const isChecked = e.currentTarget.checked;
                          setSelected((prev) =>
                            isChecked
                              ? [...prev, key]
                              : prev.filter((k) => k !== key)
                          );
                        }}
                      />
                    );
                  })}
                </Stack>
              )}
            </ScrollArea.Autosize>
          </div>
        </Stack>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            {isEdit ? "Save changes" : "Create role"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
