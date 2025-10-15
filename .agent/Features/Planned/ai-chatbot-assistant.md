# AI Chatbot Assistant - Implementation Plan

**Status:** PLANNED
**Priority:** Medium
**Estimated Total Effort:** 4-6 weeks (across all phases)
**Created:** 2025-10-15
**Agent:** vercel-ai-sdk-v5-expert

---

## Overview

Add an intelligent AI-powered chatbot to the platform that helps users navigate features, query data, and perform actions through natural conversation. The chatbot will use Vercel AI SDK v5 with a combination of tools (real-time data access) and RAG (documentation search) to provide contextual, accurate assistance.

## Goals

1. **Reduce support burden** - Users can self-serve common questions
2. **Improve discoverability** - Help users find features they don't know exist
3. **Increase productivity** - Quick actions via chat instead of clicking through UI
4. **Better onboarding** - Guide new users through platform capabilities
5. **Data insights** - Allow natural language queries of inventory data

---

## Technical Architecture

### Stack
- **Frontend:** React with `@ai-sdk/react` (useChat hook)
- **Backend:** Express API routes with `ai` package (streamText)
- **LLM Provider:** OpenAI GPT-4o (can swap to Anthropic Claude later)
- **RAG:** Vector database (Pinecone or pgvector) for documentation search
- **Tools:** Zod-validated functions for data access and actions

### Core Components
```
┌─────────────────────────────────────────────────────────┐
│ Frontend (admin-web)                                    │
│  ├─ ChatWidget.tsx (floating bubble UI)                │
│  ├─ ChatPanel.tsx (expandable chat interface)          │
│  ├─ MessageList.tsx (renders UIMessage parts)          │
│  └─ useChat hook (manages state, streaming)            │
└─────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────┐
│ Backend (api-server)                                    │
│  ├─ /api/chat (POST - main chat endpoint)              │
│  ├─ chatService.ts (orchestrates AI calls)             │
│  ├─ tools/ (product, stock, transfer tools)            │
│  ├─ ragService.ts (vector search for docs)             │
│  └─ promptBuilder.ts (system message construction)     │
└─────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────┐
│ External Services                                        │
│  ├─ OpenAI API (GPT-4o)                                │
│  └─ Pinecone / pgvector (documentation embeddings)     │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 1: MVP - Stock Transfers Assistant (Week 1-2)

**Goal:** Prove the concept with a focused chatbot that helps with stock transfers only.

### Scope
- ✅ Basic chat UI (floating bubble + expandable panel)
- ✅ Authentication & user context
- ✅ **3 read-only tools** for stock transfers:
  1. Search/list transfers
  2. Get transfer details
  3. Get transfer approval status
- ✅ Simple system message (no RAG yet)
- ✅ Streaming responses
- ✅ Error handling

### Backend Implementation

#### 1.1 Database Schema (if needed)
```prisma
// api-server/prisma/schema.prisma
// Only if we want to store chat history (optional for MVP)

model ChatConversation {
  id        String   @id @default(cuid())
  userId    String
  tenantId  String
  title     String?  // Auto-generated from first message
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  messages ChatMessage[]

  user   User   @relation(fields: [userId], references: [id])
  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([userId, tenantId])
}

model ChatMessage {
  id             String   @id @default(cuid())
  conversationId String
  role           String   // 'user' | 'assistant'
  content        Json     // UIMessage parts array
  createdAt      DateTime @default(now())

  conversation ChatConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
}
```

#### 1.2 API Route
```typescript
// api-server/src/routes/chatRouter.ts
import { Router } from 'express';
import { requireAuthenticatedUserMiddleware } from '../middleware/sessionMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import * as chatService from '../services/chat/chatService.js';

export const chatRouter = Router();

// POST /api/chat - Main chat endpoint
chatRouter.post(
  '/',
  requireAuthenticatedUserMiddleware,
  // No specific permission needed - everyone can use chatbot
  async (req, res, next) => {
    try {
      const { messages } = req.body; // UIMessage[]

      const stream = await chatService.streamChatResponse({
        messages,
        userId: req.currentUserId,
        tenantId: req.currentTenantId,
      });

      // Stream the response
      stream.pipeUIMessageStreamToResponse(res);
    } catch (e) {
      next(e);
    }
  }
);
```

#### 1.3 Chat Service
```typescript
// api-server/src/services/chat/chatService.ts
import { streamText, convertToModelMessages } from 'ai';
import { openai } from '@ai-sdk/openai';
import { transferTools } from './tools/transferTools.js';
import { buildSystemMessage } from './promptBuilder.js';

