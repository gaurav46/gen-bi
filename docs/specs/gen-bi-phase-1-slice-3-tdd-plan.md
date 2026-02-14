# TDD Plan: Gen-BI Phase 1 -- Slice 3: Table & Column Analysis

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it ([ ] -> [x]).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

**Important constraints:**
- Use `TenantDatabasePort` for all tenant DB queries -- it is already built
- Tenant DB connections are read-only: only SELECT queries via information_schema
- Use Prisma for storing metadata in the internal DB
- Use CLI tools for dependencies (`pnpm add`, `npx prisma`) -- never manually edit package.json
- Use `npx prisma migrate dev` for migrations -- never reset the database
- Do not commit unless explicitly asked to
- SRP, DRY, YAGNI at all times
- Import Prisma client from `generated/prisma/client`

## Context
- **Source**: `docs/specs/gen-bi-phase-1.md`
- **Slice**: Slice 3: Table & Column Analysis
- **Risk level**: HIGH (complex SQL queries against information_schema, large schema handling, new Prisma models, multiple metadata types)
- **API endpoints**:
  - `POST /api/schema/discover` -- `{ connectionId, schemas: ["public", "sales"] }`
  - `GET /api/schema/discover/status` -- progress of current discovery
  - `GET /api/schema/:connectionId/tables` -- discovered metadata
- **Acceptance Criteria**:
  1. Discovers tables, columns, data types, foreign keys, and indexes for selected schemas
  2. Shows "Analyzing tables..." progress step with count (e.g., "Analyzing table 3 of 12")
  3. Stores discovered schema metadata (tables, columns, types, FKs, indexes) in internal DB (Prisma)
  4. Prisma migration creates tables for schema metadata storage
  5. Shows an error when a selected schema contains zero tables
  6. Analysis can handle databases with 100+ tables without timeout

## Codebase Analysis

### Existing Structure
- **Backend**: NestJS at `packages/backend/src/`
  - `SchemaDiscoveryModule` with `SchemaDiscoveryService` (has `testConnection`) and `TenantDatabaseAdapter`
  - `TenantDatabasePort` interface: `connect()`, `query()`, `disconnect()`
  - `ConnectionsService.findOne()` decrypts password
  - DI tokens: `PRISMA_CLIENT`, `TENANT_DATABASE_PORT`
  - No dedicated controller for schema-discovery yet -- `POST :id/test` lives on `ConnectionsController`
  - Vitest with `unplugin-swc`
- **Frontend**: Vite + React + shadcn/ui at `packages/frontend/src/`
  - `SettingsForm` has schema discovery flow with checkboxes and Analyze button
  - Analyze button `onClick` currently does nothing (`() => undefined`)
  - shadcn components: button, input, label, card, checkbox

### Architecture for Slice 3
| Layer | Role | Location |
|-------|------|----------|
| Inbound Adapter | `SchemaController` -- new controller for `/schema/*` routes | `schema-discovery/schema.controller.ts` |
| Use Case | `SchemaDiscoveryService` -- extend with `analyzeSchemas()` and `getDiscoveredTables()` | `schema-discovery/schema-discovery.service.ts` |
| Outbound Port | `TenantDatabasePort` (reuse) | `schema-discovery/tenant-database.port.ts` |
| Outbound Adapter | `TenantDatabaseAdapter` (reuse) | `schema-discovery/tenant-database.adapter.ts` |
| Persistence | Prisma models for `DiscoveredTable`, `DiscoveredColumn`, `DiscoveredForeignKey`, `DiscoveredIndex` | `prisma/schema.prisma` |
| Frontend | Analyze button triggers POST, shows progress | `SettingsForm.tsx` |

### Test Infrastructure
- **Backend**: Vitest, `@nestjs/testing`, `vi.fn()` for mocks
- **Frontend**: Vitest, React Testing Library, `vi.stubGlobal('fetch', ...)`
- **Run commands**: `pnpm --filter backend test`, `pnpm --filter frontend test`

---

## Step 0: Prisma schema + migration for metadata storage

- [x] Add Prisma models to `packages/backend/prisma/schema.prisma`:
  - `DiscoveredTable` -- connectionId, schemaName, tableName, createdAt
  - `DiscoveredColumn` -- tableId (FK), columnName, dataType, isNullable, ordinalPosition
  - `DiscoveredForeignKey` -- tableId (FK), columnName, foreignTableSchema, foreignTableName, foreignColumnName, constraintName
  - `DiscoveredIndex` -- tableId (FK), indexName, columnName, isUnique
  - Use `@@map` for snake_case table names, `@map` for snake_case column names
  - `DiscoveredTable` has a unique constraint on `[connectionId, schemaName, tableName]`
  - Relations: `DiscoveredTable` has many columns, foreign keys, and indexes

