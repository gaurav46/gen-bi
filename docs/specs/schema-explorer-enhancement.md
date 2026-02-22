# Discovery: Schema Explorer Enhancement

## Why

The schema explorer today shows table structure (columns, types, foreign keys, indexes) but not the actual data. Users have to leave the explorer and run manual queries just to see what is in a table. We want the explorer to be the one-stop place where users can browse table structure, preview data, page through rows, and fix data values inline -- without writing SQL.

## Layout Wireframe

<!-- -------- bee-comment -------- -->
> **@developer**: can we add the layout info as wireframe
> **@bee**: Added ASCII wireframe showing the full schema explorer layout with data preview and pagination.
> - [ ] mark as resolved
<!-- -------- /bee-comment -------- -->

```
┌─────────────────────────────────────────────────────────────────────┐
│  Schema Explorer                                                    │
├──────────────┬──────────────────────────────────────────────────────┤
│ [Search...]  │  orders                                              │
│              │  ┌─ Column Details ─────────────────────────────────┐│
│  customers   │  │ Column      │ Type    │ Null │ FK        │ Idx  ││
│ >orders      │  │ id          │ int4    │      │           │ PK   ││
│  products    │  │ customer_id │ int4    │      │ customers │ IDX  ││
│  categories  │  │ total       │ numeric │ YES  │           │      ││
│  shipments   │  │ status      │ varchar │      │           │      ││
│  ...         │  └─────────────────────────────────────────────────┘│
│              │                                                      │
│              │  ┌─ Data Preview ───────────────────────────────────┐│
│              │  │ id │ customer_id │ total  │ status    │         ││
│              │  │ 1  │ 42          │ 150.00 │ shipped   │         ││
│              │  │ 2  │ 17          │  89.50 │ pending   │         ││
│              │  │ 3  │ 42          │ 220.00 │ delivered │         ││
│              │  │ .. │             │        │           │         ││
│              │  └─────────────────────────────────────────────────┘│
│              │  ◀ Prev  Page 1 of 12  Next ▶                       │
│  (scroll)    │                                                      │
└──────────────┴──────────────────────────────────────────────────────┘
```

**Layout notes:**
- Left sidebar (w-72): table list with search — unchanged from today
- Right panel top: existing column detail table (schema metadata)
- Right panel bottom: new data preview grid with actual row data
- Pagination controls below the data grid (Prev / Next, page indicator)
- Cells are click-to-edit in Phase 2 (tables with PK only)
- Tables without PK: data grid shows rows but cells are not editable, with a banner

## Who

- **App users exploring a connected database.** They select a table in the sidebar, see its columns, and now also want to see and page through real rows. They need a quick way to spot-check data and correct mistakes in place.

## Success Criteria

- Users can see actual row data for any table directly beneath the column metadata, without running a separate query.
- Users can click a cell, change a value, and save it -- and the change persists in the tenant database.
- Tables without a primary key still show data but clearly communicate that editing is not available (and why).
- Large tables are navigable via pagination without loading the entire dataset at once.
- No accidental DELETE, DROP, ALTER, or other destructive operations are possible through this feature.

## Problem Statement

The schema explorer is currently metadata-only. To see actual data, users must switch to the query interface and write SQL by hand. This creates friction for simple tasks like verifying data, spotting anomalies, or correcting a wrong value. We are adding a data preview grid with pagination and inline cell editing so the explorer becomes a complete data browsing and light-editing tool -- while keeping destructive write operations firmly blocked.

## Hypotheses

- H1: Most tables users care about have a primary key, so PK-based row identification will cover the common case.
- H2: 25 rows per page is a comfortable default that balances data visibility with page load speed.
- H3: Inline cell editing (click-to-edit, save/cancel) is intuitive enough that users will not need a separate "edit form" view.
- H4: Allowing UPDATE while blocking DELETE/DROP/ALTER is a safe enough write policy for this use case (no auth system exists yet).

## Out of Scope

- **Row deletion.** Users cannot delete rows through the explorer.
- **Schema modification.** No CREATE, ALTER, or DROP operations.
- **INSERT / adding new rows.** Not part of this feature.
- **User-configurable page size.** Fixed at 25 rows.
- **Sorting or filtering the data grid.** May come later; not in this scope.
- **Bulk editing.** One cell at a time only.
- **Undo/history.** Once saved, there is no built-in revert.
- **Auth or permissions.** No user-level access control for who can edit. This is a known gap.

## Milestone Map

### Phase 1: Read-only data preview with pagination

The walking skeleton. Users select a table and see its rows beneath the column metadata.

- Fetch paginated rows from the tenant database (SELECT with LIMIT/OFFSET, 25 rows per page)
- Display a data grid below the existing column detail panel
- Show page controls (previous / next, current page indicator, total row count)
- Detect whether the table has a primary key (needed for Phase 2)
- Backend endpoint: paginated row fetch for a given connection + table

### Phase 2: Inline cell editing (UPDATE)

Build on Phase 1's data grid to make cells editable -- only for tables that have a primary key.

- Click a cell to enter edit mode; show the current value in an input field
- Save (confirm) or cancel the edit per cell
- Construct a parameterized UPDATE statement using the primary key to identify the row
- New backend endpoint: accept a row update (table, PK values, column, new value) and execute it safely
- Enable a write-capable connection path in the tenant database adapter (UPDATE only; all other writes remain blocked)
- For tables without a primary key: show data read-only with a message explaining why editing is not available
- Validate on the backend that only UPDATE statements are generated (no user-supplied SQL)

## Open Questions

- **Composite primary keys:** The PK detection needs to handle composite keys. How common are composite PKs in the tenant databases we connect to? (Implementation will support them, but UX may need thought if rows have many PK columns.)
- **Data types in the edit field:** Some column types (JSON, arrays, timestamps) may need special handling in the cell editor. Phase 2 may start with simple text/number types and expand.
- **Concurrency:** If two users edit the same cell, last-write-wins is the implicit behavior. Is that acceptable, or do we need optimistic locking?
- **Audit trail:** With no auth system and no undo, there is no record of who changed what. Should we log updates somewhere before enabling this in production?
- **Connection pooling:** The current adapter creates a new `Client` per connection. With writes enabled, should we address connection reuse before or after this feature?
- **Large text / blob columns:** Should the data grid truncate long values? What is the display limit per cell?

## Revised Assessment

Size: FEATURE -- Two well-scoped phases, each with a small number of capabilities. Phase 1 is a straightforward read path. Phase 2 adds one write operation with clear guardrails. This does not rise to EPIC level.

Risk: MODERATE -- The main risk is enabling writes on tenant databases for the first time. The mitigation (UPDATE-only, PK-required, parameterized queries, no user-supplied SQL) is clear but must be implemented carefully. The absence of auth and audit logging is a known gap that does not block this feature but should be addressed before broad rollout.

Greenfield: no

[x] Reviewed
