# TDD Plan — Widget Edit Slice 1: Backend PATCH + Schema

Spec: `docs/specs/widget-edit.md` — Slice 1
Architecture: Hexagonal (outside-in)
Risk: LOW

---

## Step 1: Prisma migration — add `legendLabels` to Widget

- [x] Add `legendLabels Json? @map("legend_labels")` to the Widget model in `schema.prisma`
- [x] Run `pnpm prisma migrate dev --name add_widget_legend_labels` from `packages/backend`
- [x] Regenerate Prisma client

No test needed — schema-only change verified by migration success.

---

## Step 2: RED — Controller unit test for PATCH endpoint

Add to `dashboards.controller.spec.ts`:

- [x] Test: `PATCH /dashboards/:id/widgets/:widgetId calls updateWidget and returns result`
  - Mock `service.updateWidget` to return an updated widget with new title and legendLabels
  - Call `controller.updateWidget('d1', 'w1', { title: 'New Title', legendLabels: { revenue: 'Monthly Revenue' } })`
  - Assert it returns the updated widget and service was called with correct args

This will fail — `updateWidget` doesn't exist on controller or service yet.

---

## Step 3: GREEN — Add controller PATCH method

- [x] Add `UpdateWidgetDto` to `dashboards.types.ts`: `{ title?: string; legendLabels?: Record<string, string> }`
- [x] Add `@Patch(':id/widgets/:widgetId')` method to `DashboardsController` that delegates to `service.updateWidget`
- [x] Controller test goes GREEN

---

## Step 4: RED — Service unit test for updateWidget (happy path)

Add to `dashboards.integration.spec.ts`:

- [x] Test: `updateWidget updates title and legendLabels`
  - Mock `prisma.widget.update` to return updated widget
  - Call `service.updateWidget('d1', 'w1', { title: 'New', legendLabels: { revenue: 'Rev' } })`
  - Assert `prisma.widget.update` called with `where: { id: 'w1', dashboardId: 'd1' }, data: { title: 'New', legendLabels: { revenue: 'Rev' } }`

---

## Step 5: GREEN — Implement updateWidget in service

- [x] Add `updateWidget(dashboardId, widgetId, dto)` to `DashboardsService`
- [x] Build a `data` object containing only the provided fields (title and/or legendLabels)
- [x] Call `prisma.widget.update` with `where: { id: widgetId, dashboardId }` and the data
- [x] Service test goes GREEN

---

## Step 6: RED — Service test for 404 when widget not found

- [x] Test: `updateWidget throws NotFoundException when widget does not exist`
  - Mock `prisma.widget.update` to reject with Prisma's `P2025` record-not-found error
  - Assert `NotFoundException` is thrown

---

## Step 7: GREEN — Handle not-found in updateWidget

- [x] Wrap the `prisma.widget.update` call in try/catch
- [x] Catch Prisma's `P2025` error code and throw `NotFoundException`
- [x] 404 test goes GREEN

---

## Step 8: RED — Controller test for empty body → 400

- [x] Test: `PATCH with empty body throws BadRequestException`
  - Call `controller.updateWidget('d1', 'w1', {})`
  - Assert `BadRequestException` is thrown

---

## Step 9: GREEN — Validate non-empty body in controller

- [x] Add guard in `updateWidget`: if neither `title` nor `legendLabels` is provided, throw `BadRequestException`
- [x] Empty body test goes GREEN

---

## Step 10: Refactor

- [x] Review all new code for naming, SRP, duplication
- [x] Ensure `UpdateWidgetDto` is exported and used consistently
- [x] Add `update` to the mocked prisma widget object in `beforeEach` of integration spec
- [x] Add `updateWidget` to the service mock Pick type in controller spec
- [x] Run full test suite — all green

[x] Reviewed
