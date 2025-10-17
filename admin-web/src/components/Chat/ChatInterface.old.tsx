import { useChat, type UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useMemo } from 'react';
import { Stack, Textarea, Button, ScrollArea, Text, Group, Loader } from '@mantine/core';
import { IconSend } from '@tabler/icons-react';
import { ChatMessage } from './ChatMessage';
import classes from './ChatInterface.module.css';

export function ChatInterface() {
  const [input, setInput] = useState('');
  const viewport = useRef<HTMLDivElement>(null);

  const transport = useMemo(() => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string;
    return new DefaultChatTransport({
      api: `${apiBaseUrl}/api/chat`,
      credentials: 'include',
      // Override fetch to handle 401 errors (session expiration)
      fetch: async (url, options) => {
        const response = await fetch(url, options);

        // Handle 401 Unauthorized (session expired)
        if (response.status === 401) {
          // Try to read error body to check for AUTH_REQUIRED
          const text = await response.clone().text();
          let errorCode;
          try {
            const json = JSON.parse(text);
            errorCode = json?.error?.errorCode;
          } catch {
            // Not JSON, ignore
          }

          if (errorCode === 'AUTH_REQUIRED' || response.status === 401) {
            // Clear auth state and redirect to sign-in
            import('../../stores/auth.js').then(({ useAuthStore }) => {
              useAuthStore.getState().clear();
            });
            window.location.href = '/sign-in?reason=session_expired';
          }
        }

        return response;
      },
    });
  }, []);

  const { messages, sendMessage, status } = useChat({
    transport,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    console.log('Messages updated:', messages);
    // Use setTimeout to avoid triggering during render
    const timer = setTimeout(() => {
      if (viewport.current) {
        viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages.length]); // Only trigger when message count changes, not on every message update

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status === 'streaming') return;

    sendMessage({ text: input });
    setInput('');
  };

  const isLoading = status === 'streaming';

  return (
    <Stack gap={0} style={{ height: '100%', flex: 1 }}>
      {/* Messages Area */}
      <ScrollArea viewportRef={viewport} style={{ flex: 1 }} p="md">
        {messages.length === 0 ? (
          <Stack gap="md" align="center" justify="center" style={{ minHeight: 300, maxWidth: 600, margin: '0 auto' }}>
            <Text size="lg" fw={500}>
              👋 Hi! I can help you manage your inventory:
            </Text>

            <Stack gap="xs" style={{ width: '100%' }}>
              <Text size="sm" fw={500}>📦 Products & Stock</Text>
              <Text size="xs" c="dimmed" pl="lg">
                "What products are low on stock?" • "Show me stock at Main Warehouse"
              </Text>
            </Stack>

            <Stack gap="xs" style={{ width: '100%' }}>
              <Text size="sm" fw={500}>🚚 Transfers & Approvals</Text>
              <Text size="xs" c="dimmed" pl="lg">
                "Find my pending transfers" • "Why does TRF-001 need approval?"
              </Text>
            </Stack>

            <Stack gap="xs" style={{ width: '100%' }}>
              <Text size="sm" fw={500}>📊 Analytics & Insights</Text>
              <Text size="xs" c="dimmed" pl="lg">
                "What's our transfer completion rate?" • "Total stock value by branch"
              </Text>
            </Stack>

            <Stack gap="xs" style={{ width: '100%' }}>
              <Text size="sm" fw={500}>👥 Team & Branches</Text>
              <Text size="xs" c="dimmed" pl="lg">
                "Who are the warehouse managers?" • "List all active branches"
              </Text>
            </Stack>
          </Stack>
        ) : (
          <Stack gap="md">
            {messages.map((message: UIMessage) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <Group gap="xs">
                <Loader size="xs" />
                <Text size="sm" c="dimmed">
                  Thinking...
                </Text>
              </Group>
            )}
          </Stack>
        )}
      </ScrollArea>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className={classes.inputForm}>
        <Group gap="xs" p="md" align="flex-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about products, stock, transfers, analytics, or users..."
            disabled={isLoading}
            minRows={1}
            maxRows={4}
            autosize
            style={{ flex: 1 }}
            data-testid="chat-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            loading={isLoading}
            leftSection={<IconSend size={18} />}
            data-testid="chat-send-button"
          >
            Send
          </Button>
        </Group>
      </form>
    </Stack>
  );
}
