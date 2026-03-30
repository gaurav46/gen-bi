# Spec: DuckDB + SQL Server — Phase 1: Shared Foundation

## Overview

Thread `dbType` through the data model, API, and connection form so that Phase 2 (DuckDB app DB) and Phase 3 (SQL Server tenant adapter) can be built in parallel. Phase 1 delivers no visible end-user capability change beyond a database-type selector in the connection form with auto-toggling port defaults.

---

## Slice 1: `dbType` in the data model and API

### Acceptance Criteria

- [x] `ConnectionConfig` Prisma model gains a `dbType` String field that defaults to `'postgresql'`; the Prisma migration is generated and applies cleanly
- [x] `TenantConnectionConfig` type in `tenant-database.port.ts` gains a `dbType: 'postgresql' | 'sqlserver'` field
- [x] `CreateConnectionDto` in `connections.service.ts` gains a `dbType: 'postgresql' | 'sqlserver'` field
- [x] `ConnectionsService.create` persists `dbType` to the database
- [x] `ConnectionsService.getTenantConnectionConfig` returns `dbType` in the `TenantConnectionConfig` it produces
- [x] `ConnectionsService.findOne` returns `dbType` in its response object
- [x] `POST /api/connections` accepts `dbType` and stores it; omitting `dbType` stores `'postgresql'`
- [x] `GET /api/connections/:id` returns `dbType` in the response body
- [x] Existing connections in the database that predate this migration are readable and treated as `'postgresql'`
- [x] No existing tests break after this change

### API Shape

```typescript
// POST /api/connections — request body (dbType is optional, defaults to 'postgresql')
{
  host: string
  port: number
  databaseName: string
  username: string
  password: string
  dbType?: 'postgresql' | 'sqlserver'
}

// GET /api/connections/:id — response body (new dbType field)
{
  id: string
  host: string
  port: number
  databaseName: string
  username: string
  dbType: 'postgresql' | 'sqlserver'
  createdAt: string
  updatedAt: string
}

// TenantConnectionConfig (tenant-database.port.ts)
type TenantConnectionConfig = {
  host: string
  port: number
  database: string
  username: string
  password: string
  dbType: 'postgresql' | 'sqlserver'
}
```

---

## Slice 2: `dbType` selector in `ConnectionForm`

### Acceptance Criteria

- [x] `ConnectionForm` renders a database-type dropdown above the host field with two options: "PostgreSQL" and "SQL Server"
- [x] The dropdown defaults to "PostgreSQL" when creating a new connection
- [x] When an existing connection is loaded, the dropdown reflects the stored `dbType` value
- [x] Selecting "PostgreSQL" sets the port field to `5432` when the port has not been manually edited
- [x] Selecting "SQL Server" sets the port field to `1433` when the port has not been manually edited
- [x] Once the user manually edits the port field, subsequent `dbType` changes no longer overwrite the port
- [x] The form sends `dbType` in the `POST /api/connections` request body
- [x] No SQL Server-specific auth fields (Windows Auth domain, auth type selector, encrypt toggle) are rendered in Phase 1
- [x] Submission is blocked and the button is disabled when any required field (host, port, database, username, password) is empty, regardless of `dbType`
- [x] The existing connection string input remains functional for PostgreSQL; it does not attempt to parse or render for SQL Server

### Design Notes (from `.claude/DESIGN.md`)

- Dropdown uses the shadcn `Select` component (already listed for install in the design brief)
- Label uses `text-sm font-medium`; dropdown sits in the same `space-y-1.5` form-field pattern as existing fields
- Dropdown spans `col-span-4` in the existing 4-column grid, placed as the first field row

---

## Slice 3: Resolve `ConnectionsModule` ↔ `SchemaDiscoveryModule` circular dependency

### Acceptance Criteria

- [x] The `forwardRef` import is removed from both `connections.module.ts` and `schema-discovery.module.ts`
- [x] The app compiles and starts without circular-dependency warnings from NestJS
- [x] `PRISMA_CLIENT` is still injectable in `SchemaDiscoveryService` and `PrismaSchemaRetrievalAdapter` (via the extracted shared module or re-export)
- [x] `ConnectionsService` is still injectable in `SchemaDiscoveryModule` (used to call `getTenantConnectionConfig`)
- [x] All existing unit tests pass after the module restructure

---

## Slice 4: Move `SYSTEM_SCHEMA_NAMES` to adapter level

### Acceptance Criteria

- [x] The `SYSTEM_SCHEMA_NAMES` constant is removed from `schema-discovery.service.ts`
- [x] `TenantDatabaseAdapter` (PostgreSQL adapter) owns its own system schema exclusion list containing `'information_schema'`, `'pg_catalog'`, `'pg_toast'`
- [x] Schema discovery continues to exclude the same PostgreSQL system schemas as before
- [x] `SchemaDiscoveryService` no longer contains any PostgreSQL-specific schema name strings
- [x] The adapter's system schema filter is used during the `analyzeSchemas` flow (behavior is unchanged for existing PostgreSQL connections)

### Deferred Item

`pg_temp_*` startsWith guard patterns remain in `schema-discovery.service.ts`. These are pre-existing defensive guards not called out in the Technical Context for this spec. Developer-accepted as out of scope for Slice 4; deferred to Phase 4 cleanup.

---

## Slice 5: Package hygiene fixes

### Acceptance Criteria

- [x] The `@anthropic-ai/sdnk` typo in `packages/backend/package.json` is corrected to `@anthropic-ai/sdk`
- [x] `pnpm install` runs without errors after the correction
- [x] The backend compiles with the corrected package name

---

## Out of Scope

- SQL Server-specific auth fields: Windows Auth domain field, auth type selector (SQL Auth / Windows Auth / Azure SQL), encrypt connection toggle — all ship in Phase 3
- `SqlServerTenantDatabaseAdapter` implementation — Phase 3
- `TenantDatabaseDispatcher` (multi-adapter routing) — Phase 3
- DuckDB client, Drizzle ORM, or any app-database replacement — Phase 2
- The `@anthropic-ai/sdk` typo fix does not remove or update any other `jest`/`ts-jest` unused devDependencies — deferred to Phase 4 cleanup

---

## Technical Context

- Patterns to follow: hexagonal ports-and-adapters; NestJS feature modules; immutable DTO updates (spread, not mutate)
- `ConnectionConfig` Prisma model is in `packages/backend/prisma/schema.prisma`; migration runs with `prisma migrate dev`
- `TenantConnectionConfig` type is in `packages/backend/src/schema-discovery/tenant-database.port.ts`
- `CreateConnectionDto` and `ConnectionsService` are in `packages/backend/src/connections/connections.service.ts`
- `ConnectionForm.tsx` is in `packages/frontend/src/components/settings-form/ConnectionForm.tsx`
- Circular dep lives in `connections.module.ts` (line 9) and `schema-discovery.module.ts` (line 13) — both use `forwardRef`; extract an `AppDatabaseModule` or restructure exports to break the cycle
- `SYSTEM_SCHEMA_NAMES` is at `schema-discovery.service.ts:12`; filter usage is at line 277
- `@anthropic-ai/sdnk` typo is at `packages/backend/package.json:21`
- Test framework: Vitest, co-located `*.spec.ts` files; no real database in tests (all ports mocked with `vi.fn()`)
- Design system: shadcn/ui + Tailwind v4; `Select` component available for the `dbType` dropdown
- Risk level: LOW (additive data-model change + UI addition; no behaviour change to existing flows)

[x] Reviewed
