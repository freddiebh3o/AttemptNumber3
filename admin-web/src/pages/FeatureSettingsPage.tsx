/* admin-web/src/pages/FeatureSettingsPage.tsx */
import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Paper,
  Stack,
  Switch,
  TextInput,
  Button,
  Group,
  Text,
  Alert,
  Divider,
  Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useParams } from 'react-router-dom';
import { IconInfoCircle } from '@tabler/icons-react';
import {
  getTenantFeatureFlagsApiRequest,
  putTenantFeatureFlagsApiRequest,
} from '../api/tenantFeatureFlags';
import { useAuthStore } from '../stores/auth';

interface FeatureFlags {
  chatAssistantEnabled: boolean;
  openaiApiKey: string | null;
  barcodeScanningEnabled: boolean;
}

export default function FeatureSettingsPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
    chatAssistantEnabled: false,
    openaiApiKey: null,
    barcodeScanningEnabled: false,
  });

  // Load feature flags on mount
  useEffect(() => {
    if (!tenantSlug) return;

    const loadFeatureFlags = async () => {
      try {
        setLoading(true);
        const response = await getTenantFeatureFlagsApiRequest(tenantSlug);
        if (response.success && response.data) {
          setFeatureFlags({
            chatAssistantEnabled: response.data.chatAssistantEnabled ?? false,
            openaiApiKey: response.data.openaiApiKey ?? null,
            barcodeScanningEnabled: response.data.barcodeScanningEnabled ?? false,
          });
        }
      } catch (error) {
        notifications.show({
          title: 'Error',
          message: 'Failed to load feature settings',
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    };

    loadFeatureFlags();
  }, [tenantSlug]);

  const handleSave = async () => {
    if (!tenantSlug) return;

    try {
      setSaving(true);
      const response = await putTenantFeatureFlagsApiRequest({
        tenantSlug,
        body: featureFlags,
      });

      if (response.success) {
        // Update the auth store with the new feature flags immediately
        await useAuthStore.getState().refreshFromServer();

        notifications.show({
          title: 'Success',
          message: 'Feature settings saved successfully',
          color: 'green',
        });
      } else {
        throw new Error((response as any).error?.userFacingMessage || 'Failed to save settings');
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save feature settings',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container size="md" py="xl">
        <Group justify="center">
          <Loader />
        </Group>
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Title order={2}>Feature Settings</Title>

        <Paper p="lg" withBorder>
          <Stack gap="md">
            <Title order={3}>AI Chat Assistant</Title>

            <Switch
              label="Enable AI Chat Assistant"
              description="Allow users to use the AI-powered chat assistant"
              checked={featureFlags.chatAssistantEnabled}
              onChange={(event) =>
                setFeatureFlags({
                  ...featureFlags,
                  chatAssistantEnabled: event.currentTarget.checked,
                })
              }
              data-testid="toggle-chat-assistant"
            />

            <TextInput
              label="OpenAI API Key"
              placeholder="sk-..."
              type="password"
              description="Leave blank to use system default"
              value={featureFlags.openaiApiKey || ''}
              onChange={(event) =>
                setFeatureFlags({
                  ...featureFlags,
                  openaiApiKey: event.currentTarget.value || null,
                })
              }
              data-testid="input-openai-api-key"
            />

            <Alert icon={<IconInfoCircle size={16} />} title="Cost Information" color="blue">
              <Text size="sm">
                If you provide your own OpenAI API key, all chat assistant calls will be billed to
                your API account. If left blank, the system default key will be used.
              </Text>
            </Alert>
          </Stack>
        </Paper>

        <Divider />

        <Paper p="lg" withBorder>
          <Stack gap="md">
            <Title order={3}>Barcode Scanning</Title>

            <Switch
              label="Enable Barcode Scanning"
              description="Allow users to scan product barcodes with their device camera"
              checked={featureFlags.barcodeScanningEnabled}
              onChange={(event) =>
                setFeatureFlags({
                  ...featureFlags,
                  barcodeScanningEnabled: event.currentTarget.checked,
                })
              }
              data-testid="toggle-barcode-scanning"
            />
          </Stack>
        </Paper>

        <Group justify="flex-end">
          <Button
            onClick={handleSave}
            loading={saving}
            data-testid="btn-save-features"
          >
            Save Settings
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
