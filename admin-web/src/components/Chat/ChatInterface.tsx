import { useChat, type UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Stack,
  Textarea,
  Button,
  ScrollArea,
  Text,
  Group,
  Loader,
  Paper,
  ActionIcon,
  Menu,
  TextInput,
  Modal,
  Box,
  Divider,
} from '@mantine/core';
import {
  IconSend,
  IconPlus,
  IconDots,
  IconTrash,
  IconEdit,
  IconMessageCircle,
} from '@tabler/icons-react';
import { ChatMessage } from './ChatMessage';
import classes from './ChatInterface.module.css';
import {
  listConversationsApiRequest,
  getConversationApiRequest,
  deleteConversationApiRequest,
  updateConversationTitleApiRequest,
  type ChatConversation,
} from '../../api/conversations';
import { getSuggestionsForUser, type ChatSuggestion } from '../../api/chatSuggestions';
import { notifications } from '@mantine/notifications';

export function ChatInterface() {
  const [input, setInput] = useState('');
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [suggestions, setSuggestions] = useState<ChatSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const viewport = useRef<HTMLDivElement>(null);

  const transport = useMemo(() => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string;
    return new DefaultChatTransport({
      api: `${apiBaseUrl}/api/chat`,
      credentials: 'include',
      // Override fetch to handle 401 errors (session expiration) and add conversationId
      fetch: async (url, options) => {
        // Add conversationId to request body if it exists
        if (currentConversationId && options?.body) {
          try {
            const body = JSON.parse(options.body as string);
            body.conversationId = currentConversationId;
            options.body = JSON.stringify(body);
          } catch {
            // Ignore if body is not JSON
          }
        }

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
  }, [currentConversationId]);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    onFinish: () => {
      // Reload conversations list after message is sent
      loadConversations();
    },
  });

  // Load conversations and suggestions on mount
  useEffect(() => {
    loadConversations();
    loadSuggestions();
  }, []);

  // Load conversation history when switching conversations
  useEffect(() => {
    if (currentConversationId) {
      loadConversationMessages(currentConversationId);
    } else {
      setMessages([]);
    }
  }, [currentConversationId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const timer = setTimeout(() => {
      if (viewport.current) {
        viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const loadConversations = async () => {
    try {
      setLoadingConversations(true);
      const response = await listConversationsApiRequest({ limit: 50 });
      setConversations(response.data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load conversation history',
        color: 'red',
      });
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const fetchedSuggestions = await getSuggestionsForUser({ limit: 6 });
      setSuggestions(fetchedSuggestions);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
      // Don't show error notification - it's not critical
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    try {
      const response = await getConversationApiRequest({ conversationId });
      // Convert backend ChatMessage[] to UIMessage[] format
      const uiMessages: UIMessage[] = response.data.messages.map((msg) => {
        // Handle both string content and parts array format
        let parts;
        if (typeof msg.content === 'string') {
          parts = [{ type: 'text' as const, text: msg.content }];
        } else if (Array.isArray(msg.content)) {
          parts = msg.content;
        } else {
          parts = [{ type: 'text' as const, text: String(msg.content) }];
        }

        return {
          id: msg.id,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          parts,
          createdAt: new Date(msg.createdAt),
        };
      });
      setMessages(uiMessages);
    } catch (error) {
      console.error('Failed to load conversation messages:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load conversation',
        color: 'red',
      });
    }
  };

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
  };

  const handleSelectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await deleteConversationApiRequest({ conversationId });
      notifications.show({
        title: 'Success',
        message: 'Conversation deleted',
        color: 'green',
      });

      // Remove from list
      setConversations(conversations.filter(c => c.id !== conversationId));

      // If deleting current conversation, start new one
      if (currentConversationId === conversationId) {
        handleNewConversation();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete conversation',
        color: 'red',
      });
    }
  };

  const handleStartEdit = (conversation: ChatConversation) => {
    setEditingConversationId(conversation.id);
    setEditTitle(conversation.title || '');
  };

  const handleSaveEdit = async () => {
    if (!editingConversationId || !editTitle.trim()) return;

    try {
      await updateConversationTitleApiRequest({
        conversationId: editingConversationId,
        title: editTitle,
      });

      // Update in list
      setConversations(conversations.map(c =>
        c.id === editingConversationId ? { ...c, title: editTitle } : c
      ));

      setEditingConversationId(null);
      setEditTitle('');

      notifications.show({
        title: 'Success',
        message: 'Conversation renamed',
        color: 'green',
      });
    } catch (error) {
      console.error('Failed to rename conversation:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to rename conversation',
        color: 'red',
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status === 'streaming') return;

    sendMessage({ text: input });
    setInput('');
  };

  const handleSuggestionClick = (suggestion: ChatSuggestion) => {
    if (status === 'streaming') return;
    sendMessage({ text: suggestion.text });
  };

  const isLoading = status === 'streaming';

  return (
    <Group gap={0} align="stretch" style={{ height: '100%', width: '100%' }}>
      {/* Conversation Sidebar */}
      <Paper
        shadow="sm"
        style={{
          width: 280,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--mantine-color-gray-3)',
        }}
      >
        <Stack gap={0} style={{ height: '100%' }}>
          {/* New Conversation Button */}
          <Box p="md">
            <Button
              fullWidth
              leftSection={<IconPlus size={18} />}
              onClick={handleNewConversation}
              variant="light"
            >
              New Conversation
            </Button>
          </Box>

          <Divider />

          {/* Conversations List */}
          <ScrollArea style={{ flex: 1 }} p="xs">
            {loadingConversations ? (
              <Group justify="center" p="md">
                <Loader size="sm" />
              </Group>
            ) : conversations.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" p="md">
                No conversations yet
              </Text>
            ) : (
              <Stack gap="xs">
                {conversations.map((conversation) => (
                  <Paper
                    key={conversation.id}
                    p="sm"
                    withBorder
                    style={{
                      cursor: 'pointer',
                      backgroundColor:
                        currentConversationId === conversation.id
                          ? 'var(--mantine-color-blue-0)'
                          : undefined,
                      borderColor:
                        currentConversationId === conversation.id
                          ? 'var(--mantine-color-blue-5)'
                          : undefined,
                    }}
                    onClick={() => handleSelectConversation(conversation.id)}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                        <IconMessageCircle size={16} />
                        <Text size="sm" truncate style={{ flex: 1 }}>
                          {conversation.title || 'Untitled'}
                        </Text>
                      </Group>
                      <Menu position="bottom-end" withinPortal>
                        <Menu.Target>
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <IconDots size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconEdit size={16} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(conversation);
                            }}
                          >
                            Rename
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconTrash size={16} />}
                            color="red"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConversation(conversation.id);
                            }}
                          >
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                    <Text size="xs" c="dimmed" mt={4}>
                      {new Date(conversation.updatedAt).toLocaleDateString()}
                    </Text>
                  </Paper>
                ))}
              </Stack>
            )}
          </ScrollArea>
        </Stack>
      </Paper>

      {/* Chat Area */}
      <Stack gap={0} style={{ height: '100%', flex: 1 }}>
        {/* Messages Area */}
        <ScrollArea viewportRef={viewport} style={{ flex: 1 }} p="md">
          {messages.length === 0 ? (
            <Stack gap="lg" align="center" justify="center" style={{ minHeight: 300, maxWidth: 700, margin: '0 auto', paddingTop: 40 }}>
              <Text size="xl" fw={500} ta="center">
                Hi! I'm your inventory assistant
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                I can help you with products, stock, transfers, analytics, and more.
              </Text>

              {loadingSuggestions ? (
                <Group justify="center" p="md">
                  <Loader size="sm" />
                  <Text size="sm" c="dimmed">Loading suggestions...</Text>
                </Group>
              ) : suggestions.length > 0 ? (
                <Stack gap="xs" style={{ width: '100%' }} mt="md">
                  <Text size="sm" fw={500} c="dimmed">Suggested questions:</Text>
                  <Stack gap="xs">
                    {suggestions.map((suggestion) => (
                      <Button
                        key={suggestion.id}
                        variant="light"
                        size="md"
                        onClick={() => handleSuggestionClick(suggestion)}
                        disabled={isLoading}
                        style={{
                          height: 'auto',
                          padding: '12px 16px',
                          textAlign: 'left',
                          whiteSpace: 'normal',
                        }}
                        data-testid={`suggestion-${suggestion.id}`}
                      >
                        {suggestion.text}
                      </Button>
                    ))}
                  </Stack>
                </Stack>
              ) : null}

              <Text size="xs" c="dimmed" ta="center" mt="lg">
                Or type your own question below
              </Text>
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

      {/* Rename Modal */}
      <Modal
        opened={editingConversationId !== null}
        onClose={() => {
          setEditingConversationId(null);
          setEditTitle('');
        }}
        title="Rename Conversation"
      >
        <Stack gap="md">
          <TextInput
            label="Conversation Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Enter conversation title"
            data-autofocus
          />
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => {
                setEditingConversationId(null);
                setEditTitle('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editTitle.trim()}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Group>
  );
}
