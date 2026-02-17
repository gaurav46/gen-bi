# TDD Plan: Phase 3, Slice 2 — KPI Card

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it ([ ] → [x]).
Continue until all items are done.
If stuck after 3 attempts, mark ⚠️ and move to the next independent step.

## Context
- **Source**: `/Users/sapanparikh/Development/clients/incubyte/gen-bi/docs/specs/gen-bi-phase-3.md`
- **Phase/Slice**: Phase 3, Slice 2: KPI Card
- **Success Criteria**:
  - KPI card renders when AI picks `chartType: "kpi_card"`
  - KPI card shows the AI-generated title as label and the single value prominently
  - KPI card handles single-row, single-measure results (the typical KPI shape)
  - When result has multiple rows, KPI card shows the first row's measure value

## Codebase Analysis

### Architecture
- Current: Hexagonal architecture established in Slice 1
- Target: Add KPI card using same patterns — pure domain transform, thin UI component

### Directory Structure
| Layer | Directory | Test Directory |
|-------|-----------|----------------|
| Domain | `packages/frontend/src/domain/` | co-located `*.test.ts` |
| UI Components | `packages/frontend/src/components/workspace/` | co-located `*.test.tsx` |

### External Dependencies
- Recharts (already installed)
- shadcn/ui Card component (already available)
- @testing-library/react + Vitest (already configured)

### Test Infrastructure
- Framework: Vitest
- Mocking: vi.fn()
- Component testing: @testing-library/react

### Existing from Slice 1
- `chart-transforms.ts` — has `transformForBarLine`, `transformForPie`, `transformChartData` dispatcher
- `chart-transforms.test.ts` — 9 pure tests
- `ChartRenderer.tsx` — dispatches by chartType to chart panels
- `ChartRenderer.test.tsx` — 5 tests
- `WorkspacePage.test.tsx` — 9 tests including chart rendering tests
- Chart panel pattern: `<div data-testid="[type]-chart">` wrapper, fixed height `h-80`

---

## Outer Test (Integration)

**Write this test FIRST. It stays RED until all layers are built and wired.**

### Scenario
User asks a KPI-style question ("What is total revenue?"). Backend responds with `chartType: "kpi_card"` and a single-row, single-measure result. WorkspacePage renders the KPI card showing the title and value prominently.

### Test Specification
- Test location: `packages/frontend/src/components/workspace/WorkspacePage.test.tsx`
- Test name: `test('renders KPI card when chartType is kpi_card')`

### Setup
- Mock: `QueryPort` with `submitQuery` returning a canned response with `chartType: "kpi_card"`
- Canned data: Single row with one measure column (e.g., `{ total_revenue: 125000 }`)

### Actions
1. User types a question
2. User clicks Ask button
3. Port returns KPI response

### Assertions
- [x] KPI card element is in the document (data-testid)
- [x] Table, bar chart, line chart, pie chart are NOT rendered
- [x] SQL display is still visible (preserving existing behavior)

### Expected Failure Progression
| After Layer | Expected Failure |
|-------------|-----------------|
| (none) | "TestingLibraryElementError: Unable to find element with data-testid kpi-card" |
| Domain transform | "TypeError: Cannot read properties of null" (transformChartData returns null for kpi_card) |
| Component created | "ChartRenderer returns null for kpi_card" |
| ChartRenderer wiring | ✅ PASSES |

---

## Layer 1: Domain — KPI Transform (Pure)

### 1.0 Unit Test: transformForKpi extracts single value with label

**Behavior**: Given rows with one measure column, extract the first row's measure value and the measure name as label

- [x] **RED**: Write test
  - Location: `packages/frontend/src/domain/chart-transforms.test.ts`
  - Test name: `test('transformForKpi extracts single measure value and label')`
  - Input: `rows = [{ total_revenue: 125000 }]`, `columns = [{ name: 'total_revenue', type: 'numeric', role: 'measure' }]`
  - Assert: `{ label: 'total_revenue', value: 125000 }`

- [x] **RUN**: Confirm test FAILS (function does not exist)

