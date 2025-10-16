# AI Chatbot Backend - Standard Operating Procedure

**Last Updated:** 2025-10-15
**Status:** Active
**Related PRD:** [.agent/Features/Planned/ai-chatbot-assistant.md](../Features/Planned/ai-chatbot-assistant.md)

---

## Overview

The AI Chatbot Backend provides an intelligent assistant that helps users query stock transfer data through natural language. It uses the Vercel AI SDK v5 with OpenAI GPT-4o and implements a multi-layered security model to ensure users can only access data they're authorized to view.

**Key Features:**
- Natural language queries for stock transfers
- Real-time data access via AI tools
- Branch membership-based security filtering
- Tenant isolation
- Streaming responses for better UX
- Full RBAC integration

---

## Architecture

### Components

```
User → POST /api/chat → Chat Router → Chat Service → AI Model (GPT-4o)
                                             ↓
                                        Transfer Tools
                                             ↓
                                   Transfer Service (Security Layer)
                                             ↓
                                        Database (Prisma)
```

### Files

| File | Purpose |
|------|---------|
| `api-server/src/routes/chatRouter.ts` | Express route for POST /api/chat |
| `api-server/src/services/chat/chatService.ts` | Main orchestration of AI responses |
| `api-server/src/services/chat/promptBuilder.ts` | Builds security-aware system messages |
| `api-server/src/services/chat/tools/transferTools.ts` | 3 read-only tools for transfers |

---

## Security Model

### Multi-Layered Security

**Level 1: Route Authentication**
- Middleware: `requireAuthenticatedUserMiddleware`
- Sets: `req.currentUserId` and `req.currentTenantId`
- Rejects: Unauthenticated requests with 401

**Level 2: Service-Layer Enforcement**
- `listStockTransfers`: Automatically filters to user's branch memberships
- `getStockTransfer`: Calls `assertTransferAccess` to verify user is member of source OR destination branch
- All queries filter by `currentTenantId`

**Level 3: Tool Inheritance**
- Tools call service functions (no direct database queries)
- Security is inherited from service layer
- Single source of truth for permissions

**Key Security Principles:**
1. No direct database queries in tools
2. Service functions enforce all security
3. Tools inherit security (no duplication)
4. Branch membership filtering is automatic
5. Tenant isolation is enforced at service layer

### Permission Model

**Route Level:**
- POST `/api/chat` requires authentication only
- No specific permission required (everyone can use chat)
- Tools check permissions internally via service functions

**Tool Level:**
- All transfer tools call existing service functions
- `listStockTransfers`: Filters to user's branch memberships automatically
- `getStockTransfer`: Validates user is member of source OR destination branch
- Permissions are inherited from the service layer

---

