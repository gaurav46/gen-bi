# TDD Plan: Phase 3, Slice 3 — Chart Type Override

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it ([ ] -> [x]).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

## Context
- **Source**: `docs/specs/gen-bi-phase-3.md`
- **Phase/Slice**: Phase 3, Slice 3: Chart Type Override
- **Risk Level**: Moderate
- **Success Criteria**:
  - User can switch between available chart types via a selector
  - Selector shows icons or labels for: bar, line, area, pie, KPI card, table
  - AI-recommended chart type is pre-selected as default
  - Switching chart type re-renders the same data with the new visualization
  - Selected chart type is visually indicated in the selector
  - Override does not re-query -- it only changes the frontend rendering

## Codebase Analysis

### Architecture
- Current: Hexagonal architecture from Slices 1 and 2
- Target: Same hexagonal pattern. This slice is predominantly UI state management -- a new `ChartTypeSelector` component and local state in `WorkspacePage`

### Key Insight
This slice does NOT need new domain transforms or new ports. All six chart types (bar, line, area, pie, kpi_card, table) already have their rendering paths wired. The work is:
1. A pure domain constant defining the available chart types and their labels
2. A new `ChartTypeSelector` component
3. State management in `WorkspacePage` to hold the override

### Existing Infrastructure
| File | Role |
|------|------|
| `src/components/workspace/WorkspacePage.tsx` | Orchestrates query, renders chart or table |
| `src/components/workspace/ChartRenderer.tsx` | Dispatches chartType to chart panels |
| `src/components/workspace/ResultsTable.tsx` | Renders table visualization |
| `src/domain/chart-transforms.ts` | Pure transforms per chart type |
| `src/domain/query-types.ts` | `QueryResponse` type with `visualization.chartType` |

### Test Infrastructure
- Framework: Vitest
- Component testing: @testing-library/react + userEvent
- Mocking: vi.fn()
- No ToggleGroup shadcn component installed -- use button-based selector with aria attributes

### Design Constraints (from DESIGN.md)
- Button-like elements: `rounded-md`, `text-sm`
- Dense spacing: `gap-1.5` between inline items
- Active/selected state: use `bg-primary text-primary-foreground` or `bg-accent`
- Icons: Lucide, `size-4` (16px)
- Accessibility: focus-visible ring, keyboard navigable

---

## Outer Test (Integration)

**Write this test FIRST. It stays RED until all layers are built and wired.**

### Scenario

<!-- -------- bee-comment -------- -->
> **@developer**: will se show the charts in a drop down? Where will show it, and how many chart types will be shown?
> **@bee**: Not a dropdown — a horizontal row of 6 small toggle buttons (Bar, Line, Area, Pie, KPI Card, Table). Placed between the title and the chart/table area. The active type gets `bg-primary` styling; the rest are `bg-secondary`. This keeps all options visible at a glance without an extra click. 6 types = the full set from Phase 3.
> - [x] mark as resolved
<!-- -------- /bee-comment -------- -->

User asks a question. Backend responds with `chartType: "bar"`. WorkspacePage renders a bar chart AND a horizontal row of 6 chart type toggle buttons (Bar, Line, Area, Pie, KPI Card, Table) between the title and the chart, with "Bar" pre-selected. User clicks "Line" in the selector. The bar chart disappears and a line chart renders. No new query is made to the backend.

### Test Specification
- Test location: `packages/frontend/src/components/workspace/WorkspacePage.test.tsx`
- Test name: `test('chart type selector switches visualization without re-querying')`

### Setup
- Mock: `QueryPort` returning canned response with `chartType: "bar"`
- Canned data: Two rows with dimension + measure (reuse existing `cannedResponse`)

### Actions
1. User types question, clicks Ask
2. Wait for bar chart to render
3. Assert selector is visible with "Bar" indicated as active
4. User clicks "Line" button in the selector
5. Assert line chart renders, bar chart gone
6. Assert `port.submitQuery` was called exactly once (no re-query)