- [x] Run migration: `cd packages/backend && npx prisma migrate dev --name add_schema_metadata_tables`

- [x] Verify migration succeeded and Prisma client regenerated

---

## Behavior 1: SchemaController accepts POST /schema/discover and delegates to service

**Given** a request body with `connectionId` and `schemas` array
**When** `POST /api/schema/discover` is called
**Then** the controller delegates to `SchemaDiscoveryService.analyzeSchemas()` and returns the result

- [x] **RED**: Write failing controller test
- [x] **RUN**: Confirm test FAILS (file/class does not exist)
- [x] **GREEN**: Implement minimum code
- [x] **RUN**: Confirm test PASSES
- [x] **REFACTOR**: Verify the controller is thin -- just delegates

---

## Behavior 2: SchemaController serves GET /schema/:connectionId/tables

**Given** schema metadata has been stored for a connectionId
**When** `GET /api/schema/:connectionId/tables` is called
**Then** the controller returns the stored metadata

- [x] **RED**: Write failing controller test
- [x] **RUN**: Confirm test FAILS
- [x] **GREEN**: Add `@Get(':connectionId/tables')` handler
- [x] **RUN**: Confirm test PASSES

---

## Behavior 3: SchemaController serves GET /schema/discover/status

**Given** an analysis is in progress
**When** `GET /api/schema/discover/status` is called
**Then** the controller returns current progress

- [x] **RED**: Write failing controller test
- [x] **RUN**: Confirm test FAILS
- [x] **GREEN**: Add `@Get('discover/status')` handler (declared BEFORE `:connectionId/tables`)
- [x] **RUN**: Confirm test PASSES

---

## Behavior 4: Service discovers tables for selected schemas via information_schema

**Given** a connectionId and selected schemas
**When** `analyzeSchemas(connectionId, schemas)` is called
**Then** it connects to the tenant DB, queries tables from information_schema, and returns the count

- [x] **RED**: Write failing service test
- [x] **RUN**: Confirm test FAILS
- [x] **GREEN**: Add `analyzeSchemas` method with PRISMA_CLIENT injection, parameterized queries
- [x] **RUN**: Confirm test PASSES
- [x] **REFACTOR**: SQL uses parameterized queries with placeholders

---

## Behavior 5: Service discovers columns for each table

**Given** tables have been discovered
**When** columns are queried from information_schema
**Then** column metadata (name, type, nullable, ordinal position) is returned for each table

- [x] **RED**: Write failing service test
- [x] **RUN**: Confirm test FAILS
- [x] **GREEN**: Column discovery included in analyzeSchemas
- [x] **RUN**: Confirm test PASSES

---

## Behavior 6: Service discovers foreign keys

**Given** tables have been discovered
**When** foreign keys are queried
**Then** FK metadata (constraint name, column, referenced table/column) is returned

- [x] **RED**: Write failing service test
- [x] **RUN**: Confirm test FAILS
- [x] **GREEN**: FK discovery included in analyzeSchemas
- [x] **RUN**: Confirm test PASSES

---

## Behavior 7: Service discovers indexes

**Given** tables have been discovered
**When** indexes are queried
**Then** index metadata (name, columns, uniqueness) is returned

- [x] **RED**: Write failing service test
- [x] **RUN**: Confirm test FAILS
- [x] **GREEN**: Index discovery included in analyzeSchemas
- [x] **RUN**: Confirm test PASSES

---

## Behavior 8: Service persists all discovered metadata to Prisma

**Given** tables, columns, FKs, and indexes have been discovered
**When** the analysis completes
**Then** all metadata is stored in the internal DB via Prisma, replacing any previous data for that connectionId

- [x] **RED**: Write failing service test
- [x] **RUN**: Confirm test FAILS
- [x] **GREEN**: Persistence with deleteMany + create implemented
- [x] **RUN**: Confirm test PASSES
- [x] **REFACTOR**: Verified delete-before-create ordering

---

## Behavior 9: Service tracks and exposes progress

**Given** an analysis is in progress
**When** each table is being processed
**Then** the progress is updated with current table number and total count

- [x] **RED**: Write failing service test
- [x] **RUN**: Confirm test FAILS
- [x] **GREEN**: Progress tracking with getDiscoveryStatus() implemented
- [x] **RUN**: Confirm test PASSES

---

## Behavior 10: Service retrieves stored metadata via getDiscoveredTables

**Given** metadata has been persisted for a connectionId
**When** `getDiscoveredTables(connectionId)` is called
**Then** it returns the stored tables with their columns, FKs, and indexes

