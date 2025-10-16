# Vercel AI SDK v5 TypeScript Fixes

**Date:** 2025-01-15
**Agent:** vercel-ai-sdk-v5-expert
**Task:** Fix TypeScript errors in AI SDK v5 tool definitions and streamText configuration

---

## Problem Summary

The codebase was using AI SDK v5 (ai@5.0.72, @ai-sdk/openai@2.0.52) but had outdated patterns from v4:

### Issues Found

1. **Tool Definition Errors:**
   - ❌ Using `parameters` instead of `inputSchema`
   - ❌ Adding explicit type annotations on `execute` function parameter
   - ❌ Manually destructuring args inside execute function

2. **Multi-Step Control:**
   - ❌ Using removed `maxSteps` parameter
   - ❌ Using deprecated `convertToCoreMessages` function

---

## Solutions Applied

### 1. Tool Definitions - Correct v5 Pattern

**Key Changes:**
- ✅ Use `inputSchema` instead of `parameters`
- ✅ Remove explicit type annotations from execute function
- ✅ Destructure parameters directly in function signature
- ✅ Let TypeScript infer types from Zod schema

**Before (v4 style):**
```typescript
tool({
  description: 'Search transfers',
  parameters: z.object({  // ❌ Old: parameters
    status: z.enum(['REQUESTED', 'APPROVED']).optional(),
    limit: z.number().optional(),
  }),
  execute: async (args: {  // ❌ Explicit type annotation
    status?: 'REQUESTED' | 'APPROVED';
    limit?: number;
  }) => {
    const { status, limit } = args;  // ❌ Manual destructuring
    // implementation
  },
})
```

**After (v5 style):**
```typescript
tool({
  description: 'Search transfers',
  inputSchema: z.object({  // ✅ New: inputSchema
    status: z.enum(['REQUESTED', 'APPROVED']).optional(),
    limit: z.number().optional(),
  }),
  execute: async ({ status, limit }) => {  // ✅ Direct destructuring, types inferred
    // implementation - status and limit are automatically typed!
  },
})
```

### 2. Multi-Step Control - stopWhen Instead of maxSteps

**Before:**
```typescript
import { streamText, convertToCoreMessages } from 'ai';

const result = await streamText({
  model: openai('gpt-4o'),
  messages: convertToCoreMessages(messages),
  maxSteps: 10,  // ❌ Removed in v5
});
```

**After:**
```typescript
import { streamText, convertToModelMessages, stepCountIs } from 'ai';

const result = await streamText({
  model: openai('gpt-4o'),
  messages: convertToModelMessages(messages),  // ✅ Renamed function
  stopWhen: stepCountIs(10),  // ✅ New flexible control
});
```

---

## Files Modified

### 1. `api-server/src/services/chat/tools/transferTools.ts`

Changed all three tools:
- `searchTransfers`
- `getTransferDetails`
- `getApprovalStatus`

**Changes per tool:**
1. `parameters` → `inputSchema`
2. Removed explicit type annotations from execute function
3. Changed from `async (args: Type) => {}` to `async ({ param1, param2 }) => {}`
4. Removed manual destructuring inside execute body

### 2. `api-server/src/services/chat/chatService.ts`

**Changes:**
1. Updated imports:
   - Added `stepCountIs` import
   - Changed `convertToCoreMessages` to `convertToModelMessages`

2. Updated streamText call:
   - Changed `convertToCoreMessages` to `convertToModelMessages`
   - Changed `maxSteps: 10` to `stopWhen: stepCountIs(10)`
   - Added explanatory comment

---

## Key Learnings from AI SDK v5

### Type Inference Magic

The v5 `tool()` helper provides **automatic type inference** from Zod schemas:

```typescript
const weatherTool = tool({
  inputSchema: z.object({
    city: z.string(),
    units: z.enum(['celsius', 'fahrenheit']),
  }),
  execute: async ({ city, units }) => {
    // TypeScript automatically knows:
    // - city: string
    // - units: "celsius" | "fahrenheit"
    return { temperature: 22 };
  },
});
```

**Why it works:**
- The `tool()` helper extracts types from Zod schema
- It infers the execute function parameter type
- No manual type annotations needed!
- Keeps code DRY and type-safe

### Multi-Step Control Flexibility

v5 replaced the simple `maxSteps` number with flexible `stopWhen` conditions:

```typescript
// Stop after N steps
stopWhen: stepCountIs(5)

// Stop when specific tool is called
stopWhen: hasToolCall('finalizeTask')

// Multiple conditions (stops if ANY is true)
stopWhen: [
  stepCountIs(10),
  hasToolCall('submitOrder')
]

// Custom condition
stopWhen: ({ steps }) => {
  const lastStep = steps[steps.length - 1];
  return lastStep?.text?.includes('COMPLETE');
}
```

**Important:** `stopWhen` conditions are only evaluated when the last step contains tool results.

---

## Remaining Work (Not AI SDK Related)

The following TypeScript errors are **service integration issues**, not AI SDK v5 problems:

1. **Prisma query includes:** Missing `include` statements in chatService.ts
2. **Service function filters:** Type mismatch in filter objects
3. **Null safety:** Missing null checks for optional properties

