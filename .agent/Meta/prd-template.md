# [Feature Name] - Implementation Plan

**Status:** 📋 Planning / ⏳ In Progress / ✅ Complete
**Priority:** High / Medium / Low
**Estimated Effort:** X days/weeks
**Created:** YYYY-MM-DD
**Last Updated:** YYYY-MM-DD

---

## Overview

[2-3 sentence description of what this feature does and why it's valuable to the business or users]

**Key Capabilities:**
- Capability 1 (what users can do)
- Capability 2
- Capability 3

**Related Documentation:**
- [System Doc](../System/relevant-doc.md) - Context from existing system
- [SOP Guide](../SOP/relevant-sop.md) - Related procedures

---

## Phase 1: [Phase Name]

**Goal:** [1 sentence describing what this phase achieves]

**Relevant Files:**
- [api-server/src/services/featureService.ts](../../api-server/src/services/featureService.ts)
- [api-server/src/routes/featureRouter.ts](../../api-server/src/routes/featureRouter.ts)
- [admin-web/src/pages/FeaturePage.tsx](../../admin-web/src/pages/FeaturePage.tsx)

### Backend Implementation

- [ ] Database schema changes (create migration: `add_feature_name`)
- [ ] Prisma client regeneration
- [ ] Service layer functions created
- [ ] OpenAPI schemas defined
- [ ] API endpoints implemented
- [ ] Backend tests written (NEVER RUN THE ACTUAL TEST)

### Frontend Implementation

- [ ] OpenAPI types regenerated
- [ ] API client functions created
- [ ] UI components implemented with **data-testid attributes**
- [ ] Page/route integration
- [ ] Navigation links added
- [ ] E2E tests written (NEVER RUN THE ACTUAL TEST)

### Documentation

- [ ] Update /docs for AI assistant (if new concepts/workflows introduced)
- [ ] Update relevant System documentation
- [ ] Update relevant SOP documentation (if procedures change)

---

## Phase 2: [Phase Name]

**Goal:** [1 sentence describing what this phase achieves]

**Relevant Files:**
- [List key files that will be modified in this phase]

### Backend Implementation

- [ ] [Backend task 1]
- [ ] [Backend task 2]
- [ ] Backend tests passing
- [ ] Confirm all tests pass before moving to frontend

### Frontend Implementation

- [ ] [Frontend task 1 with data-testid attributes]
- [ ] [Frontend task 2]
- [ ] E2E tests passing

### Documentation

- [ ] Update /docs for AI assistant (if applicable)
- [ ] Update system documentation (if applicable)

---

## Phase 3: [Phase Name] (if needed)

[Follow same structure as Phase 1 and Phase 2]

---

## Testing Strategy

### Backend Tests (Jest)

**Service Layer:**
- [ ] CRUD operations with validation
- [ ] Multi-tenant isolation
- [ ] Permission enforcement
- [ ] Edge cases and error handling

**API Routes:**
- [ ] Authenticated requests
- [ ] Permission middleware
- [ ] Request validation
- [ ] Response format

### Frontend Tests (Playwright E2E)

**User Flows:**
- [ ] Create/Read/Update/Delete operations
- [ ] Form validation
- [ ] Success/error notifications
- [ ] Navigation

**Permission-Based UI:**
- [ ] OWNER role functionality
- [ ] ADMIN role functionality
- [ ] EDITOR role functionality
- [ ] VIEWER role (read-only)

---

## Success Metrics

- [ ] [Metric 1: e.g., Feature is accessible to all user roles appropriately]
- [ ] [Metric 2: e.g., All CRUD operations work end-to-end]
- [ ] [Metric 3: e.g., 90%+ test pass rate maintained]

---

## Notes & Decisions

**Key Design Decisions:**
- Decision 1 and rationale
- Decision 2 and rationale

**Known Limitations:**
- Limitation 1
- Limitation 2

**Future Enhancements (Out of Scope):**
- Enhancement 1
- Enhancement 2

---

## Instructions for Using This Template

### What to INCLUDE:
- ✅ High-level overview of what's being built
- ✅ Phase-based breakdown with clear goals
- ✅ Checklist items for tracking progress
- ✅ File references (links to files that will be modified)
- ✅ Testing requirements per phase
- ✅ Documentation update reminders
- ✅ Always include instruction to analyse existing tests, to see if there are any that conflict with or become outdated by the new feature
- ✅ Always refer to the following documents when writing tests 
    - Backend:
        - api-server\__tests__\TEST_TEMPLATE.md
        - api-server\__tests__\scriptsList.md -> File with scripts to run each test suite. Will need updating if any new tests are created or old tests are changed 
    - frontend: 
        - admin-web\e2e\GUIDELINES.md

### What to EXCLUDE:
- ❌ Code snippets (reference files instead)
- ❌ Full database schemas (link to System docs instead)
- ❌ Detailed API request/response formats (use OpenAPI for that)
- ❌ Implementation algorithms (those belong in code comments)
- ❌ Step-by-step instructions (use SOPs for procedures)

### Workflow Principles:
1. **Backend First:** Always complete backend + backend tests before starting frontend
2. **Test Early:** Write tests as you implement, not after
3. **data-testid:** Always add data-testid attributes to frontend components for E2E testing
4. **Documentation:** Update /docs when introducing new concepts the AI assistant should know
5. **Iterative:** Break large features into small phases (1-3 days each)

### Progress Tracking:
- Use `- [ ]` for uncompleted tasks
- Use `- [x]` for completed tasks
- Update **Last Updated** date when making changes
- Update **Status** field as you progress through phases

---

**Template Version:** 1.0
**Created:** 2025-10-17
