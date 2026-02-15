# TDD Plan: Phase 1, Slice 5 -- Schema Explorer UI

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it ([ ] -> [x]).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

## Context
- **Source**: `docs/specs/gen-bi-phase-1.md` -- Slice 5
- **Design Brief**: `.claude/DESIGN.md`
- **Risk Level**: HIGH
- **Success Criteria**:
  1. App shell with collapsible sidebar navigation (Schema Explorer + Settings)
  2. Schema Explorer page shows tables in a searchable list panel
  3. Clicking a table shows column detail in a right panel (name, type, nullable, FK, index indicators)
  4. Tables fetched from GET /api/schema/:connectionId/tables
  5. Loading states use Skeleton components
  6. Keyboard navigation works for sidebar and table list
  7. Dense spacing from design brief applied consistently

## Codebase Analysis

### Architecture
- **Current**: Flat component structure. `App.tsx` renders `<SettingsForm />` directly. No routing, no layout shell.
- **Target**: Onion architecture for frontend -- pure domain types + port interfaces + UI adapters.

### Existing API Contract
The backend `GET /api/schema/:connectionId/tables` returns:
```ts
Array<{
  id: string;
  connectionId: string;
  schemaName: string;
  tableName: string;
  columns: Array<{ columnName: string; dataType: string; isNullable: boolean; ordinalPosition: number }>;
  foreignKeys: Array<{ columnName: string; foreignTableSchema: string; foreignTableName: string; foreignColumnName: string; constraintName: string }>;
  indexes: Array<{ indexName: string; columnName: string; isUnique: boolean }>;
}>
```

### Directory Structure (Target)

| Layer | Directory | Test Directory |
|-------|-----------|----------------|
| Domain (types, transforms) | `src/domain/` | co-located `*.test.ts` |
| Ports (data fetching interfaces) | `src/ports/` | tested via hook/component tests |
| Hooks (use case adapters) | `src/hooks/` | co-located `*.test.ts` |
| Components (UI adapters) | `src/components/` | co-located `*.test.tsx` |
| UI primitives (shadcn) | `src/components/ui/` | not tested (third-party) |

### Test Infrastructure
- Framework: Vitest (globals: true, jsdom)
- Rendering: @testing-library/react + user-event
- Mocking: vi.fn(), vi.stubGlobal('fetch', ...)
- Setup: `src/test-setup.ts` (jest-dom matchers + localStorage mock)
- Run: `pnpm --filter frontend exec vitest run`

### External Dependencies to Mock (in outer test)
- `fetch` for `GET /api/schema/:connectionId/tables` (backend API)
- `localStorage` for `connectionId` (already mocked in test-setup)

---

## Outer Test (Integration)

**Write this test FIRST. It stays RED until all layers are built and wired.**

### Scenario
User has a saved connection with analyzed tables. They see an app shell with a sidebar. They navigate to Schema Explorer, see a list of tables grouped by schema, search to filter tables, click a table, and see its column details with type, nullable, FK, and index indicators.

### Test Specification
- Test location: `packages/frontend/src/App.integration.test.tsx`
- Test name: `test('user browses schema explorer: sees tables, searches, views column detail')`

### Setup
- `localStorage.setItem('connectionId', 'conn-1')`
- Mock `fetch` to return tables data for `GET /api/schema/conn-1/tables`
- Mock `fetch` to return saved connection for `GET /api/connections/conn-1`

### Actions
1. Render `<App />`
2. Verify sidebar shows "Schema Explorer" and "Settings" nav items
3. Click "Schema Explorer" nav item (should be default/active)
4. Wait for table list to appear
5. Type a search term to filter tables
6. Click a table to see column detail
7. Verify column detail shows name, type, nullable, FK, index indicators

### Assertions
- [x] Sidebar renders with "Schema Explorer" and "Settings" navigation items
- [x] Table list displays table names grouped by schema
- [x] Search input filters the table list
- [x] Clicking a table shows column detail panel
- [x] Column detail shows column name, data type, nullable flag
- [x] FK relationships shown on relevant columns
- [x] Indexed columns visually distinguished

### Expected Failure Progression
| After Layer | Expected Failure |
|-------------|-----------------|
| (none) | No sidebar, no schema explorer rendered |
| App Shell + Sidebar | "Schema Explorer page not implemented" |
| Schema Explorer page | "Tables not fetched / not rendered" |
| Table list + detail | Outer test PASSES |