export async function streamChatResponse({
  messages,
  userId,
  tenantId,
}: {
  messages: any[]; // UIMessage[]
  userId: string;
  tenantId: string;
}) {
  // Get user context
  const user = await prismaClientInstance.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        where: { tenantId },
        include: { role: { include: { permissions: true } } },
      },
    },
  });

  const membership = user.memberships[0];
  const permissions = membership?.role.permissions.map(p => p.permissionKey) || [];

  // Build system message
  const systemMessage = buildSystemMessage({
    userName: user.fullName,
    userRole: membership?.role.roleName,
    permissions,
    tenantId,
  });

  // Stream response
  const result = await streamText({
    model: openai('gpt-4o'),
    system: systemMessage,
    messages: convertToModelMessages(messages),
    tools: transferTools({ userId, tenantId }), // Phase 1: Transfer tools only
    temperature: 0.7,
    maxOutputTokens: 1000,
  });

  return result.toUIMessageStreamResponse({
    onFinish: ({ messages: allMessages, responseMessage }) => {
      // Optional: Save to database for history
      // await saveChatMessages(userId, tenantId, allMessages);
    },
  });
}
```

#### 1.4 Transfer Tools
```typescript
// api-server/src/services/chat/tools/transferTools.ts
import { tool } from 'ai';
import { z } from 'zod';
import * as transferService from '../../stockTransfers/stockTransferService.js';

export function transferTools({ userId, tenantId }: { userId: string; tenantId: string }) {
  return {
    searchTransfers: tool({
      description: 'Search and list stock transfers. Use this when user asks about their transfers, pending transfers, or wants to find a specific transfer.',
      inputSchema: z.object({
        status: z.enum(['REQUESTED', 'APPROVED', 'IN_TRANSIT', 'COMPLETED', 'REJECTED', 'CANCELLED']).optional()
          .describe('Filter by transfer status'),
        priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']).optional()
          .describe('Filter by priority'),
        direction: z.enum(['inbound', 'outbound']).optional()
          .describe('inbound = coming to me, outbound = sending from me'),
        limit: z.number().optional().default(5)
          .describe('Number of results (max 10)'),
      }),
      execute: async ({ status, priority, direction, limit }) => {
        const result = await transferService.listStockTransfers({
          tenantId,
          userId,
          filters: {
            status,
            priority,
            direction,
            limit: Math.min(limit || 5, 10),
          },
        });

        return {
          transfers: result.transfers.map(t => ({
            id: t.id,
            transferNumber: t.transferNumber,
            status: t.status,
            priority: t.priority,
            sourceBranch: t.sourceBranch?.branchName,
            destinationBranch: t.destinationBranch?.branchName,
            itemCount: t.items.length,
            requestedAt: t.requestedAt,
          })),
          total: result.total,
        };
      },
    }),

    getTransferDetails: tool({
      description: 'Get detailed information about a specific stock transfer. Use when user asks about a specific transfer by number or ID.',
      inputSchema: z.object({
        transferNumber: z.string().optional().describe('Transfer number (e.g., TR-00123)'),
        transferId: z.string().optional().describe('Transfer ID if known'),
      }),
      execute: async ({ transferNumber, transferId }) => {
        let transfer;

        if (transferId) {
          transfer = await transferService.getStockTransfer({ tenantId, userId, transferId });
        } else if (transferNumber) {
          // Search by transfer number
          const results = await transferService.listStockTransfers({
            tenantId,
            userId,
            filters: { q: transferNumber, limit: 1 },
          });
          transfer = results.transfers[0];
        }

        if (!transfer) {
          return { error: 'Transfer not found' };
        }

        return {
          transferNumber: transfer.transferNumber,
          status: transfer.status,
          priority: transfer.priority,
          sourceBranch: transfer.sourceBranch?.branchName,
          destinationBranch: transfer.destinationBranch?.branchName,
          requestedBy: transfer.requestedBy?.fullName,
          requestedAt: transfer.requestedAt,
          items: transfer.items.map(item => ({
            product: item.product?.productName,
            sku: item.product?.sku,
            qtyRequested: item.qtyRequested,
            qtyApproved: item.qtyApproved,
            qtyShipped: item.qtyShipped,
            qtyReceived: item.qtyReceived,
          })),
          notes: transfer.requestNotes,
        };
      },
    }),

    getApprovalStatus: tool({
      description: 'Get approval progress for a stock transfer. Use when user asks why a transfer is stuck or pending.',
      inputSchema: z.object({
        transferId: z.string().describe('Transfer ID'),
      }),
      execute: async ({ transferId }) => {
        const progress = await transferService.getApprovalProgress({
          tenantId,
          userId,
          transferId
        });

        return {
          currentLevel: progress.currentLevel,
          requiredLevels: progress.requiredLevels,
          approvals: progress.approvals.map(a => ({
            level: a.level,
            status: a.status,
            approver: a.approver?.fullName,
            approvedAt: a.approvedAt,
            notes: a.notes,
          })),
          isFullyApproved: progress.isFullyApproved,
          nextApprover: progress.nextApprover,
        };
      },
    }),
  };
}
```

#### 1.5 System Message Builder
```typescript
// api-server/src/services/chat/promptBuilder.ts

