# Spec: Phase 4 — Dashboards

## Overview

<!-- -------- bee-comment -------- -->
> **@developer**: instead of pin, imagine the "Add to dashboard" workflow. The dashboard can have an id, and the route can have the id. That means if i shared a URL of the dashboard with someone, it will open it.
> **@bee**: Reframed the entire phase around dashboards as the primary concept. Removed "pin" language. Dashboards get UUID IDs and URL-routable paths (`/dashboards/:id`), making them shareable by URL. "Widget" is now just a component inside a dashboard, not a standalone pinned item.
> - [x] mark as resolved
<!-- -------- /bee-comment -------- -->

Users can save any query result as a widget on a named dashboard. Dashboards are URL-routable (`/dashboards/:id`) — sharing the URL opens that dashboard. Each dashboard is a named collection of widgets that re-execute their stored SQL on load for fresh data. No authentication — dashboards are scoped to `connectionId` in localStorage.

## Slice 1: Add to Dashboard

<!-- -------- bee-comment -------- -->
> **@developer**: i would put a nice looking dropdown on top of the visualization that says "Add to dashboard" and the last option should be "Create Dashboard"
> **@bee**: Replaced the "Pin" button with an "Add to Dashboard" dropdown. The dropdown lists existing dashboards for the current connectionId, with "Create Dashboard" as the last option. Selecting a dashboard saves the widget directly to it. "Create Dashboard" prompts for a name, creates the dashboard, then adds the widget. This is the walking skeleton — end-to-end from query result to persisted widget on a dashboard.
> - [x] mark as resolved
<!-- -------- /bee-comment -------- -->

The walking skeleton: user runs a query, clicks "Add to Dashboard", picks an existing dashboard or creates a new one, and the widget is saved. This slice adds Dashboard + Widget models, the backend APIs, and the dropdown in the UI.

- [ ] User sees an "Add to Dashboard" dropdown above the visualization in Workspace
- [ ] Dropdown lists existing dashboards for the current connectionId
- [ ] Last option in the dropdown is "Create Dashboard"
- [ ] Selecting an existing dashboard saves the widget to it (SQL, chart type, title, column metadata)
- [ ] Selecting "Create Dashboard" prompts for a name, creates the dashboard, then adds the widget
- [ ] Dropdown shows a brief success indicator after saving
- [ ] Shows error feedback when the save fails

### API Shape

```
POST /api/dashboards
{ connectionId, name }
-> 201 { id, connectionId, name, createdAt }

GET /api/dashboards?connectionId=xxx
-> 200 [ { id, name, widgetCount, createdAt }, ... ]

POST /api/dashboards/:id/widgets
{ title, sql, chartType, columns }
-> 201 { id, dashboardId, title, sql, chartType, columns, position, createdAt }
```

### DB Model

New Prisma migration adds `Dashboard` and `Widget`:
```
Dashboard: { id (UUID), connectionId, name, createdAt }
Widget: { id (UUID), dashboardId, title, sql, chartType, columns (JSON), position (Int), createdAt }
```

## Slice 2: Dashboard Landing & Detail Pages

<!-- -------- bee-comment -------- -->
> **@developer**: we are assuming that there is one dashboard. But this is more like a music playlist, add components to a dashboard and see any dahsboard you want to see later. Based on this you will have to think where will you show the list of dashboards (may be create a nice looking landing page with thumbnails represnting dashbard names)
> **@bee**: Redesigned around the playlist mental model. Added a landing page showing all dashboards as cards/thumbnails with names. Each card links to a detail page (`/dashboards/:id`) that renders the widgets. This gives users a clear "library" of their dashboards, just like browsing playlists.
> - [ ] mark as resolved
<!-- -------- /bee-comment -------- -->

User can navigate to "Dashboards" and see a landing page listing all their dashboards as cards. Clicking a card opens the dashboard detail page (`/dashboards/:id`) which renders all widgets with live data.

- [ ] New "Dashboards" nav item appears in the sidebar
- [ ] Landing page shows all dashboards for the current connectionId as cards with names
- [ ] Landing page shows an empty state when no dashboards exist
- [ ] Clicking a dashboard card navigates to `/dashboards/:id`
- [ ] Dashboard detail page re-executes each widget's stored SQL and renders live charts
- [ ] Each widget shows its title above the chart
- [ ] Widgets that fail to load (SQL error, timeout) show an error state without crashing the page
- [ ] Dashboard URL is shareable — opening `/dashboards/:id` directly loads that dashboard

### API Shape

```
GET /api/dashboards/:id
-> 200 { id, name, widgets: [ { id, title, sql, chartType, columns, position }, ... ] }

POST /api/dashboards/:dashboardId/widgets/:widgetId/execute
-> 200 { columns, rows }
```

The execute endpoint runs the widget's stored SQL against the tenant DB via the existing read-only libpq connection.

## Slice 3: Dashboard Management

User can remove widgets from a dashboard and delete dashboards. Keeps the dashboard experience manageable as users accumulate content.

- [ ] User can remove a widget from a dashboard on the detail page
- [ ] Removing a widget does not require a full page reload
- [ ] User can delete a dashboard from the landing page
- [ ] Deleting a dashboard deletes all its widgets (cascade)
- [ ] Confirmation prompt before deleting a dashboard
- [ ] Landing page updates after deletion without full page reload

### API Shape

```
DELETE /api/dashboards/:id/widgets/:widgetId
-> 204

DELETE /api/dashboards/:id
-> 204
```

## Out of Scope

- Authentication or user accounts (connectionId is the identity boundary)
- Drag-and-drop widget reordering
- Widget resizing or custom grid layouts
- Scheduled refresh or auto-refresh of widgets
- Widget editing (changing SQL, title, or chart type after adding)
- Export or download of dashboards
- Dashboard thumbnails showing actual chart previews (card shows name only for MVP)
- Duplicate widget detection or deduplication

## Technical Context

- **Architecture**: Hexagonal — new `dashboards/` backend module with controller, service, Prisma repository
- **Frontend**: New port interface (`DashboardPort`), fetch adapter, new pages (`DashboardLandingPage`, `DashboardDetailPage`)
- **Routing**: URL-routable dashboards — extend routing to support `/dashboards/:id`
- **Sidebar**: Extend `PageId` type to include `'dashboards'`
- **Reuse**: `ChartRenderer` and `transformChartData` from Phase 3 render widget charts. Tenant DB connection logic from `QueryService` powers the execute endpoint.
- **DB**: Prisma ORM migrations (not Supabase CLI). Widget `columns` stored as JSON field. Dashboard and Widget use UUID primary keys for URL-safe IDs.
- **Patterns**: Follow existing NestJS module structure (controller -> service -> Prisma). Follow existing frontend port/adapter pattern.
- **Risk level**: MODERATE

[x] Reviewed
