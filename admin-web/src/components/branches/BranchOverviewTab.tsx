import { Stack, Switch, TextInput } from "@mantine/core";

export function BranchOverviewTab(props: {
  isEdit: boolean;
  branchSlug: string;
  branchName: string;
  isActive: boolean;
  onChangeSlug: (v: string) => void;
  onChangeName: (v: string) => void;
  onChangeIsActive: (v: boolean) => void;
}) {
  const { branchSlug, branchName, isActive, onChangeSlug, onChangeName, onChangeIsActive } = props;

  return (
    <Stack gap="md" className="max-w-2xl">
      <TextInput
        label="Slug"
        description="Lowercase letters, numbers, hyphens (3–40 chars)"
        required
        value={branchSlug}
        onChange={(e) => onChangeSlug(e.currentTarget.value)}
        placeholder="e.g. london-hq"
        data-testid="branch-slug-input"
      />
      <TextInput
        label="Name"
        required
        value={branchName}
        onChange={(e) => onChangeName(e.currentTarget.value)}
        placeholder="e.g. London HQ"
        data-testid="branch-name-input"
      />
      <Switch
        label="Active"
        checked={isActive}
        onChange={(e) => onChangeIsActive(e.currentTarget.checked)}
        data-testid="branch-active-switch"
      />
    </Stack>
  );
}
