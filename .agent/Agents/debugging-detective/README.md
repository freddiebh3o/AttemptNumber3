# debugging-detective - Work Portfolio

**Agent Definition:** [.claude/agents/debugging-detective.md](../../../.claude/agents/debugging-detective.md)

## Purpose
Root cause analysis, log analysis, correlation ID tracing, race condition detection, test failure debugging, and systematic problem-solving.

## Recent Work (Last 10)

<!-- Agents will update this section automatically -->
<!-- Format: - [YYYY-MM-DD] [Task Name](./work/filename.md) - Brief description -->

_No work completed yet_

## Common Patterns

### Typical Tasks
- Investigating production bugs
- Analyzing error logs with correlation IDs
- Debugging race conditions and concurrency issues
- Fixing flaky tests
- Profiling performance issues
- Tracing requests through distributed system
- Root cause analysis of mysterious behavior

### Standard Workflow
1. Gather reproduction steps and error messages
2. Extract correlation ID from error response
3. Search logs for that correlation ID
4. Trace request through all middleware and services
5. Form hypotheses about root cause
6. Test hypotheses systematically
7. Identify actual root cause (not symptoms)
8. Document findings and propose solution
9. Verify fix resolves issue

### Output Location
- **Work log**: `.agent/Agents/debugging-detective/work/{issue}-analysis-{date}.md`
- **Feature doc**: `.agent/Features/{status}/{feature-name}/debugging-detective.md` (if feature-related)

## Related Agents

### Before Me
- Bug reported (user, test failure, production error)

### After Me
- Appropriate agent implements fix (backend-api-expert, database-expert, etc.)

## Key Responsibilities

✅ Systematic root cause analysis
✅ Correlation ID tracing through logs
✅ Race condition identification
✅ Test flakiness debugging
✅ Performance profiling
✅ Database query analysis
✅ Prevention strategies
✅ Clear documentation of findings

## Documentation to Reference
- `.agent/SOP/debugging-guide.md` - Common issues
- `.agent/SOP/troubleshooting-tests.md` - Test debugging
- `.agent/System/architecture.md` - System context
- Application logs with correlation IDs