export function buildSystemMessage({
  userName,
  userRole,
  permissions,
  tenantId,
}: {
  userName: string;
  userRole?: string;
  permissions: string[];
  tenantId: string;
}) {
  return `You are a helpful assistant for an inventory management platform.

# Your Role
Help users understand and navigate the stock transfer system. Be friendly, concise, and accurate.

# Current User Context
- Name: ${userName}
- Role: ${userRole || 'User'}
- Permissions: ${permissions.join(', ')}

# Available Features (Phase 1 - Stock Transfers)
You can help users with:
1. **Finding transfers** - Search by status, priority, or direction (inbound/outbound)
2. **Transfer details** - Get full information about specific transfers
3. **Approval status** - Check why a transfer is pending and what approvals are needed

# Platform Terminology
- **Stock Transfer**: Moving inventory between branches
- **Statuses**: REQUESTED → APPROVED → IN_TRANSIT → COMPLETED
- **Priority Levels**: URGENT, HIGH, NORMAL, LOW
- **Approval Workflow**: Transfers may require 1-3 levels of approval depending on rules
- **Inbound**: Transfers coming TO the user's branch
- **Outbound**: Transfers going FROM the user's branch

# Response Guidelines
1. Use the available tools to get real-time data when users ask questions
2. Be conversational and helpful - avoid jargon
3. When a transfer is stuck, explain the approval process clearly
4. Format transfer numbers as "TR-00123" for readability
5. If a user asks about features not yet available, politely explain: "I currently focus on stock transfers. Other features will be added soon!"

# Important
- Always check user permissions before suggesting actions
- Never make up data - use tools to get accurate information
- If you don't know something, say so and suggest alternatives`;
}
```

### Frontend Implementation

#### 1.6 Chat Widget Component
```typescript
// admin-web/src/components/chat/ChatWidget.tsx
import { useState } from 'react';
import { ActionIcon, Transition } from '@mantine/core';
import { IconMessageCircle, IconX } from '@tabler/icons-react';
import { ChatPanel } from './ChatPanel';
import classes from './ChatWidget.module.css';

export function ChatWidget() {
  const [opened, setOpened] = useState(false);

  return (
    <>
      {/* Chat Panel */}
      <Transition mounted={opened} transition="slide-up" duration={200}>
        {(styles) => (
          <div style={styles} className={classes.chatPanel}>
            <ChatPanel onClose={() => setOpened(false)} />
          </div>
        )}
      </Transition>

      {/* Floating Button */}
      <ActionIcon
        className={classes.floatingButton}
        size={60}
        radius="xl"
        variant="filled"
        color="blue"
        onClick={() => setOpened(!opened)}
        aria-label={opened ? 'Close chat' : 'Open chat assistant'}
      >
        {opened ? <IconX size={28} /> : <IconMessageCircle size={28} />}
      </ActionIcon>
    </>
  );
}
```

#### 1.7 Chat Panel Component
```typescript
// admin-web/src/components/chat/ChatPanel.tsx
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect } from 'react';
import { Paper, Stack, TextInput, Button, ScrollArea, Text, Group, ActionIcon } from '@mantine/core';
import { IconSend, IconX } from '@tabler/icons-react';
import { MessageList } from './MessageList';
import classes from './ChatPanel.module.css';

