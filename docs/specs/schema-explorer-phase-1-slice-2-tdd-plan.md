# TDD Plan: Schema Explorer Phase 1 -- Slice 2

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it ([ ] -> [x]).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

## Context
- **Source**: `docs/specs/schema-explorer-phase-1.md`
- **Slice**: Slice 2 -- Frontend data preview grid + pagination controls
- **Risk**: MODERATE
- **Acceptance Criteria**:
  - Data preview grid appears below column detail panel
  - Column headers match table columns, rows show actual data
  - Loading, error (with retry), empty, null, and truncation states
  - Pagination: page indicator, prev/next with disabled states, table switch resets to page 1, total row count

## Codebase Analysis

### File Structure
- Port: `packages/frontend/src/ports/schema-data-port.ts`
- Adapter: `packages/frontend/src/adapters/fetch-schema-data-adapter.ts`
- Types: `packages/frontend/src/domain/schema-types.ts`
- New hook: `packages/frontend/src/hooks/useTableRows.ts`
- New component: `packages/frontend/src/components/schema-explorer/DataPreviewPanel.tsx`
- Integration: `packages/frontend/src/components/schema-explorer/SchemaExplorerPage.tsx`

### Test Infrastructure
- Framework: Vitest + @testing-library/react + @testing-library/user-event
- Co-located test files (`.test.ts` / `.test.tsx`)
- Run: `cd packages/frontend && pnpm test`
- Mock ports via `vi.fn()` objects passed as props
- Existing patterns in `SchemaExplorerPage.test.tsx` and `useSchemaExplorer.test.ts`

### Design Constraints (from `.claude/DESIGN.md`)
- Table cells: `px-3 py-1.5`, header: `px-3 py-2`
- Null/empty: `text-muted-foreground italic`
- Body text: `text-sm`, monospace data: `text-xs font-mono`
- Loading: Skeleton components
- shadcn Table, Button, Skeleton available

---

## Behavior 1: Add TableRowsResponse type and fetchTableRows to port

**Given** the existing `SchemaDataPort` interface
**When** slice 2 code needs to fetch row data
**Then** the port has a `fetchTableRows` method returning `TableRowsResponse`

- [x] **RED**: Write failing test
  - Location: `packages/frontend/src/adapters/fetch-schema-data-adapter.test.ts`
  - Test: `FetchSchemaDataAdapter implements fetchTableRows`
  - Assert the adapter has a `fetchTableRows` method (TypeScript compile check is the real gate, but a basic call-and-mock test confirms wiring)

- [x] **RUN**: Confirm test FAILS (method does not exist)

- [x] **GREEN**: Implement minimum code
  - Add `TableRowsResponse` type to `schema-types.ts`
  - Add `fetchTableRows(connectionId, schemaName, tableName, page)` to `SchemaDataPort`
  - Implement in `FetchSchemaDataAdapter` -- single `fetch()` call to `/api/schema/:connectionId/tables/:schemaName/:tableName/rows?page=N`

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: None expected

---

## Behavior 2: useTableRows fetches rows when table is selected

**Given** a selected table with connectionId, schemaName, tableName
**When** the hook mounts
**Then** it calls `fetchTableRows` and exposes rows, totalRows, page, isLoading

- [x] **RED**: Write failing test
  - Location: `packages/frontend/src/hooks/useTableRows.test.ts`
  - Test: `fetches rows on mount and exposes row data`
  - Create a mock port with `fetchTableRows` returning sample rows
  - Render hook with a table reference, assert `rows`, `totalRows`, `page` match response

- [x] **RUN**: Confirm FAILS (hook does not exist)

- [x] **GREEN**: Create `useTableRows` hook
  - Accepts port + table (or null)
  - Calls `fetchTableRows` in useEffect when table is non-null
  - Exposes `{ rows, totalRows, page, pageSize, isLoading, error }`

- [x] **RUN**: Confirm PASSES

- [x] **REFACTOR**: None expected

---

## Behavior 3: useTableRows exposes loading state

**Given** a selected table
**When** the fetch is in flight
**Then** `isLoading` is true

