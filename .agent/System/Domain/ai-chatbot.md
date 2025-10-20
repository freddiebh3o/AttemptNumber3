# AI Chatbot Assistant System

**Last Updated:** 2025-10-19
**Status:** Production Ready
**Related Documentation:**
- [Architecture Overview](../architecture.md#ai-integration)
- [Database Schema - Chat Tables](../database-schema.md)
- [AI Chatbot Backend SOP](../../SOP/ai-chatbot-backend.md)

---

## Overview

The AI Chatbot Assistant is an intelligent conversational interface powered by OpenAI GPT-4o that allows users to query and interact with the inventory management system using natural language. The system combines real-time data access, documentation search (RAG), and multi-turn conversation persistence to provide a comprehensive help experience.

**Key Capabilities:**
- Natural language queries for all major system features
- 23 specialized AI tools across 8 functional categories
- RAG (Retrieval-Augmented Generation) for documentation search
- Multi-turn conversation threading and persistence
- Branch membership-based security filtering
- Real-time streaming responses
- Usage analytics and tool adoption tracking

**Technology Stack:**
- **LLM:** OpenAI GPT-4o (gpt-4o model)
- **AI Framework:** Vercel AI SDK v5 (`ai` ^5.0.72)
- **OpenAI Client:** `@ai-sdk/openai` ^2.0.52
- **Embedding Model:** text-embedding-3-small (1536 dimensions)
- **Vector Database:** PostgreSQL with pgvector extension
- **Streaming:** Server-Sent Events (SSE)

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────┐
│    Frontend (React + useChat hook)      │
│  - Chat UI with message display         │
│  - Streaming message rendering          │
│  - Conversation history                 │
└────────────┬────────────────────────────┘
             │ POST /api/chat
             ↓
┌─────────────────────────────────────────┐
│      Chat Router (Express)              │
│  - requireAuthenticatedUserMiddleware   │
│  - Request validation (Zod)             │
│  - Sets currentUserId, currentTenantId  │
└────────────┬────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────┐
│      Chat Service (chatService.ts)      │
│  1. Get user context (role, perms)      │
│  2. RAG: Search documentation           │
│  3. Build system message                │
│  4. Stream response from OpenAI         │
│  5. Save conversation + analytics       │
└────────────┬────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────┐
│      OpenAI GPT-4o API                  │
│  - Streaming text generation            │
│  - Tool calling (function calling)      │
│  - Multi-step reasoning (max 10 steps)  │
└────────────┬────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────┐
│      AI Tools (8 categories)            │
│  - Transfer, Product, Stock             │
│  - Branch, User, Template               │
│  - Approval, Analytics                  │
│  - All call existing service functions  │
└────────────┬────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────┐
│      Service Layer                      │
│  - Business logic implementation        │
│  - Tenant isolation enforcement         │
│  - Branch membership filtering          │
│  - Permission checks                    │
└────────────┬────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────┐
│      PostgreSQL Database                │
│  - ChatConversation (threading)         │
│  - ChatMessage (history)                │
│  - DocumentChunk (RAG vectors)          │
│  - ChatAnalytics (usage metrics)        │
└─────────────────────────────────────────┘
```

### Component Breakdown

**Files:**
```
api-server/src/
├── routes/
│   └── chatRouter.ts               # POST /api/chat endpoint
├── services/chat/
│   ├── chatService.ts              # Main orchestration
│   ├── promptBuilder.ts            # System message generation
│   ├── conversationService.ts      # Conversation persistence
│   ├── ragService.ts               # Document search (RAG)
│   ├── embeddingService.ts         # OpenAI embedding generation
│   ├── analyticsService.ts         # Usage tracking
│   └── tools/
│       ├── transferTools.ts        # 3 transfer tools
│       ├── productTools.ts         # 4 product tools
│       ├── stockTools.ts           # 4 stock management tools
│       ├── branchTools.ts          # 2 branch tools
│       ├── userTools.ts            # 4 user/role tools
│       ├── templateTools.ts        # 2 template tools
│       ├── approvalTools.ts        # 2 approval tools
│       └── analyticsTools.ts       # 3 analytics tools
```

---

## Conversation Threading Model

### Multi-Turn Conversations

Users can have ongoing conversations with the AI assistant where context is preserved across messages. Each conversation is a thread of messages stored in the database.

**Data Model:**

```typescript
interface ChatConversation {
  id: string;                    // Unique conversation ID (CUID)
  tenantId: string;              // Tenant isolation
  userId: string;                // Conversation owner
  title: string;                 // Auto-generated from first message (first 50 chars)
  createdAt: Date;
  updatedAt: Date;               // Updated on each new message
  messages: ChatMessage[];       // Ordered chronologically
}

interface ChatMessage {
  id: string;                    // Message ID
  conversationId: string;        // Parent conversation
  role: 'user' | 'assistant';    // Message sender
  content: any;                  // JSON (parts array from AI SDK v5)
  createdAt: Date;
}
```

**Message Content Format (AI SDK v5):**
```json
{
  "role": "assistant",
  "content": [
    { "type": "text", "text": "Here are your pending transfers:" },
    {
      "type": "tool-call",
      "toolName": "searchTransfers",
      "toolCallId": "call_abc123",
      "args": { "status": "REQUESTED" }
    },
    {
      "type": "tool-result",
      "toolCallId": "call_abc123",
      "result": { "transfers": [...], "count": 5 }
    }
  ]
}
```

### Conversation Lifecycle

1. **New Conversation:**
   - User sends first message
   - System creates `ChatConversation` with auto-generated title
   - System saves user message as first `ChatMessage`
   - AI responds and response is saved as second message

2. **Resume Conversation:**
   - Frontend sends `conversationId` with new message
   - System validates user owns conversation (userId + tenantId check)
   - System adds user message to existing conversation
   - AI responds with full conversation history for context
   - Response saved as new message

3. **Conversation Security:**
   - Users can ONLY access their own conversations
   - All queries filtered by `userId` AND `tenantId`
   - No cross-tenant conversation access
   - Conversation deletion cascades to all messages

**API:**
```typescript
// Create conversation
createConversation({ userId, tenantId, firstMessage })

// Get conversation (security enforced)
getConversation({ conversationId, userId, tenantId })

// List user's conversations
listConversations({ userId, tenantId, limit })

// Add message to conversation
addMessageToConversation({ conversationId, userId, tenantId, message })

// Delete conversation (cascade)
deleteConversation({ conversationId, userId, tenantId })
```

---

## AI Tools

The chatbot has **23 specialized tools** across **8 functional categories**. All tools follow the same security pattern: they call existing service functions rather than querying the database directly.

### Tool Categories

#### 1. Stock Transfer Tools (3 tools)

**File:** `tools/transferTools.ts`

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `searchTransfers` | List and filter transfers | `status`, `priority`, `direction`, `branchId`, `limit` |
| `getTransferDetails` | Get full transfer info | `transferNumber` OR `transferId` |
| `getApprovalStatus` | Check approval progress | `transferId` |

**Security:**
- Automatically filters to user's branch memberships
- Users only see transfers where they're a member of source OR destination branch
- Tenant isolation enforced

**Example:**
```typescript
searchTransfers({ status: 'REQUESTED', priority: 'URGENT', limit: 5 })
// Returns: { transfers: [...], count: 3, hasMore: false }
```

#### 2. Product Tools (4 tools)

**File:** `tools/productTools.ts`

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `countAllProducts` | Get total product count | None |
| `searchProducts` | Search by name/SKU | `query`, `limit` (intelligent: 3-100) |
| `getProductDetails` | Get specific product | `productId` OR `sku` |
| `getStockLevel` | Check inventory level | `productId/sku`, `branchId/branchName` |

**Security:**
- Products are tenant-scoped (no branch filtering needed)
- Stock levels filtered by tenant + branch

**Example:**
```typescript
searchProducts({ query: 'widget', limit: 10 })
// Returns: { products: [...], showing: 10, totalCount: 191, hasMore: true }

getStockLevel({ sku: 'WID-001', branchName: 'Main Warehouse' })
// Returns: { qtyOnHand: 500, qtyAllocated: 50, qtyAvailable: 450 }
```

#### 3. Stock Management Tools (4 tools)

**File:** `tools/stockTools.ts`

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `getBranchStock` | View all inventory at branch | `branchId/branchName`, `limit` |
| `getStockMovements` | Recent ledger entries | `branchId`, `productId`, `limit` |
| `getLowStockItems` | Products needing reorder | `branchId`, `threshold`, `limit` |
| `getLotDetails` | FIFO lot info | `productId`, `branchId` |

**Security:**
- Branch membership filtering enforced
- Users can only access branches they're members of

**Example:**
```typescript
getLowStockItems({ branchName: 'Store A', threshold: 10, limit: 20 })
// Returns: Products with qtyOnHand < 10

getLotDetails({ productId: 'prod_123', branchId: 'branch_abc' })
// Returns: FIFO lots with receivedAt dates and unit costs
```

#### 4. Branch Tools (2 tools)

**File:** `tools/branchTools.ts`

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `listBranches` | List all active branches | None |
| `getBranchStats` | Branch performance metrics | `branchId/branchName` |

**Security:**
- Branches are tenant-scoped
- Stats filtered by tenant

**Example:**
```typescript
getBranchStats({ branchName: 'Main Warehouse' })
// Returns: { productCount, totalValue, recentTransfers, avgFulfillment }
```

#### 5. User & Role Tools (4 tools)

**File:** `tools/userTools.ts`

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `searchUsers` | Find users by email | `query`, `limit` |
| `getUserDetails` | Get user info | `userId` OR `email` |
| `listRoles` | View all roles | None |
| `getRolePermissions` | Check role permissions | `roleId/roleName` |

**Security:**
- Users filtered by tenant membership
- Only returns users within same tenant

**Example:**
```typescript
searchUsers({ query: 'john@', limit: 10 })
// Returns: Users with email matching query, their roles, and branches

getRolePermissions({ roleName: 'EDITOR' })
// Returns: List of permissions for role
```

#### 6. Template Tools (2 tools)

**File:** `tools/templateTools.ts`

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `listTemplates` | View transfer templates | `limit` |
| `getTemplateDetails` | Get template config | `templateId/templateName` |

**Security:**
- Templates filtered by tenant
- Only active templates returned

**Example:**
```typescript
getTemplateDetails({ templateName: 'Weekly Restock - Store A' })
// Returns: Source/dest branches, products with default quantities
```

#### 7. Approval Tools (2 tools)

**File:** `tools/approvalTools.ts`

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `getApprovalRules` | List approval rules | `isActive` (optional) |
| `explainApprovalRequirements` | Why transfer needs approval | `transferId` |

**Security:**
- Rules filtered by tenant
- Only returns rules user has access to

**Example:**
```typescript
explainApprovalRequirements({ transferId: 'transfer_123' })
// Returns: Matching rules, required levels, current progress
```

#### 8. Analytics Tools (3 tools)

**File:** `tools/analyticsTools.ts`

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `getTransferMetrics` | Completion rates, cycle times | `startDate`, `endDate` |
| `getPerformanceMetrics` | Branch activity analysis | `branchId`, `startDate`, `endDate` |
| `getValueReports` | Total inventory value (FIFO) | `branchId` (optional) |

**Security:**
- Metrics filtered by tenant
- Branch-specific metrics filtered by branch membership

**Example:**
```typescript
getTransferMetrics({ startDate: '2025-01-01', endDate: '2025-01-31' })
// Returns: { totalTransfers, completionRate, avgCycleTime, ... }
```

### Tool Design Pattern

**All tools follow this pattern:**

```typescript
export function productTools({ userId, tenantId }: { userId: string; tenantId: string }) {
  return {
    searchProducts: tool({
      description: 'Search for products by name or SKU...',
      inputSchema: z.object({
        query: z.string().optional().describe('Product name or SKU'),
        limit: z.number().optional().default(10),
      }),
      execute: async ({ query, limit }) => {
        // SECURITY: Call existing service function (no direct DB queries)
        const result = await productService.searchProducts({
          tenantId,  // Enforces tenant isolation
          userId,    // For audit trails
          query,
          limit,
        });
        return result; // Service handles all security
      },
    }),
  };
}
```

**Security Principles:**
1. ✅ Tools NEVER query database directly
2. ✅ All tools call existing service functions
3. ✅ Service layer enforces tenant isolation
4. ✅ Service layer enforces branch membership filtering
5. ✅ Single source of truth for security logic

---

## RAG (Retrieval-Augmented Generation)

### Purpose

Enable the AI to answer "how-to" questions using actual project documentation instead of hallucinating or saying "refer to the docs".

**Use Cases:**
- "How do I create a stock transfer?"
- "What's the approval workflow?"
- "How does FIFO work?"
- "How do I add a new user?"

### Architecture

```
┌──────────────────────────────────┐
│  Documentation Files (.md)       │
│  - .agent/SOP/*.md               │
│  - docs/*.md                     │
└──────────┬───────────────────────┘
           │ npm run ingest-docs
           ↓
┌──────────────────────────────────┐
│  Document Ingestion              │
│  1. Parse markdown by headings   │
│  2. Split into sections          │
│  3. Generate embeddings          │
│  4. Store in DocumentChunk       │
└──────────┬───────────────────────┘
           │
           ↓
┌──────────────────────────────────┐
│  PostgreSQL + pgvector           │
│  - DocumentChunk table           │
│  - Vector column (1536 dims)     │
│  - Cosine similarity search      │
└──────────┬───────────────────────┘
           │ Query time
           ↓
┌──────────────────────────────────┐
│  User Query                      │
│  "How do I create a transfer?"   │
└──────────┬───────────────────────┘
           │
           ↓
┌──────────────────────────────────┐
│  RAG Service (ragService.ts)     │
│  1. Generate query embedding     │
│  2. Vector similarity search     │
│  3. Return top K chunks (>0.7)   │
└──────────┬───────────────────────┘
           │
           ↓
┌──────────────────────────────────┐
│  System Message Builder          │
│  - Inject relevant docs          │
│  - User context                  │
│  - Security rules                │
└──────────┬───────────────────────┘
           │
           ↓
┌──────────────────────────────────┐
│  OpenAI GPT-4o                   │
│  - Uses docs to answer           │
│  - No hallucination              │
│  - Complete, accurate answers    │
└──────────────────────────────────┘
```

### Implementation Details

**Embedding Model:**
- Model: `text-embedding-3-small` (OpenAI)
- Dimensions: 1536
- Cost: ~$0.02 per 1M tokens
- Speed: ~100ms per embedding

**Document Chunking Strategy:**
- Split by markdown headings (`##` and `###`)
- Minimum chunk size: 50 characters
- Each heading becomes a separate chunk
- Preserves context within sections

**Vector Storage:**
- Database: PostgreSQL with pgvector extension
- Column type: `vector(1536)`
- Index: IVFFlat for fast similarity search
- Similarity metric: Cosine similarity (1 - cosine distance)

**Search Parameters:**
- Default limit: 3 chunks
- Similarity threshold: 0.7 (70% similarity)
- Returns: documentId, title, content, similarity score

**Document Ingestion Script:**
```bash
cd api-server
npm run ingest-docs  # Runs scripts/ingestDocs.ts
```

**Ingestion Workflow:**
```typescript
// 1. Parse markdown into sections
const sections = parseMarkdownSections(markdown);
// sections = [
//   { id: 'creating-transfers', title: 'Creating Transfers', content: '...' },
//   { id: 'approval-workflow', title: 'Approval Workflow', content: '...' },
// ]

// 2. Generate embeddings for each section
for (const section of sections) {
  const embedding = await generateEmbedding(section.content);
  // embedding = [0.123, -0.456, 0.789, ...] (1536 floats)

  // 3. Store in DocumentChunk
  await prisma.documentChunk.create({
    data: {
      documentId: filePath,
      sectionId: section.id,
      title: `${documentName} - ${section.title}`,
      content: section.content,
      embedding: embedding, // pgvector format
      metadata: { category, level: section.level },
    },
  });
}
```

**Search Workflow:**
```typescript
// 1. User asks: "How do I create a transfer?"
const userQuery = "How do I create a transfer?";

// 2. Generate query embedding
const queryEmbedding = await generateEmbedding(userQuery);

// 3. Vector similarity search
const results = await prisma.$queryRaw`
  SELECT id, title, content,
         1 - (embedding <=> ${queryVector}::vector) as similarity
  FROM document_chunks
  WHERE 1 - (embedding <=> ${queryVector}::vector) > 0.7
  ORDER BY similarity DESC
  LIMIT 3
`;
// Returns top 3 chunks with >70% similarity

// 4. Inject into system message
const systemMessage = buildSystemMessage({
  ...,
  relevantDocs: results, // AI uses these to answer
});
```

**System Message Integration:**
```typescript
// If relevant docs found, they're injected at the top:
`
# Relevant Documentation

I found these relevant help guides for your question:

## 1. Stock Transfers - Creating Transfers

To create a stock transfer:
1. Navigate to Stock Transfers page
2. Click "New Transfer" button
3. Select source and destination branches
...

---

## 2. Stock Transfers - Approval Workflow

Transfers may require approval based on:
- Total transfer value (£)
- Total quantity
- Specific branch combinations
...

Use this documentation to answer the user's question completely and accurately.
`
```

### Performance

**Ingestion:**
- ~10-20 docs/second
- ~100ms per embedding generation
- One-time cost (or when docs change)

**Search:**
- ~50-100ms per query
- 3 chunks retrieved by default
- Similarity threshold filters irrelevant results

**Cost:**
- Ingestion: ~$0.02 per 1M tokens
- Search: ~$0.00002 per query
- Very cost-effective for documentation search

---

## Analytics Tracking

### Metrics Collected

The system tracks comprehensive usage metrics for understanding chatbot adoption and tool usage patterns.

**Daily Metrics (ChatAnalytics table):**

```typescript
interface ChatAnalytics {
  id: string;
  tenantId: string;
  date: Date;                              // Date only (no time component)
  totalConversations: number;              // Conversations started this day
  totalMessages: number;                   // User + assistant messages
  uniqueUsers: number;                     // Distinct users who chatted
  toolCalls: Record<string, number>;       // JSON: { "searchTransfers": 42, ... }
  avgMessagesPerConversation: number | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Example Record:**
```json
{
  "id": "analytics_123",
  "tenantId": "tenant_abc",
  "date": "2025-10-19",
  "totalConversations": 47,
  "totalMessages": 312,
  "uniqueUsers": 23,
  "toolCalls": {
    "searchTransfers": 89,
    "getTransferDetails": 34,
    "searchProducts": 67,
    "getStockLevel": 45,
    "getBranchStats": 12
  },
  "avgMessagesPerConversation": 6.6
}
```

### Tracking Points

**1. Conversation Started:**
```typescript
// When: User creates new conversation
await recordConversationStarted({ tenantId, userId, date });
// Increments: totalConversations
```

**2. Messages Sent:**
```typescript
// When: User sends message + AI responds
await recordMessages({ tenantId, date, count: 2 });
// Increments: totalMessages (user + assistant = 2)
```

**3. Tool Usage:**
```typescript
// When: AI calls a tool during response
await recordToolUsage({ tenantId, date, toolName: 'searchTransfers' });
// Updates: toolCalls JSON { "searchTransfers": previous + 1 }
```

**4. Unique Users:**
```typescript
// When: Batch job runs (daily)
await updateUniqueUsersCount({ tenantId, date });
// Counts: DISTINCT userId from conversations created that day
```

**5. Average Metrics:**
```typescript
// When: Batch job runs (daily)
await updateAverageMetrics({ tenantId, date });
// Calculates: avgMessagesPerConversation
```

### Analytics API

**Get Analytics for Date Range:**
```typescript
const analytics = await getAnalytics({
  tenantId,
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
});
// Returns: Array of daily analytics records
```

**Get Summary:**
```typescript
const summary = await getAnalyticsSummary({
  tenantId,
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
});

// Returns:
{
  totalConversations: 1234,
  totalMessages: 8912,
  uniqueUsers: 456,
  averageMessagesPerConversation: 7.2,
  toolCallsSummary: {
    "searchTransfers": 2341,
    "getTransferDetails": 987,
    "searchProducts": 1654,
    ...
  },
  topTools: [
    { name: 'searchTransfers', count: 2341 },
    { name: 'searchProducts', count: 1654 },
    { name: 'getTransferDetails', count: 987 },
    { name: 'getStockLevel', count: 876 },
    { name: 'getBranchStats', count: 654 },
  ],
  totalToolCalls: 9876,
  dailyData: [...] // All daily records
}
```

### Use Cases

**1. Adoption Tracking:**
- Are users using the chatbot?
- How many conversations per day?
- Which users are power users?

**2. Tool Popularity:**
- Which tools are most used?
- Are users discovering advanced features?
- Are there underutilized tools?

**3. Conversation Quality:**
- How many messages per conversation?
- Are conversations getting resolved quickly?
- Do users need to ask multiple times?

**4. Cost Monitoring:**
- Total messages = OpenAI API cost proxy
- Tool calls = complexity proxy
- Can project monthly costs

---

## Security & Permissions

### Permission Model

**Route-Level:**
- POST `/api/chat` requires authentication only
- No specific permission required (all users can chat)
- Middleware: `requireAuthenticatedUserMiddleware`

**Tool-Level:**
- Tools call existing service functions
- Service functions check permissions internally
- Example: `productService.createProduct()` checks `products:write`
- Tools inherit security from service layer

**Branch Membership Filtering:**
- Users can only see transfers for branches they're members of
- Service functions automatically filter by `UserBranchMembership`
- No manual filtering needed in tools
- Example: `searchTransfers` returns only transfers where user is member of source OR destination branch

### Security Architecture

```
┌──────────────────────────────────┐
│  POST /api/chat                  │
│  - requireAuthenticatedUser      │
│  - Sets: req.currentUserId       │
│  - Sets: req.currentTenantId     │
└──────────┬───────────────────────┘
           │
           ↓
┌──────────────────────────────────┐
│  Chat Service                    │
│  - Gets user's permissions       │
│  - Gets user's branch memberships│
│  - Injects into system message   │
└──────────┬───────────────────────┘
           │
           ↓
┌──────────────────────────────────┐
│  AI Tools                        │
│  - Call service functions        │
│  - Pass userId + tenantId        │
│  - NO direct DB queries          │
└──────────┬───────────────────────┘
           │
           ↓
┌──────────────────────────────────┐
│  Service Layer                   │
│  - Check permissions             │
│  - Filter by tenantId (ALWAYS)   │
│  - Filter by branch membership   │
│  - Throw errors if unauthorized  │
└──────────────────────────────────┘
```

### User Context in System Message

The system message includes user context to help AI understand access limitations:

```typescript
# Current User Context
- Name: user@example.com
- Role: EDITOR
- Permissions: products:read, products:write, stock:read, stock:write, stock:allocate
- Branches you can access: Main Warehouse, Store A, Store B
- Tenant Slug: acme

# IMPORTANT SECURITY RULES
1. Users can ONLY see transfers for branches they are members of
2. The system automatically filters data based on user's branch memberships
3. If a user asks about transfers they can't access, explain they need branch membership
4. NEVER bypass permission checks or suggest workarounds
5. If user has no branch memberships, they cannot access any transfers
```

**Benefits:**
- AI knows user's limitations
- Can explain access restrictions
- Won't promise data user can't see
- Provides helpful guidance on getting access

### Example Security Flow

**Scenario:** User asks "Show me all pending transfers"

```typescript
// 1. Tool called
await tools.searchTransfers.execute({ status: 'REQUESTED' });

// 2. Tool calls service
const result = await transferService.listStockTransfers({
  tenantId,  // From authenticated user
  userId,    // From authenticated user
  filters: { status: 'REQUESTED' },
});

// 3. Service enforces security
const userBranches = await getUserBranchMemberships(userId, tenantId);
// userBranches = ['branch_1', 'branch_2']

const transfers = await prisma.stockTransfer.findMany({
  where: {
    tenantId,  // Tenant isolation
    OR: [
      { sourceBranchId: { in: userBranches } },      // User is member of source
      { destinationBranchId: { in: userBranches } }, // OR destination
    ],
    status: 'REQUESTED',
  },
});

// 4. Returns only authorized transfers
// User CANNOT see transfers for branches they're not members of
```

---

## Streaming Responses

### Technology

**Server-Sent Events (SSE)** - One-way communication from server to client with real-time updates.

**Vercel AI SDK v5:**
- `streamText()` - Generate streaming text
- `toUIMessageStream()` - Convert to UI format
- `pipeUIMessageStreamToResponse()` - Pipe to HTTP response

**Frontend:**
- `useChat()` hook from `ai/react`
- Handles SSE automatically
- Updates UI in real-time

### Backend Implementation

```typescript
// api-server/src/services/chat/chatService.ts

export async function streamChatResponse({ messages, userId, tenantId, res }) {
  // Build system message with context
  const systemMessage = buildSystemMessage({ userName, permissions, branches, relevantDocs });

  // Stream from OpenAI
  const result = await streamText({
    model: openai('gpt-4o'),
    system: systemMessage,
    messages: convertToModelMessages(messages),
    tools: {
      ...transferTools({ userId, tenantId }),
      ...productTools({ userId, tenantId }),
      // ... 8 categories of tools
    },
    temperature: 0.7,
    stopWhen: stepCountIs(10), // Prevent infinite loops
  });

  // Convert to UI stream and pipe to response
  const uiMessageStream = result.toUIMessageStream();
  pipeUIMessageStreamToResponse({ response: res, stream: uiMessageStream });
}
```

### Frontend Implementation

```typescript
// admin-web/src/pages/ChatPage.tsx

import { useChat } from 'ai/react';

function ChatPage() {
  const { messages, input, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    // SSE handled automatically
  });

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>
          <strong>{msg.role}:</strong> {msg.content}
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} />
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
    </div>
  );
}
```

### Benefits

1. **Real-time feedback** - Users see response as it's generated
2. **Lower perceived latency** - Start seeing results in <1 second
3. **Tool calling visibility** - Can show "Searching products..." while tool runs
4. **Better UX** - Feels more conversational and responsive
5. **Abort support** - Users can stop generation if needed

### Response Format

**SSE Event Stream:**
```
data: {"type":"text","text":"Here"}
data: {"type":"text","text":" are"}
data: {"type":"text","text":" your"}
data: {"type":"text","text":" pending"}
data: {"type":"text","text":" transfers"}
data: {"type":"tool-call","toolName":"searchTransfers","args":{...}}
data: {"type":"tool-result","result":{...}}
data: {"type":"text","text":":\n\n1. TRF-2025-0001"}
data: [DONE]
```

**Frontend Receives:**
```typescript
{
  id: 'msg_123',
  role: 'assistant',
  content: 'Here are your pending transfers:\n\n1. TRF-2025-0001...',
  toolInvocations: [
    {
      toolName: 'searchTransfers',
      args: { status: 'REQUESTED' },
      result: { transfers: [...], count: 5 }
    }
  ]
}
```

---

## Configuration

### Tenant-Specific API Keys

**Overview:**
Tenants can provide their own OpenAI API keys for the AI Chat Assistant, allowing them to:
- Use their own API budget instead of the server's
- Control their AI feature costs directly
- Enable/disable the chat assistant feature independently

**API Key Priority (Fallback Chain):**
1. **Tenant's OpenAI API Key** (if `chatAssistantEnabled: true` and `openaiApiKey` is set)
2. **Server's Default API Key** (from `OPENAI_API_KEY` environment variable)
3. **No API Key** - Chat assistant returns error

**Implementation:**
```typescript
// Service: getOpenAIApiKey({ tenantId })
// File: api-server/src/services/chat/apiKeyService.ts

// 1. Load tenant's feature flags
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { featureFlags: true },
});

const flags = tenant.featureFlags as TenantFeatureFlags;

// 2. Check if tenant has chat assistant enabled with custom key
if (flags?.chatAssistantEnabled && flags?.openaiApiKey) {
  return flags.openaiApiKey; // Use tenant's key
}

// 3. Fall back to server's default key
return process.env.OPENAI_API_KEY || null;
```

**Feature Flags Structure:**
```typescript
interface TenantFeatureFlags {
  chatAssistantEnabled: boolean;      // Enable/disable chat assistant for tenant
  openaiApiKey: string | null;        // Tenant's OpenAI API key (plaintext)
  barcodeScanningEnabled: boolean;    // Enable/disable barcode scanning
}

// Stored in: Tenant.featureFlags (JSON column)
```

**UI Management:**
- Tenants can configure feature flags via the **Features** page (`/settings/features`)
- Requires `theme:manage` permission (owner/admin roles)
- API key format validated (must start with `sk-`)
- API key displayed as password-masked input for security

**API Endpoints:**
```typescript
// Get tenant feature flags
GET /api/tenants/:tenantSlug/feature-flags
// Returns: { chatAssistantEnabled, openaiApiKey, barcodeScanningEnabled }

// Update tenant feature flags
PUT /api/tenants/:tenantSlug/feature-flags
// Body: { chatAssistantEnabled?, openaiApiKey?, barcodeScanningEnabled? }
// Partial updates supported
```

**Security Considerations:**
- API keys stored in plaintext in database (acceptable for MVP)
- Future enhancement: Encrypt keys at rest using AES-256
- API key format validated on save (must start with `sk-`)
- Only users with `theme:manage` permission can view/edit keys

**Cost Allocation:**
- If tenant provides API key: All chat costs billed to tenant's OpenAI account
- If tenant uses server key: All chat costs billed to server's OpenAI account
- No usage tracking per tenant (future enhancement)

### Environment Variables

**Required:**
```bash
OPENAI_API_KEY=sk-...  # Server's default OpenAI API key (fallback)
```

**Priority:**
- `.env` file values override system environment variables
- Configured in `api-server/src/app.ts`: `config({ override: true })`
- Tenant-specific keys take priority over server's default key

### Model Configuration

```typescript
const result = await streamText({
  model: openai('gpt-4o'),        // GPT-4 Omni
  temperature: 0.7,               // Balanced creativity vs consistency
  stopWhen: stepCountIs(10),      // Max tool calling steps (prevent loops)
});
```

**Temperature Rationale:**
- 0.0 = Deterministic, factual (too robotic)
- 0.7 = Balanced (chosen - conversational but accurate)
- 1.0 = Creative (too unpredictable for business data)

**Max Steps:**
- Prevents infinite tool calling loops
- 10 steps allows complex multi-step reasoning
- Example: Search products → Get details → Check stock → Calculate value

### Rate Limiting

**Not implemented yet for chat endpoint**, but recommended:
```typescript
// Future: Apply rate limiting to prevent abuse
chatRouter.post('/',
  requireAuthenticatedUserMiddleware,
  createFixedWindowRateLimiterMiddleware({
    scope: 'session',
    windowMs: 60_000,  // 1 minute
    maxRequests: 20,   // 20 messages/minute
  }),
  ...
);
```

---

## API Reference

### POST /api/chat

**Endpoint:** `POST /api/chat`

**Authentication:** Required (session cookie)

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "parts": [
        {
          "type": "text",
          "text": "Show me my pending transfers"
        }
      ]
    }
  ],
  "conversationId": "conv_123" // Optional: resume existing conversation
}
```

**Response:** Streaming (Server-Sent Events)

**Status Codes:**
- `200` - Success (streaming response)
- `400` - Validation error (messages format invalid)
- `401` - Unauthorized (no session cookie)
- `500` - Internal server error (OpenAI API error, etc.)

**Example Usage:**
```typescript
// Using fetch (manual SSE handling)
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Include session cookie
  body: JSON.stringify({
    messages: [
      {
        role: 'user',
        parts: [{ type: 'text', text: 'Show me pending transfers' }],
      },
    ],
  }),
});

// Read SSE stream
const reader = response.body.getReader();
// ... handle stream chunks

// OR using Vercel AI SDK (recommended)
import { useChat } from 'ai/react';

const { messages, input, handleSubmit } = useChat({
  api: '/api/chat',
});
```

---

## Related Documentation

- **Architecture:** [AI Integration](../architecture.md#ai-integration)
- **Database Schema:** [Chat Tables](../database-schema.md)
- **SOP:** [AI Chatbot Backend](../../SOP/ai-chatbot-backend.md)
- **Testing:** [Testing Guide](../../SOP/testing_overview.md)
- **Vercel AI SDK v5:** https://sdk.vercel.ai/docs

---

**Document Version:** 1.0
**Last Updated:** 2025-10-19
**Maintained By:** Development Team