interface ChatPanelProps {
  onClose: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const viewport = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      credentials: 'include',
    }),
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (viewport.current) {
      viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    sendMessage({ text: input });
    setInput('');
  };

  return (
    <Paper shadow="xl" radius="lg" className={classes.panel}>
      {/* Header */}
      <Group justify="space-between" className={classes.header}>
        <div>
          <Text fw={600} size="lg">AI Assistant</Text>
          <Text size="xs" c="dimmed">Ask me about stock transfers</Text>
        </div>
        <ActionIcon variant="subtle" onClick={onClose}>
          <IconX size={20} />
        </ActionIcon>
      </Group>

      {/* Messages */}
      <ScrollArea viewportRef={viewport} className={classes.messages}>
        {messages.length === 0 ? (
          <Stack gap="xs" p="md">
            <Text c="dimmed" size="sm">👋 Hi! I can help you with:</Text>
            <Text size="sm" c="dimmed">• Finding your stock transfers</Text>
            <Text size="sm" c="dimmed">• Checking transfer status</Text>
            <Text size="sm" c="dimmed">• Understanding approval workflows</Text>
          </Stack>
        ) : (
          <MessageList messages={messages} />
        )}
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className={classes.inputForm}>
        <TextInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything about stock transfers..."
          disabled={status === 'streaming'}
          rightSection={
            <ActionIcon
              type="submit"
              variant="filled"
              disabled={!input.trim() || status === 'streaming'}
              loading={status === 'streaming'}
            >
              <IconSend size={18} />
            </ActionIcon>
          }
          styles={{ input: { paddingRight: 50 } }}
        />
      </form>
    </Paper>
  );
}
```

#### 1.8 Message List Component
```typescript
// admin-web/src/components/chat/MessageList.tsx
import { Stack, Paper, Text, Loader, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { UIMessage } from 'ai';
import classes from './MessageList.module.css';

interface MessageListProps {
  messages: UIMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <Stack gap="sm" p="md">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </Stack>
  );
}

function MessageItem({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={isUser ? classes.userMessageContainer : classes.assistantMessageContainer}>
      <Paper
        className={isUser ? classes.userMessage : classes.assistantMessage}
        p="sm"
        radius="md"
      >
        {message.parts.map((part, index) => {
          // Text content
          if (part.type === 'text') {
            return (
              <Text key={index} size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {part.text}
              </Text>
            );
          }

          // Tool execution states (Phase 1 - just show loading)
          if (part.type.startsWith('tool-')) {
            const toolName = part.type.replace('tool-', '');

            switch (part.state) {
              case 'input-streaming':
              case 'input-available':
                return (
                  <Alert key={index} icon={<Loader size="xs" />} color="blue" variant="light">
                    <Text size="xs">Searching transfers...</Text>
                  </Alert>
                );
              case 'output-error':
                return (
                  <Alert key={index} icon={<IconAlertCircle size={16} />} color="red" variant="light">
                    <Text size="xs">{part.errorText}</Text>
                  </Alert>
                );
              default:
                return null; // output-available is handled by AI in text response
            }
          }

          return null;
        })}
      </Paper>
    </div>
  );
}
```

#### 1.9 Add to Layout
```typescript
// admin-web/src/components/shell/AdminLayout.tsx
import { ChatWidget } from '../chat/ChatWidget';

export function AdminLayout() {
  return (
    <AppShell /* existing shell setup */>
      {/* Existing header, navbar, main content */}

      {/* NEW: Add chat widget */}
      <ChatWidget />
    </AppShell>
  );
}
```

### Testing & Validation

**Manual Testing Checklist:**
- [ ] Chat widget appears in bottom-right corner
- [ ] Clicking opens/closes chat panel
- [ ] Can send messages and receive responses
- [ ] Tool calls show loading indicators
- [ ] Transfer search returns results
- [ ] Transfer details display correctly
- [ ] Approval status shows correctly
- [ ] Error handling works (invalid transfer number)
- [ ] Permissions respected (can't see others' transfers if restricted)

### Success Metrics
- Chat widget accessible on all pages
- Response time < 3 seconds for tool calls
- Zero crashes/errors in production
- Users can successfully query transfers

---

## Phase 2: Expand Tools - Products & Stock (Week 3)

**Goal:** Add product and stock querying capabilities.

### New Tools to Add

#### 2.1 Product Tools
```typescript
// api-server/src/services/chat/tools/productTools.ts

