# AI SDK v5 - Correct Usage Examples

Quick reference for Vercel AI SDK v5 patterns used in this project.

---

## Tool Definition Pattern

### Basic Tool

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const weatherTool = tool({
  description: 'Get weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name'),
    units: z.enum(['celsius', 'fahrenheit']).optional(),
  }),
  // Types are automatically inferred from inputSchema!
  execute: async ({ location, units = 'celsius' }) => {
    // location: string (inferred)
    // units: "celsius" | "fahrenheit" | undefined (inferred)

    return {
      temperature: 22,
      conditions: 'sunny',
      location,
      units,
    };
  },
});
```

### Tool with Optional Output Schema

```typescript
export const searchTool = tool({
  description: 'Search database',
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().optional().default(10),
  }),
  // Optional: Define output schema for extra type safety
  outputSchema: z.object({
    results: z.array(z.object({
      id: z.string(),
      title: z.string(),
    })),
    total: z.number(),
  }),
  execute: async ({ query, limit }) => {
    const results = await db.search(query, limit);
    return {
      results,
      total: results.length,
    };
  },
});
```

### Tool Factory Pattern (Our Pattern)

```typescript
export function transferTools({ userId, tenantId }: { userId: string; tenantId: string }) {
  return {
    searchTransfers: tool({
      description: 'Search stock transfers',
      inputSchema: z.object({
        status: z.enum(['REQUESTED', 'APPROVED']).optional(),
        limit: z.number().optional().default(5),
      }),
      execute: async ({ status, limit }) => {
        // Factory params available in closure
        const results = await service.listTransfers({
          userId,
          tenantId,
          filters: { status, limit },
        });

        return {
          transfers: results.items,
          count: results.items.length,
        };
      },
    }),

    getTransferDetails: tool({
      description: 'Get transfer details',
      inputSchema: z.object({
        transferId: z.string(),
      }),
      execute: async ({ transferId }) => {
        const transfer = await service.getTransfer({
          userId,
          tenantId,
          transferId,
        });

        return transfer;
      },
    }),
  };
}
```

---

## Using Tools with streamText

### Basic Usage

```typescript
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = await streamText({
  model: openai('gpt-4o'),
  messages: convertToModelMessages(uiMessages),
  tools: {
    weather: weatherTool,
    search: searchTool,
  },
  temperature: 0.7,
  stopWhen: stepCountIs(5),
});
```

### With Tool Factory

```typescript
const result = await streamText({
  model: openai('gpt-4o'),
  messages: convertToModelMessages(uiMessages),
  // Factory returns object of tools
  tools: transferTools({ userId, tenantId }),
  temperature: 0.7,
  stopWhen: stepCountIs(10),
});
```

### Streaming to Express Response

```typescript
export async function chatHandler(req: Request, res: Response) {
  const { messages, userId, tenantId } = req.body;

  const result = await streamText({
    model: openai('gpt-4o'),
    system: 'You are a helpful assistant',
    messages: convertToModelMessages(messages),
    tools: transferTools({ userId, tenantId }),
    stopWhen: stepCountIs(10),
  });

  // Pipe directly to response
  result.pipeTextStreamToResponse(res);
}
```

---

## Stop Conditions (replaces maxSteps)

### Stop After N Steps

```typescript
import { stepCountIs } from 'ai';

stopWhen: stepCountIs(5)
```

### Stop When Specific Tool Called

```typescript
import { hasToolCall } from 'ai';

