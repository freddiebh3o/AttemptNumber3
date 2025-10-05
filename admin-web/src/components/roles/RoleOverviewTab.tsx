// admin-web/src/components/roles/RoleOverviewTab.tsx
import { MultiSelect, Stack, TextInput, Textarea } from "@mantine/core";
import { useMemo } from "react";
import type { PermissionRecord, PermissionKey } from "../../api/roles";

type Props = {
  isEdit: boolean;
  isSystem: boolean;
  name: string;
  description: string;
  allPermissions: PermissionRecord[];
  selectedPermissions: PermissionKey[];
  onChangeName: (v: string) => void;
  onChangeDescription: (v: string) => void;
  onChangeSelected: (v: PermissionKey[]) => void;
};

export function RoleOverviewTab({
  isSystem,
  name,
  description,
  allPermissions,
  selectedPermissions,
  onChangeName,
  onChangeDescription,
  onChangeSelected,
}: Props) {
  const choices = useMemo(
    () =>
      allPermissions
        .slice()
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((p) => ({ value: p.key, label: `${p.key} — ${p.description}` })),
    [allPermissions]
  );

  return (
    <Stack gap="md">
      <TextInput
        label="Name"
        required
        value={name}
        onChange={(e) => onChangeName(e.currentTarget.value)}
        disabled={isSystem}
        placeholder="e.g. Content Editor"
      />

      <Textarea
        label="Description"
        placeholder="Optional description"
        value={description}
        onChange={(e) => onChangeDescription(e.currentTarget.value)}
        disabled={isSystem}
        minRows={2}
      />

      <MultiSelect
        label="Permissions"
        placeholder={choices.length ? "Select permissions" : "Loading permissions…"}
        data={choices}
        value={selectedPermissions}
        onChange={(vals) => onChangeSelected(vals as PermissionKey[])}
        searchable
        clearable
        disabled={isSystem || choices.length === 0}
        maxDropdownHeight={260}
      />
    </Stack>
  );
}