export function productTools({ userId, tenantId }: Context) {
  return {
    searchProducts: tool({
      description: 'Search for products by name or SKU',
      inputSchema: z.object({
        query: z.string().describe('Product name or SKU to search'),
        limit: z.number().optional().default(5),
      }),
      execute: async ({ query, limit }) => {
        const products = await prismaClientInstance.product.findMany({
          where: {
            tenantId,
            OR: [
              { productName: { contains: query, mode: 'insensitive' } },
              { sku: { contains: query, mode: 'insensitive' } },
            ],
          },
          take: limit,
        });

        return products.map(p => ({
          id: p.id,
          name: p.productName,
          sku: p.sku,
          price: `£${(p.unitPricePence / 100).toFixed(2)}`,
        }));
      },
    }),

    getStockLevel: tool({
      description: 'Get current stock level for a product at a specific branch',
      inputSchema: z.object({
        productId: z.string().optional(),
        productName: z.string().optional(),
        sku: z.string().optional(),
        branchName: z.string().optional().describe('Leave empty for current user branch'),
      }),
      execute: async ({ productId, productName, sku, branchName }) => {
        // Resolve product
        let product;
        if (productId) {
          product = await prismaClientInstance.product.findUnique({ where: { id: productId } });
        } else if (sku) {
          product = await prismaClientInstance.product.findFirst({
            where: { tenantId, sku },
          });
        } else if (productName) {
          product = await prismaClientInstance.product.findFirst({
            where: { tenantId, productName: { contains: productName, mode: 'insensitive' } },
          });
        }

        if (!product) return { error: 'Product not found' };

        // Resolve branch
        let branchId;
        if (branchName) {
          const branch = await prismaClientInstance.branch.findFirst({
            where: { tenantId, branchName: { contains: branchName, mode: 'insensitive' } },
          });
          branchId = branch?.id;
        } else {
          // Use user's current branch
          const membership = await prismaClientInstance.userBranchMembership.findFirst({
            where: { userId, tenantId },
          });
          branchId = membership?.branchId;
        }

        // Get stock
        const stock = await prismaClientInstance.productStock.findFirst({
          where: { productId: product.id, branchId },
          include: { branch: true },
        });

        return {
          product: product.productName,
          sku: product.sku,
          branch: stock?.branch?.branchName || 'Unknown',
          qtyOnHand: stock?.qtyOnHand || 0,
        };
      },
    }),
  };
}
```

#### 2.2 Update Chat Service
```typescript
// api-server/src/services/chat/chatService.ts

import { transferTools } from './tools/transferTools.js';
import { productTools } from './tools/productTools.js'; // NEW

export async function streamChatResponse({ messages, userId, tenantId }) {
  // ... existing setup ...

  const result = await streamText({
    model: openai('gpt-4o'),
    system: systemMessage,
    messages: convertToModelMessages(messages),
    tools: {
      ...transferTools({ userId, tenantId }),
      ...productTools({ userId, tenantId }), // NEW
    },
    temperature: 0.7,
    maxOutputTokens: 1000,
  });

  return result.toUIMessageStreamResponse();
}
```

#### 2.3 Update System Message
```typescript
// Add to promptBuilder.ts

# Available Features (Phase 2 - Added Products & Stock)
You can help users with:
1. **Stock Transfers** - Search, details, approval status
2. **Products** - Search by name or SKU
3. **Stock Levels** - Check inventory at any branch

# New Commands
- "Find product Widget Pro"
- "What's the stock level for SKU-001?"
- "How many widgets do we have at Main Warehouse?"
```

### Testing
- [ ] Can search products by name
- [ ] Can search products by SKU
- [ ] Stock levels display correctly
- [ ] Branch resolution works (by name or user's branch)
- [ ] Handles product not found gracefully

---

## Phase 3: Action Tools - Create & Modify (Week 4)

**Goal:** Allow users to create products and transfers via chat.

### New Action Tools

#### 3.1 Create Product Tool
```typescript
// api-server/src/services/chat/tools/productTools.ts

createProduct: tool({
  description: 'Create a new product. Only use if user explicitly wants to create a product AND provides a name.',
  inputSchema: z.object({
    productName: z.string(),
    sku: z.string().optional(),
    unitPricePence: z.number().optional(),
  }),
  execute: async ({ productName, sku, unitPricePence }) => {
    // Check permission
    const hasPermission = await checkUserPermission(userId, tenantId, 'products:write');
    if (!hasPermission) {
      return {
        type: 'permission-error',
        message: 'You need products:write permission to create products',
      };
    }

    // If missing required fields, return pre-fill action
    if (!sku || unitPricePence === undefined) {
      return {
        type: 'open-form',
        action: 'create-product-modal',
        prefillData: { productName, sku, unitPricePence },
        message: 'I\'ve opened the product creation form with the name pre-filled. Please complete the remaining fields.',
      };
    }

    // All fields provided - create directly
    const product = await prismaClientInstance.product.create({
      data: {
        productName,
        sku,
        unitPricePence,
        tenantId,
      },
    });

    return {
      type: 'direct-creation',
      success: true,
      product: {
        id: product.id,
        name: product.productName,
        sku: product.sku,
      },
      viewUrl: `/products/${product.id}`,
    };
  },
}),
```

#### 3.2 Frontend Tool Handling
```typescript
// admin-web/src/components/chat/ChatPanel.tsx

const [createProductModalOpen, setCreateProductModalOpen] = useState(false);
const [createProductPrefill, setCreateProductPrefill] = useState(null);