### Test Data Shape
Two tables, one with FK and index, to exercise all visual indicators:
```ts
const mockTables = [
  {
    id: 't1', connectionId: 'conn-1', schemaName: 'public', tableName: 'users',
    columns: [
      { columnName: 'id', dataType: 'int4', isNullable: false, ordinalPosition: 1 },
      { columnName: 'email', dataType: 'varchar', isNullable: false, ordinalPosition: 2 },
      { columnName: 'name', dataType: 'varchar', isNullable: true, ordinalPosition: 3 },
    ],
    foreignKeys: [],
    indexes: [{ indexName: 'users_pkey', columnName: 'id', isUnique: true }],
  },
  {
    id: 't2', connectionId: 'conn-1', schemaName: 'public', tableName: 'orders',
    columns: [
      { columnName: 'id', dataType: 'int4', isNullable: false, ordinalPosition: 1 },
      { columnName: 'user_id', dataType: 'int4', isNullable: false, ordinalPosition: 2 },
      { columnName: 'total', dataType: 'numeric', isNullable: true, ordinalPosition: 3 },
    ],
    foreignKeys: [{ columnName: 'user_id', foreignTableSchema: 'public', foreignTableName: 'users', foreignColumnName: 'id', constraintName: 'orders_user_id_fkey' }],
    indexes: [{ indexName: 'orders_pkey', columnName: 'id', isUnique: true }],
  },
];
```

- [x] **Write the outer integration test** at `packages/frontend/src/App.integration.test.tsx`
- [x] **RUN**: Confirm it FAILS (App renders SettingsForm, no sidebar)

---

## Pre-requisite: Install shadcn Components

Before building any layers, install the required shadcn components.

- [x] Run: `cd packages/frontend && npx shadcn@latest add sidebar table badge tooltip collapsible scroll-area separator skeleton sonner dialog select tabs`
- [x] Verify the new components exist in `packages/frontend/src/components/ui/`
- [x] **RUN existing tests**: `pnpm --filter frontend exec vitest run` -- confirm all 20 SettingsForm tests still pass

---

## Layer 1: Domain Types (Pure)

**Pure types and transformation functions. No I/O. No React. No mocks.**

### 1.1 Domain: Table and Column Types

- [x] **CREATE** domain types file at `packages/frontend/src/domain/schema-types.ts`
  - `DiscoveredTable` type matching API response shape
  - `DiscoveredColumn`, `DiscoveredForeignKey`, `DiscoveredIndex` types
  - `ColumnDisplayInfo` type -- enriched column with resolved FK and index info for display

### 1.2 Domain: Pure Transform -- enrichColumnsForDisplay

**Behavior**: Given a table's columns, foreignKeys, and indexes, produce an array of `ColumnDisplayInfo` with FK target and index type resolved per column.

- [x] **RED**: Write pure test at `packages/frontend/src/domain/schema-transforms.test.ts`
  - Test: `'enriches columns with FK and index info'`
  - Input: columns array + foreignKeys array + indexes array
  - Assert: each column has `foreignKey` (resolved target or null) and `indexType` (PK/UQ/IDX or null)

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Implement `enrichColumnsForDisplay()` at `packages/frontend/src/domain/schema-transforms.ts`
  - **PURITY CHECK**: No imports from React, no fetch, no hooks

- [x] **RUN**: Confirm test PASSES

### 1.3 Domain: Pure Transform -- groupTablesBySchema

**Behavior**: Given flat array of tables, group them by `schemaName` into a `Map<string, DiscoveredTable[]>`.

- [x] **RED**: Write pure test
  - Test: `'groups tables by schema name'`
  - Input: flat array with tables from multiple schemas
  - Assert: returns Map with schema names as keys, tables as values

- [x] **RUN**: Confirm FAILS
- [x] **GREEN**: Implement `groupTablesBySchema()`
- [x] **RUN**: Confirm PASSES

### 1.4 Domain: Pure Transform -- filterTablesByName

**Behavior**: Given tables array and search term, return tables whose name contains the term (case-insensitive).

- [x] **RED**: Write pure test
  - Test: `'filters tables by name case-insensitively'`
  - Test: `'returns all tables when search is empty'`

- [x] **RUN**: Confirm FAILS
- [x] **GREEN**: Implement `filterTablesByName()`
- [x] **RUN**: Confirm PASSES

- [x] **ARCHITECTURE CHECK**: All domain files import nothing from outside `src/domain/`
- [x] **COMMIT**: "feat(domain): schema types and pure transform functions"

---

## Layer 2: Port Interface -- SchemaDataPort

Define the contract for fetching schema data. This port is consumed by hooks.

