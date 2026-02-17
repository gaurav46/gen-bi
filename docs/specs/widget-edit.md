# Spec: Widget Edit — Title & Legend Labels

## Overview
Add a pencil/edit icon to each dashboard widget that opens a dialog where users can rename the widget title and customize chart legend labels (series names). Changes are persisted per widget.

## Slice 1: Backend PATCH endpoint + schema migration
- [x] Widget model has a `legendLabels` JSON field (nullable, defaults to null) storing `{ columnName: customLabel }` mappings
- [x] PATCH `/dashboards/:id/widgets/:widgetId` accepts `{ title?, legendLabels? }` and updates the widget
- [x] PATCH returns the updated widget
- [x] PATCH with empty body returns 400
- [x] PATCH with non-existent widget returns 404

## Slice 2: Edit dialog + legend label rendering
- [ ] Each widget card on the dashboard detail page shows a pencil icon button
- [ ] Clicking the pencil icon opens a dialog with the current title in an editable text field
- [ ] The dialog lists each measure column with an editable label field, pre-filled with the custom label (if set) or the original column name
- [ ] Saving the dialog calls PATCH and updates the widget in-place (no full page reload)
- [ ] Cancelling the dialog discards changes
- [ ] Chart legend displays custom labels instead of raw column names when `legendLabels` is set
- [ ] When `legendLabels` is not set or a column has no custom label, the original column name is used

## API Shape

```
PATCH /api/dashboards/:id/widgets/:widgetId
{ title?: string, legendLabels?: Record<string, string> }
→ 200 { id, dashboardId, title, sql, chartType, columns, legendLabels, position, createdAt }
```

## Out of Scope
- Editing SQL or chart type from the edit dialog
- Drag-to-reorder widgets
- Editing the dashboard name
- Dimension label customization (only measure/series labels)

## Technical Context
- Patterns: hexagonal architecture, port/adapter for frontend, Prisma for backend
- Recharts `<Bar>`, `<Line>`, `<Area>` accept a `name` prop that overrides the legend label
- Existing chart panels pass `dataKey={key}` — adding `name={customLabel}` is the rendering change
- Risk level: LOW

[x] Reviewed
