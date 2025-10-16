import { ActionIcon } from '@mantine/core';
import { IconMessageCircle } from '@tabler/icons-react';
import classes from './ChatTrigger.module.css';

interface ChatTriggerProps {
  onClick: () => void;
}

export function ChatTrigger({ onClick }: ChatTriggerProps) {
  return (
    <ActionIcon
      className={classes.floatingButton}
      size={60}
      radius="xl"
      variant="filled"
      color="blue"
      onClick={onClick}
      aria-label="Open chat assistant"
    >
      <IconMessageCircle size={28} />
    </ActionIcon>
  );
}