### Assertions
- [x] Chart type selector is visible after query response
- [x] AI-recommended type ("bar") is pre-selected
- [x] Clicking "Line" renders line chart, removes bar chart
- [x] `submitQuery` call count remains 1

### Expected Failure Progression
| After Layer | Expected Failure |
|-------------|-----------------|
| (none) | "Unable to find element with data-testid chart-type-selector" |
| Domain constants | Same -- no UI yet |
| ChartTypeSelector component | Selector renders but clicking does nothing (no state wiring) |
| WorkspacePage state wiring | PASSES |

---

## Layer 1: Domain — Chart Type Constants (Pure)

### 1.0 Pure Test: CHART_TYPES constant provides label and value for all six types

**Behavior**: A constant array defines the available chart types with display labels and values. Pure data, no logic.

- [x] **RED**: Write test
  - Location: `packages/frontend/src/domain/chart-types.test.ts` (new file)
  - Test name: `test('CHART_TYPES includes all six visualization types with labels')`
  - Assert: Array has 6 entries; each has `value` and `label`; values are `bar`, `line`, `area`, `pie`, `kpi_card`, `table`

- [x] **RUN**: Confirm test FAILS (module does not exist)

- [x] **GREEN**: Implement
  - Location: `packages/frontend/src/domain/chart-types.ts` (new file)
  - Export `CHART_TYPES` as a typed constant array: `{ value: ChartTypeValue; label: string }[]`
  - Export `ChartTypeValue` type union: `'bar' | 'line' | 'area' | 'pie' | 'kpi_card' | 'table'`
  - Labels: "Bar", "Line", "Area", "Pie", "KPI Card", "Table"

- [x] **RUN**: Confirm test PASSES

- [x] **ARCHITECTURE CHECK**: File has zero imports from outside domain

### After Layer 1
- [x] **RUN OUTER TEST**: Still fails -- no selector UI yet

---

## Layer 2: UI Component — ChartTypeSelector

### 2.0 Unit Test: Renders a button for each chart type

**Behavior**: Given the list of chart types and a selected value, render a button/toggle for each

- [x] **RED**: Write test
  - Location: `packages/frontend/src/components/workspace/ChartTypeSelector.test.tsx` (new file)
  - Test name: `test('renders a button for each chart type')`
  - Props: `selected="bar"`, `onSelect={vi.fn()}`
  - Assert: Six buttons visible with accessible names matching labels; container has `data-testid="chart-type-selector"`

- [x] **RUN**: Confirm test FAILS (component does not exist)

- [x] **GREEN**: Implement `ChartTypeSelector`
  - Location: `packages/frontend/src/components/workspace/ChartTypeSelector.tsx` (new file)
  - Props: `{ selected: ChartTypeValue; onSelect: (type: ChartTypeValue) => void }`
  - Render: `CHART_TYPES.map(...)` producing buttons with `aria-pressed` for selected state
  - Design: row of buttons using `gap-1.5`, `text-sm`, `rounded-md`, `px-2 py-1.5`

- [x] **RUN**: Confirm test PASSES

### 2.1 Unit Test: Selected type has visual indication (aria-pressed)

**Behavior**: The button matching `selected` prop has `aria-pressed="true"`, others have `aria-pressed="false"`

- [x] **RED**: Write test
  - Test name: `test('selected chart type button has aria-pressed true')`
  - Props: `selected="pie"`, `onSelect={vi.fn()}`
  - Assert: "Pie" button has `aria-pressed="true"`; "Bar" button has `aria-pressed="false"`

- [x] **RUN**: Confirm test FAILS or PASSES (depends on 2.0 implementation)

- [x] **GREEN**: Ensure each button sets `aria-pressed={type.value === selected}`

- [x] **RUN**: Confirm test PASSES