## API Endpoint

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
  ]
}
```

**Response:** Streaming text response (Server-Sent Events)

**Status Codes:**
- `200` - Success (streaming response)
- `400` - Validation error (messages not an array)
- `401` - Unauthorized (no session cookie)
- `500` - Internal server error

---

## Available Tools

### 1. searchTransfers

**Purpose:** List and filter stock transfers

**Parameters:**
- `status` (optional): Filter by transfer status (REQUESTED, APPROVED, IN_TRANSIT, COMPLETED, REJECTED, CANCELLED)
- `priority` (optional): Filter by priority (URGENT, HIGH, NORMAL, LOW)
- `direction` (optional): Filter by direction (inbound, outbound)
- `branchId` (optional): Filter to specific branch
- `limit` (optional): Number of results (max 10, default 5)

**Security:**
- Automatically filters to user's branch memberships
- Users only see transfers where they're a member of source OR destination branch

**Example Usage:**
```typescript
const tools = transferTools({ userId, tenantId });
const result = await tools.searchTransfers.execute({
  status: 'REQUESTED',
  priority: 'URGENT',
  limit: 5,
});
```

**Returns:**
```json
{
  "transfers": [
    {
      "id": "...",
      "transferNumber": "TRF-2025-0001",
      "status": "REQUESTED",
      "priority": "URGENT",
      "sourceBranch": "Main Warehouse",
      "destinationBranch": "Store A",
      "itemCount": 3,
      "requestedAt": "2025-10-15T12:00:00.000Z"
    }
  ],
  "count": 1,
  "hasMore": false
}
```

### 2. getTransferDetails

**Purpose:** Get detailed information about a specific transfer

**Parameters:**
- `transferNumber` (optional): Transfer number (e.g., "TRF-2025-0001")
- `transferId` (optional): Transfer ID

**Security:**
- Validates user is member of source OR destination branch
- Returns permission error if user doesn't have access

**Example Usage:**
```typescript
const result = await tools.getTransferDetails.execute({
  transferNumber: 'TRF-2025-0001',
});
```

**Returns:**
```json
{
  "transferNumber": "TRF-2025-0001",
  "status": "REQUESTED",
  "priority": "NORMAL",
  "sourceBranch": "Main Warehouse",
  "destinationBranch": "Store A",
  "requestedBy": "user@example.com",
  "requestedAt": "2025-10-15T12:00:00.000Z",
  "items": [
    {
      "product": "Widget",
      "sku": "WID-001",
      "qtyRequested": 100,
      "qtyApproved": null,
      "qtyShipped": 0,
      "qtyReceived": 0
    }
  ],
  "notes": "Urgent transfer for Store A",
  "requiresMultiLevelApproval": false
}
```

### 3. getApprovalStatus

**Purpose:** Check approval progress for a transfer

**Parameters:**
- `transferId`: Transfer ID (required)

**Security:**
- Validates user has access to the transfer
- Same access control as `getTransferDetails`

**Example Usage:**
```typescript
const result = await tools.getApprovalStatus.execute({
  transferId: 'transfer-id-here',
});
```

**Returns:**
```json
{
  "requiresMultiLevelApproval": false,
  "status": "REQUESTED",
  "message": "This transfer uses simple approval workflow (one-step approval)"
}
```

---

## Testing

### Running Tests

```bash
cd api-server
npm run test:accept -- chat
```

**Test Coverage:**
- 28 tests total (all passing)
- 21 service/tool tests
- 7 route tests

**Test Files:**
- `api-server/__tests__/services/chat.test.ts` - Service and tool tests
- `api-server/__tests__/routes/chatRoutes.test.ts` - API route tests

### Test Categories

**1. System Message Builder (4 tests)**
- User context inclusion
- Security rules inclusion
- Branch membership handling
- Optional role handling

**2. Transfer Tools - searchTransfers (7 tests)**
- List transfers for user
- Filter by status
- Filter by priority
- Filter by direction (inbound/outbound)
- Result limiting
- Branch membership filtering
- Security isolation

**3. Transfer Tools - getTransferDetails (4 tests)**
- Get by ID
- Get by transfer number
- Not found handling
- Access control enforcement

**4. Transfer Tools - getApprovalStatus (3 tests)**
- Status for simple approval
- Not found handling
- Access control enforcement

**5. Security Tests (3 tests)**
- Branch membership filtering
- Branch isolation
- Tenant isolation

**6. Route Tests (7 tests)**
- Authentication enforcement
- Request validation
- Streaming response
- Error handling

### Important Test Notes

**API Key:**
Tests will show OpenAI API errors if `OPENAI_API_KEY` is invalid. This is expected and tests will still pass. The tests are designed to handle API errors gracefully.

**To avoid global env var conflicts:**
```bash
# In Git Bash
unset OPENAI_API_KEY
npm run test:accept -- chat
```

---

## Environment Variables

### Required

```bash
# .env file
OPENAI_API_KEY=sk-your-actual-key-here
```

### Configuration Priority

The application uses `dotenv` with `override: true` to ensure `.env` file values take precedence over system environment variables.

**File:** `api-server/src/app.ts`
```typescript
import { config } from "dotenv";
config({ override: true }); // Force .env to override system vars
```

---

## How to Use

### 1. Adding the Chat Feature to a New Service

If you want to add chat tools for a different domain (e.g., products, users):

**Step 1: Create Tool File**
```typescript
// api-server/src/services/chat/tools/productTools.ts
import { tool } from 'ai';
import { z } from 'zod';
import * as productService from '../../products/productService.js';

