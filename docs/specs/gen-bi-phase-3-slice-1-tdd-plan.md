# TDD Plan: Phase 3, Slice 1 -- Data Transformer + Bar, Line, Area, Pie Charts

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it ([ ] -> [x]).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

## Context
- **Source**: `docs/specs/gen-bi-phase-3.md`
- **Phase/Slice**: Phase 3, Slice 1
- **Risk Level**: MODERATE
- **Success Criteria**:
  1. Bar chart renders when AI recommends `chartType: "bar"`
  2. Line chart renders when AI recommends `chartType: "line"`
  3. Area chart renders when AI recommends `chartType: "area"`
  4. Pie chart renders when AI recommends `chartType: "pie"`
  5. Data transformer reshapes rows per chart type using column roles
  6. Charts use `--chart-1` through `--chart-5` CSS variables
  7. Multiple measures render as grouped bars / multiple lines / stacked areas
  8. Pie chart uses first measure only when multiple measures exist
  9. Table still renders as fallback when `chartType: "table"`
  10. Chart shows below the title, above the SQL display

## Codebase Analysis

### Existing Patterns
| Pattern | Example |
|---------|---------|
| Pure domain transforms | `domain/query-transforms.ts` (formatCellValue, isNumericType) |
| Pure domain tests | `domain/query-transforms.test.ts` (input -> output, no mocks) |
| Component with port injection | `WorkspacePage.tsx` (receives `QueryPort` as prop) |
| Component unit tests | `WorkspacePage.test.tsx` (mock port, render, assert DOM) |
| Types | `domain/query-types.ts` (QueryResponse with columns/rows/visualization) |

### Directory Structure
| Layer | Directory | Test Location |
|-------|-----------|---------------|
| Domain (transforms) | `packages/frontend/src/domain/` | co-located `.test.ts` |
| Components (charts) | `packages/frontend/src/components/workspace/` | co-located `.test.tsx` |
| Page (orchestration) | `packages/frontend/src/components/workspace/` | co-located `.test.tsx` |

### External Dependencies
- **recharts** -- needs `pnpm add recharts` before any chart work
- No backend changes needed

### Test Infrastructure
- Framework: Vitest (globals: true, jsdom environment)
- Rendering: @testing-library/react + @testing-library/user-event
- Mocking: vi.fn(), vi.mock()
- Setup: `src/test-setup.ts` (ResizeObserver polyfill already present -- needed by Recharts)

### Architecture Note
This slice is frontend-only. The "onion" maps to:
- **Domain core** (pure): data transform functions in `domain/`
- **Components** (adapters): chart components that consume transformed data
- **Page** (orchestration): `WorkspacePage` decides which component to render

No port interfaces are needed between layers here -- the domain is pure functions called directly by components. The existing `QueryPort` already delivers data from the backend.

---

## Step 0: Install recharts

- [x] Run `cd packages/frontend && pnpm add recharts`
- [x] Verify recharts appears in `package.json` dependencies

---

## Outer Test (Integration): WorkspacePage renders chart by chartType

**Write this test FIRST. It stays RED until all layers are built and wired.**

### Scenario
User submits a question. Backend returns a response with `chartType: "bar"`. WorkspacePage renders a bar chart (not a table). Title appears above the chart, SQL display appears below.

### Test Location
`packages/frontend/src/components/workspace/WorkspacePage.test.tsx`

Extend the existing test file with new test cases.

### Step 0.1: Outer test -- bar chart renders for chartType "bar"

- [x] **RED**: Add test to existing `WorkspacePage.test.tsx`
  - Name: `test('renders bar chart when chartType is bar')`
  - Setup: mock port returns response with `chartType: "bar"`, dimension + measure columns, sample rows
  - Action: type question, click Ask
  - Assert: title visible, a `[data-testid="bar-chart"]` element present, ResultsTable NOT present
  - Assert: SQL display still present below chart

- [x] **RUN**: Confirm test FAILS (no chart component exists yet)

### Step 0.2: Outer test -- table still renders for chartType "table"

- [x] **RED**: Add test
  - Name: `test('renders table when chartType is table')`
  - Setup: mock port returns response with `chartType: "table"`
  - Action: type question, click Ask
  - Assert: table headers/rows visible, no chart testid present

- [x] **RUN**: Confirm test PASSES (regression guard — existing behavior already renders table)

### Expected Failure Progression
| After Layer | Expected Failure |
|-------------|-----------------|
| (now) | `bar-chart` testid not found |
| Domain transforms | Still fails -- transforms exist but no component renders them |
| Chart components | Still fails -- components exist but WorkspacePage does not use them |
| WorkspacePage wiring | PASSES |

---

## Layer 1: Domain Core (Pure Transforms)