### 2.2 Unit Test: Clicking a button calls onSelect with the chart type value

**Behavior**: Clicking a non-selected button fires `onSelect` with that type's value

- [x] **RED**: Write test
  - Test name: `test('clicking a chart type button calls onSelect with its value')`
  - Props: `selected="bar"`, `onSelect={vi.fn()}`
  - Action: Click the "Line" button
  - Assert: `onSelect` called with `'line'`

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Wire `onClick={() => onSelect(type.value)}` on each button

- [x] **RUN**: Confirm test PASSES

### 2.3 Unit Test: Selected button has distinct visual styling

**Behavior**: The active button uses primary colors, inactive buttons use secondary/ghost styling

- [x] **RED**: Write test
  - Test name: `test('selected button has primary styling, others have secondary')`
  - Props: `selected="area"`, `onSelect={vi.fn()}`
  - Assert: "Area" button has class containing `bg-primary`; "Bar" button does not

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Apply conditional classes: selected gets `bg-primary text-primary-foreground`, others get `bg-secondary text-secondary-foreground`

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: Clean up class logic, consider using `cn()` utility

- [x] **ARCHITECTURE CHECK**: Component imports only from `domain/chart-types.ts` (pure constant) and React. No infrastructure imports.

### After Layer 2
- [x] **RUN OUTER TEST**: Still fails -- WorkspacePage does not render the selector yet

---

## Layer 3: Wiring — WorkspacePage State Management

### 3.0 Unit Test: WorkspacePage renders ChartTypeSelector after query response

**Behavior**: After a successful query, the selector appears between the title and the chart

- [x] **RED**: Write test
  - Location: `packages/frontend/src/components/workspace/WorkspacePage.test.tsx`
  - Test name: `test('renders chart type selector after query response')`
  - Setup: Submit a question, wait for response
  - Assert: `getByTestId('chart-type-selector')` is in the document

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Import `ChartTypeSelector` in WorkspacePage, render it between the title block and the chart/table block when `response` exists. Pass `response.visualization.chartType` as `selected`.

- [x] **RUN**: Confirm test PASSES

### 3.1 Unit Test: Selector defaults to AI-recommended chart type

**Behavior**: The AI's recommended chart type is pre-selected in the selector

- [x] **RED**: Write test
  - Test name: `test('chart type selector defaults to AI-recommended type')`
  - Setup: Port returns `chartType: "pie"`, submit question
  - Assert: The "Pie" button has `aria-pressed="true"`

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Add `overrideChartType` state to WorkspacePage (initially `null`). Compute `activeChartType = overrideChartType ?? response.visualization.chartType`. Pass `activeChartType` to the selector as `selected`.

- [x] **RUN**: Confirm test PASSES

### 3.2 Integration Test: Switching chart type re-renders without re-querying (THE OUTER TEST)

This is the outer test defined above. Now it should pass with the wiring in place.

- [x] **RED**: Write the full outer test (if not already written in the outer test step)
  - Test name: `test('chart type selector switches visualization without re-querying')`
  - Setup: Port returns `chartType: "bar"`
  - Actions: Submit question, wait for bar chart, click "Line" button
  - Assert: line chart visible, bar chart gone, `submitQuery` called once

- [x] **GREEN**: In WorkspacePage, wire the `onSelect` callback to set `overrideChartType`. Pass `activeChartType` (not `response.visualization.chartType`) to the rendering logic -- both the `ChartRenderer` and the `table` conditional.

- [x] **RUN**: Confirm test PASSES

### 3.3 Unit Test: Switching to "table" shows ResultsTable instead of ChartRenderer

**Behavior**: When user selects "Table", ResultsTable renders; ChartRenderer does not

- [x] **RED**: Write test
  - Test name: `test('selecting table chart type renders ResultsTable')`
  - Setup: Port returns `chartType: "bar"`, submit question
  - Actions: Click "Table" button in selector
  - Assert: `getByRole('table')` is in document; `queryByTestId('bar-chart')` is null

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Update the rendering conditional in WorkspacePage to use `activeChartType` instead of `response.visualization.chartType`