export function productTools({ userId, tenantId }: { userId: string; tenantId: string }) {
  return {
    searchProducts: tool({
      description: 'Search products by name or SKU',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
        limit: z.number().optional().default(5),
      }),
      execute: async ({ query, limit }) => {
        // Call existing service function - security is enforced there
        const products = await productService.searchProducts({
          tenantId,
          userId,
          query,
          limit,
        });
        return products;
      },
    }),
  };
}
```

**Step 2: Register Tools in Chat Service**
```typescript
// api-server/src/services/chat/chatService.ts
import { productTools } from './tools/productTools.js';

const result = await streamText({
  model: openai('gpt-4o'),
  system: systemMessage,
  messages: modelMessages,
  tools: {
    ...transferTools({ userId, tenantId }),
    ...productTools({ userId, tenantId }), // NEW
  },
  temperature: 0.7,
  stopWhen: stepCountIs(10),
});
```

**Step 3: Update System Message**
```typescript
// api-server/src/services/chat/promptBuilder.ts
// Update available features section
# Available Features
You can help users with:
1. **Stock Transfers** - Search, details, approval status
2. **Products** - Search by name or SKU // NEW
```

### 2. Modifying the System Message

The system message controls the AI's behavior. To update it:

**File:** `api-server/src/services/chat/promptBuilder.ts`

**Key Sections:**
- User context (name, role, permissions, branches)
- Security rules (branch membership, permissions)
- Available features (what the AI can help with)
- Platform terminology (domain language)
- Response guidelines (how to format responses)

**Example Modification:**
```typescript
// Add a new response guideline
# Response Guidelines
1. Use tools to get real-time data
2. Be conversational and helpful
3. Format transfer numbers as "TRF-2025-0001"
4. NEW: Always include branch names in responses
```

### 3. Testing New Tools

When adding new tools, follow this pattern:

```typescript
// __tests__/services/chat.test.ts
describe('[AC-CHAT-XXX] New Tool', () => {
  it('should execute tool successfully', async () => {
    const tools = yourTools({ userId: testUser.id, tenantId: testTenant.id });

    const result = await tools.yourTool.execute({
      param1: 'value',
    });

    expect(result).toBeDefined();
    // Add specific assertions
  });

  it('should enforce security', async () => {
    // Test that users can't access data they shouldn't
  });

  it('should handle errors gracefully', async () => {
    // Test error cases
  });
});
```

---

## Common Issues & Solutions

### Issue: OpenAI API Key Error in Tests

**Symptom:** Tests show "Incorrect API key provided" errors

**Solution:**
```bash
# Unset global environment variable
unset OPENAI_API_KEY

# Then run tests
npm run test:accept -- chat
```

**Why:** Global environment variables take precedence. The app is configured to override with `.env` values, but tests may still pick up global vars.

### Issue: User Can See Transfers They Shouldn't

**Symptom:** User sees transfers for branches they're not a member of

**Diagnosis:**
1. Check if user has `UserBranchMembership` records
2. Verify `listStockTransfers` is filtering correctly
3. Check if service layer is being bypassed (tools should NEVER query database directly)

**Solution:**
```typescript
// WRONG - Direct database query
const transfers = await prisma.stockTransfer.findMany({
  where: { tenantId },
});

// RIGHT - Use service function
const result = await transferService.listStockTransfers({
  tenantId,
  userId, // Service will filter by user's branches
  filters: {},
});
```

### Issue: Streaming Response Not Working

**Symptom:** Response hangs or doesn't stream

**Diagnosis:**
1. Check if middleware is buffering the response
2. Verify `pipeTextStreamToResponse` is called correctly
3. Check if error handler is intercepting the stream

**Solution:**
Ensure the error handler doesn't interfere with streaming:
```typescript
// chatRouter.ts
chatRouter.post('/',
  requireAuthenticatedUserMiddleware,
  async (req, res, next) => {
    try {
      // Don't await - let it stream
      await chatService.streamChatResponse({
        messages,
        userId: req.currentUserId!,
        tenantId: req.currentTenantId!,
        res,
      });
    } catch (e) {
      next(e); // Let error handler deal with it
    }
  }
);
```

### Issue: TypeScript Type Errors with Tools

**Symptom:** TypeScript complains about tool execute function types

**Solution:** Use direct destructuring, let types be inferred from inputSchema:
```typescript
// WRONG - Explicit type annotations
execute: async (args: { query: string; limit?: number }) => { ... }