These are separate issues related to:
- Database query patterns
- Service layer contracts
- Prisma typing

---

## Testing Recommendations

### 1. Type Safety Tests

Verify tool types are inferred correctly:

```typescript
import { InferUITool } from 'ai';

type SearchTransfersInput = InferUITool<typeof searchTransfersTool>['input'];
type SearchTransfersOutput = InferUITool<typeof searchTransfersTool>['output'];

// Verify input types
const validInput: SearchTransfersInput = {
  status: 'REQUESTED',
  limit: 5
};

// Verify output types
const validOutput: SearchTransfersOutput = {
  transfers: [],
  count: 0,
  hasMore: false
};
```

### 2. Runtime Tests

Test tool execution:

```typescript
const tools = transferTools({ userId: 'test-user', tenantId: 'test-tenant' });

// Test with valid input
const result = await tools.searchTransfers.execute({
  status: 'REQUESTED',
  limit: 5
});

// Test with optional fields
const result2 = await tools.searchTransfers.execute({
  limit: 10
});
```

### 3. Integration Tests

Test with actual streamText:

```typescript
const result = await streamText({
  model: openai('gpt-4o'),
  messages: [{ role: 'user', content: 'Show my transfers' }],
  tools: transferTools({ userId, tenantId }),
  stopWhen: stepCountIs(5),
});

// Verify tool calls work
for await (const chunk of result.fullStream) {
  if (chunk.type === 'tool-call') {
    console.log('Tool called:', chunk.toolName);
    console.log('Tool input:', chunk.input);
  }
}
```

---

## Documentation References

### Official AI SDK v5 Documentation

1. **Tool Definition:**
   - https://github.com/vercel/ai/blob/main/content/docs/07-reference/01-ai-sdk-core/20-tool.mdx

2. **Migration Guide v4 → v5:**
   - https://github.com/vercel/ai/blob/main/content/docs/08-migration-guides/26-migration-guide-5-0.mdx

3. **Tool Calling Guide:**
   - https://github.com/vercel/ai/blob/main/content/docs/03-ai-sdk-core/15-tools-and-tool-calling.mdx

### Key Sections from Migration Guide

- **Tool Definition Changes:** parameters → inputSchema
- **Tool Property Changes:** args/result → input/output
- **Step Control:** maxSteps → stopWhen
- **Message Conversion:** convertToCoreMessages → convertToModelMessages
- **Type System:** CoreMessage → ModelMessage, Message → UIMessage

---

## Common Pitfalls to Avoid

### ❌ Don't: Add explicit type annotations

```typescript
// Wrong - causes type errors
execute: async (args: { city: string }) => {
  //              ^^^^^^^^^^^^^^^^^^^^^ ❌ Don't do this!
}
```

### ✅ Do: Let types be inferred

```typescript
// Correct - types inferred from inputSchema
execute: async ({ city }) => {
  //             ^^^^^^^ ✅ Automatically typed as string!
}
```

### ❌ Don't: Use old parameters property

```typescript
// Wrong - v4 style
tool({
  parameters: z.object({ ... })  // ❌ Deprecated
})
```

### ✅ Do: Use inputSchema

```typescript
// Correct - v5 style
tool({
  inputSchema: z.object({ ... })  // ✅ Current
})
```

### ❌ Don't: Use maxSteps

```typescript
// Wrong - removed in v5
streamText({
  maxSteps: 10  // ❌ Doesn't exist
})
```

### ✅ Do: Use stopWhen

```typescript
// Correct - v5 replacement
streamText({
  stopWhen: stepCountIs(10)  // ✅ More flexible
})
```

---

## Type Safety Benefits

With the v5 patterns correctly applied:

1. **Automatic type inference:** No manual type annotations needed
2. **Type safety:** Catch errors at compile time
3. **Refactoring safety:** Changing Zod schema updates types everywhere
4. **IntelliSense:** Full autocomplete for tool inputs and outputs
5. **Less code:** DRY principle - types defined once in schema

---

## Next Steps

1. ✅ **AI SDK v5 patterns fixed** - All tool definitions now correct
2. 🔄 **Service integration issues** - Need to fix Prisma queries and service contracts
3. 📝 **Add tests** - Verify tools work correctly with real data
4. 📚 **Document tool usage** - Add examples for frontend developers

---

## Summary

**What was fixed:**
- ✅ All tool definitions now use correct v5 pattern (inputSchema + inferred types)
- ✅ Multi-step control updated to use stopWhen instead of maxSteps
- ✅ Message conversion updated to convertToModelMessages
- ✅ All AI SDK v5 TypeScript errors resolved

**What remains:**
- ⏳ Service layer integration issues (not AI SDK related)
- ⏳ Testing with actual tools
- ⏳ Frontend integration

**Impact:**
- Type-safe tool definitions
- Future-proof for AI SDK v5
- Easier maintenance and refactoring
- Better developer experience

---

**Agent:** vercel-ai-sdk-v5-expert
**Status:** ✅ Complete
**Handoff:** Ready for service-layer-expert to fix Prisma queries and service contracts
