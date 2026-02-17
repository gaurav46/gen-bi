# TDD Plan: Phase 4, Slices 2+3 -- Dashboard Landing, Detail Pages & Management

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it (`[ ]` -> `[x]`).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

## Context
- **Source**: Phase 4 spec (Slices 2 and 3)
- **Risk Level**: MODERATE -- happy path + error scenarios + edge cases
- **Success Criteria**:
  - Dashboards nav item in sidebar
  - Landing page lists dashboards as cards (empty state when none)
  - Clicking card navigates to detail page
  - Detail page executes widget SQL and renders live charts
  - Widget titles shown above charts
  - Failed widgets show error state without crashing
  - Direct URL `/dashboards/:id` loads dashboard
  - Remove widget from detail page (no reload)
  - Delete dashboard from landing (cascade, confirm, no reload)

## Architecture

### Directory Structure
| Layer | Directory | Test Directory |
|-------|-----------|----------------|
| Backend Controller | `packages/backend/src/dashboards/` | co-located `.spec.ts` |
| Backend Service | `packages/backend/src/dashboards/` | co-located `.spec.ts` |
| Frontend Port | `packages/frontend/src/ports/` | (tested via adapter tests) |
| Frontend Adapter | `packages/frontend/src/adapters/` | co-located `.test.ts` |
| Frontend Domain | `packages/frontend/src/domain/` | co-located `.test.ts` |
| Frontend Pages | `packages/frontend/src/components/dashboards/` | co-located `.test.tsx` |

### Test Infrastructure
- Framework: Vitest in both packages
- Mocking: `vi.fn()`, `vi.stubGlobal('fetch', ...)`
- Frontend: `@testing-library/react` + `userEvent`
- Backend: direct class instantiation with mocked dependencies

---

## Outer Test (Frontend Integration)

**Write this test FIRST. It stays RED until all layers are built and wired.**

### Scenario
User navigates to Dashboards, sees a dashboard card, clicks it, sees widgets rendered as live charts, removes a widget, goes back, deletes a dashboard.

### Test Specification
- Location: `packages/frontend/src/App.integration.test.tsx`
- Add a new `it(...)` block to the existing describe

### Setup
- `localStorage` has `connectionId: 'conn-1'`
- `fetch` mock handles:
  - `GET /api/dashboards?connectionId=conn-1` -> list of dashboards
  - `GET /api/dashboards/d1` -> dashboard detail with widgets
  - `POST /api/dashboards/d1/widgets/w1/execute` -> columns + rows
  - `POST /api/dashboards/d1/widgets/w2/execute` -> error response (500)
  - `DELETE /api/dashboards/d1/widgets/w1` -> 204
  - `DELETE /api/dashboards/d1` -> 204

### Actions and Assertions
1. Render App, click "Dashboards" nav item
2. Assert landing page shows dashboard card "Sales KPIs"
3. Click the card
4. Assert detail page shows widget titles, one chart rendered, one error state
5. Click remove on widget w1, assert it disappears
6. Click back, assert landing page
7. Click delete on dashboard, confirm, assert card removed

### Expected Failure Progression
| After Layer | Expected Failure |
|-------------|-----------------|
| (none) | "Dashboards" nav item not found |
| Sidebar + PageId | Dashboard landing page not rendered |
| Landing page | Detail page not rendered on card click |
| Detail page | Port methods missing / fetch calls fail |
| Backend endpoints | All passes |

- [x] **RED**: Write the outer integration test in `packages/frontend/src/App.integration.test.tsx`
- [x] **RUN**: Confirm it FAILS (no "Dashboards" nav item)

---

## Part A: Backend Additions

### A1. Controller Tests -- New Endpoints

Extend the existing controller spec to cover the four new endpoints.

- [x] **A1.0 Define new service methods in type**
  - In the controller spec, add `getDashboard`, `executeWidgetSql`, `removeWidget`, `deleteDashboard` to the service mock type

- [x] **RED**: Add test `GET /dashboards/:id calls getDashboard`
  - Mock `service.getDashboard` returning a dashboard with widgets array
  - Call `controller.getDashboard('d1')`
  - Assert result matches and service was called with `'d1'`