const { messages, sendMessage, addToolResult } = useChat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),

  async onToolCall({ toolCall }) {
    // Handle create product
    if (toolCall.toolName === 'createProduct') {
      const output = toolCall.output; // Tool already executed

      if (output.type === 'open-form') {
        // Open modal with pre-fill
        setCreateProductPrefill(output.prefillData);
        setCreateProductModalOpen(true);
      } else if (output.type === 'direct-creation' && output.success) {
        // Product created successfully - maybe show success notification
        notifications.show({
          title: 'Product Created',
          message: `${output.product.name} created successfully!`,
          color: 'green',
        });
      }
    }
  },
});
```

### Smart Form Pre-filling
- If user provides all required fields → Create directly
- If missing fields → Open modal with partial data pre-filled
- User can review/complete before saving

---

## Phase 4: RAG Implementation - Documentation Search (Week 5)

**Goal:** Add vector search for platform documentation to answer "how-to" questions.

### Architecture

```
User Question → Vector Search → Relevant Docs → Injected into System Message → AI Response
```

### Implementation

#### 4.1 Vector Database Setup (Pinecone)
```bash
# Install dependencies
cd api-server
pnpm add @pinecone-database/pinecone openai
```

```typescript
// api-server/src/services/chat/vectorStore.ts
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const index = pinecone.index('platform-docs');

export async function searchDocumentation(query: string, limit = 3) {
  // 1. Generate embedding for user query
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;

  // 2. Search vector database
  const searchResults = await index.query({
    vector: queryEmbedding,
    topK: limit,
    includeMetadata: true,
  });

  // 3. Return relevant docs
  return searchResults.matches.map(match => ({
    title: match.metadata.title,
    content: match.metadata.content,
    url: match.metadata.url,
    score: match.score,
  }));
}
```

#### 4.2 Document Ingestion Script
```typescript
// api-server/scripts/ingestDocs.ts
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const docs = [
  {
    title: 'Creating Stock Transfers',
    content: `To create a stock transfer:
    1. Navigate to Stock Transfers page
    2. Click "New Transfer" button
    3. Select source and destination branches
    4. Add products and quantities
    5. Set priority if urgent
    6. Submit for approval`,
    url: '/help/stock-transfers/create',
  },
  {
    title: 'Approval Workflows',
    content: `Stock transfers require approvals based on rules:
    - Level 1: Branch Manager approval
    - Level 2: Regional Manager approval (for high-value transfers)
    - Level 3: Executive approval (for urgent/high-value)

    Approvers receive email notifications.`,
    url: '/help/approvals/workflows',
  },
  // Add more documentation...
];

async function ingestDocuments() {
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const index = pinecone.index('platform-docs');

  for (const doc of docs) {
    // Generate embedding
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: doc.content,
    });

    const embedding = response.data[0].embedding;

    // Upsert to Pinecone
    await index.upsert([
      {
        id: doc.url,
        values: embedding,
        metadata: {
          title: doc.title,
          content: doc.content,
          url: doc.url,
        },
      },
    ]);
  }

  console.log(`✓ Ingested ${docs.length} documents`);
}

ingestDocuments();
```

#### 4.3 Update Chat Service with RAG
```typescript
// api-server/src/services/chat/chatService.ts
import { searchDocumentation } from './vectorStore.js';

export async function streamChatResponse({ messages, userId, tenantId }) {
  // Get last user message for RAG search
  const lastUserMessage = messages[messages.length - 1];
  const lastUserText = lastUserMessage.parts.find(p => p.type === 'text')?.text || '';

  // Search documentation
  const relevantDocs = await searchDocumentation(lastUserText, 3);

  // Build enhanced system message with RAG context
  const systemMessage = buildSystemMessage({
    userName,
    userRole,
    permissions,
    tenantId,
    relevantDocs, // NEW: Include RAG results
  });

  // ... rest of streaming logic
}
```

#### 4.4 Update Prompt Builder
```typescript
// api-server/src/services/chat/promptBuilder.ts

export function buildSystemMessage({
  userName,
  userRole,
  permissions,
  tenantId,
  relevantDocs = [], // NEW
}) {
  const docSection = relevantDocs.length > 0
    ? `
# Relevant Documentation
${relevantDocs.map(doc => `
## ${doc.title}
${doc.content}
[Read more: ${doc.url}]
`).join('\n')}
`
    : '';

  return `You are a helpful assistant for an inventory management platform.

${docSection}

# Your Role
Help users understand and navigate the platform. Use the documentation above when relevant.

# Current User Context
- Name: ${userName}
- Role: ${userRole || 'User'}
- Permissions: ${permissions.join(', ')}

# Response Guidelines
1. Reference the documentation when answering "how-to" questions
2. Provide links to relevant help pages when available
3. Use tools for real-time data queries
4. Be concise but thorough
`;
}
```

### Benefits of RAG
- ✅ Can answer "How do I...?" questions
- ✅ Always up-to-date (update docs → re-ingest)
- ✅ Provides source links for users to learn more
- ✅ Scales to large documentation bases

---

## Phase 5: Advanced Features (Week 6)

**Goal:** Polish and add advanced capabilities.

### 5.1 Multi-Modal Support (Images)

Allow users to upload screenshots:

```typescript
// Frontend - allow image upload
const { messages, sendMessage } = useChat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
});

