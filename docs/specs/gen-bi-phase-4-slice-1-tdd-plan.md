# TDD Plan: Phase 4, Slice 1 -- Add to Dashboard

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it ([ ] -> [x]).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

## Context
- **Source**: `docs/specs/gen-bi-phase-4.md`
- **Phase/Slice**: Phase 4, Slice 1 -- Add to Dashboard
- **Risk Level**: MODERATE (happy path + edge cases + error scenarios)
- **Success Criteria**:
  1. User sees "Add to Dashboard" dropdown above the visualization
  2. Dropdown lists existing dashboards for current connectionId
  3. Last option is "Create Dashboard"
  4. Selecting a dashboard saves the widget (SQL, chart type, title, columns)
  5. "Create Dashboard" prompts for name, creates dashboard, adds widget
  6. Brief success indicator after saving
  7. Error feedback when save fails

## Codebase Analysis

### Architecture
- **Backend**: NestJS modules -- controller -> service -> Prisma. Ports use `@Inject(TOKEN)` pattern. See `query.module.ts` for wiring example.
- **Frontend**: Port interfaces in `src/ports/`, fetch adapters in `src/adapters/`, domain types in `src/domain/`. Components receive ports as props. `AppShell` wires ports to pages.
- **Target**: New `dashboards` NestJS module on backend. New `DashboardPort` + adapter + dropdown component on frontend.

### Directory Structure
| Layer | Directory | Test Directory |
|-------|-----------|----------------|
| Backend Controller | `packages/backend/src/dashboards/` | co-located `.spec.ts` |
| Backend Service | `packages/backend/src/dashboards/` | co-located `.spec.ts` |
| Prisma Schema | `packages/backend/prisma/schema.prisma` | n/a |
| Frontend Port | `packages/frontend/src/ports/` | n/a (tested via component tests) |
| Frontend Adapter | `packages/frontend/src/adapters/` | co-located `.test.ts` |
| Frontend Domain | `packages/frontend/src/domain/` | co-located `.test.ts` |
| Frontend Component | `packages/frontend/src/components/workspace/` | co-located `.test.tsx` |

### External Dependencies to Mock
- Prisma client (backend service tests)
- `fetch` (frontend adapter tests and integration test)

### Test Infrastructure
- Framework: Vitest in both packages
- Mocking: `vi.fn()`, `vi.stubGlobal`
- Frontend: `@testing-library/react` + `userEvent`

---

## Outer Test (Frontend Integration)

**Write this test FIRST. It stays RED until all layers are built and wired.**

### Scenario
User submits a query in Workspace, sees the result with an "Add to Dashboard" dropdown, selects an existing dashboard from the list, and sees a success indicator.

### Test Specification
- Test location: `packages/frontend/src/App.integration.test.tsx`
- Test name: `'user adds a query result to an existing dashboard'`

### Setup
- `localStorage` has `connectionId: 'conn-1'`
- Stub `fetch` to handle:
  - `POST /api/query` -> returns mock query response (existing pattern)
  - `GET /api/dashboards?connectionId=conn-1` -> returns `[{ id: 'd1', name: 'Sales KPIs', widgetCount: 2, createdAt: '...' }]`
  - `POST /api/dashboards/d1/widgets` -> returns `201` with widget data

### Actions
1. Navigate to Workspace
2. Type a question, click Ask
3. Wait for chart to render
4. Click "Add to Dashboard" dropdown
5. See "Sales KPIs" in the list
6. Click "Sales KPIs"
7. See success indicator

### Assertions
- [x] "Add to Dashboard" dropdown is visible after query response
- [x] Dropdown lists "Sales KPIs"
- [x] After selecting, `POST /api/dashboards/d1/widgets` was called with correct payload (title, sql, chartType, columns)
- [x] Success indicator appears

### Expected Failure Progression
| After Layer | Expected Failure |
|-------------|-----------------|
| (none) | No "Add to Dashboard" element found |
| Frontend dropdown component | fetch to `/api/dashboards` fails (no backend or mock) |
| Frontend adapter + port wired | Backend routes not implemented / fetch mock incomplete |
| Backend APIs + wiring | All GREEN |

---

## Part A: Backend

The backend is straightforward CRUD. No complex domain logic -- the "domain" is just data shapes. We skip a separate domain layer and let the service handle orchestration directly (YAGNI -- no business rules to extract yet).

### A.0 Prisma Migration

- [x] **Add Dashboard and Widget models to `packages/backend/prisma/schema.prisma`**
  - Dashboard: `id` (UUID), `connectionId`, `name`, `createdAt`
  - Widget: `id` (UUID), `dashboardId`, `title`, `sql`, `chartType`, `columns` (Json), `position` (Int), `createdAt`
  - Dashboard has `@@map("dashboards")`, Widget has `@@map("widgets")`
  - Widget belongs to Dashboard with `onDelete: Cascade`
  - Widget has `_count` relation for `widgetCount` on list endpoint

