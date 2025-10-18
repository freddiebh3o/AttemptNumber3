/* admin-web/src/pages/SignInPage.tsx */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TextInput, PasswordInput, Button, Paper, Title, Stack, Alert } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { signInApiRequest } from '../api/auth';
import { useAuthStore } from '../stores/auth';

export default function SignInPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason');

  const [userEmailInputValue, setUserEmailInputValue] = useState('');
  const [userPasswordInputValue, setUserPasswordInputValue] = useState('');
  const [tenantSlugInputValue, setTenantSlugInputValue] = useState('');
  const [isSubmittingSignInForm, setIsSubmittingSignInForm] = useState(false);
  const [showAlert, setShowAlert] = useState(!!reason);

  // Clear URL param after user starts interacting with the form
  useEffect(() => {
    if (reason && showAlert) {
      // Show alert initially
      setShowAlert(true);
    }
  }, [reason, showAlert]);

  // Clear URL param when user focuses on any input (they've seen the message)
  const handleInputFocus = () => {
    if (reason) {
      navigate('/sign-in', { replace: true });
      setShowAlert(false);
    }
  };

  // Message definitions for different logout reasons
  const messages: Record<string, { title: string; message: string; color: string }> = {
    session_expired: {
      title: 'Session expired',
      message: 'Your session has expired. Please sign in again.',
      color: 'yellow',
    },
    logged_out: {
      title: 'Signed out',
      message: "You've been signed out successfully.",
      color: 'blue',
    },
    unauthorized: {
      title: 'Authentication required',
      message: 'Please sign in to continue.',
      color: 'red',
    },
  };

  const alert = showAlert && reason && messages[reason];

  async function handleSubmitSignInForm(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmittingSignInForm(true);
    try {
      const email = userEmailInputValue.trim();
      const password = userPasswordInputValue;
      const tenantSlug = tenantSlugInputValue.trim().toLowerCase();

      await signInApiRequest({ email, password, tenantSlug });

      // 🔑 Hydrate the auth store BEFORE navigating so permission checks are ready
      await useAuthStore.getState().refreshFromServer();

      notifications.show({ color: 'green', message: 'Signed in successfully.' });
      navigate(`/${tenantSlug}/products`);
    } catch (error: any) {
      notifications.show({
        color: 'red',
        title: 'Sign-in failed',
        message: error?.message ?? 'Unknown error',
      });
    } finally {
      setIsSubmittingSignInForm(false);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 min-h-screen min-w-screen">
      {/* Left: form */}
      <div className="flex items-center justify-center p-6 bg-gray-50">
        <Paper withBorder shadow="sm" radius="md" p="lg" className="w-full max-w-md bg-white">
          <Title order={3} mb="md">Multi-Tenant Admin — Sign in</Title>

          {/* Show alert banner if reason is present */}
          {alert && (
            <Alert color={alert.color} title={alert.title} mb="md">
              {alert.message}
            </Alert>
          )}

          <form onSubmit={handleSubmitSignInForm}>
            <Stack>
              <TextInput
                label="Email address"
                type="email"
                required
                value={userEmailInputValue}
                onChange={(e) => setUserEmailInputValue(e.currentTarget.value)}
                onFocus={handleInputFocus}
                data-testid="auth-email-input"
              />
              <PasswordInput
                label="Password"
                required
                value={userPasswordInputValue}
                onChange={(e) => setUserPasswordInputValue(e.currentTarget.value)}
                onFocus={handleInputFocus}
                data-testid="auth-password-input"
              />
              <TextInput
                label="Tenant"
                placeholder="e.g. acme"
                required
                value={tenantSlugInputValue}
                onChange={(e) => setTenantSlugInputValue(e.currentTarget.value)}
                onFocus={handleInputFocus}
                data-testid="auth-tenant-input"
              />
              <Button loading={isSubmittingSignInForm} type="submit" data-testid="auth-signin-button">
                Sign in
              </Button>
            </Stack>
          </form>
        </Paper>
      </div>

      {/* Right: image */}
      <div className="relative hidden md:block">
        <img
          src="/login-hero.jpg"
          alt="Admin dashboard illustration"
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
        />
      </div>
    </div>
  );
}