- [x] **RED**: Add test `POST /dashboards/:dashboardId/widgets/:widgetId/execute calls executeWidgetSql`
  - Mock `service.executeWidgetSql` returning `{ columns, rows }`
  - Call `controller.executeWidget('d1', 'w1')`
  - Assert result and service called with `'d1', 'w1'`

- [x] **RED**: Add test `DELETE /dashboards/:id/widgets/:widgetId calls removeWidget`
  - Mock `service.removeWidget` returning void
  - Call `controller.removeWidget('d1', 'w1')`
  - Assert service called with `'d1', 'w1'`

- [x] **RED**: Add test `DELETE /dashboards/:id calls deleteDashboard`
  - Mock `service.deleteDashboard` returning void
  - Call `controller.deleteDashboard('d1')`
  - Assert service called with `'d1'`

- [x] **RUN**: Confirm all four tests FAIL

- [x] **GREEN**: Add the four new methods to `dashboards.controller.ts`
  - `@Get(':id') getDashboard(@Param('id') id: string)`
  - `@Post(':dashboardId/widgets/:widgetId/execute') @HttpCode(200) executeWidget(@Param('dashboardId') dashboardId: string, @Param('widgetId') widgetId: string)`
  - `@Delete(':id/widgets/:widgetId') @HttpCode(204) removeWidget(@Param('id') id: string, @Param('widgetId') widgetId: string)`
  - `@Delete(':id') @HttpCode(204) deleteDashboard(@Param('id') id: string)`

- [x] **RUN**: Confirm all controller tests PASS

### A2. Service Tests -- New Methods

Extend the existing service integration spec.

- [x] **A2.1 RED**: Test `getDashboard returns dashboard with widgets`
  - Mock `prisma.dashboard.findUniqueOrThrow` with `include: { widgets: true }`
  - Assert returns `{ id, name, widgets: [...] }`

- [x] **A2.2 RED**: Test `getDashboard throws NotFoundException for missing dashboard`
  - Mock `prisma.dashboard.findUniqueOrThrow` throwing Prisma `NotFoundError`
  - Assert service throws `NotFoundException`

- [x] **A2.3 RED**: Test `executeWidgetSql connects to tenant DB, runs widget SQL, returns result`
  - Mock `prisma.widget.findUniqueOrThrow` returning widget with sql and dashboardId
  - Mock `prisma.dashboard.findUniqueOrThrow` returning dashboard with connectionId
  - Mock `connectionsService.findOne` returning DB credentials
  - Mock `tenantDatabasePort.connect`, `.query`, `.disconnect`
  - Assert `tenantDatabasePort.query` called with the widget's stored SQL
  - Assert result has `{ columns, rows }`

- [x] **A2.4 RED**: Test `executeWidgetSql calls disconnect even when query fails`
  - Mock `tenantDatabasePort.query` throwing an error
  - Assert `disconnect` still called
  - Assert error propagates

- [x] **A2.5 RED**: Test `removeWidget deletes the widget`
  - Mock `prisma.widget.delete` with `where: { id, dashboardId }`
  - Assert called correctly

- [x] **A2.6 RED**: Test `deleteDashboard deletes the dashboard`
  - Mock `prisma.dashboard.delete` with `where: { id }`
  - Assert called correctly (cascade handles widgets)

- [x] **RUN**: Confirm all six tests FAIL

- [x] **GREEN**: Implement the four new methods in `dashboards.service.ts`
  - Inject `ConnectionsService` and `@Inject(TENANT_DATABASE_PORT) tenantDatabasePort: TenantDatabasePort` in constructor
  - `getDashboard(id)`: `prisma.dashboard.findUniqueOrThrow({ where: { id }, include: { widgets: { orderBy: { position: 'asc' } } } })`
  - `executeWidgetSql(dashboardId, widgetId)`: find widget -> find dashboard -> get connection -> connect -> query -> disconnect in finally
  - `removeWidget(dashboardId, widgetId)`: `prisma.widget.delete({ where: { id: widgetId, dashboardId } })`
  - `deleteDashboard(id)`: `prisma.dashboard.delete({ where: { id } })`

- [x] **RUN**: Confirm all service tests PASS

### A3. Module Wiring