- [x] **CREATE PORT INTERFACE** at `packages/frontend/src/ports/schema-data-port.ts`
  - Interface: `SchemaDataPort`
  - Method: `fetchTables(connectionId: string): Promise<DiscoveredTable[]>`
  - Imports only from `src/domain/schema-types.ts`

---

## Layer 3: Use Case Hook -- useSchemaExplorer

This is the application logic layer. It orchestrates fetching via the port and transforms via domain functions.

### 3.0 Define Port: SchemaDataPort (done in Layer 2)

### 3.1 Hook Test: fetches and exposes tables

**Behavior**: Hook calls port to fetch tables, exposes loading/data/error state, groups by schema, supports search filtering and table selection.

- [x] **RED**: Write test at `packages/frontend/src/hooks/useSchemaExplorer.test.ts`
  - Test: `'fetches tables on mount and exposes grouped data'`
  - Mock: `SchemaDataPort` (the interface, not fetch directly)
  - Assert: returns `{ tables, groupedTables, isLoading, error }`

- [x] **RUN**: Confirm FAILS

- [x] **GREEN**: Implement `useSchemaExplorer` at `packages/frontend/src/hooks/useSchemaExplorer.ts`
  - Takes `SchemaDataPort` and `connectionId` as parameters
  - Calls `port.fetchTables(connectionId)` on mount
  - Uses `groupTablesBySchema` from domain
  - Exposes `searchTerm`, `setSearchTerm`, `filteredTables` (uses `filterTablesByName`)
  - Exposes `selectedTable`, `setSelectedTable`
  - Exposes `isLoading`, `error`

- [x] **RUN**: Confirm PASSES

### 3.2 Hook Test: filters tables by search term

- [x] **RED**: Test: `'filters tables when search term changes'`
- [x] **RUN**: Confirm FAILS
- [x] **GREEN**: Update hook to apply `filterTablesByName` with `searchTerm`
- [x] **RUN**: Confirm PASSES

### 3.3 Hook Test: handles loading and error states

- [x] **RED**: Test: `'exposes isLoading=true while fetching'`
- [x] **RED**: Test: `'exposes error when fetch fails'`
- [x] **RUN**: Confirm FAILS
- [x] **GREEN**: Implement loading/error state management
- [x] **RUN**: Confirm PASSES

- [x] **ARCHITECTURE CHECK**:
  - Hook imports domain types and transforms (real, not mocked)
  - Hook depends on `SchemaDataPort` interface (injected, mocked in tests)
  - Hook does NOT import fetch or any infrastructure

- [x] **COMMIT**: "feat(hooks): useSchemaExplorer hook with port injection"

---

## Layer 4: UI Components (Inbound Adapters)

Build from small to large: detail panel, table list, schema explorer page, app shell.

### 4.1 Component: ColumnDetailPanel

**Behavior**: Renders a table of columns with name, type, nullable, FK, and index indicators.

- [x] **RED**: Write test at `packages/frontend/src/components/schema-explorer/ColumnDetailPanel.test.tsx`
  - Test: `'renders column names and data types'`
  - Input: table with columns, foreignKeys, indexes (as props)
  - Assert: column names visible, data types visible

- [x] **RUN**: Confirm FAILS

- [x] **GREEN**: Implement `ColumnDetailPanel` at `packages/frontend/src/components/schema-explorer/ColumnDetailPanel.tsx`
  - Props: `{ table: DiscoveredTable }`
  - Uses `enrichColumnsForDisplay()` from domain
  - Renders dense table per design brief specs (px-3 py-1.5, font-mono for types)

- [x] **RUN**: Confirm PASSES

- [x] **RED**: Test: `'shows nullable flag for nullable columns'`
- [x] **RUN**: FAILS -> **GREEN** -> PASSES

- [x] **RED**: Test: `'shows FK indicator with target table reference'`
- [x] **RUN**: FAILS -> **GREEN** -> PASSES

- [x] **RED**: Test: `'shows index indicator (PK/UQ/IDX badge)'`
- [x] **RUN**: FAILS -> **GREEN** -> PASSES

- [x] **REFACTOR**: Apply design brief styling -- header text-xs uppercase, monospace column names, Badge for index type

### 4.2 Component: TableListPanel

**Behavior**: Renders a scrollable, searchable list of tables. Clicking a table calls onSelect.

- [x] **RED**: Write test at `packages/frontend/src/components/schema-explorer/TableListPanel.test.tsx`
  - Test: `'renders table names from provided list'`
  - Input: tables array + onSelect callback + searchTerm + onSearchChange
  - Assert: table names visible

- [x] **RUN**: Confirm FAILS