// User can attach images
sendMessage({
  parts: [
    { type: 'text', text: 'What is wrong with this screen?' },
    { type: 'file', url: imageDataUrl, mediaType: 'image/png' },
  ],
});
```

### 5.2 Conversation History

Store chat conversations for context:

```typescript
// On message finish, save to database
onFinish: async ({ messages }) => {
  await prismaClientInstance.chatConversation.upsert({
    where: { id: conversationId },
    create: {
      id: conversationId,
      userId,
      tenantId,
      title: messages[0].parts[0].text.slice(0, 50), // First message as title
      messages: {
        create: messages.map(m => ({
          role: m.role,
          content: m.parts,
        })),
      },
    },
    update: {
      messages: {
        create: messages.slice(-1).map(m => ({ // Only add new message
          role: m.role,
          content: m.parts,
        })),
      },
    },
  });
}
```

### 5.3 Analytics Dashboard

Track chatbot usage:

```prisma
model ChatAnalytics {
  id            String   @id @default(cuid())
  tenantId      String
  date          DateTime @db.Date
  totalChats    Int      @default(0)
  totalMessages Int      @default(0)
  uniqueUsers   Int      @default(0)
  toolCalls     Json     // { "searchProducts": 45, "searchTransfers": 32 }

  @@unique([tenantId, date])
}
```

Dashboard showing:
- Daily active users
- Most used tools
- Common questions
- Average conversation length

### 5.4 Smart Suggestions

Suggest common actions:

```typescript
// In ChatPanel - show quick actions
const suggestions = [
  "Show my pending transfers",
  "What's in stock at Main Warehouse?",
  "Create a new product",
  "Find transfer TR-00123",
];

<Group gap="xs" wrap="wrap">
  {suggestions.map(suggestion => (
    <Button
      key={suggestion}
      size="xs"
      variant="light"
      onClick={() => {
        setInput(suggestion);
        sendMessage({ text: suggestion });
      }}
    >
      {suggestion}
    </Button>
  ))}
</Group>
```

---

## Phase 6: Workflow Integration (Future)

**Goal:** Integrate chatbot into your development workflow.

### When Creating New Features

**Step 1: Define Tools**
Every new feature should include chatbot tools:

```typescript
// Example: When adding "Branch Management" feature
// Also create: api-server/src/services/chat/tools/branchTools.ts

export function branchTools({ userId, tenantId }) {
  return {
    listBranches: tool({ /* ... */ }),
    getBranchDetails: tool({ /* ... */ }),
    getBranchPerformance: tool({ /* ... */ }),
  };
}
```

**Step 2: Add Documentation**
Write docs that will be ingested into RAG:

```markdown
# Managing Branches

To create a new branch:
1. Navigate to Branches page
2. Click "Add Branch"
3. Enter branch name, location, and contact info
4. Assign branch manager
5. Save

