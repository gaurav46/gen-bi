# Spec: Phase 3 — Visualize

## Overview

Users ask a question and see the answer rendered as the right chart — bar, line, pie, KPI card, or table. The AI already picks the chart type (Phase 2 tidy fix). This phase adds the data transformer, chart components, and a chart type override so users can switch visualizations.

## Slice 1: Data Transformer + Bar, Line, Area, Pie Charts

<!-- -------- bee-comment -------- -->
> **@developer**: I am thinking we will only be able to think about the architecture, and the data complexity if we work on two three chart types at once. I am assuming most charts will have different shapes of input data.
> **@bee**: Good call. Merged Slices 1+2 into a single slice with bar, line, and pie. This forces us to design the transformer for all three data shapes upfront: bar/line share the same shape, pie needs a different one. Better architecture validation.
> - [x] mark as resolved
<!-- -------- /bee-comment -------- -->

<!-- -------- bee-comment -------- -->
> **@developer**: is there any other chart type which may have different data shapes? Bar and line charts are fundamentally same thing. I would select upto 5 charts which cover 99% of user requirements
> **@bee**: You're right that bar and line are the same shape. Across all Recharts chart types, there are only 4 distinct data shapes: (1) category × measures → bar, line, area, (2) name-value pairs → pie, (3) single value → KPI card, (4) tabular → table. Adding **area chart** is free — same transform as bar/line, very common in BI for showing trends with volume. So 5 chart types (bar, line, area, pie, KPI card) + table = 6 visualizations covering 99% of BI needs, with only 3 transform functions. Added area chart to Slice 1.
> - [x] mark as resolved
<!-- -------- /bee-comment -------- -->

Build the data transformer and chart types together so the architecture handles all data shapes from the start.

<!-- -------- bee-comment -------- -->
> **@developer**: i like the idea of charttype, but how would you write a data mapper? Queries will always return data as rows, but each chart type will have different data input requirements.
> **@bee**: The transformer has a per-chart-type strategy, but the shapes are simpler than you'd expect. Recharts bar and line charts use the same format: `[{ dimension: "Alice", revenue: 500, orders: 12 }, ...]` — rows are passed nearly as-is, just keyed by column name. Pie needs a different shape: `[{ name: "Alice", value: 500 }, ...]` — first dimension becomes `name`, first measure becomes `value`. So the transformer is a small switch: bar/line → pass rows with dimension/measure keys, pie → reshape to name/value pairs. Column `role` metadata ("dimension" vs "measure") drives the mapping.
> - [x] mark as resolved
<!-- -------- /bee-comment -------- -->

- [x] Bar chart renders when AI recommends `chartType: "bar"`
- [x] Line chart renders when AI recommends `chartType: "line"`
- [x] Area chart renders when AI recommends `chartType: "area"`
- [x] Pie chart renders when AI recommends `chartType: "pie"`
- [x] Data transformer reshapes query rows per chart type using column roles:
  - Bar/Line/Area: dimension column → x-axis key, measure columns → data series (same transform)
  - Pie: first dimension → `name`, first measure → `value`
- [x] Charts use the existing `--chart-1` through `--chart-5` CSS variables for colors
- [x] Multiple measures render as grouped bars (bar), multiple line series (line), or stacked areas (area)
- [x] Pie chart uses first measure only when multiple measures exist
- [x] Table still renders as fallback when `chartType: "table"` (existing behavior preserved)
- [x] Chart shows below the title, above the SQL display

### Data Transformer Design

<!-- -------- bee-comment -------- -->
> **@developer**: do we plan to implement transformForChart for each chart type? Or recharts will handle all chart types?
> **@bee**: Both, in a sense. The transformer has a per-chart-type function, but bar and line share the same one (Recharts uses identical data format for both). So there are really three transform strategies: (1) bar/line → rows keyed by column name, (2) pie → reshape to name/value pairs, (3) kpi → extract single value. The chart components then pass this pre-shaped data to Recharts. Clarified below with the three shapes.
> - [x] mark as resolved
<!-- -------- /bee-comment -------- -->

