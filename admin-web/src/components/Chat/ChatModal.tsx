import { Modal } from '@mantine/core';
import { ChatInterface } from './ChatInterface';

interface ChatModalProps {
  opened: boolean;
  onClose: () => void;
}

export function ChatModal({ opened, onClose }: ChatModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="AI Assistant"
      size="70%"
      centered
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column', height: '80vh' },
        content: { height: 'calc(80vh + 60px)' }, // Account for header
      }}
      __vars={{ '--data-testid': 'chat-modal' } as any}
    >
      <div data-testid="chat-modal-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
        <ChatInterface />
      </div>
    </Modal>
  );
}
