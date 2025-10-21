# PRD 3: New Middleware Tests

**Status:** 📋 Planning
**Priority:** High
**Estimated Effort:** 1-2 days
**Created:** 2025-10-21
**Last Updated:** 2025-10-21

---

## Overview

Complete middleware test coverage by adding 3 missing test files for untested middleware functions. This fills obvious gaps in infrastructure testing and ensures all middleware is properly tested.

**Key Capabilities:**
- 100% middleware test coverage (all 9 middleware functions tested)
- Request ID correlation testing
- Zod schema validation testing
- HTTP logging middleware testing

**Related Documentation:**
- [Middleware Directory](../../../../api-server/src/middleware/) - All middleware implementations
- [Backend Testing Guide](../../../SOP/backend-testing.md) - Middleware testing patterns
- [Test Template](../../../../api-server/__tests__/TEST_TEMPLATE.md) - Middleware test pattern
- [Master PRD](./prd.md) - Overall refactoring plan

---

## Phase 1: Request ID and Validation Middleware

**Goal:** Test request ID generation and Zod validation middleware

**Relevant Files:**
- [api-server/src/middleware/requestIdMiddleware.ts](../../../../api-server/src/middleware/requestIdMiddleware.ts) - Implementation
- [api-server/src/middleware/zodValidation.ts](../../../../api-server/src/middleware/zodValidation.ts) - Implementation
- [api-server/__tests__/middleware/requestId.test.ts](../../../../api-server/__tests__/middleware/requestId.test.ts) - NEW
- [api-server/__tests__/middleware/zodValidation.test.ts](../../../../api-server/__tests__/middleware/zodValidation.test.ts) - NEW

### Backend Implementation

- [ ] Create requestId.test.ts
  - [ ] Sets correlationId on request object
  - [ ] Generates valid UUIDv4 format
  - [ ] Unique ID per request (no collisions)
  - [ ] Propagates correlationId to response headers
  - [ ] Works with concurrent requests
  - [ ] CorrelationId available to error handler

- [ ] Create zodValidation.test.ts
  - [ ] Validates request body against Zod schema (success)
  - [ ] Returns 400 for invalid body data
  - [ ] Returns detailed validation error messages
  - [ ] Validates query parameters
  - [ ] Validates path parameters
  - [ ] Multiple validation errors reported together
  - [ ] Custom error messages from Zod schema
  - [ ] Works with nested object schemas
  - [ ] Works with array schemas

- [ ] Confirm all tests pass before moving to Phase 2

---

## Phase 2: HTTP Logging Middleware

**Goal:** Test HTTP request/response logging middleware

**Relevant Files:**
- [api-server/src/middleware/httpLoggingMiddleware.ts](../../../../api-server/src/middleware/httpLoggingMiddleware.ts) - Implementation
- [api-server/__tests__/middleware/httpLogging.test.ts](../../../../api-server/__tests__/middleware/httpLogging.test.ts) - NEW

### Backend Implementation

- [ ] Create httpLogging.test.ts
  - [ ] Logs HTTP method and URL
  - [ ] Logs response status code
  - [ ] Logs request duration (timing)
  - [ ] Includes correlationId in logs
  - [ ] Logs request body (sanitized)
  - [ ] Logs response body (sanitized)
  - [ ] Redacts sensitive fields (password, authorization)
  - [ ] Handles logging errors gracefully
  - [ ] Performance: minimal overhead (<5ms)
  - [ ] Skip logging for health check endpoints

- [ ] Confirm all tests pass

---

## Testing Strategy

### Middleware Test Pattern

**Setup:**
- Create minimal Express app with middleware under test
- Add test routes that exercise middleware functionality
- Use supertest for HTTP testing
- Mock logger where necessary (verify log calls)

**Coverage:**
- Test happy path (middleware works correctly)
- Test error cases (middleware handles errors)
- Test edge cases (empty data, malformed requests, etc.)
- Test integration with error handler
- Test performance characteristics where relevant

**Example Structure:**
```typescript
describe('[ST-XXX] MiddlewareName Middleware', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(middlewareUnderTest);
    app.get('/test', (req, res) => res.json({ success: true }));
    app.use(standardErrorHandler);
  });

  describe('[AC-XXX-1] Feature Name', () => {
    it('should do expected behavior', async () => {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
      // Assert middleware behavior
    });
  });
});
```

---

## Success Metrics

- [ ] 3 new middleware test files created
- [ ] requestId.test.ts: 6+ tests passing
- [ ] zodValidation.test.ts: 9+ tests passing
- [ ] httpLogging.test.ts: 10+ tests passing
- [ ] All middleware tests passing (~25 new tests total)
- [ ] 100% middleware coverage achieved (9/9 middleware functions)
- [ ] Middleware test patterns documented in TEST_TEMPLATE.md
- [ ] Backend testing SOP updated with middleware testing examples

---

## Notes & Decisions

**Key Design Decisions:**

1. **Test with minimal Express app**
   - **Rationale:** Isolates middleware from full application complexity
   - **Alternative:** Test in full app context (rejected: too much coupling, hard to debug)

2. **Mock logger for httpLogging tests**
   - **Rationale:** Verify log calls without polluting test output
   - **Alternative:** Test actual log output (rejected: brittle, coupling to logger implementation)

3. **Test zodValidation with realistic schemas**
   - **Rationale:** Catch edge cases in Zod integration (nested objects, arrays, etc.)
   - **Alternative:** Use simple schemas only (rejected: incomplete coverage)

4. **Performance testing for httpLogging**
   - **Rationale:** Ensure logging doesn't impact request latency
   - **Alternative:** Skip performance testing (rejected: logging is hot path)

5. **Redaction testing for httpLogging**
   - **Rationale:** Security-critical to verify sensitive data is not logged
   - **Alternative:** Assume redaction works (rejected: too risky for security)

**Known Limitations:**
- httpLogging tests may be brittle if logger format changes
- correlationId format (UUIDv4) is implementation detail (could change to shorter ID)
- Performance thresholds (<5ms) may vary by machine

**Future Enhancements (Out of Scope):**
- Structured logging with OpenTelemetry integration
- Distributed tracing with correlation ID propagation
- Request/response body size limits in logging
- Configurable log levels per middleware

---

**Template Version:** 1.0
**Created:** 2025-10-21
