# Schema Explorer Enhancement

## Goal

Enhance the schema explorer to show actual table data alongside metadata, allow users to annotate columns with business descriptions, and paginate the data preview.

## Current State

- Left panel: searchable table list
- Right panel: column metadata table (name, type, nullable, FK, indexes)
- Backend serves discovered metadata from Prisma; tenant DB is read-only

## What Changes

### 1. Tabbed Detail Panel

When a table is selected, the right panel shows two tabs:

- **Schema** tab (default) — existing column metadata table, plus an inline-editable "Description" column
- **Data** tab — paginated rows from the tenant database

### 2. Column Descriptions (Editable)

Each column gets an optional business-friendly description stored in our Prisma DB (not the tenant DB).

**Why**: Descriptions improve NL-to-SQL quality — they become part of the schema context sent to the LLM.

**UX**:
- In the Schema tab, a new "Description" column appears after "Type"
- Each cell shows the description text or a muted "Add description..." placeholder
- Click to edit inline — a text input replaces the cell
- Save on Enter or blur; cancel on Escape
- Auto-saves via API (no separate save button)

**Acceptance Criteria**:
- [ ] Description column visible in the schema tab
- [ ] Click-to-edit with inline input
- [ ] Persists to backend on Enter/blur
- [ ] Escape cancels without saving
- [ ] Optimistic UI — shows new value immediately, reverts on error
- [ ] Empty descriptions show placeholder text

### 3. Data Preview Tab

Shows a paginated table of actual rows from the tenant database.

**UX**:
- Switching to "Data" tab fetches page 1 (25 rows)
- Column headers match the table's columns
- Standard table layout, horizontal scroll for wide tables
- Pagination controls at the bottom: Previous / Page N of M / Next
- Row count displayed (e.g., "Showing 1-25 of 1,204")

**Acceptance Criteria**:
- [ ] Data tab fetches and displays rows from tenant DB
- [ ] 25 rows per page
- [ ] Previous/Next pagination controls
- [ ] Shows total row count and current range
- [ ] Loading skeleton while fetching
- [ ] Error state if query fails
- [ ] Empty state for tables with no rows

### 4. Backend: Table Data Endpoint

New endpoint to fetch paginated table data.

```
GET /schema/:connectionId/tables/:tableId/data?page=1&pageSize=25
```

**Response**:
```json
{
  "rows": [...],
  "totalRows": 1204,
  "page": 1,
  "pageSize": 25
}
```

**Implementation**:
- Looks up the table's schema and name from `DiscoveredTable`
- Connects to tenant DB (read-only)
- Runs `SELECT * FROM "schema"."table" LIMIT 25 OFFSET 0`
- Runs `SELECT count(*) FROM "schema"."table"` for total
- Returns paginated response

**Safety**:
- Table/schema names come from our DB (not user input) — no SQL injection risk
- Tenant connection remains read-only
- Query timeout applies (reuse existing pattern)

### 5. Backend: Column Description Endpoints

```
PUT /schema/columns/:columnId/description
Body: { "description": "The customer's primary email address" }

Response: { "columnId": "...", "description": "..." }
```

**Implementation**:
- New `description` field on `DiscoveredColumn` model (nullable string)
- Single endpoint to set/clear description
- Empty string or null clears the description

### 6. DB Migration

Add `description` column to `discovered_columns` table:

```
ALTER TABLE discovered_columns ADD COLUMN description TEXT;
```

## Slicing

### Slice 1 — Tabbed Layout + Data Preview
- Add tab UI (Schema | Data) to the detail panel
- Backend endpoint for paginated table data
- Frontend fetches and renders data tab with pagination
- Schema tab remains unchanged (just wrapped in a tab)

### Slice 2 — Column Descriptions
- Prisma migration: add `description` to `DiscoveredColumn`
- Backend endpoint to update column description
- Include description in schema tab table
- Inline editing UX
- Wire descriptions into schema context for NL-to-SQL

## Out of Scope

- Editing actual tenant data (INSERT/UPDATE/DELETE)
- Column sorting/filtering in the data tab
- Export to CSV
- Table-level descriptions (can add later)
- Full-text search within data
