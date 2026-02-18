# Spec: Schema Explorer - Phase 1 (Read-Only Data Preview with Pagination)

## Overview

Add a data preview grid below the existing column detail panel in the schema explorer. When a user selects a table, they see its actual row data with pagination (25 rows per page) -- no SQL required. This phase is read-only; editing comes in Phase 2.

## Acceptance Criteria

### Backend: Paginated Row Fetch

- [ ] Backend exposes an endpoint that returns paginated rows for a given connection, schema, and table
- [ ] Returns 25 rows per page by default
- [ ] Returns total row count for the table alongside the page data
- [ ] Accepts a page number parameter (1-based) and defaults to page 1
- [ ] Quotes the schema name and table name in the generated SQL to handle reserved words and special characters
- [ ] Uses parameterized LIMIT/OFFSET (not string interpolation) for pagination values
- [ ] Returns an error when the connection ID does not exist
- [ ] Returns an error when the requested table does not exist in the tenant database
- [ ] Returns an empty rows array (not an error) when the table has zero rows
- [ ] Returns an error when the page number is less than 1
- [ ] Detects and returns whether the table has a primary key (column names if yes, empty array if no)

### Frontend: Data Preview Grid

- [ ] Data preview grid appears below the column detail panel when a table is selected
- [ ] Column headers in the grid match the table's column names
- [ ] Rows display actual data values from the tenant database
- [ ] Shows a loading state while row data is fetching
- [ ] Shows an error message if the row fetch fails, with a retry button
- [ ] Shows a "No data" message when the table has zero rows
- [ ] Long text values are truncated in cells to prevent layout breakage
- [ ] Null values are visually distinguishable from empty strings

### Frontend: Pagination Controls

- [ ] Pagination controls appear below the data grid
- [ ] Shows current page number and total page count (e.g., "Page 1 of 12")
- [ ] Previous button is disabled on page 1
- [ ] Next button is disabled on the last page
- [ ] Clicking Next fetches and displays the next page of rows
- [ ] Clicking Previous fetches and displays the previous page of rows
- [ ] Switching to a different table resets pagination to page 1
- [ ] Shows total row count near the pagination controls

## API Shape

```
GET /api/schema/:connectionId/tables/:schemaName/:tableName/rows?page=1

Response 200:
{
  rows: Record<string, unknown>[],
  totalRows: number,
  page: number,
  pageSize: number,
  primaryKeyColumns: string[]
}

Response 404 (connection or table not found):
{ message: string }

Response 400 (invalid page):
{ message: string }
```

## Out of Scope

- Inline cell editing (Phase 2)
- Sorting or filtering the data grid
- User-configurable page size (fixed at 25)
- Row deletion, insertion, or any write operation
- Schema modification
- Horizontal scrolling optimization for wide tables (basic overflow-auto is fine)
- Caching row data across page navigations

## Technical Context

- **Patterns to follow:** Hexagonal architecture -- new port method on `SchemaDataPort` (frontend) and new service method using `TenantDatabasePort` (backend). Similar to existing `QueryService.fetchSampleRows()` which does `SELECT * FROM "table" LIMIT 5`.
- **Backend connection pattern:** `SchemaDiscoveryService` connects via `TenantDatabasePort`, sets read-only mode, queries, then disconnects. The new endpoint follows this same connect/query/disconnect lifecycle.
- **Frontend port injection:** `SchemaExplorerPage` receives `SchemaDataPort` as a prop. The new `fetchRows` method goes on this same port (or a new port if separation is cleaner).
- **UI components available:** shadcn/ui `Table`, `Button`, `Badge`, `Skeleton` -- no pagination component exists yet, build one from `Button` components.
- **Key integration point:** `SchemaExplorerPage.tsx` currently renders `ColumnDetailPanel` in the right panel. The data preview grid renders below it in the same panel area.
- **Total row count:** Use `SELECT count(*) FROM "schema"."table"` as a separate query alongside the data fetch.
- **PK detection query:** Use `pg_constraint` or `information_schema.table_constraints` to check for primary key constraints on the table.
- **Risk level:** MODERATE -- new tenant DB query patterns, but read-only and follows established connection lifecycle.

## Slices

### Slice 1: Backend paginated row fetch + PK detection
All backend ACs — the endpoint, pagination, total count, PK detection, error cases. Frontend can test against this endpoint immediately.

### Slice 2: Frontend data preview grid + pagination controls
All frontend ACs — data grid below column details, loading/error/empty states, pagination controls with prev/next.

[x] Reviewed