// RIGHT - Direct destructuring, types inferred
execute: async ({ query, limit }) => { ... }
```

---

## Best Practices

### 1. Security

✅ **DO:**
- Always call service functions from tools
- Let service layer enforce all security
- Filter by `tenantId` at service layer
- Validate user has required permissions/memberships

❌ **DON'T:**
- Query database directly from tools
- Duplicate security logic in tools
- Trust user input without validation
- Bypass service layer for "simple" queries

### 2. Tool Design

✅ **DO:**
- Keep tool descriptions clear and specific
- Use Zod for input validation
- Return user-friendly error messages
- Limit result counts (avoid returning 1000s of records)
- Use `inputSchema` (not deprecated `parameters`)

❌ **DON'T:**
- Return raw database objects
- Include sensitive data (passwords, API keys)
- Make tools too general ("do anything")
- Return unbounded result sets

### 3. System Messages

✅ **DO:**
- Include user context (role, permissions, branches)
- Embed security rules
- Define domain terminology
- Provide clear response guidelines
- Update when adding new features

❌ **DON'T:**
- Include PII in system message
- Make it too long (token limits)
- Contradict actual security enforcement
- Use overly technical language

### 4. Testing

✅ **DO:**
- Test security (branch membership, tenant isolation)
- Test error cases
- Test tool execution with real data
- Test permission enforcement
- Use test helpers (factories)

❌ **DON'T:**
- Skip security tests
- Only test happy paths
- Mock service functions (test real integration)
- Hardcode test data

---

## Debugging

### Enable Detailed Logging

```typescript
// chatService.ts
console.log('User context:', {
  userId,
  tenantId,
  branchMemberships: branchMemberships.map(b => b.branch.branchName),
  permissions: permissionsArray,
});
```

### Check Tool Execution

```typescript
// transferTools.ts
execute: async ({ status, priority }) => {
  console.log('Tool called with:', { status, priority, userId, tenantId });

  const result = await transferService.listStockTransfers(...);

  console.log('Tool result:', {
    count: result.items.length,
    transfers: result.items.map(t => t.transferNumber),
  });

  return result;
}
```

### Verify Permissions

```bash
# In PostgreSQL/Prisma Studio
SELECT u.userEmailAddress, r.name as role, p.permissionKey
FROM "User" u
JOIN "UserTenantMembership" utm ON u.id = utm.userId
JOIN "Role" r ON utm.roleId = r.id
JOIN "RolePermission" rp ON r.id = rp.roleId
JOIN "Permission" p ON rp.permissionId = p.id
WHERE u.id = 'user-id-here';
```

### Check Branch Memberships

```bash
# In PostgreSQL/Prisma Studio
SELECT u.userEmailAddress, b.branchName
FROM "User" u
JOIN "UserBranchMembership" ubm ON u.id = ubm.userId
JOIN "Branch" b ON ubm.branchId = b.id
WHERE u.id = 'user-id-here';
```

---

## Maintenance

### Adding New Features

1. Update PRD document ([.agent/Features/Planned/ai-chatbot-assistant.md](../Features/Planned/ai-chatbot-assistant.md))
2. Create new tools in `api-server/src/services/chat/tools/`
3. Register tools in `chatService.ts`
4. Update system message in `promptBuilder.ts`
5. Write tests in `__tests__/services/chat.test.ts`
6. Update this SOP document

### Updating Dependencies

```bash
cd api-server
npm update ai @ai-sdk/openai
npm run build
npm run test:accept -- chat
```

### Performance Monitoring

Monitor these metrics:
- Response time (target: < 3 seconds)
- OpenAI API costs (tokens used per request)
- Error rate (target: < 1%)
- Tool execution time

---

## Related Documentation

- **PRD:** [.agent/Features/Planned/ai-chatbot-assistant.md](../Features/Planned/ai-chatbot-assistant.md)
- **Testing Guide:** [.agent/SOP/testing_overview.md](./testing_overview.md)
- **Stock Transfer Service:** `api-server/src/services/stockTransfers/stockTransferService.ts`
- **Vercel AI SDK v5 Docs:** https://sdk.vercel.ai/docs

---

**Document Version:** 1.0
**Last Updated:** 2025-10-15
**Maintained By:** Development Team