- [x] **Run migration**: `cd packages/backend && npx prisma migrate dev --name add-dashboards-widgets`

- [x] **Verify**: generated Prisma client has Dashboard and Widget types

### A.1 Backend Integration Test: Full Dashboard + Widget Journey

**This is the backend outer test. Stays RED until service is wired.**

- [x] **RED**: Write test at `packages/backend/src/dashboards/dashboards.integration.spec.ts`
  - Test name: `'create dashboard, list dashboards, add widget'`
  - Mock: `PrismaService` (same pattern as existing tests -- mock the Prisma client methods)
  - Flow:
    1. Call `service.createDashboard({ connectionId: 'conn-1', name: 'Sales KPIs' })` -> returns dashboard with id
    2. Call `service.listDashboards('conn-1')` -> returns array with the dashboard + `widgetCount: 0`
    3. Call `service.addWidget(dashboardId, { title, sql, chartType, columns })` -> returns widget with auto-incremented `position`
  - Assert: return shapes match API spec, position is 0 for first widget

- [x] **RUN**: Confirm test FAILS (service does not exist)

### A.2 Dashboard Service

- [x] **GREEN**: Implement `packages/backend/src/dashboards/dashboards.service.ts`
  - Injectable service with `PrismaService` injected
  - `createDashboard(data: CreateDashboardDto)`: creates via Prisma, returns dashboard
  - `listDashboards(connectionId: string)`: finds all for connectionId, includes `_count.widgets` as `widgetCount`
  - `addWidget(dashboardId: string, data: CreateWidgetDto)`: counts existing widgets for position, creates widget

- [x] **RUN**: Confirm integration test PASSES

- [x] **REFACTOR**: Extract DTO types to `packages/backend/src/dashboards/dashboards.types.ts`

### A.3 Dashboard Controller

- [x] **RED**: Write test at `packages/backend/src/dashboards/dashboards.controller.spec.ts`
  - Mock: `DashboardsService`
  - Test `POST /dashboards` -> calls `createDashboard`, returns 201
  - Test `GET /dashboards?connectionId=xxx` -> calls `listDashboards`, returns 200
  - Test `POST /dashboards/:id/widgets` -> calls `addWidget`, returns 201

- [x] **RUN**: Confirm tests FAIL

- [x] **GREEN**: Implement `packages/backend/src/dashboards/dashboards.controller.ts`
  - NestJS controller with routes matching API shape
  - `@Post()` for create dashboard
  - `@Get()` with `@Query('connectionId')` for list
  - `@Post(':id/widgets')` with `@Param('id')` for add widget
  - Use `@HttpCode(201)` for POST endpoints

- [x] **RUN**: Confirm controller tests PASS

### A.4 Dashboard Module + Wiring

- [x] **Create** `packages/backend/src/dashboards/dashboards.module.ts`
  - Imports `ConnectionsModule` (provides PRISMA_CLIENT)
  - Registers `DashboardsService` as provider
  - Registers `DashboardsController`

- [x] **Register** module in `packages/backend/src/app.module.ts`

- [x] **RUN**: All backend tests pass (116 tests)

- [x] **ARCHITECTURE CHECK**: Controller depends only on service. Service depends only on PRISMA_CLIENT. No query module imports.

---

## Part B: Frontend

### B.0 Domain Types

- [x] **Create** `packages/frontend/src/domain/dashboard-types.ts`
  - Types: `Dashboard` (id, name, widgetCount, createdAt), `CreateDashboardRequest` (connectionId, name), `CreateWidgetRequest` (title, sql, chartType, columns), `Widget` (id, dashboardId, title, sql, chartType, columns, position, createdAt)
  - Keep minimal -- only what Slice 1 needs

### B.1 Define Port: DashboardPort

- [x] **CREATE PORT INTERFACE** at `packages/frontend/src/ports/dashboard-port.ts`
  - `listDashboards(connectionId: string): Promise<Dashboard[]>`
  - `createDashboard(request: CreateDashboardRequest): Promise<Dashboard>`
  - `addWidget(dashboardId: string, request: CreateWidgetRequest): Promise<Widget>`

### B.2 Outbound Adapter: FetchDashboardAdapter

- [x] **RED**: Write test at `packages/frontend/src/adapters/fetch-dashboard-adapter.test.ts`
  - Test `listDashboards` calls `GET /api/dashboards?connectionId=xxx`, returns parsed JSON
  - Test `createDashboard` calls `POST /api/dashboards` with body, returns parsed JSON
  - Test `addWidget` calls `POST /api/dashboards/:id/widgets` with body, returns parsed JSON
  - Test error case: non-ok response throws

- [x] **RUN**: Confirm tests FAIL

- [x] **GREEN**: Implement `packages/frontend/src/adapters/fetch-dashboard-adapter.ts`
  - Implements `DashboardPort`
  - Follow same pattern as `FetchQueryAdapter`