Branches can have different inventory and staff.
```

**Step 3: Ingest Documentation**
```bash
pnpm run ingest-docs
```

**Step 4: Test via Chat**
Manually test that chatbot can:
- Answer questions about the feature
- Use tools to query data
- Help users complete tasks

---

## Ongoing Maintenance & Expansion

### Monthly Tasks
- [ ] Review chat analytics - what are users asking?
- [ ] Add new documentation for frequently asked questions
- [ ] Expand tools based on user needs
- [ ] Monitor error rates and fix edge cases

### Metrics to Track
- **Engagement**: Daily active chatbot users
- **Satisfaction**: Thumbs up/down on responses
- **Deflection**: Support tickets avoided
- **Coverage**: % of platform features with tools/docs

### Cost Monitoring
- **Token Usage**: Monitor OpenAI API costs
- **Optimization**: Cache common queries, use GPT-4o-mini for simple questions
- **Budget Alerts**: Set spending limits

---

## Technical Considerations

### Security
- ✅ Always filter by `tenantId` - users can only access their tenant's data
- ✅ Check permissions before executing action tools
- ✅ Sanitize tool inputs (Zod validation)
- ✅ Never expose sensitive data (API keys, internal IDs) in responses
- ✅ Rate limit API endpoint (use existing middleware)

### Performance
- ✅ Stream responses for perceived speed
- ✅ Cache system messages (they don't change often)
- ✅ Limit tool execution time (timeout after 10s)
- ✅ Use GPT-4o-mini for simple queries (cheaper, faster)
- ✅ Batch embeddings when ingesting docs

### Error Handling
- ✅ Tool errors should return user-friendly messages
- ✅ Network errors should allow retry
- ✅ Show loading states during tool execution
- ✅ Log all errors with correlation IDs for debugging

### Accessibility
- ✅ Keyboard navigation (Enter to send, Esc to close)
- ✅ Screen reader support (ARIA labels)
- ✅ High contrast mode support
- ✅ Configurable text size

---

## Dependencies & Environment Setup

### New Dependencies

**Backend:**
```json
{
  "ai": "^5.0.0",
  "@ai-sdk/openai": "^2.0.0",
  "@pinecone-database/pinecone": "^4.0.0",
  "zod": "^3.25.0"
}
```

**Frontend:**
```json
{
  "@ai-sdk/react": "^1.0.0",
  "ai": "^5.0.0"
}
```

### Environment Variables

```bash
# .env
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX_NAME=platform-docs
```

---

## Success Criteria

### Phase 1 (MVP)
- [ ] Chat widget accessible on all pages
- [ ] Users can query their stock transfers
- [ ] Response time < 3 seconds
- [ ] Zero production errors

### Phase 2 (Products & Stock)
- [ ] Users can search products
- [ ] Stock levels display accurately
- [ ] 80% of stock-related questions answered

### Phase 3 (Actions)
- [ ] Users can create products via chat
- [ ] Form pre-filling works correctly
- [ ] Permission checks enforced

### Phase 4 (RAG)
- [ ] "How to" questions answered from docs
- [ ] Documentation links provided
- [ ] Search relevance > 80%

### Phase 5 (Polish)
- [ ] Image upload supported
- [ ] Conversation history saved
- [ ] Analytics dashboard live
- [ ] Smart suggestions shown

### Phase 6 (Workflow)
- [ ] All new features include tools
- [ ] Documentation ingestion automated
- [ ] 100% platform coverage

---

## Rollout Strategy

### Beta Testing (Week 1-2)
- Enable for internal team only
- Gather feedback on usefulness
- Fix critical bugs

### Limited Release (Week 3-4)
- Enable for 20% of users
- Monitor usage patterns
- Iterate on prompts and tools

### General Availability (Week 5+)
- Enable for all users
- Announce feature in release notes
- Create help documentation for chatbot itself

---

## Future Enhancements (Post-Launch)

### Voice Input
- Add speech-to-text for hands-free interaction
- Useful in warehouse environments

### Proactive Assistance
- Chatbot detects user struggles and offers help
- "I noticed you're on the transfer page. Need help creating a transfer?"

### Multi-Language Support
- Translate responses based on user locale
- Useful for international teams

### Custom Training
- Fine-tune model on company-specific terminology
- Better understanding of internal processes

### Integration with External Systems
- Query data from ERP, WMS, etc.
- Unified interface across multiple systems

---

## Estimated Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1: MVP | 2 weeks | Stock transfers assistant with 3 tools |
| Phase 2: Products & Stock | 1 week | Add 2 product tools |
| Phase 3: Actions | 1 week | Create/modify capabilities |
| Phase 4: RAG | 1 week | Documentation search |
| Phase 5: Polish | 1 week | Advanced features |
| **Total** | **6 weeks** | **Full-featured AI assistant** |

---

## Cost Estimate

### OpenAI API Costs (Monthly)
- **GPT-4o**: $0.005/1K input tokens, $0.015/1K output tokens
- **Embeddings**: $0.0001/1K tokens
- **Estimated usage**: 1M tokens/month
- **Monthly cost**: ~$50-150 depending on usage

### Pinecone (Vector Database)
- **Starter**: $70/month (includes 2M vectors)
- **Growth**: Scale as needed

### Total: ~$120-220/month for a small-medium team

---

## Next Steps

1. **Review this plan** - Adjust phases/timeline as needed
2. **Set up OpenAI account** - Get API key
3. **Choose vector database** - Pinecone vs pgvector (cheaper but requires setup)
4. **Kickoff Phase 1** - Start with stock transfers MVP
5. **Create initial documentation** - Write docs to ingest for RAG

---

## Questions to Answer Before Starting

1. **Which LLM provider?** OpenAI (GPT-4o) or Anthropic (Claude Sonnet)?
2. **Vector database?** Pinecone (managed) or pgvector (self-hosted, free)?
3. **Conversation history?** Store in database or keep in-memory only?
4. **Beta testers?** Who should test first?
5. **Success metrics?** How will we measure if chatbot is useful?

---

**Document Version:** 1.0
**Last Updated:** 2025-10-15
**Owner:** vercel-ai-sdk-v5-expert agent
