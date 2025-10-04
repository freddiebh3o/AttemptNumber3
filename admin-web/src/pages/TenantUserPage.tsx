// admin-web/src/pages/TenantUserPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  PasswordInput,
  MultiSelect,
  Badge,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { components } from "../types/openapi";
import {
  createTenantUserApiRequest,
  updateTenantUserApiRequest,
  getTenantUserApiRequest,
} from "../api/tenantUsers";
import { listRolesApiRequest } from "../api/roles";
import { listBranchesApiRequest } from "../api/branches";
import { handlePageError } from "../utils/pageError";

type TenantUserRecord = components["schemas"]["TenantUserRecord"];
type RoleRecord = components["schemas"]["RoleRecord"];
type BranchRecord = components["schemas"]["BranchRecord"];

type CreateBody = NonNullable<
  import("../types/openapi").paths["/api/tenant-users"]["post"]["requestBody"]
>["content"]["application/json"];

type UpdateBody = NonNullable<
  import("../types/openapi").paths["/api/tenant-users/{userId}"]["put"]["requestBody"]
>["content"]["application/json"];

export default function TenantUserPage() {
  const { tenantSlug, userId } = useParams<{ tenantSlug: string; userId?: string }>();
  const isEdit = Boolean(userId);
  const navigate = useNavigate();

  // catalogs
  const [roles, setRoles] = useState<RoleRecord[] | null>(null);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const [branches, setBranches] = useState<BranchRecord[] | null>(null);
  const [loadingBranches, setLoadingBranches] = useState(true);

  // record for edit
  const [initial, setInitial] = useState<TenantUserRecord | null>(null);
  const [loadingUser, setLoadingUser] = useState(isEdit);

  // form fields
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [password, setPassword] = useState(""); // create required, edit optional
  const [branchIds, setBranchIds] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);

  // load roles
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingRoles(true);
        const res = await listRolesApiRequest({ limit: 100, includeTotal: false });
        if (!cancelled && res.success) setRoles(res.data.items ?? []);
      } catch (e) {
        handlePageError(e, { title: "Failed to load roles" });
      } finally {
        if (!cancelled) setLoadingRoles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // load branches
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingBranches(true);
        const res = await listBranchesApiRequest({
          limit: 100,
          includeTotal: false,
          sortBy: "branchName",
          sortDir: "asc",
        });
        if (!cancelled && res.success) setBranches(res.data.items ?? []);
      } catch (e) {
        handlePageError(e, { title: "Failed to load branches" });
      } finally {
        if (!cancelled) setLoadingBranches(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // fetch user on edit
  useEffect(() => {
    if (!isEdit || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingUser(true);
        const res = await getTenantUserApiRequest({ userId });
        if (!cancelled && res.success) {
          const u = res.data.user as TenantUserRecord; // server now returns { data: { user } }
          setInitial(u);
          setEmail(u.userEmailAddress ?? "");
          setRoleId(u.role?.id ?? null);
          const existingBranchIds = (u as any).branches?.map((b: any) => b.id) ?? [];
          setBranchIds(existingBranchIds);
        }
      } catch (e) {
        handlePageError(e, { title: "Failed to load user" });
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, userId]);

  const roleChoices = useMemo(
    () => (roles ?? []).map((r) => ({ value: r.id, label: r.name })),
    [roles]
  );

  const branchChoices = useMemo(
    () =>
      (branches ?? []).map((b) => ({
        value: b.id,
        label: b.branchName + (b.isActive ? "" : " (inactive)"),
      })),
    [branches]
  );

  const pageTitle = isEdit ? "Edit User" : "New User";
  const isBusy = saving || loadingRoles || loadingBranches || (isEdit && loadingUser);

  function setsEqual(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    const sa = new Set(a);
    for (const x of b) if (!sa.has(x)) return false;
    return true;
  }

  async function handleSave() {
    // basic validation
    if (!email.trim()) {
      notifications.show({ color: "red", message: "Email is required." });
      return;
    }
    if (!roleId) {
      notifications.show({ color: "red", message: "Role is required." });
      return;
    }
    if (!isEdit && password.length < 8) {
      notifications.show({ color: "red", message: "Password must be at least 8 characters." });
      return;
    }

    setSaving(true);
    try {
      const idk = (crypto as any)?.randomUUID?.() ?? Math.random().toString(36).slice(2);

      if (!isEdit) {
        // Create
        const body: CreateBody = {
          email: email.trim(),
          password,
          roleId, // roleId is non-null here (validated above)
          branchIds, // optional per OpenAPI
        } as any;

        const res = await createTenantUserApiRequest({
          ...body,
          idempotencyKeyOptional: idk,
        });
        if (res.success) {
          notifications.show({ color: "green", message: "User created." });
          navigate(`/${tenantSlug}/users`);
        }
      } else {
        // Update (send only changed fields)
        if (!userId) return;

        const initialBranchIds: string[] =
          ((initial as any)?.branches?.map((b: any) => b.id) as string[]) ?? [];

        const updateBody: UpdateBody = {
          ...(initial?.userEmailAddress !== email.trim() && { email: email.trim() }),
          ...(password ? { password } : {}),
          ...(initial?.role?.id !== roleId && roleId ? { roleId } : {}),
          ...(!setsEqual(initialBranchIds, branchIds) && { branchIds }),
        } as any;

        const res = await updateTenantUserApiRequest({
          userId,
          ...updateBody,
          idempotencyKeyOptional: idk,
        });
        if (res.success) {
          notifications.show({ color: "green", message: "User updated." });
          navigate(`/${tenantSlug}/users`);
        }
      }
    } catch (e) {
      handlePageError(e, { title: "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="start">
        <Title order={2}>{pageTitle}</Title>
        <Group>
          <Button variant="default" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isBusy}>
            Save
          </Button>
        </Group>
      </Group>

      <Paper withBorder radius="md" p="md" className="bg-white">
        {isBusy ? (
          <Group gap="sm">
            <Loader size="sm" />
            <Text>Loading…</Text>
          </Group>
        ) : (
          <Stack gap="md">
            <TextInput
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />

            {/* Create: password required; Edit: optional to reset */}
            <PasswordInput
              label={isEdit ? "Reset password (optional)" : "Password"}
              required={!isEdit}
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              placeholder={isEdit ? "Leave blank to keep existing password" : ""}
            />

            <Select
              label="Role"
              data={roleChoices}
              value={roleId}
              onChange={setRoleId}
              searchable
              nothingFoundMessage="No roles"
              required
            />

            <MultiSelect
              label="Branches"
              description="Assign the user to one or more branches"
              data={branchChoices}
              value={branchIds}
              onChange={setBranchIds}
              searchable
              nothingFoundMessage="No branches"
              placeholder="Select branches…"
              rightSectionWidth={90}
              rightSection={
                branchIds.length ? <Badge variant="light">{branchIds.length} selected</Badge> : null
              }
            />
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