- [x] **RUN**: Confirm adapter tests PASS

- [x] **REFACTOR** if needed

### B.3 Component: AddToDashboardDropdown

This is the main UI piece. A dropdown button that lists dashboards and has "Create Dashboard" as the last option.

- [x] **RED**: Write test at `packages/frontend/src/components/workspace/AddToDashboardDropdown.test.tsx`
  - **Test 1**: `'shows existing dashboards when opened'`
    - Props: mock `DashboardPort`, `connectionId`, widget data (title, sql, chartType, columns)
    - Render, click "Add to Dashboard" button
    - Assert: dashboard names from mock appear in dropdown
    - Assert: "Create Dashboard" appears as last item
  - **Test 2**: `'adds widget to selected dashboard'`
    - Click dropdown, click a dashboard name
    - Assert: `addWidget` called with correct dashboardId and widget data
    - Assert: success indicator shown (e.g., text changes to "Added!" briefly)
  - **Test 3**: `'creates dashboard then adds widget when Create Dashboard selected'`
    - Click dropdown, click "Create Dashboard"
    - Assert: name input/dialog appears
    - Type a name, confirm
    - Assert: `createDashboard` called with connectionId + name
    - Assert: `addWidget` called with new dashboard id
    - Assert: success indicator shown
  - **Test 4**: `'shows error when addWidget fails'`
    - Mock `addWidget` to reject
    - Click dropdown, select dashboard
    - Assert: error message visible
  - **Test 5**: `'shows error when listDashboards fails'`
    - Mock `listDashboards` to reject
    - Open dropdown
    - Assert: error feedback shown

- [x] **RUN**: Confirm tests FAIL

- [x] **GREEN**: Implement `packages/frontend/src/components/workspace/AddToDashboardDropdown.tsx`
  - Uses shadcn `DropdownMenu` + `Dialog` for create flow
  - Trigger button: "Add to Dashboard" text
  - On open: fetches dashboards via port
  - Lists dashboards as menu items
  - Last item: "Create Dashboard" -- opens a Dialog for the name
  - On select: calls `addWidget`, shows brief success state
  - On "Create Dashboard" confirm: calls `createDashboard` then `addWidget`
  - Error state: shows destructive text on failure

- [x] **RUN**: Confirm all dropdown tests PASS

- [x] **REFACTOR**: Added DialogDescription for accessibility

### B.4 Wire Dropdown into WorkspacePage

- [x] **RED**: Add test to `packages/frontend/src/components/workspace/WorkspacePage.test.tsx`
  - Test name: `'shows Add to Dashboard dropdown after query response'`
  - WorkspacePage now needs a `dashboardPort` prop
  - Submit a query, wait for response
  - Assert: "Add to Dashboard" button is present in the DOM
  - Assert: dropdown is NOT present before query response

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Update `WorkspacePage`
  - Add `dashboardPort: DashboardPort` to props
  - Render `AddToDashboardDropdown` alongside ChartTypeSelector when `response` exists
  - Pass connectionId, title, sql, chartType (the active one including override), columns

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR** if needed

### B.5 Wire Port into AppShell and App

- [x] **Update** `packages/frontend/src/components/app-shell/AppShell.tsx`
  - Add `dashboardPort: DashboardPort` to `AppShellProps`
  - Pass it to `WorkspacePage`

- [x] **Update** `packages/frontend/src/App.tsx`
  - Create `FetchDashboardAdapter` instance
  - Pass it to `AppShell`

- [x] **RUN**: All frontend tests pass (157 tests)

---

## Wiring Phase: Outer Integration Test GREEN

- [x] **Update** `packages/frontend/src/App.integration.test.tsx`
  - Write the outer test described above
  - Add fetch stubs for dashboard endpoints alongside existing stubs
  - Full flow: navigate to Workspace -> ask question -> click "Add to Dashboard" -> select dashboard -> see success

- [x] **RUN**: Outer integration test PASSES

---

## Final Architecture Verification

- [x] **Backend controller** imports only: service, NestJS decorators, DTO types
- [x] **Backend service** imports only: PRISMA_CLIENT, DTO types
- [x] **Frontend adapter** imports only: port interface, domain types
- [x] **Frontend component** imports only: port interface, domain types, UI components
- [x] **Domain types** import: nothing
- [x] **No circular dependencies** between layers

## Test Summary
| Layer | Type | # Tests | Mocks Used | Status |
|-------|------|---------|------------|--------|
| Frontend Outer (Integration) | Integration | 1 | fetch stub | |
| Backend Integration | Unit | 1 | PrismaService | |
| Backend Controller | Unit | 3 | DashboardsService | |
| Frontend Adapter | Unit | 4 | fetch stub | |
| AddToDashboardDropdown | Unit | 5 | DashboardPort | |
| WorkspacePage (new test) | Unit | 1 | DashboardPort + QueryPort | |
| **Total** | | **15** | | |
[x] reviewed