<!-- -------- bee-comment -------- -->
> **@developer**: do we need to add some sort of data mapper for each chart type?
> **@bee**: Yes — but it's lightweight. Three transform functions, not five. Bar and line share a transform, pie has its own, KPI has its own. Each is a small pure function. Added the three shapes below to make this concrete.
> - [x] mark as resolved
<!-- -------- /bee-comment -------- -->

No backend changes. Frontend receives the existing `QueryResponse`:
```
{ intent, title, sql, visualization: { chartType }, columns, rows, attempts }
```

Three transform strategies (pure functions in `domain/`):

**Bar/Line/Area** — rows keyed by column name (Recharts uses this directly):
```
transformForBarLine(rows, columns) → { data: [{ month: "Jan", revenue: 500, orders: 12 }], dimensionKey: "month", measureKeys: ["revenue", "orders"] }
```

**Pie** — reshape to name/value pairs:
```
transformForPie(rows, columns) → { data: [{ name: "Alice", value: 500 }] }
```

**KPI** (Slice 2) — extract single value:
```
transformForKpi(rows, columns) → { label: "Total Revenue", value: 15000 }
```

## Slice 2: KPI Card

- [x] KPI card renders when AI picks `chartType: "kpi_card"`
- [x] KPI card shows the AI-generated title as label and the single value prominently
- [x] KPI card handles single-row, single-measure results (the typical KPI shape)
- [x] When result has multiple rows, KPI card shows the first row's measure value

## Slice 3: Chart Type Override

<!-- -------- bee-comment -------- -->
> **@developer**: why AI picks up the cart type? Shouldnt' we let the user choose from a few recommendations?
> **@bee**: The AI picks a *default* — its best guess based on data shape and intent. But it's not locked in. Slice 3 (chart type override) lets the user switch to any chart type after seeing the AI's pick. So the flow is: AI recommends → user sees result → user can override. This gives the best of both worlds: smart default + user control. Updated the language to say "AI recommends" instead of "AI picks" to make this clearer.
> - [x] mark as resolved
<!-- -------- /bee-comment -------- -->

- [x] User can switch between available chart types via a selector
- [x] Selector shows icons or labels for: bar, line, area, pie, KPI card, table
- [x] AI-recommended chart type is pre-selected as default
- [x] Switching chart type re-renders the same data with the new visualization
- [x] Selected chart type is visually indicated in the selector
- [x] Override does not re-query — it only changes the frontend rendering

## Out of Scope

<!-- -------- bee-comment -------- -->
> **@developer**: if chart animations are easily supported then why not add them?
> **@bee**: Fair point — Recharts enables animations by default (`isAnimationActive={true}`). So we get them for free. Removed from out-of-scope. We'll just use Recharts' default animation behavior without custom tuning.
> - [x] mark as resolved
<!-- -------- /bee-comment -------- -->

- Chart tooltips beyond Recharts defaults
- Responsive chart sizing (basic container-width is fine, no breakpoint-specific behavior)
- Chart download/export as image
- Custom axis labels or formatting beyond what Recharts provides
- Trend indicators on KPI cards
- Persisting the user's chart type override (resets on next query)

## Technical Context

- **Architecture**: Hexagonal — transform functions are pure functions in `domain/`, chart components in `components/workspace/`
- **Charting library**: Recharts (to be installed via `pnpm add recharts`)
- **Design system**: shadcn/ui + Tailwind CSS v4, chart colors already defined (`--chart-1` through `--chart-5`)
- **Existing code**: `WorkspacePage` currently renders `ResultsTable` + `SqlDisplay`. Charts slot in between title and SQL display.
- **Column metadata**: `columns[].role` (`dimension` | `measure`) drives axis mapping
- **Risk level**: MODERATE

[x] Reviewed