- [x] **GREEN**: Implement `transformForKpi`
  - Location: `packages/frontend/src/domain/chart-transforms.ts`
  - Return type: `{ label: string; value: number }`
  - Implementation: Find first measure column, extract first row's value for that column

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: Extract return type as `KpiData` type

- [x] **ARCHITECTURE CHECK**: Function is pure — no imports from UI or infrastructure

### 1.1 Unit Test: transformForKpi handles multiple rows (takes first)

**Behavior**: When multiple rows exist, use the first row's measure value

- [x] **RED**: Write test
  - Test name: `test('transformForKpi uses first row when multiple rows exist')`
  - Input: `rows = [{ total_revenue: 125000 }, { total_revenue: 98000 }]`, same columns
  - Assert: `value` is 125000 (first row)

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Verify implementation already handles this (it does — `rows[0][measureKey]`)

- [x] **RUN**: Confirm test PASSES

### 1.2 Unit Test: transformForKpi handles empty rows

**Behavior**: Return zero value when no rows exist

- [x] **RED**: Write test
  - Test name: `test('transformForKpi returns zero for empty rows')`
  - Input: `rows = []`, measure column present
  - Assert: `{ label: 'total_revenue', value: 0 }`

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Add guard: `rows.length === 0` → return `{ label: measureKey, value: 0 }`

- [x] **RUN**: Confirm test PASSES

### 1.3 Unit Test: transformChartData dispatcher includes kpi_card

**Behavior**: `transformChartData('kpi_card', rows, columns)` calls `transformForKpi`

- [x] **RED**: Write test
  - Test name: `test('transformChartData returns KpiData for kpi_card chart type')`
  - Input: `chartType = 'kpi_card'`, single-row kpi data
  - Assert: Result has `label` and `value` properties

- [x] **RUN**: Confirm test FAILS (returns null)

- [x] **GREEN**: Add `case 'kpi_card'` to switch statement, call `transformForKpi`

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: Update `ChartData` union type to include `KpiData`

### After Layer 1
- [x] **RUN OUTER TEST**: Confirm it fails with a different error (ChartRenderer still returns null for kpi_card)
- [x] **COMMIT**: "feat(domain): add KPI card transform — pure function extracting single measure value"

---

## Layer 2: UI Component — KpiCardPanel

### 2.0 Unit Test: KpiCardPanel renders value prominently

**Behavior**: Display the measure value in large text, label as smaller text above or below

- [x] **RED**: Write test
  - Location: `packages/frontend/src/components/workspace/KpiCardPanel.test.tsx` (new file)
  - Test name: `test('renders KPI value prominently with label')`
  - Props: `{ label: 'Total Revenue', value: 125000 }`
  - Assert: value "125000" is in the document, label "Total Revenue" is in the document

- [x] **RUN**: Confirm test FAILS (component does not exist)

- [x] **GREEN**: Implement `KpiCardPanel`
  - Location: `packages/frontend/src/components/workspace/KpiCardPanel.tsx` (new file)
  - Props: `KpiData` type from domain
  - Use shadcn Card component wrapper
  - Structure (per design system):
    ```
    <div data-testid="kpi-card" className="h-80 w-full flex items-center justify-center">
      <Card className="p-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-4xl font-semibold">{value.toLocaleString()}</div>
      </Card>
    </div>
    ```
  - Design constraints (from DESIGN.md):
    - Card padding: `p-6` is acceptable for KPI cards (visual emphasis)
    - Value text: `text-4xl font-semibold` for prominence
    - Label text: `text-sm text-muted-foreground` for metadata
    - Number formatting: use `toLocaleString()` for thousands separator

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: Consider centering, spacing adjustments for visual balance

### 2.1 Unit Test: KpiCardPanel has data-testid for integration

**Behavior**: Outer test needs to find the KPI card element

- [x] **RED**: Write test
  - Test name: `test('has kpi-card data-testid')`
  - Assert: `getByTestId('kpi-card')` exists

- [x] **RUN**: Confirm test already passes (added in 2.0)