- [x] **RED**: Write failing test
- [x] **RUN**: Green from behavior 2 implementation
- [x] **GREEN**: Already implemented
- [x] **REFACTOR**: None

---

## Behavior 4: useTableRows exposes error state

**Given** a selected table
**When** the fetch rejects
**Then** `error` contains the message, `isLoading` is false

- [x] **RED**: Write failing test
- [x] **RUN**: Confirm FAILS
- [x] **GREEN**: Add catch handler in hook, set error state
- [x] **RUN**: Confirm PASSES
- [x] **REFACTOR**: None

---

## Behavior 5: useTableRows supports page navigation

**Given** the hook is at page 1
**When** `goToNextPage()` is called
**Then** it fetches page 2 and updates state

- [x] **RED**: Write failing test
- [x] **RUN**: Confirm FAILS
- [x] **GREEN**: Add `goToNextPage` and `goToPreviousPage` functions to hook, backed by a `page` state variable that triggers re-fetch
- [x] **RUN**: Confirm PASSES
- [x] **REFACTOR**: None

---

## Behavior 6: useTableRows resets to page 1 when table changes

**Given** the hook is on page 3 of table A
**When** the selected table changes to table B
**Then** it fetches page 1 of table B

- [x] **RED**: Write failing test
- [x] **RUN**: Confirm FAILS
- [x] **GREEN**: Reset page state in useEffect dependency on table identity
- [x] **RUN**: Confirm PASSES
- [x] **REFACTOR**: None

---

## Behavior 7: useTableRows exposes retry

**Given** a failed fetch
**When** `retry()` is called
**Then** it re-fetches the current page

- [x] **RED**: Write failing test
- [x] **RUN**: Confirm FAILS
- [x] **GREEN**: Add `retry` function that re-triggers the fetch
- [x] **RUN**: Confirm PASSES
- [x] **REFACTOR**: None needed — hook is clean and simple

---

## Behavior 8: DataPreviewPanel renders column headers and row data

**Given** rows data with known columns
**When** the component renders
**Then** column names appear as headers, cell values appear in rows

- [x] **RED**: Write failing test
- [x] **RUN**: Confirm FAILS (component does not exist)
- [x] **GREEN**: Create `DataPreviewPanel` component
- [x] **RUN**: Confirm PASSES
- [x] **REFACTOR**: Extracted `CellValue` renderer from the start

---

## Behavior 9: DataPreviewPanel shows loading state

**Given** `isLoading` is true
**When** the component renders
**Then** Skeleton placeholders are visible

- [x] **RED**: Write failing test
- [x] **RUN**: Confirm FAILS
- [x] **GREEN**: Add loading branch rendering Skeleton rows
- [x] **RUN**: Confirm PASSES
- [x] **REFACTOR**: None

---

## Behavior 10: DataPreviewPanel shows error with retry button

**Given** an error message
**When** the component renders
**Then** the error text and a Retry button are visible

- [x] **RED**: Write failing test
- [x] **RUN**: Confirm FAILS
- [x] **GREEN**: Add error branch with message + Button onClick={onRetry}
- [x] **RUN**: Confirm PASSES
- [x] **REFACTOR**: None

---

## Behavior 11: DataPreviewPanel shows empty state

**Given** rows is an empty array and not loading
**When** the component renders
**Then** a "No data" message is shown

- [x] **RED**: Write failing test
- [x] **RUN**: Confirm FAILS
- [x] **GREEN**: Add empty state branch
- [x] **RUN**: Confirm PASSES
- [x] **REFACTOR**: None

---

## Behavior 12: Null values are visually distinct from empty strings

**Given** a row with a null value and another with an empty string
**When** the component renders
**Then** null shows as italic "null" text, empty string shows as empty cell

- [x] **RED**: Write failing test
- [x] **RUN**: Confirm FAILS
- [x] **GREEN**: In cell rendering, check `value === null` and render styled "null" span
- [x] **RUN**: Confirm PASSES
- [x] **REFACTOR**: Extracted `CellValue` renderer function

---

## Behavior 13: Long text values are truncated

