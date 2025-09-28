// admin-web/src/pages/TenantUsersPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ActionIcon, Badge, Button, Group, Modal, Paper, PasswordInput,
  Select, Stack, Table, Text, TextInput, Title, Loader
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconPlus, IconPencil, IconTrash, IconRefresh, IconArrowBack } from '@tabler/icons-react'
import {
  listTenantUsersApiRequest,
  createTenantUserApiRequest,
  updateTenantUserApiRequest,
  deleteTenantUserApiRequest,
} from '../api/tenantUsers'
import { handlePageError } from '../utils/pageError'
import { useAuthStore } from '../stores/auth'

type RoleName = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'
type Row = { userId: string; userEmailAddress: string; roleName: RoleName; createdAt?: string; updatedAt?: string }

export default function TenantUsersPage() {
  const navigate = useNavigate()
  const { tenantSlug } = useParams<{ tenantSlug: string }>()

  // Global memberships (no per-page /me calls)
  const memberships = useAuthStore((s) => s.tenantMemberships)

  // Page state
  const [isLoading, setIsLoading] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null) // null = not loaded yet
  const [errorForBoundary, setErrorForBoundary] = useState<Error & { httpStatusCode?: number; correlationId?: string } | null>(null)

  // Create/Edit modal state
  const [createOpen, setCreateOpen] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<RoleName>('VIEWER')
  const [editOpen, setEditOpen] = useState(false)
  const [editUserId, setEditUserId] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editRole, setEditRole] = useState<RoleName>('VIEWER')

  const isAdminOrOwner = useMemo(() => {
    const m = memberships.find((x) => x.tenantSlug === tenantSlug)
    return m?.roleName === 'OWNER' || m?.roleName === 'ADMIN'
  }, [memberships, tenantSlug])

  async function load() {
    setIsLoading(true)
    try {
      const res = await listTenantUsersApiRequest({ limit: 100 })
      if (res.success) {
        setRows(res.data.users)
      } else {
        const e = Object.assign(new Error('Failed to load users'), { httpStatusCode: 500 })
        setErrorForBoundary(e)
      }
    } catch (e: any) {
      setErrorForBoundary(handlePageError(e, { title: 'Error' }))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setRows(null)
    setErrorForBoundary(null)
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug])

  if (errorForBoundary) throw errorForBoundary

  function openEditModal(row: Row) {
    setEditUserId(row.userId)
    setEditEmail(row.userEmailAddress)
    setEditPassword('')
    setEditRole(row.roleName)
    setEditOpen(true)
  }

  async function handleCreate() {
    if (!createEmail || !createPassword) {
      notifications.show({ color: 'red', message: 'Email and password are required' })
      return
    }
    try {
      const idempotencyKeyValue = `create-${Date.now()}`
      const res = await createTenantUserApiRequest({
        email: createEmail,
        password: createPassword,
        roleName: createRole,
        idempotencyKeyOptional: idempotencyKeyValue,
      })
      if (res.success) {
        notifications.show({ color: 'green', message: 'User added to tenant' })
        setCreateOpen(false)
        setCreateEmail('')
        setCreatePassword('')
        setCreateRole('VIEWER')
        await load()
      }
    } catch (e: any) {
      notifications.show({ color: 'red', message: e?.message ?? 'Create failed' })
    }
  }

  async function handleEdit() {
    if (!editUserId) return
    try {
      const body: any = {}
      if (editEmail) body.email = editEmail
      if (editPassword) body.password = editPassword
      if (editRole) body.roleName = editRole

      const idempotencyKeyValue = `update-${editUserId}-${Date.now()}`
      const res = await updateTenantUserApiRequest({ userId: editUserId, ...body, idempotencyKeyOptional: idempotencyKeyValue })
      if (res.success) {
        notifications.show({ color: 'green', message: 'User updated' })
        setEditOpen(false)
        await load()
      }
    } catch (e: any) {
      notifications.show({ color: 'red', message: e?.message ?? 'Update failed' })
    }
  }

  async function handleDelete(userId: string) {
    try {
      const res = await deleteTenantUserApiRequest({ userId, idempotencyKeyOptional: `delete-${userId}-${Date.now()}` })
      if (res.success) {
        notifications.show({ color: 'green', message: 'User removed from tenant' })
        await load()
      }
    } catch (e: any) {
      notifications.show({ color: 'red', message: e?.message ?? 'Delete failed' })
    }
  }

  return (
    <div>
      <div className="p-4 border-b bg-white">
        <Group justify="space-between">
          <Group>
            <ActionIcon component={Link} to={`/${tenantSlug}/products`} variant="light" title="Back to products">
              <IconArrowBack />
            </ActionIcon>
            <Title order={3}>
              Tenant users — <Badge variant="light">{tenantSlug}</Badge>
            </Title>
            <ActionIcon variant="light" onClick={load} title="Refresh" loading={isLoading}>
              <IconRefresh />
            </ActionIcon>
          </Group>
          <Group>
            {/* Tenant switching & sign-out removed; handled in the header */}
          </Group>
        </Group>
      </div>

      <div className="p-4">
        <Paper withBorder p="md" radius="md" className="bg-white">
          <Group justify="space-between" mb="md">
            <Title order={4}>Users in this tenant</Title>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setCreateOpen(true)}
              disabled={!isAdminOrOwner}
            >
              Add user
            </Button>
          </Group>

          {rows === null || isLoading ? (
            <Group justify="center" p="lg"><Loader /></Group>
          ) : (
            <Table striped withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Updated</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((r) => (
                  <Table.Tr key={r.userId}>
                    <Table.Td>{r.userEmailAddress}</Table.Td>
                    <Table.Td><Badge>{r.roleName}</Badge></Table.Td>
                    <Table.Td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</Table.Td>
                    <Table.Td>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}</Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button size="xs" variant="light" leftSection={<IconPencil size={16} />} onClick={() => openEditModal(r)} disabled={!isAdminOrOwner}>
                          Edit
                        </Button>
                        <Button size="xs" variant="light" color="red" leftSection={<IconTrash size={16} />} onClick={() => handleDelete(r.userId)} disabled={!isAdminOrOwner}>
                          Remove
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </div>

      {/* Create modal */}
      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Add user to tenant">
        <Stack>
          <TextInput label="Email" value={createEmail} onChange={(e) => setCreateEmail(e.currentTarget.value)} />
          <PasswordInput label="Temporary password" value={createPassword} onChange={(e) => setCreatePassword(e.currentTarget.value)} />
          <Select label="Role" value={createRole} onChange={(v) => setCreateRole((v as RoleName) ?? 'VIEWER')} data={['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']} />
          <Group justify="flex-end"><Button onClick={handleCreate}>Create/Attach</Button></Group>
        </Stack>
      </Modal>

      {/* Edit modal */}
      <Modal opened={editOpen} onClose={() => setEditOpen(false)} title="Edit user/membership">
        <Stack>
          <Text size="sm">Leave password blank to keep the same.</Text>
          <TextInput label="Email" value={editEmail} onChange={(e) => setEditEmail(e.currentTarget.value)} />
          <PasswordInput label="New password" value={editPassword} onChange={(e) => setEditPassword(e.currentTarget.value)} />
          <Select label="Role" value={editRole} onChange={(v) => setEditRole((v as RoleName) ?? 'VIEWER')} data={['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']} />
          <Group justify="flex-end"><Button onClick={handleEdit}>Save changes</Button></Group>
        </Stack>
      </Modal>
    </div>
  )
}
