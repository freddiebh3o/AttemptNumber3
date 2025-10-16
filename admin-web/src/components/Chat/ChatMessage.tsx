import { Paper, Text, Box, useMantineTheme } from '@mantine/core';
import ReactMarkdown from 'react-markdown';
import type { UIMessage } from '@ai-sdk/react';
import classes from './ChatMessage.module.css';

interface ChatMessageProps {
  message: UIMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const theme = useMantineTheme();
  const isUser = message.role === 'user';

  // Extract text content from UIMessage parts
  const textContent = message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('');

  // Use the theme's primary color for user messages
  const userBgColor = `${theme.primaryColor}.6`;

  return (
    <div className={isUser ? classes.userMessageContainer : classes.assistantMessageContainer}>
      <Paper
        p="sm"
        radius="md"
        withBorder={!isUser}
        bg={isUser ? userBgColor : undefined}
        c={isUser ? 'white' : undefined}
        style={{ maxWidth: isUser ? '70%' : '80%' }}
      >
        {isUser ? (
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {textContent}
          </Text>
        ) : (
          <Box className={classes.markdown}>
            <ReactMarkdown
              components={{
                // Custom rendering for links (transfer numbers, etc.)
                a: ({ node, ...props }) => (
                  <Text component="a" {...props} fw={500} c="blue" td="underline" />
                ),
              }}
            >
              {textContent}
            </ReactMarkdown>
          </Box>
        )}
      </Paper>
    </div>
  );
}
