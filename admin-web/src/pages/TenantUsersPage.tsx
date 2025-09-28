// admin-web/src/pages/TenantUsersPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconPlus, IconPencil, IconTrash, IconRefresh, IconLogout, IconArrowBack } from '@tabler/icons-react'
import { meApiRequest, signOutApiRequest, switchTenantApiRequest } from '../api/auth'
import {
  listTenantUsersApiRequest,
  createTenantUserApiRequest,
  updateTenantUserApiRequest,
  deleteTenantUserApiRequest,
} from '../api/tenantUsers'

type RoleName = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'

export default function TenantUsersPage() {
  const navigate = useNavigate()
  const { tenantSlug } = useParams<{ tenantSlug: string }>()
  const [memberships, setMemberships] = useState<Array<{ tenantSlug: string; roleName: RoleName }>>([])
  const [isLoading, setIsLoading] = useState(false)

  type Row = { userId: string; userEmailAddress: string; roleName: RoleName; createdAt?: string; updatedAt?: string }
  const [rows, setRows] = useState<Row[]>([])

  const isAdminOrOwner = useMemo(() => {
    const m = memberships.find((x) => x.tenantSlug === tenantSlug)
    return m?.roleName === 'OWNER' || m?.roleName === 'ADMIN'
  }, [memberships, tenantSlug])

  async function bootstrap() {
    try {
      const me = await meApiRequest()
      if (!me.success) throw new Error('Not signed in')
      setMemberships(me.data.tenantMemberships)
      const has = me.data.tenantMemberships.some((m) => m.tenantSlug === tenantSlug)
      if (!has && tenantSlug) {
        const m = me.data.tenantMemberships.find((x) => x.tenantSlug === tenantSlug)
        if (m) {
          await switchTenantApiRequest({ tenantSlug })
        } else {
          notifications.show({ color: 'red', message: `You do not belong to ${tenantSlug}` })
          navigate('/sign-in')
        }
      }
    } catch {
      navigate('/sign-in')
    }
  }

  async function load() {
    setIsLoading(true)
    try {
      const res = await listTenantUsersApiRequest({ limit: 100 })
      if (res.success) {
        setRows(res.data.users)
      }
    } catch (e: any) {
      notifications.show({ color: 'red', message: e?.message ?? 'Failed to load users' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    bootstrap().then(load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug])

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<RoleName>('VIEWER')

  async function handleCreate() {
    if (!createEmail || !createPassword) {
      notifications.show({ color: 'red', message: 'Email and password are required' })
      return
    }
    try {
      const idempotencyKeyValue = `create-${Date.now()}`;
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

  // Edit modal
  const [editOpen, setEditOpen] = useState(false)
  const [editUserId, setEditUserId] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editRole, setEditRole] = useState<RoleName>('VIEWER')

  function openEditModal(row: Row) {
    setEditUserId(row.userId)
    setEditEmail(row.userEmailAddress)
    setEditPassword('')
    setEditRole(row.roleName)
    setEditOpen(true)
  }

  async function handleEdit() {
    if (!editUserId) return
    try {
      const body: any = {}
      if (editEmail) body.email = editEmail
      if (editPassword) body.password = editPassword
      if (editRole) body.roleName = editRole
      
      const idempotencyKeyValue = `update-${editUserId}-${Date.now()}`;
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

  async function handleSignOut() {
    await signOutApiRequest()
    navigate('/sign-in')
  }

  async function handleSwitchTenant(newSlug: string) {
    try {
      await switchTenantApiRequest({ tenantSlug: newSlug })
      navigate(`/${newSlug}/users`)
    } catch (e: any) {
      notifications.show({ color: 'red', message: e?.message ?? 'Switch failed' })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
            {memberships.map((m) => (
              <Button
                key={m.tenantSlug}
                variant={m.tenantSlug === tenantSlug ? 'filled' : 'light'}
                onClick={() => handleSwitchTenant(m.tenantSlug)}
              >
                {m.tenantSlug} ({m.roleName})
              </Button>
            ))}
            <Button variant="default" leftSection={<IconLogout />} onClick={handleSignOut}>
              Sign out
            </Button>
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
                  <Table.Td>
                    <Badge>{r.roleName}</Badge>
                  </Table.Td>
                  <Table.Td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</Table.Td>
                  <Table.Td>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconPencil size={16} />}
                        onClick={() => openEditModal(r)}
                        disabled={!isAdminOrOwner}
                      >
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        leftSection={<IconTrash size={16} />}
                        onClick={() => handleDelete(r.userId)}
                        disabled={!isAdminOrOwner}
                      >
                        Remove
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      </div>

      {/* Create modal */}
      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Add user to tenant">
        <Stack>
          <TextInput label="Email" value={createEmail} onChange={(e) => setCreateEmail(e.currentTarget.value)} />
          <PasswordInput label="Temporary password" value={createPassword} onChange={(e) => setCreatePassword(e.currentTarget.value)} />
          <Select
            label="Role"
            value={createRole}
            onChange={(v) => setCreateRole((v as RoleName) ?? 'VIEWER')}
            data={['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']}
          />
          <Group justify="flex-end">
            <Button onClick={handleCreate}>Create/Attach</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit modal */}
      <Modal opened={editOpen} onClose={() => setEditOpen(false)} title="Edit user/membership">
        <Stack>
          <Text size="sm">Leave password blank to keep the same.</Text>
          <TextInput label="Email" value={editEmail} onChange={(e) => setEditEmail(e.currentTarget.value)} />
          <PasswordInput label="New password" value={editPassword} onChange={(e) => setEditPassword(e.currentTarget.value)} />
          <Select
            label="Role"
            value={editRole}
            onChange={(v) => setEditRole((v as RoleName) ?? 'VIEWER')}
            data={['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']}
          />
          <Group justify="flex-end">
            <Button onClick={handleEdit}>Save changes</Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  )
}