- [x] **RUN**: Confirm test PASSES

### 3.4 Unit Test: Switching from table back to a chart type shows the chart

**Behavior**: User can go table -> bar and see the bar chart again

- [x] **RED**: Write test
  - Test name: `test('switching from table back to chart type renders chart')`
  - Setup: Port returns `chartType: "table"`, submit question
  - Actions: Click "Bar" button, then verify bar chart renders
  - Assert: `getByTestId('bar-chart')` is in document; `queryByRole('table')` is null

- [x] **RUN**: Confirm test FAILS or PASSES (depends on existing logic)

- [x] **GREEN**: Ensure the conditional uses `activeChartType` consistently

- [x] **RUN**: Confirm test PASSES

### 3.5 Edge Case: Override resets when a new query is submitted

**Behavior**: After overriding chart type, submitting a new question resets to the AI recommendation

- [x] **RED**: Write test
  - Test name: `test('override resets when new query is submitted')`
  - Setup: Port returns `chartType: "bar"` first, then `chartType: "pie"` second
  - Actions: Submit question 1, override to "Line", submit question 2
  - Assert: After second query, "Pie" button has `aria-pressed="true"` (not "Line")

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Reset `overrideChartType` to `null` when `submit` is called (or when response changes)

- [x] **RUN**: Confirm test PASSES

- [x] **ARCHITECTURE CHECK**:
  - WorkspacePage imports ChartTypeSelector (UI component) and domain type
  - No business logic leaked into WorkspacePage -- it only manages state and delegates
  - ChartTypeSelector has no knowledge of WorkspacePage or query infrastructure

### After Layer 3
- [x] **RUN ALL TESTS**: All existing + new tests pass
- [x] **RUN OUTER TEST**: PASSES

---

## Layer 4: Selector not visible before first query

### 4.0 Unit Test: Selector is NOT rendered before a query is submitted

**Behavior**: Before any query, there is no chart type selector

- [x] **RED**: Write test
  - Test name: `test('chart type selector is not visible before query')`
  - Assert: `queryByTestId('chart-type-selector')` returns null on initial render

- [x] **RUN**: Confirm test PASSES (should already work since selector only renders inside the `response &&` block)

- [x] **VERIFY**: If it already passes, this is a confirmation test -- keep it for regression

---

## Final Architecture Verification

After all tests pass, verify the dependency direction:

- [x] **Domain** (`chart-types.ts`) imports: NOTHING from outside domain
- [x] **ChartTypeSelector** imports: domain constant + React only
- [x] **WorkspacePage** imports: ChartTypeSelector, ChartRenderer, ResultsTable, ports, hooks
- [x] **No circular dependencies** between layers
- [x] **No re-query on override**: Confirmed by call-count assertion in outer test

## Test Summary
| Layer | Type | # Tests | Mocks Used | Status |
|-------|------|---------|------------|--------|
| Outer (Integration) | Integration | 1 | QueryPort | |
| Domain (chart-types) | Pure | 1 | None | |
| ChartTypeSelector | Unit | 4 | vi.fn() for onSelect | |
| WorkspacePage wiring | Unit | 5 | QueryPort | |
| **Total** | | **11** | | |

## Risk Mitigation (Moderate)

- **Edge case: Override to KPI with multi-row data** -- KPI transform already handles this (uses first row). No extra work needed.
- **Edge case: Override reset on new query** -- Covered by test 3.5
- **Edge case: No selector before first query** -- Covered by test 4.0
- **Accessibility**: `aria-pressed` on toggle buttons provides screen reader support. Keyboard navigation works via native button focus.
- **No re-query guarantee**: Outer test asserts `submitQuery` call count stays at 1 after override
[x] Reviewed
