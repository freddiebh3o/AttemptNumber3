// admin-web/src/components/feedback/ErrorBoundary.tsx
import React from 'react';
import { Alert, Button, Code, Group, Stack, Text, Title } from '@mantine/core';
import { useNavigate, useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';

type ErrLike = Error & { httpStatusCode?: number; status?: number; correlationId?: string; details?: unknown };

function ErrorView({ title, message, correlationId, ctaTo }: { title: string; message: string; correlationId?: string; ctaTo?: string }) {
  const navigate = useNavigate();
  return (
    <Stack p="lg" gap="md">
      <Title order={3}>{title}</Title>
      <Alert variant="light">{message}</Alert>
      {correlationId && (
        <Text c="dimmed" size="sm">
          Correlation ID: <Code>{correlationId}</Code>
        </Text>
      )}
      <Group>
        {ctaTo ? <Button component={Link} to={ctaTo}>Go to dashboard</Button> : null}
        <Button variant="light" onClick={() => navigate(-1)}>Go back</Button>
      </Group>
    </Stack>
  );
}

export function AccessDenied() {
  return <ErrorView title="Access denied" message="You don't have permission to view this resource." ctaTo="/" />;
}

export function NotFound() {
  return <ErrorView title="Not found" message="We couldn't find what you were looking for." ctaTo="/" />;
}

export function GenericError({ error }: { error?: ErrLike }) {
  const status = error?.httpStatusCode ?? error?.status;
  const message = error?.message || 'Something went wrong.';
  return <ErrorView title={`Error${status ? ` ${status}` : ''}`} message={message} correlationId={error?.correlationId} ctaTo="/" />;
}

/**
 * Route-level boundary for React Router `errorElement`.
 * It handles:
 * - thrown Response (via loaders/actions)
 * - thrown Error objects from components with shape { status | httpStatusCode, correlationId }
 */
export function RouteErrorBoundary() {
  const err = useRouteError();

  // Loader/action "Response"
  if (isRouteErrorResponse(err)) {
    if (err.status === 403) return <AccessDenied />;
    if (err.status === 404) return <NotFound />;
    return <GenericError error={Object.assign(new Error(err.statusText), { status: err.status })} />;
  }

  const e = err as ErrLike | undefined;
  const status = e?.httpStatusCode ?? e?.status;

  // Handle 401 (session expired) - redirect to sign-in with reason
  if (status === 401) {
    // Clear auth store and redirect (backup handler for route/loader errors)
    import('../../stores/auth.js').then(({ useAuthStore }) => {
      useAuthStore.getState().clear();
    });
    window.location.href = '/sign-in?reason=session_expired';
    return null; // Won't render since redirecting
  }

  if (status === 403) return <AccessDenied />;
  if (status === 404) return <NotFound />;
  return <GenericError error={e} />;
}

/** Classic React error boundary (for unexpected render errors) */
export class RenderErrorBoundary extends React.Component<React.PropsWithChildren, { error?: ErrLike }> {
  state: { error?: ErrLike } = {};
  static getDerivedStateFromError(error: ErrLike) {
    return { error };
  }
  render() {
    if (this.state.error) return <GenericError error={this.state.error} />;
    return this.props.children;
  }
}
