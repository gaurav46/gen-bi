# TDD Plan: Phase 4 Slice 4 — URL Routing for Dashboards

## Goal

Replace state-based navigation with `react-router-dom` URL routing so that `/dashboards/:id` is shareable and browser back/forward works.

## Acceptance Criteria (from spec)

- Clicking a dashboard card navigates to `/dashboards/:id`
- Dashboard URL is shareable — opening `/dashboards/:id` directly loads that dashboard
- Browser back/forward navigates between pages
- All existing navigation (sidebar, back button) still works

## Architecture

Minimal change — install `react-router-dom`, wrap `App` in `BrowserRouter`, convert `AppShell` page switching from `useState` to routes + `useNavigate`. Dashboard components keep their existing props; the route params feed the `dashboardId` prop.

## Steps

### Step 1 — Install react-router-dom

- [x] `pnpm add react-router-dom` in `packages/frontend`

### Step 2 — RED: Route renders DashboardDetailPage for `/dashboards/:id`

- [x] Write test in `App.integration.test.tsx`: wrap `<App />` in `MemoryRouter` with `initialEntries={['/dashboards/d1']}`, assert `DashboardDetailPage` renders (shows dashboard name, widget titles)

### Step 3 — GREEN: Add routing to App + AppShell

- [x] Wrap app in `BrowserRouter` in `main.tsx`
- [x] In `AppShell`, replace `activePage` state with `Routes` + `Route` declarations:
  - `/` → `SchemaExplorerPage`
  - `/workspace` → `WorkspacePage`
  - `/dashboards` → `DashboardsLandingPage`
  - `/dashboards/:id` → `DashboardDetailPage`
  - `/settings` → `SettingsForm`
- [x] `DashboardDetailPage` reads `id` from `useParams()` instead of prop
- [x] `DashboardsLandingPage` `onSelectDashboard` uses `useNavigate` to go to `/dashboards/:id`
- [x] `DashboardDetailPage` `onBack` uses `useNavigate` to go to `/dashboards`
- [x] `AppSidebar` uses `useNavigate` instead of `onNavigate` callback
- [x] Existing tests pass (update test wrappers to use `MemoryRouter`)

### Step 4 — RED: Sidebar navigation uses URLs

- [x] Write test: clicking "Dashboards" in sidebar navigates to `/dashboards` route (URL changes)

### Step 5 — GREEN: AppSidebar uses NavLink/useNavigate

- [x] Convert sidebar items to use `useNavigate` with `useLocation` for `isActive`
- [x] Remove `activePage` / `onNavigate` props from `AppSidebar`

### Step 6 — Update all existing tests

- [x] Wrap all `render(<App />)` calls in `MemoryRouter` with appropriate `initialEntries`
- [x] Update `DashboardsLandingPage.test.tsx` to use `MemoryRouter`
- [x] Update `DashboardDetailPage.test.tsx` to use `MemoryRouter` with route param
- [x] All 172 frontend tests pass

### Step 7 — Refactor

- [x] Remove `PageId` type if no longer used
- [x] Remove `selectedDashboardId` state from `AppShell`
- [x] Remove `onNavigate` prop from `AppSidebar`
- [x] Clean up any unused imports

[x] Reviewed