**Pure functions. No mocks. Input -> output.**

These are the innermost layer. Build them first because they have zero dependencies.

### 1.1 Transform type definitions

- [x] **CREATE** types for transform output in `packages/frontend/src/domain/chart-transforms.ts`
  - `BarLineAreaData`: `{ data: Record<string, unknown>[], dimensionKey: string, measureKeys: string[] }`
  - `PieData`: `{ data: { name: string, value: number }[] }`
  - A union or discriminated type to cover both shapes

### 1.2 Pure test: transformForBarLine -- single measure

- [x] **RED**: Write test in `packages/frontend/src/domain/chart-transforms.test.ts`
- [x] **GREEN**: Implement `transformForBarLine` in `chart-transforms.ts`
- [x] **RUN**: Confirm PASSES

### 1.3 Pure test: transformForBarLine -- multiple measures

- [x] **RED**: Write test
- [x] **RUN**: Confirm PASSES (implemented generically)

### 1.4 Pure test: transformForPie -- basic

- [x] **RED**: Write test
- [x] **GREEN**: Implement `transformForPie` in `chart-transforms.ts`
- [x] **RUN**: Confirm PASSES

### 1.5 Pure test: transformForPie -- multiple measures uses first only

- [x] **RED**: Write test
- [x] **RUN**: Confirm PASSES (picks first measure)

### 1.6 Pure test: edge case -- empty rows

- [x] **RED**: Write test
- [x] **RUN**: Confirm PASSES

### 1.7 Pure test: selector function for chart type

- [x] **RED**: Write test
- [x] **GREEN**: Implement `transformChartData` dispatcher
- [x] **RUN**: Confirm PASSES (9 tests total)

### After Layer 1
- [x] **ARCHITECTURE CHECK**: `chart-transforms.ts` imports NOTHING from components, adapters, or infrastructure. Only imports from `domain/query-types`.
- [x] **RUN OUTER TEST**: Still fails -- transforms exist but WorkspacePage does not use them yet.

---

## Layer 2: Chart Components (Adapters)

Thin Recharts wrappers. Each takes pre-transformed data and renders.

### 2.1 BarChart component

- [x] **RED + GREEN**: BarChartPanel — test + implementation, PASSES
- [x] **REFACTOR**: Extracted `CHART_COLORS` to `domain/chart-colors.ts` upfront

### 2.2 LineChart component
- [x] **RED + GREEN**: LineChartPanel — test + implementation, PASSES

### 2.3 AreaChart component
- [x] **RED + GREEN**: AreaChartPanel — test + implementation, PASSES

### 2.4 PieChart component
- [x] **RED + GREEN**: PieChartPanel — test + implementation, PASSES

### 2.5 Extract shared chart color constants
- [x] **REFACTOR**: `CHART_COLORS` in `domain/chart-colors.ts` — used by all 4 chart panels

### After Layer 2
- [x] **ARCHITECTURE CHECK**: Chart components import only from `recharts` and domain types.

---

## Layer 3: Wiring -- WorkspacePage orchestration

### 3.1 ChartRenderer component (routing by chartType)
- [x] **RED + GREEN**: ChartRenderer — 5 tests (bar, line, area, pie, table=null), all PASS

### 3.2 Update WorkspacePage to use ChartRenderer
- [x] **GREEN**: WorkspacePage wired — renders ChartRenderer for charts, ResultsTable for table
- [x] **RUN OUTER TEST**: bar chart test PASSES
- [x] **RUN OUTER TEST**: table fallback test PASSES

### 3.3 Additional outer tests for line, area, pie
- [x] **ADD + RUN**: All 3 outer tests added and PASS

---

## Final Verification

- [x] **RUN ALL TESTS**: `pnpm test` — 127 frontend tests pass (24 files), 112 backend tests pass (17 files)
- [x] **ARCHITECTURE CHECK**:
  - `domain/chart-transforms.ts` imports only from `domain/query-types`
  - `domain/chart-transforms.test.ts` has zero mocks — pure input/output
  - Chart panel components import only from recharts + domain/chart-colors + domain/chart-transforms (types)
  - `ChartRenderer` imports chart panels + domain transforms
  - `WorkspacePage` imports `ChartRenderer` and `ResultsTable` — delegates rendering
  - No circular dependencies

## Test Summary
| Layer | Type | Tests | Mocks Used |
|-------|------|-------|------------|
| Outer (WorkspacePage) | Integration | 5 | QueryPort (existing mock) |
| Domain (transforms) | Pure | ~6 | None |
| Chart components | Unit | 4 | None (render test) |
| ChartRenderer | Unit | 5 | None (render test) |
| **Total** | | **~20** | |

[x] Reviewed