### After Layer 2
- [x] **RUN OUTER TEST**: Still fails — ChartRenderer doesn't dispatch to KpiCardPanel yet
- [x] **COMMIT**: "feat(ui): add KpiCardPanel — displays single measure prominently"

---

## Layer 3: Wiring — ChartRenderer Integration

### 3.0 Unit Test: ChartRenderer renders KpiCardPanel for kpi_card

**Behavior**: When chartType is "kpi_card", render the KPI panel

- [x] **RED**: Write test
  - Location: `packages/frontend/src/components/workspace/ChartRenderer.test.tsx`
  - Test name: `test('renders KpiCardPanel for chartType kpi_card')`
  - Props: `chartType="kpi_card"`, rows with single measure, columns with measure role
  - Assert: `getByTestId('kpi-card')` exists

- [x] **RUN**: Confirm test FAILS (returns null)

- [x] **GREEN**: Update ChartRenderer
  - Location: `packages/frontend/src/components/workspace/ChartRenderer.tsx`
  - Import `KpiCardPanel` and `KpiData` type
  - Add case to switch: `case 'kpi_card': return <KpiCardPanel {...(chartData as KpiData)} />;`

- [x] **RUN**: Confirm test PASSES

- [x] **ARCHITECTURE CHECK**: ChartRenderer depends only on component imports and domain types, no business logic

### After Layer 3
- [x] **RUN OUTER TEST**: Should PASS ✅
- [x] **COMMIT**: "feat: wire KPI card to ChartRenderer — integration complete"

---

## Final Architecture Verification

After all tests pass, verify the dependency direction:

- [x] **Domain layer** (`chart-transforms.ts`) imports: NOTHING external (pure)
- [x] **UI Component** (`KpiCardPanel.tsx`) imports: domain types, shadcn Card, React
- [x] **ChartRenderer** imports: domain types and transforms, UI components
- [x] **WorkspacePage** imports: ChartRenderer, ports, domain types
- [x] **No circular dependencies** between layers

## Test Summary
| Layer | Type | # Tests | Mocks Used | Status |
|-------|------|---------|------------|--------|
| Outer (Integration) | E2E | 1 | QueryPort | ✅ |
| Domain Core (transformForKpi) | Pure | 3 | None | ✅ |
| Domain Core (dispatcher) | Pure | 1 | None | ✅ |
| UI Component | Unit | 2 | None (pure props) | ✅ |
| ChartRenderer | Unit | 1 | None | ✅ |
| **Total** | | **8** | | ✅ |

## Design System Compliance

KpiCardPanel follows DESIGN.md constraints:

- [x] **Typography**: Value uses `text-4xl font-semibold` for prominence, label uses `text-sm text-muted-foreground`
- [x] **Spacing**: Card uses `p-6` for visual breathing room (exception to dense p-3 rule for emphasis)
- [x] **Component**: Uses shadcn Card component from existing inventory
- [x] **Accessibility**: Proper semantic HTML, readable contrast between label and value
- [x] **Number formatting**: `toLocaleString()` for thousands separators (125,000 not 125000)

## Risk Mitigation (Moderate Risk Level)

- **Edge case: No measure columns** — Domain transform handles empty columns gracefully (returns empty label, 0 value)
- **Edge case: Multiple measures** — Uses first measure column (matches pie chart behavior)
- **Edge case: Null value in first row** — Number coercion converts null to 0
- **Consistency with existing charts** — Follows same pattern as bar/line/pie (testid, height, transform→component flow)

---

## Teaching Moment

This slice demonstrates the same outside-in progression as Slice 1:
1. **Outer test first** — WorkspacePage integration test written before any implementation
2. **Domain emerges pure** — `transformForKpi` is testable with zero mocks, no UI awareness
3. **Component is thin** — KpiCardPanel just displays, no logic
4. **Wiring is last** — ChartRenderer switch case connects the layers

The architecture stays hexagonal: domain transform (pure) → UI component (thin) → renderer (dispatcher). Adding a new chart type doesn't require changing existing chart code — we just add a new case to the switch and a new transform function.

[x] Reviewed