- [x] **Update `dashboards.module.ts`**:
  - Import `SchemaDiscoveryModule` (provides `TENANT_DATABASE_PORT`)
  - `DashboardsService` constructor now needs `ConnectionsService` (already available via `ConnectionsModule`) and `TENANT_DATABASE_PORT` (from `SchemaDiscoveryModule`)

- [x] **Update `dashboards.types.ts`**: Add `DashboardDetail` type with widgets array if needed for type safety

- [x] **RUN**: Confirm all backend tests still pass

- [x] **COMMIT POINT** (if asked): "feat(backend): dashboard detail, execute widget, remove widget, delete dashboard"

---

## Part B: Frontend

### B1. Domain Types

- [x] **Extend `packages/frontend/src/domain/dashboard-types.ts`**:
  - Add `DashboardDetail` type: `{ id, name, widgets: Widget[] }`
  - Add `WidgetExecutionResult` type: `{ columns: { name: string; type: string; role: string }[]; rows: Record<string, unknown>[] }`

### B2. Port Extension

- [x] **Extend `packages/frontend/src/ports/dashboard-port.ts`**:
  - Add `getDashboard(id: string): Promise<DashboardDetail>`
  - Add `executeWidget(dashboardId: string, widgetId: string): Promise<WidgetExecutionResult>`
  - Add `removeWidget(dashboardId: string, widgetId: string): Promise<void>`
  - Add `deleteDashboard(id: string): Promise<void>`

### B3. Adapter Extension

- [x] **RED**: Add tests in `packages/frontend/src/adapters/fetch-dashboard-adapter.test.ts`
  - Test `getDashboard fetches GET /api/dashboards/:id`
  - Test `executeWidget fetches POST /api/dashboards/:dashboardId/widgets/:widgetId/execute`
  - Test `removeWidget fetches DELETE /api/dashboards/:id/widgets/:widgetId`
  - Test `deleteDashboard fetches DELETE /api/dashboards/:id`

- [x] **RUN**: Confirm tests FAIL

- [x] **GREEN**: Implement the four new methods in `FetchDashboardAdapter`

- [x] **RUN**: Confirm adapter tests PASS

### B4. Sidebar -- Add Dashboards Nav Item

- [x] **RED**: Test in `packages/frontend/src/components/app-shell/AppSidebar.test.tsx` (create if needed)
  - Render `AppSidebar` with `activePage='dashboards'`
  - Assert "Dashboards" nav item is rendered

- [x] **GREEN**: Update `PageId` type to include `'dashboards'`, add nav item with `LayoutDashboard` icon from lucide-react

- [x] **RUN**: Confirm test PASSES

### B5. Dashboard Landing Page

- [x] **B5.1 RED**: Test `DashboardsLandingPage renders dashboard cards`
  - Location: `packages/frontend/src/components/dashboards/DashboardsLandingPage.test.tsx`
  - Props: `dashboardPort` (mocked `listDashboards` returns two dashboards), `connectionId`, `onSelectDashboard` callback
  - Assert: renders card with name "Sales KPIs", card with name "Marketing"
  - Assert: clicking a card calls `onSelectDashboard` with the dashboard id

- [x] **B5.2 RED**: Test `DashboardsLandingPage shows empty state when no dashboards`
  - Mock `listDashboards` returns `[]`
  - Assert: shows text indicating no dashboards

- [x] **B5.3 RED**: Test `DashboardsLandingPage delete button removes dashboard after confirm`
  - Mock `deleteDashboard` resolves, mock `window.confirm` returns true
  - Click delete button on a card
  - Assert: `deleteDashboard` called with correct id
  - Assert: card removed from view (re-fetch or local state removal)

- [x] **B5.4 RED**: Test `DashboardsLandingPage delete cancelled does nothing`
  - Mock `window.confirm` returns false
  - Click delete button
  - Assert: `deleteDashboard` not called

- [x] **RUN**: Confirm all four tests FAIL

- [x] **GREEN**: Implement `DashboardsLandingPage` component
  - Location: `packages/frontend/src/components/dashboards/DashboardsLandingPage.tsx`
  - Props: `dashboardPort: DashboardPort`, `connectionId: string`, `onSelectDashboard: (id: string) => void`
  - Fetches dashboards on mount via `dashboardPort.listDashboards(connectionId)`
  - Renders cards using shadcn `Card` component
  - Each card has dashboard name, widget count, delete button
  - Delete calls `window.confirm`, then `dashboardPort.deleteDashboard`, then removes from local state

