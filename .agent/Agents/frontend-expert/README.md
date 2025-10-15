# frontend-expert - Work Portfolio

**Agent Definition:** [.claude/agents/frontend-expert.md](../../../.claude/agents/frontend-expert.md)

## Purpose
React components, Mantine UI, TypeScript, routing, state management (Zustand), and responsive design.

## Recent Work (Last 10)

<!-- Agents will update this section automatically -->
<!-- Format: - [YYYY-MM-DD] [Task Name](./work/filename.md) - Brief description -->

- [2025-10-14] [Stock Transfers V2 Phase 4 Frontend](./work/phase4-frontend-implementation-2025-10-14.md) - Implemented 3 enhancements: Transfer Analytics Dashboard (7 charts), Priority System (URGENT/HIGH/NORMAL/LOW), and Partial Shipment Support with batch tracking
- [2025-10-14] [Barcode Scanning UI](./work/barcode-scanning-ui-2025-10-14.md) - Implemented barcode scanning modal for stock transfer receiving with camera integration and manual entry fallback

## Common Patterns

### Typical Tasks
- Creating page components with Mantine UI
- Building forms with validation (react-hook-form)
- Implementing CRUD interfaces
- Adding routing and navigation
- Implementing permission-based UI rendering
- Creating reusable component libraries

### Standard Workflow
1. Read API contracts from backend-api-expert output
2. Run `npm run openapi:gen` to get latest types
3. Create API client module in `src/api/{resource}.ts`
4. Build page component in `src/pages/{Resource}Page.tsx`
5. Add route in `src/main.tsx` with permission guard
6. Style with Mantine components + Tailwind utilities
7. Test in browser and with Playwright E2E tests

### Output Location
- **Work log**: `.agent/Agents/frontend-expert/work/{feature}-ui-{date}.md`
- **Feature doc**: `.agent/Features/{status}/{feature-name}/frontend-expert.md`

## Related Agents

### Before Me
- **backend-api-expert**: Provides API contracts
- **integration-orchestrator**: Runs openapi:gen for type sync

### After Me
- **test-engineer**: Tests my UI with Playwright E2E tests

### Works With
- **rbac-security-expert**: For permission-based UI rendering

## Key Responsibilities

✅ Type-safe React components with TypeScript
✅ Mantine UI component usage and customization
✅ Responsive design (mobile-first)
✅ Permission-based UI rendering (`<RequirePermission>`)
✅ Form validation and error handling
✅ API client integration with proper error handling
✅ Routing with React Router
✅ Accessible UI (ARIA attributes, semantic HTML)
✅ **Add data-testid attributes for testability** (see Testing Best Practices below)

## Testing Best Practices

### Always Add data-testid Attributes

**IMPORTANT:** When creating components that will need to be tested, ALWAYS add `data-testid` attributes to make E2E testing reliable and maintainable.

**When to Add data-testid:**
- ✅ Components with duplicate text content (e.g., multiple cards showing "Total: 50")
- ✅ Dynamic content that changes (e.g., metric cards, charts, tables)
- ✅ Components rendered multiple times on the same page
- ✅ Key UI elements that tests need to verify (buttons, forms, modals)
- ✅ Charts, graphs, and visualization components
- ✅ Any component where text-based selectors would be ambiguous

**Naming Convention:**
- Use kebab-case: `data-testid="metric-total-transfers"`
- Be descriptive: Include component type and purpose
- Be consistent: Use same pattern across similar components

**Examples from Phase 4 Analytics:**

```tsx
// ✅ Good - Metric cards with data-testid
const metrics = [
  {
    title: "Total Transfers",
    testId: "metric-total-transfers",  // Add testId to data structure
    value: data.totalTransfers,
    icon: <IconTruck size={24} />,
  },
  // ... other metrics
];

return (
  <Grid>
    {metrics.map((metric) => (
      <Grid.Col key={metric.title} span={{ base: 12, xs: 6, md: 3 }}>
        <Paper withBorder p="md" radius="md" data-testid={metric.testId}>
          {/* ... */}
        </Paper>
      </Grid.Col>
    ))}
  </Grid>
);

// ✅ Good - Charts with data-testid
<Paper withBorder p="md" radius="md" data-testid="chart-transfer-volume">
  <Title order={4}>Transfer Volume Over Time</Title>
  <BarChart /* ... */ />
</Paper>

// ✅ Good - Tables with data-testid
<Paper withBorder p="md" radius="md" data-testid="table-top-routes">
  <Title order={4}>Top Transfer Routes</Title>
  <Table /* ... */ />
</Paper>

// ❌ Bad - No data-testid (test will use ambiguous text selectors)
<Paper withBorder p="md" radius="md">
  <Text>Total Transfers: {count}</Text>
</Paper>
```

**Why This Matters:**
- 🎯 **Reliable selectors**: data-testid won't break when text changes
- 🚫 **Avoids strict mode violations**: No more "resolved to 6 elements" errors
- 🧪 **Easier testing**: Test engineer can write stable tests quickly
- 📝 **Self-documenting**: Shows which elements are test targets

### Mantine Component Testing Considerations

**NumberInput in Tables:**
- NumberInput renders as `<input type="text" inputmode="numeric">`
- No label when in table cells - must use data-testid or position-based selectors
- Tests should triple-click to select all, then fill (not type character-by-character)

**Select Dropdowns:**
- Options render in portals outside the modal/dialog
- Tests must use page-level `getByRole('option')` not scoped to modal
- Example: `await page.getByRole('option', { name: 'HIGH' }).click()`

**DatePickerInput:**
- Uses button element, not input - `.fill()` doesn't work
- Tests should use URL params for date filtering instead of UI interaction
- Example: `page.goto('/analytics?startDate=2025-09-01&endDate=2025-10-14')`

## Documentation to Reference
- `.agent/System/architecture.md` - Frontend patterns
- `.agent/Features/{feature}/backend-api-expert.md` - API contracts
- `admin-web/src/types/openapi.d.ts` - Generated types
- `.agent/SOP/frontend-testing.md` - E2E testing patterns