stopWhen: hasToolCall('finalizeOrder')
```

### Multiple Conditions (OR logic)

```typescript
stopWhen: [
  stepCountIs(10),
  hasToolCall('submitOrder'),
]
```

### Custom Condition

```typescript
stopWhen: ({ steps }) => {
  const lastStep = steps[steps.length - 1];
  // Stop if last step contains "COMPLETE" in text
  return lastStep?.text?.includes('COMPLETE');
}
```

---

## Message Conversion

### UI Messages → Model Messages

```typescript
import { convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';

const uiMessages: UIMessage[] = [
  {
    id: '1',
    role: 'user',
    parts: [{ type: 'text', text: 'Hello' }],
  },
];

const modelMessages = convertToModelMessages(uiMessages);

const result = await streamText({
  model: openai('gpt-4o'),
  messages: modelMessages,
});
```

---

## Type Inference

### Infer Tool Input/Output Types

```typescript
import { InferUITool } from 'ai';

type WeatherInput = InferUITool<typeof weatherTool>['input'];
// { location: string; units?: "celsius" | "fahrenheit" | undefined }

type WeatherOutput = InferUITool<typeof weatherTool>['output'];
// { temperature: number; conditions: string; location: string; units: string }
```

### Infer All Tools

```typescript
import { InferUITools } from 'ai';

const tools = {
  weather: weatherTool,
  search: searchTool,
};

type AllTools = InferUITools<typeof tools>;
// {
//   weather: { input: ..., output: ... },
//   search: { input: ..., output: ... }
// }
```

---

## Error Handling in Tools

### Graceful Error Returns

```typescript
tool({
  inputSchema: z.object({
    transferId: z.string(),
  }),
  execute: async ({ transferId }) => {
    try {
      const transfer = await service.getTransfer({ transferId });
      return {
        success: true,
        data: transfer,
      };
    } catch (error: any) {
      // Return error object instead of throwing
      return {
        success: false,
        error: 'Transfer not found',
        message: 'You may not have permission to view this transfer',
      };
    }
  },
})
```

### With Validation

```typescript
tool({
  inputSchema: z.object({
    amount: z.number().positive(),
  }),
  execute: async ({ amount }) => {
    if (amount > 10000) {
      return {
        error: 'Amount exceeds maximum',
        maxAllowed: 10000,
      };
    }

    const result = await processPayment(amount);
    return result;
  },
})
```

---

## Advanced Patterns

### Tool with Streaming Output

```typescript
tool({
  inputSchema: z.object({
    location: z.string(),
  }),
  async *execute({ location }) {
    // Yield intermediate status
    yield {
      status: 'loading' as const,
      message: `Getting weather for ${location}...`,
    };

    await delay(2000);

    // Yield final result
    yield {
      status: 'success' as const,
      temperature: 22,
      location,
    };
  },
})
```

### Tool with Context

```typescript
const result = await streamText({
  model: openai('gpt-4o'),
  messages,
  tools: {
    customTool: tool({
      inputSchema: z.object({}),
      execute: async (input, { experimental_context: context }) => {
        // Access custom context
        const typedContext = context as { userId: string };
        console.log('User ID:', typedContext.userId);
      },
    }),
  },
  experimental_context: { userId: 'user-123' },
});
```

### Dynamic Tools (Unknown Types)

```typescript
import { dynamicTool } from 'ai';

const runtimeTool = dynamicTool({
  description: 'Execute user-defined function',
  inputSchema: z.object({}),
  execute: async input => {
    // input is typed as 'unknown'
    const { action, params } = input as any;
    return { result: `Executed ${action}` };
  },
});
```

---

## Common Mistakes to Avoid

### ❌ Don't Add Type Annotations

```typescript
// WRONG
execute: async (args: { city: string }) => {
  //              ^^^^^^^^^^^^^^^^^^^^^ Don't!
}

// CORRECT
execute: async ({ city }) => {
  //             ^^^^^^^ Types inferred from inputSchema
}
```

### ❌ Don't Use Old Property Names

```typescript
// WRONG - v4 style
tool({
  parameters: z.object({ ... })  // Old
})

// CORRECT - v5 style
tool({
  inputSchema: z.object({ ... })  // New
})
```

### ❌ Don't Use Removed Options

```typescript
// WRONG
streamText({
  maxSteps: 10  // Removed in v5
})

// CORRECT
streamText({
  stopWhen: stepCountIs(10)  // Replacement
})
```

### ❌ Don't Use Old Message Conversion

```typescript
// WRONG
import { convertToCoreMessages } from 'ai';
convertToCoreMessages(messages)  // Old name

// CORRECT
import { convertToModelMessages } from 'ai';
convertToModelMessages(messages)  // New name
```

---

## Quick Reference

| Task | v4 (Old) | v5 (New) |
|------|----------|----------|
| Define tool | `parameters` | `inputSchema` |
| Execute function | `execute: async (args: Type)` | `execute: async ({ param })` |
| Multi-step control | `maxSteps: 10` | `stopWhen: stepCountIs(10)` |
| Convert messages | `convertToCoreMessages` | `convertToModelMessages` |
| Tool input property | `args` | `input` |
| Tool result property | `result` | `output` |
| Message type | `CoreMessage` | `ModelMessage` |
| UI message type | `Message` | `UIMessage` |

---

## Testing Tools

```typescript
import { describe, it, expect } from 'jest';

describe('Weather Tool', () => {
  it('should return weather data', async () => {
    const result = await weatherTool.execute({
      location: 'London',
      units: 'celsius',
    });

    expect(result).toHaveProperty('temperature');
    expect(result).toHaveProperty('location', 'London');
    expect(result).toHaveProperty('units', 'celsius');
  });

  it('should handle optional parameters', async () => {
    const result = await weatherTool.execute({
      location: 'Paris',
    });

    expect(result.units).toBe('celsius'); // default
  });
});
```

---

## Resources

- **Official Docs:** https://sdk.vercel.ai/docs
- **Migration Guide:** https://sdk.vercel.ai/docs/migration-guides/migration-guide-5-0
- **Tool Reference:** https://sdk.vercel.ai/docs/reference/ai-sdk-core/tool
- **GitHub Examples:** https://github.com/vercel/ai/tree/main/examples

---

**Last Updated:** 2025-01-15
**AI SDK Version:** 5.0.72