**Given** a row with a very long string value
**When** the component renders
**Then** the cell truncates with ellipsis and does not break layout

- [x] **RED**: Write failing test
- [x] **RUN**: Confirm FAILS
- [x] **GREEN**: Add `truncate max-w-xs` class to cell content wrapper
- [x] **RUN**: Confirm PASSES
- [x] **REFACTOR**: None

---

## Behavior 14: Pagination controls show page info and total rows

**Given** page 1 of 12, totalRows 300
**When** the component renders
**Then** shows "Page 1 of 12" and "300 rows"

- [x] **RED**: Write failing test
- [x] **RUN**: Confirm FAILS
- [x] **GREEN**: Add pagination footer below table
- [x] **RUN**: Confirm PASSES
- [x] **REFACTOR**: None

---

## Behavior 15: Previous button disabled on page 1

**Given** page 1
**When** the component renders
**Then** the Previous button is disabled

- [x] **RED**: Write failing test
- [x] **RUN**: Confirm FAILS
- [x] **GREEN**: Add `disabled={page <= 1}` to Previous button
- [x] **RUN**: Confirm PASSES
- [x] **REFACTOR**: None

---

## Behavior 16: Next button disabled on last page

**Given** page 12 of 12
**When** the component renders
**Then** the Next button is disabled

- [x] **RED**: Write failing test
- [x] **RUN**: Confirm FAILS
- [x] **GREEN**: Add `disabled={page >= totalPages}` to Next button
- [x] **RUN**: Confirm PASSES
- [x] **REFACTOR**: None

---

## Behavior 17: Next and Previous buttons trigger callbacks

**Given** the component on page 2
**When** user clicks Next or Previous
**Then** the corresponding callback fires

- [x] **RED**: Write failing test
- [x] **RUN**: Confirm FAILS
- [x] **GREEN**: Wire button onClick to props
- [x] **RUN**: Confirm PASSES
- [x] **REFACTOR**: No duplication found — states are clean

---

## Behavior 18: Integration -- DataPreviewPanel appears in SchemaExplorerPage

**Given** a table is selected
**When** SchemaExplorerPage renders
**Then** both ColumnDetailPanel and DataPreviewPanel appear

- [x] **RED**: Write failing test
- [x] **RUN**: Confirm FAILS
- [x] **GREEN**: In SchemaExplorerPage, use `useTableRows` hook and render `DataPreviewPanel` below `ColumnDetailPanel`
- [x] **RUN**: Confirm PASSES
- [x] **REFACTOR**: Mock port helpers already include both `fetchTables` and `fetchTableRows`

- [x] **COMMIT POINT**: All behaviors implemented and tested

---

## Edge Cases (Moderate Risk)

### Boundary: single-page table
- [x] **RED**: Test in `DataPreviewPanel.test.tsx` -- `hides pagination when only one page`
- [x] **GREEN -> REFACTOR**

### Boundary: exact page boundary
- [x] **RED**: Test in `DataPreviewPanel.test.tsx` -- `calculates total pages correctly at exact boundary`
- [x] **GREEN -> REFACTOR**

### Error: useTableRows does not fetch when table is null
- [x] **RED**: Test in `useTableRows.test.ts` -- `does not fetch when table is null`
- [x] **GREEN -> REFACTOR**

### Data: renders various value types correctly
- [x] **RED**: Test in `DataPreviewPanel.test.tsx` -- `renders numbers, booleans, and dates as strings`
- [x] **GREEN -> REFACTOR**

- [ ] **COMMIT**: "test: data preview edge cases"

---

## Final Check

- [x] **Run full test suite**: `cd packages/frontend && pnpm test` -- all 201 tests green (22 new)
- [x] **Review test names**: Read them top to bottom -- do they describe the data preview feature clearly?
- [x] **Review implementation**: No dead code, no unused parameters, no over-complex logic

## Test Summary
| Category | # Tests | Status |
|----------|---------|--------|
| Port/types | 1 | |
| useTableRows hook | 6 | |
| DataPreviewPanel component | 10 | |
| Integration (SchemaExplorerPage) | 1 | |
| Edge cases | 4 | |
| **Total** | **22** | |
