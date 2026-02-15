# TDD Plan: Phase 2, Slice 5 -- Results Table + SQL Display

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it (`[ ]` to `[x]`).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

## UI/UX Layout Specification

### Workspace Page Layout (after query returns)

```
┌────────────────────────────────────────────────────────┐
│  [Input bar: "Ask a question..."]        [Ask button]  │
├────────────────────────────────────────────────────────┤
│  Top Customers by Revenue          ← text-lg font-semibold
│  Answer found after 2 attempts     ← text-xs text-muted-foreground (only when attempts > 1)
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Name          │ Revenue      │ Region            │  │  ← header: bg-muted/50 text-xs font-medium
│  │───────────────┼──────────────┼───────────────────│  │    text-muted-foreground uppercase tracking-wide
│  │ Alice         │       12,500 │ North             │  │  ← text-sm, numbers text-right
│  │ Bob           │        8,200 │ null              │  │  ← null: text-muted-foreground italic
│  │ Carol         │        6,100 │ West              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ▶ View generated SQL              ← collapsible trigger, text-sm text-muted-foreground
│  ┌──────────────────────────────────────────────────┐  │
│  │ SELECT name, SUM(total) as revenue, region       │  │  ← font-mono text-xs, bg-muted p-3 rounded-md
│  │ FROM customers GROUP BY name, region             │  │
│  │ ORDER BY revenue DESC LIMIT 10                   │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Design Tokens (from DESIGN.md)

| Element | Classes |
|---------|---------|
| Title | `text-lg font-semibold` |
| Attempt count | `text-xs text-muted-foreground` |
| Table header | `bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide` |
| Table cell | `text-sm px-3 py-1.5` |
| Numeric cell | `text-right` (additional) |
| Null cell | `text-muted-foreground italic` |
| Row hover | `hover:bg-muted/50` |
| Row border | `border-b border-border` |
| SQL block | `font-mono text-xs bg-muted p-3 rounded-md` |
| Collapsible trigger | `text-sm text-muted-foreground` |
| Loading state | Button shows "Thinking..." (existing) |
| Error state | `text-destructive text-sm` |
| No results | `text-muted-foreground text-sm italic` centered in table area |

### States

1. **Idle**: Input bar visible, no results area
2. **Loading**: Button disabled with "Thinking..." text, input disabled
3. **Success**: Title + table + SQL display
4. **Success (with retries)**: Same as success + attempt count badge
5. **Error**: Error message in `text-destructive`
6. **Empty results**: "No results" message where table would be

<!-- -------- bee-comment -------- -->
> **@developer**: again no ui/ux or layout specifications here
> **@bee**: Added a full "UI/UX Layout Specification" section with ASCII wireframe, design tokens table, and states enumeration.
> - [x] mark as resolved
<!-- -------- /bee-comment -------- -->

<!-- -------- bee-comment -------- -->
> **@developer**: do you think we should show the sql on top, and let the user click on a button to approve it? Or run it manually?
> **@bee**: Recommend keeping auto-execute for MVP. The user asked a question — they want the answer, not an approval gate. Safety is already handled server-side (SELECT-only validation, table ref checks, read-only DB, retry loop). The collapsible SQL display gives transparency after the fact. Human-in-the-loop SQL editing is a natural fit for Phase 5 (Schema Intelligence) when we add query tweaking. No plan changes needed.
> - [x] mark as resolved
<!-- -------- /bee-comment -------- -->

## Context
- **Source**: `docs/specs/gen-bi-phase-2.md` -- Slice 5
- **Phase/Slice**: Phase 2, Slice 5: Results Table + SQL Display
- **Risk Level**: MODERATE
- **Success Criteria**:
  - `QueryResponse` type updated with `rows` and `attempts`
  - Results display in a data table with columns from metadata
  - Numbers right-aligned, nulls shown as muted italic
  - Generated SQL in a collapsible section (`font-mono text-xs`)
  - Loading state while query processes
  - Error message on failure
  - "No results" for zero rows
  - AI-generated title above results
  - Attempt count shown when `attempts > 1`

## Codebase Analysis

### What Already Exists
| Artifact | Path | Status |
|----------|------|--------|
| `QueryPort` | `packages/frontend/src/ports/query-port.ts` | Exists -- no changes needed |
| `FetchQueryAdapter` | `packages/frontend/src/adapters/fetch-query-adapter.ts` | Exists -- no changes needed |
| `QueryResponse` type | `packages/frontend/src/domain/query-types.ts` | Needs `rows` + `attempts` fields |
| `useWorkspace` hook | `packages/frontend/src/hooks/useWorkspace.ts` | Exists -- no changes needed |
| `WorkspacePage` | `packages/frontend/src/components/workspace/WorkspacePage.tsx` | Needs rewrite to show table |
| shadcn `Table` | `packages/frontend/src/components/ui/table.tsx` | Exists |
| shadcn `Collapsible` | -- | Not installed, needs `npx shadcn@latest add collapsible` |

### Architecture
The frontend already follows an onion-like pattern:
- **Ports**: `src/ports/` (interfaces)
- **Adapters**: `src/adapters/` (fetch implementations)
- **Domain**: `src/domain/` (types + pure transforms)
- **Hooks**: `src/hooks/` (orchestration, similar to use cases)
- **Components**: `src/components/` (inbound adapters / UI)

This slice adds a presentational component (`ResultsTable`) and pure domain logic for cell formatting. The existing port, adapter, and hook layers need only minor type updates.

### Test Infrastructure
- Framework: Vitest + React Testing Library + `@testing-library/user-event`
- Test setup: `packages/frontend/src/test-setup.ts` (localStorage mock, ResizeObserver, matchMedia)
- Pattern: co-located test files (`.test.ts` / `.test.tsx`)

---

## Pre-requisite: Install Collapsible Component

- [x] Run `cd packages/frontend && npx shadcn@latest add collapsible`

---

## Outer Test (Integration)

**Write this test FIRST. It stays RED until all layers are built.**

### Scenario
User types a question, submits it, and sees: title, data table with formatted cells, generated SQL in a collapsible section, and attempt count when retries occurred.

### Test Specification
- Location: `packages/frontend/src/components/workspace/WorkspacePage.test.tsx`
- Replaces and extends the existing test file

- [x]**Write outer integration test** covering the full user journey:
  - Mock `QueryPort` returning a response with `rows`, `columns`, `title`, `sql`, `attempts`
  - User types a question and clicks Ask
  - **Asserts**:
    1. Title text appears (e.g., "Top Customers by Revenue")
    2. Table headers derived from column metadata are visible
    3. Row data renders in table cells
    4. Numeric values are right-aligned
    5. Null values render with italic styling
    6. SQL text is present (in a collapsible section)
    7. When `attempts > 1`, attempt count message appears
  - Keep existing tests for loading state and error state; update them to match the new UI structure

- [x]**RUN**: Confirm outer test FAILS (component still renders raw JSON)

### Expected Failure Progression
| After Step | Expected Failure |
|------------|-----------------|
| (now) | "Unable to find text" -- raw JSON still rendered |
| Domain type update | Still fails -- component unchanged |
| ResultsTable built | Still fails -- not wired into WorkspacePage |
| WorkspacePage updated | PASSES |

---

## Layer 1: Domain Types Update

### 1.1 Update `QueryResponse` type

- [x]**Update** `packages/frontend/src/domain/query-types.ts`
  - Add `rows: Record<string, unknown>[]` to `QueryResponse`
  - Add `attempts: number` to `QueryResponse`
  - Update `columns` role type to `'dimension' | 'measure'` (union, not open string)

- [x]**Update existing test fixtures** that reference `QueryResponse` so they compile:
  - `packages/frontend/src/hooks/useWorkspace.test.ts` -- add `rows` and `attempts` to `cannedResponse`
  - `packages/frontend/src/adapters/fetch-query-adapter.test.ts` -- add `rows` and `attempts` to `cannedResponse`
  - `packages/frontend/src/components/workspace/WorkspacePage.test.tsx` -- add `rows` and `attempts` to fixture

- [x]**RUN**: `pnpm --filter frontend test` -- all existing tests still pass

---

## Layer 2: Domain -- Pure Formatting Logic

### 2.1 Pure function: `formatCellValue`

Determines how a cell value should be displayed. Pure input to output, no mocks.

- [x]**RED**: Write pure test
  - Location: `packages/frontend/src/domain/query-transforms.test.ts`
  - Tests:
    - String values pass through unchanged
    - Number values convert to string
    - `null` returns `{ text: 'null', isNull: true }`
    - `undefined` returns `{ text: 'null', isNull: true }`
    - Boolean values render as `'true'` / `'false'`

- [x]**RUN**: Confirm test FAILS

- [x]**GREEN**: Implement `formatCellValue`
  - Location: `packages/frontend/src/domain/query-transforms.ts`
  - Returns `{ text: string; isNull: boolean }`
  - **PURITY CHECK**: No imports from outside domain

- [x]**RUN**: Confirm test PASSES

### 2.2 Pure function: `isNumericType`

Determines if a column type should be right-aligned.

- [x]**RED**: Add tests to same file
  - `int4`, `int8`, `numeric`, `decimal`, `float4`, `float8`, `bigint`, `integer` return `true`
  - `varchar`, `text`, `timestamp`, `boolean` return `false`

- [x]**RUN**: Confirm test FAILS

- [x]**GREEN**: Implement `isNumericType`
  - Same file: `packages/frontend/src/domain/query-transforms.ts`

- [x]**RUN**: Confirm test PASSES

---

## Layer 3: ResultsTable Component

### 3.1 Unit Test: Renders table headers from column metadata

- [x]**RED**: Write test
  - Location: `packages/frontend/src/components/workspace/ResultsTable.test.tsx`
  - Render `<ResultsTable columns={[...]} rows={[...]} />`
  - Assert: each column `name` appears as a table header

- [x]**RUN**: Confirm FAILS (component does not exist)

- [x]**GREEN**: Create `ResultsTable` component
  - Location: `packages/frontend/src/components/workspace/ResultsTable.tsx`
  - Uses shadcn `Table`, `TableHeader`, `TableHead`, `TableBody`, `TableRow`, `TableCell`
  - Maps `columns` to headers, `rows` to table rows

- [x]**RUN**: Confirm PASSES

### 3.2 Unit Test: Right-aligns numeric columns

- [x]**RED**: Write test
  - Pass a column with `type: 'int4'` and `role: 'measure'`
  - Assert: the header and corresponding cells have `text-right` class

- [x]**RUN**: FAILS

- [x]**GREEN**: Use `isNumericType` from domain to conditionally apply `text-right`

- [x]**RUN**: PASSES

### 3.3 Unit Test: Renders null values with muted italic styling

- [x]**RED**: Write test
  - Pass a row with a `null` value
  - Assert: cell contains text "null" with `text-muted-foreground` and `italic` classes

- [x]**RUN**: FAILS

- [x]**GREEN**: Use `formatCellValue` from domain; apply styling when `isNull` is true

- [x]**RUN**: PASSES

### 3.4 Unit Test: Shows "No results" when rows is empty

- [x]**RED**: Write test
  - Pass `rows={[]}` with valid columns
  - Assert: "No results" message visible

- [x]**RUN**: FAILS

- [x]**GREEN**: Add empty-state check at top of component

- [x]**RUN**: PASSES

### 3.5 Refactor

- [x]**REFACTOR**: Review component for clean code -- SRP, small functions, good names
- [x]**ARCHITECTURE CHECK**: `ResultsTable` imports only from `domain/` and `components/ui/`. No port or adapter imports.

---

## Layer 4: SqlDisplay Component

### 4.1 Unit Test: Shows SQL in monospace font inside collapsible

- [x]**RED**: Write test
  - Location: `packages/frontend/src/components/workspace/SqlDisplay.test.tsx`
  - Render `<SqlDisplay sql="SELECT * FROM orders" />`
  - Assert: SQL text present with `font-mono` and `text-xs` classes
  - Assert: a trigger/toggle element exists (Collapsible)

- [x]**RUN**: FAILS

- [x]**GREEN**: Create `SqlDisplay` component
  - Location: `packages/frontend/src/components/workspace/SqlDisplay.tsx`
  - Uses shadcn `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`
  - SQL rendered in a `<pre>` or `<code>` with `font-mono text-xs`

- [x]**RUN**: PASSES

### 4.2 Unit Test: Collapsible toggles SQL visibility

- [x]**RED**: Write test
  - Click the trigger
  - Assert: SQL content becomes visible/hidden (test the toggle behavior)

- [x]**RUN**: FAILS

- [x]**GREEN**: Wire collapsible open/close state

- [x]**RUN**: PASSES

- [x]**ARCHITECTURE CHECK**: `SqlDisplay` imports only from `components/ui/`. No domain, port, or adapter imports.

---

## Layer 5: Update WorkspacePage (Wiring)

### 5.1 Update WorkspacePage to render title, ResultsTable, SqlDisplay, and attempt count

- [x]**Update** the outer integration test (from the Outer Test step) if needed to finalize assertions

- [x]**RED**: Confirm outer test still fails against current WorkspacePage

- [x]**GREEN**: Rewrite the response section of `WorkspacePage.tsx`:
  - Replace raw JSON `<pre>` block with:
    1. Title: `<h2>` with response title (`text-lg font-semibold`)
    2. Attempt count: conditional text when `response.attempts > 1` (e.g., "Answer found after 2 attempts")
    3. `<ResultsTable columns={response.columns} rows={response.rows} />`
    4. `<SqlDisplay sql={response.sql} />`
  - Keep existing loading state (button shows "Thinking...")
  - Keep existing error display

- [x]**RUN**: Confirm outer test PASSES

### 5.2 Loading state test

- [x]**Verify** existing test for loading state still passes (button text "Thinking...", input disabled)
  - If test needs updating for new UI structure, update it

### 5.3 Error state test

- [x]**Verify** existing test for error message still passes
  - If test needs updating, update it

- [x]**ARCHITECTURE CHECK**: WorkspacePage imports only from `hooks/`, `ports/` (type), and sibling components. No adapter or domain imports.

---

## Final Verification

- [x]**RUN**: `pnpm --filter frontend test` -- all tests pass
- [x]**RUN**: `pnpm --filter frontend build` -- no type errors

### Dependency Direction Check
- [x]`domain/query-transforms.ts` imports nothing outside `domain/`
- [x]`domain/query-types.ts` imports nothing
- [x]`components/workspace/ResultsTable.tsx` imports from `domain/` and `components/ui/` only
- [x]`components/workspace/SqlDisplay.tsx` imports from `components/ui/` only
- [x]`components/workspace/WorkspacePage.tsx` imports from `hooks/`, `ports/` (type), and sibling workspace components only

## Test Summary
| Layer | Type | Tests | Mocks Used |
|-------|------|-------|------------|
| Outer (Integration) | Component | 1 | QueryPort |
| Domain (formatting) | Pure | ~7 | None |
| ResultsTable | Unit | 4 | None (pure component) |
| SqlDisplay | Unit | 2 | None (pure component) |
| WorkspacePage | Unit | 2 (existing, updated) | QueryPort |
| **Total** | | **~16** | |

[x] Reviewed
