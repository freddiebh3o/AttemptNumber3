import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TextInput, PasswordInput, Button, Paper, Title, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { signInApiRequest, meApiRequest } from '../api/auth'

export default function SignInPage() {
  const navigate = useNavigate()
  const [userEmailInputValue, setUserEmailInputValue] = useState('')
  const [userPasswordInputValue, setUserPasswordInputValue] = useState('')
  const [tenantSlugInputValue, setTenantSlugInputValue] = useState('')
  const [isSubmittingSignInForm, setIsSubmittingSignInForm] = useState(false)

  async function handleSubmitSignInForm(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmittingSignInForm(true)
    try {
      await signInApiRequest({
        email: userEmailInputValue,
        password: userPasswordInputValue,
        tenantSlug: tenantSlugInputValue,
      })
      await meApiRequest() // optional confirmation
      notifications.show({ color: 'green', message: 'Signed in successfully.' })
      navigate(`/${tenantSlugInputValue}/products`)
    } catch (error: any) {
      notifications.show({
        color: 'red',
        title: 'Sign-in failed',
        message: error?.message ?? 'Unknown error',
      })
    } finally {
      setIsSubmittingSignInForm(false)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 min-h-screen min-w-screen">
      {/* Left: form */}
      <div className="flex items-center justify-center p-6 bg-gray-50">
        <Paper withBorder shadow="sm" radius="md" p="lg" className="w-full max-w-md bg-white">
          <Title order={3} mb="md">Multi-Tenant Admin — Sign in</Title>
          <form onSubmit={handleSubmitSignInForm}>
            <Stack>
              <TextInput
                label="Email address"
                type="email"
                required
                value={userEmailInputValue}
                onChange={(e) => setUserEmailInputValue(e.currentTarget.value)}
              />
              <PasswordInput
                label="Password"
                required
                value={userPasswordInputValue}
                onChange={(e) => setUserPasswordInputValue(e.currentTarget.value)}
              />
              <TextInput
                label="Tenant"
                placeholder="e.g. acme"
                required
                value={tenantSlugInputValue}
                onChange={(e) => setTenantSlugInputValue(e.currentTarget.value)}
              />
              <Button loading={isSubmittingSignInForm} type="submit">
                Sign in
              </Button>
            </Stack>
          </form>
        </Paper>
      </div>

      {/* Right: image (hidden on very small screens if you like) */}
      <div className="relative hidden md:block">
        <img
          src="/login-hero.jpg"
          alt="Admin dashboard illustration"
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
        />
        {/* Optional overlay for contrast:
        <div className="absolute inset-0 bg-black/10" />
        */}
      </div>
    </div>
  )
}