- [x] **GREEN**: Implement `TableListPanel` at `packages/frontend/src/components/schema-explorer/TableListPanel.tsx`
  - Props: `{ tables, selectedTableId, onSelect, searchTerm, onSearchChange }`
  - Search input at top with Search icon
  - Table2 icon + table name for each item
  - Highlight selected item

- [x] **RUN**: Confirm PASSES

- [x] **RED**: Test: `'calls onSelect when a table is clicked'`
- [x] **RUN**: FAILS -> **GREEN** -> PASSES

- [x] **RED**: Test: `'renders search input that calls onSearchChange'`
- [x] **RUN**: FAILS -> **GREEN** -> PASSES

- [x] **RED**: Test: `'highlights the selected table'`
- [x] **RUN**: FAILS -> **GREEN** -> PASSES

- [x] **RED**: Test: `'supports keyboard navigation through table list'`
  - Assert: arrow keys move focus, Enter selects
- [x] **RUN**: FAILS -> **GREEN** -> PASSES

### 4.3 Component: SchemaExplorerPage

**Behavior**: Composes TableListPanel + ColumnDetailPanel. Receives hook state as props (or uses hook internally with injected port).

- [x] **RED**: Write test at `packages/frontend/src/components/schema-explorer/SchemaExplorerPage.test.tsx`
  - Test: `'renders table list and detail panel side by side'`
  - Mock: `SchemaDataPort` to return test tables
  - Assert: table list visible, clicking table shows column detail

- [x] **RUN**: Confirm FAILS

- [x] **GREEN**: Implement `SchemaExplorerPage` at `packages/frontend/src/components/schema-explorer/SchemaExplorerPage.tsx`
  - Uses `useSchemaExplorer` hook with injected port
  - Layout: left panel (w-72) + right panel (flex-1)
  - Gets connectionId from localStorage

- [x] **RUN**: Confirm PASSES

- [x] **RED**: Test: `'shows Skeleton loading state while fetching tables'`
- [x] **RUN**: FAILS -> **GREEN** -> PASSES

- [x] **RED**: Test: `'shows error message when fetch fails'`
- [x] **RUN**: FAILS -> **GREEN** -> PASSES

- [x] **RED**: Test: `'shows empty state when no tables exist'`
- [x] **RUN**: FAILS -> **GREEN** -> PASSES

### 4.4 Component: AppSidebar

**Behavior**: Sidebar with Schema Explorer and Settings nav items. Collapsible.

- [x] **RED**: Write test at `packages/frontend/src/components/app-shell/AppSidebar.test.tsx`
  - Test: `'renders Schema Explorer and Settings navigation items'`
  - Assert: both nav items visible with correct icons

- [x] **RUN**: Confirm FAILS

- [x] **GREEN**: Implement `AppSidebar` at `packages/frontend/src/components/app-shell/AppSidebar.tsx`
  - Uses shadcn Sidebar component
  - Two items: Database icon + "Schema Explorer", Settings icon + "Settings"
  - Active state styling per design brief

- [x] **RUN**: Confirm PASSES

- [x] **RED**: Test: `'calls onNavigate when nav item is clicked'`
- [x] **RUN**: FAILS -> **GREEN** -> PASSES

- [x] **RED**: Test: `'highlights the active navigation item'`
- [x] **RUN**: FAILS -> **GREEN** -> PASSES

- [x] **RED**: Test: `'supports keyboard navigation between nav items'`
- [x] **RUN**: FAILS -> **GREEN** -> PASSES

### 4.5 Component: AppShell

**Behavior**: Layout wrapper with sidebar + main content area. Renders current page based on active nav item.

- [x] **RED**: Write test at `packages/frontend/src/components/app-shell/AppShell.test.tsx`
  - Test: `'renders sidebar and main content area'`
  - Assert: sidebar present, main content area present

- [x] **RUN**: Confirm FAILS

- [x] **GREEN**: Implement `AppShell` at `packages/frontend/src/components/app-shell/AppShell.tsx`
  - Wraps sidebar + content in flex layout
  - Uses shadcn SidebarProvider
  - Manages active page state (schema-explorer | settings)
  - Renders SchemaExplorerPage or SettingsForm based on active page

- [x] **RUN**: Confirm PASSES

- [x] **RED**: Test: `'switches between Schema Explorer and Settings pages'`
- [x] **RUN**: FAILS -> **GREEN** -> PASSES

- [x] **COMMIT**: "feat(ui): schema explorer components -- detail panel, table list, page, sidebar, app shell"

---

## Layer 5: Outbound Adapter -- FetchSchemaDataAdapter

Implements `SchemaDataPort` using `fetch`.