- [x] **RED**: Write failing service test
- [x] **RUN**: Confirm test FAILS
- [x] **GREEN**: getDiscoveredTables with Prisma findMany + include implemented
- [x] **RUN**: Confirm test PASSES

---

## Behavior 11: Wire up the module -- register controller and Prisma dependency

- [x] Add `SchemaController` to `SchemaDiscoveryModule` controllers array
- [x] Export `PRISMA_CLIENT` from `ConnectionsModule` so `SchemaDiscoveryService` can inject it
- [x] **RUN**: Full backend test suite passes: `pnpm --filter backend test` — 40 tests pass

---

## Behavior 12: Frontend -- Analyze button triggers POST /schema/discover

**Given** the user has selected schemas and clicks Analyze
**When** the button is clicked
**Then** a POST request is sent with the connectionId and selected schemas

- [x] **RED**: Write failing test — Analyze button POST
- [x] **RUN**: Confirm test FAILS
- [x] **GREEN**: Analyze button POSTs to /api/schema/discover with connectionId + schemas
- [x] **RUN**: Confirm test PASSES

---

## Behavior 13: Frontend -- Shows "Analyzing tables..." progress with count

**Given** the Analyze API call is in progress
**When** the status endpoint is polled
**Then** the UI shows "Analyzing table N of M"

- [x] **RED**: Write failing test — progress polling
- [x] **RUN**: Confirm test FAILS
- [x] **GREEN**: Polls GET /api/schema/discover/status in parallel with POST, displays message
- [x] **RUN**: Confirm test PASSES

---

## Behavior 14: Frontend -- Shows completion and transitions after analysis

**Given** the analysis completes successfully
**When** the status returns `done`
**Then** the UI shows a success indicator

- [x] **RED**: Write failing test — completion message
- [x] **RUN**: Confirm test FAILS
- [x] **GREEN**: Shows "Analysis complete" when status is done
- [x] **RUN**: Confirm test PASSES

---

## Edge Cases (HIGH risk level)

### Empty schema -- zero tables

- [x] **RED + GREEN**: `'analyzeSchemas throws error when selected schema has zero tables'`

### Large schema -- 100+ tables performance

- [x] **RED + GREEN**: `'analyzeSchemas handles 100+ tables without error'` — queries batched by schema, no N+1

### Disconnect on failure

- [x] **RED + GREEN**: `'analyzeSchemas disconnects even when a query fails mid-analysis'`

### Re-running analysis replaces previous data

- [x] **RED + GREEN**: `'analyzeSchemas deletes previous metadata before storing new results'` — verified call ordering

### Connection config not found

- [x] **RED + GREEN**: `'analyzeSchemas returns 404 when connectionId does not exist'`

### Frontend -- error during analysis

- [x] **RED + GREEN**: `'shows error message when analysis fails'`

### Frontend -- error when schema has zero tables

- [x] **RED + GREEN**: `'shows error when selected schema has zero tables'` — same test covers this

### SQL injection safety

- [x] **RED + GREEN**: `'schema names are parameterized in queries'` — extended TenantDatabasePort.query to accept params

### Concurrent analysis requests

- [x] **RED + GREEN**: `'second analyzeSchemas call while one is running rejects'` — checks progress.status at start

---

## Final Check

- [x] **Run full backend test suite**: `pnpm --filter backend test` -- 40 tests pass
- [x] **Run full frontend test suite**: `pnpm --filter frontend test` -- 25 tests pass
- [x] **Review test names**: Read them top to bottom -- they describe the feature clearly
- [x] **Review implementation**: No dead code, no unused parameters, no over-engineering
- [x] **Architecture check**:
  - SchemaController is thin -- just delegates to service
  - SchemaDiscoveryService orchestrates: connect, query, transform, persist
  - TenantDatabaseAdapter handles tenant DB I/O (reused from Slice 2)
  - Prisma handles internal DB persistence
  - No infrastructure code leaks into business logic
  - Port interface is the contract between service and adapter
  - Parameterized queries prevent SQL injection

## Test Summary
| Category | # Tests | Layer |
|----------|---------|-------|
| SchemaController (POST /discover, GET /status, GET /tables) | 3 | Inbound Adapter |
| SchemaDiscoveryService (analyze orchestration, progress, retrieval) | 7 | Use Case |
| Frontend (analyze trigger, progress, completion) | 3 | Inbound Adapter (UI) |
| Edge cases (empty schema, large DB, disconnect, re-run, 404, errors, SQL safety, concurrency) | 8 | Mixed |
| **Total** | **21** | |

[x] Reviewed