- [x] **RUN**: Confirm landing page tests PASS

### B6. Dashboard Detail Page

- [x] **B6.1 RED**: Test `DashboardDetailPage renders widget titles and charts`
  - Location: `packages/frontend/src/components/dashboards/DashboardDetailPage.test.tsx`
  - Props: `dashboardPort` (mocked), `dashboardId`, `onBack` callback
  - Mock `getDashboard` returns dashboard with two widgets
  - Mock `executeWidget` returns `{ columns, rows }` for each
  - Assert: both widget titles rendered
  - Assert: charts rendered (check for `data-testid` matching chart type)

- [x] **B6.2 RED**: Test `DashboardDetailPage shows error state for failed widget`
  - Mock `executeWidget` for one widget rejects with error
  - Assert: error message shown for that widget
  - Assert: other widget still renders normally

- [x] **B6.3 RED**: Test `DashboardDetailPage remove widget removes it from view`
  - Mock `removeWidget` resolves
  - Click remove on a widget
  - Assert: widget disappears without page reload
  - Assert: `removeWidget` called with correct ids

- [x] **B6.4 RED**: Test `DashboardDetailPage back button calls onBack`
  - Click back button
  - Assert: `onBack` called

- [x] **RUN**: Confirm all four tests FAIL

- [x] **GREEN**: Implement `DashboardDetailPage` component
  - Location: `packages/frontend/src/components/dashboards/DashboardDetailPage.tsx`
  - Props: `dashboardPort: DashboardPort`, `dashboardId: string`, `onBack: () => void`
  - On mount: `getDashboard(dashboardId)` then `executeWidget` for each widget
  - Each widget: title above, `ChartRenderer` with execution result, or error state
  - Remove button on each widget calls `removeWidget` then filters local state
  - Back button at top calls `onBack`

- [x] **RUN**: Confirm detail page tests PASS

### B7. AppShell Wiring

- [x] **RED**: Update existing tests or add test in AppShell
  - When `activePage === 'dashboards'`, landing page renders
  - When a dashboard is selected, detail page renders
  - Back from detail returns to landing

- [x] **GREEN**: Update `AppShell.tsx`
  - Add `selectedDashboardId` state (`string | null`, initially null)
  - When `activePage === 'dashboards'` and no `selectedDashboardId`: render `DashboardsLandingPage` with `onSelectDashboard` setting the id
  - When `activePage === 'dashboards'` and `selectedDashboardId` set: render `DashboardDetailPage` with `onBack` clearing the id
  - Clear `selectedDashboardId` when navigating away from dashboards
  - Pass `dashboardPort` and `connectionId` to both pages

- [x] **RUN**: Confirm AppShell tests PASS

---

## Wiring Phase

- [x] **RUN OUTER TEST**: The integration test from the top of this plan should now PASS
- [x] **RUN ALL TESTS**: `pnpm -r test` -- all tests green
- [x] **MANUAL SMOKE TEST**: Start dev servers, verify dashboard flow end-to-end

---

## Final Architecture Verification

- [x] `DashboardsLandingPage` and `DashboardDetailPage` depend only on `DashboardPort` (interface), never on `FetchDashboardAdapter`
- [x] `ChartRenderer` reused from workspace -- no duplication
- [x] Backend service methods follow same tenant DB pattern as `QueryService`
- [x] `DashboardsModule` imports are minimal (`ConnectionsModule`, `SchemaDiscoveryModule`)
- [x] No business logic in controller or adapter -- they only translate and delegate

## Test Summary
| Layer | Type | Tests | Mocks Used |
|-------|------|-------|------------|
| Outer (Integration) | E2E | 1 | fetch stub |
| Backend Controller | Unit | 4 new | Service mock |
| Backend Service | Unit | 6 new | Prisma, ConnectionsService, TenantDatabasePort |
| Frontend Adapter | Unit | 4 new | fetch stub |
| Frontend Sidebar | Unit | 1 | None |
| Frontend Landing | Unit | 4 | DashboardPort |
| Frontend Detail | Unit | 4 | DashboardPort |
| Frontend AppShell | Unit | 1 | DashboardPort |
| **Total** | | **~25 new** | |
[x] reviewed