- [x] **RED**: Write test at `packages/frontend/src/adapters/fetch-schema-data-adapter.test.ts`
  - Test: `'fetches tables from /api/schema/:connectionId/tables'`
  - Mock: `fetch` via vi.stubGlobal
  - Assert: calls correct URL, returns parsed response

- [x] **RUN**: Confirm FAILS

- [x] **GREEN**: Implement `FetchSchemaDataAdapter` at `packages/frontend/src/adapters/fetch-schema-data-adapter.ts`
  - Implements `SchemaDataPort`
  - `fetchTables(connectionId)` calls `fetch(`/api/schema/${connectionId}/tables`)`
  - Parses JSON, returns `DiscoveredTable[]`

- [x] **RUN**: Confirm PASSES

- [x] **RED**: Test: `'throws error when response is not ok'`
- [x] **RUN**: FAILS -> **GREEN** -> PASSES

- [x] **ARCHITECTURE CHECK**: Adapter imports only the port interface and domain types. No React.

- [x] **COMMIT**: "feat(adapter): fetch-based schema data adapter"

---

## Wiring Phase

Connect all layers: App.tsx uses AppShell, which uses real adapter.

- [x] **Update App.tsx**: Replace `<SettingsForm />` with `<AppShell />`
  - AppShell creates `FetchSchemaDataAdapter` and passes to SchemaExplorerPage
  - AppShell renders SettingsForm when Settings is the active page

- [x] **RUN OUTER TEST**: `packages/frontend/src/App.integration.test.tsx` -- confirm it PASSES

- [x] **RUN ALL TESTS**: `pnpm --filter frontend exec vitest run`
  - Confirm outer integration test passes
  - Confirm all SettingsForm tests still pass (20 tests)
  - Confirm all new unit tests pass

- [x] **COMMIT**: "feat: wire schema explorer -- integration test green"

---

## Post-Wiring: Edge Cases and Robustness (HIGH risk items)

### Error States

- [x] **RED**: Test in SchemaExplorerPage: `'shows retry action when fetch fails'`
- [x] **GREEN**: Add retry button that re-fetches
- [x] **RUN**: PASSES

### No Connection State

- [x] **RED**: Test in SchemaExplorerPage: `'shows prompt to connect when no connectionId in localStorage'`
- [x] **GREEN**: Check localStorage, show "Connect a database first" message
- [x] **RUN**: PASSES

### Empty Search Results

- [x] **RED**: Test in TableListPanel: `'shows no results message when search matches nothing'`
- [x] **GREEN**: Render "No tables match" message
- [x] **RUN**: PASSES

### Large Table Count

- [x] **RED**: Test in TableListPanel: `'renders 100+ tables without performance issues'`
- [x] **GREEN**: Verify ScrollArea wraps the list (already in plan)
- [x] **RUN**: PASSES

- [x] **COMMIT**: "feat: schema explorer edge cases and error handling"

---

## Final Architecture Verification

After all tests pass, verify the dependency direction:

- [x] **Domain** (`src/domain/`): imports NOTHING from outside its own directory
- [x] **Ports** (`src/ports/`): imports only from `src/domain/`
- [x] **Hooks** (`src/hooks/`): imports from `src/domain/` and `src/ports/` only
- [x] **Components** (`src/components/schema-explorer/`, `src/components/app-shell/`): import from domain, ports, hooks, and `src/components/ui/`
- [x] **Adapters** (`src/adapters/`): import from `src/ports/` and `src/domain/` only
- [x] **App.tsx**: wiring root -- imports components and adapters
- [x] **No circular dependencies** between layers

## Test Summary
| Layer | Type | Tests | Mocks Used | Status |
|-------|------|-------|------------|--------|
| Outer (Integration) | Integration | 1 | fetch (external) | PASS |
| Domain (transforms) | Pure | 5 | None | PASS |
| Hook (useSchemaExplorer) | Unit | 4 | SchemaDataPort | PASS |
| ColumnDetailPanel | Unit | 4 | None (props only) | PASS |
| TableListPanel | Unit | 7 | None (props + callbacks) | PASS |
| SchemaExplorerPage | Unit | 6 | SchemaDataPort | PASS |
| AppSidebar | Unit | 3 | None (props + callbacks) | PASS |
| AppShell | Unit | 2 | None | PASS |
| FetchSchemaDataAdapter | Unit | 2 | fetch (external) | PASS |
| SettingsForm (existing) | Unit | 20 | fetch (external) | PASS |
| **Total** | | **59** (frontend) + **51** (backend) = **110** | | **ALL PASS** |
[x] reviewed
