# TDD Plan — Widget Edit Slice 2: Edit Dialog + Legend Label Rendering

Spec: `docs/specs/widget-edit.md` — Slice 2
Architecture: Hexagonal (outside-in)
Risk: LOW

---

## Step 1: Add `updateWidget` to port + adapter

- [x] Add `updateWidget(dashboardId, widgetId, dto): Promise<Widget>` to `DashboardPort` interface
- [x] Add `legendLabels` (optional) to `Widget` type in `dashboard-types.ts`
- [x] Add `UpdateWidgetRequest` type: `{ title?: string; legendLabels?: Record<string, string> }`

---

## Step 2: RED — Adapter test for updateWidget

Add to `fetch-dashboard-adapter.test.ts`:

- [x] Test: `updateWidget calls PATCH /api/dashboards/:id/widgets/:widgetId with body`
  - Stub fetch to return ok + updated widget
  - Call `adapter.updateWidget('d1', 'w1', { title: 'New', legendLabels: { revenue: 'Rev' } })`
  - Assert fetch called with PATCH method, JSON body, correct URL

---

## Step 3: GREEN — Implement adapter updateWidget

- [x] Add `updateWidget` method to `FetchDashboardAdapter`
- [x] PATCH to `/api/dashboards/${dashboardId}/widgets/${widgetId}` with JSON body
- [x] Adapter test goes GREEN

---

## Step 4: RED — DashboardDetailPage test: edit button opens dialog

Add to `DashboardDetailPage.test.tsx`:

- [x] Test: `each widget shows an edit button that opens a dialog`
  - Render with a widget that has columns (dimension + measure)
  - Wait for widget title
  - Click the edit button (pencil icon with aria-label "Edit")
  - Assert dialog is visible with title input pre-filled

---

## Step 5: GREEN — Add edit button + EditWidgetDialog component

- [x] Create `EditWidgetDialog.tsx` — a dialog with title input + measure label fields
  - Props: `widget`, `open`, `onOpenChange`, `onSave`
  - Title input pre-filled with `widget.title`
  - For each measure column: input pre-filled with `widget.legendLabels?.[col.name] ?? col.name`
  - Save and Cancel buttons
- [x] Add pencil icon button to each widget card in `DashboardDetailPage`
- [x] Wire open/close state
- [x] Detail page test goes GREEN

---

## Step 6: RED — EditWidgetDialog test: save calls onSave with updated values

- [x] Create `EditWidgetDialog.test.tsx`
- [x] Test: `save button calls onSave with updated title and legendLabels`
  - Render dialog open with a widget having 2 measure columns
  - Change title input
  - Change one legend label input
  - Click Save
  - Assert `onSave` called with `{ title: 'new title', legendLabels: { col1: 'new label', col2: 'original' } }`

---

## Step 7: GREEN — Wire save logic in EditWidgetDialog

- [x] Manage local state for title and legend label inputs
- [x] On Save: collect values into `{ title, legendLabels }` and call `onSave`
- [x] Dialog test goes GREEN

---

## Step 8: RED — EditWidgetDialog test: cancel discards changes

- [x] Test: `cancel button closes dialog without calling onSave`
  - Open dialog, change title, click Cancel
  - Assert `onSave` was NOT called
  - Assert `onOpenChange(false)` was called

---

## Step 9: GREEN — Wire cancel logic

- [x] Cancel button calls `onOpenChange(false)` without calling onSave
- [x] Cancel test goes GREEN

---

## Step 10: RED — DashboardDetailPage test: saving edit updates widget in-place

- [x] Test: `saving edit dialog calls updateWidget and updates title in-place`
  - Render with widget titled "Revenue"
  - Click edit, change title to "Monthly Revenue", click Save
  - Assert `port.updateWidget` called with correct args
  - Assert "Monthly Revenue" appears in the UI (no reload)

---

## Step 11: GREEN — Wire updateWidget in DashboardDetailPage

- [x] Add `handleUpdate` function that calls `dashboardPort.updateWidget`
- [x] On success, update the widget in `widgetStates` with returned data
- [x] Detail page save test goes GREEN

---

## Step 12: RED — Chart legend renders custom labels

- [x] Add test to `BarChartPanel.test.tsx` (or `ChartRenderer.test.tsx`):
  - Test: `Bar chart uses legendLabels as name prop when provided`
  - Render BarChartPanel with `legendLabels: { revenue: 'Monthly Revenue' }`
  - Assert `<Bar>` receives `name="Monthly Revenue"`

---

## Step 13: GREEN — Pass legendLabels through to chart panels

- [x] Add optional `legendLabels` to `BarLineAreaData` type
- [x] Update `ChartRenderer` to pass `legendLabels` from widget to chart panels
- [x] Update `BarChartPanel`, `LineChartPanel`, `AreaChartPanel` to accept `legendLabels` and set `name={legendLabels?.[key] ?? key}` on each `<Bar>`, `<Line>`, `<Area>`
- [x] Chart legend test goes GREEN

---

## Step 14: Refactor

- [x] Review all new code for naming, SRP, duplication
- [x] Ensure mock port in tests includes `updateWidget`
- [x] Run full frontend test suite — all green (32 files, 178 tests)

[x] Reviewed
