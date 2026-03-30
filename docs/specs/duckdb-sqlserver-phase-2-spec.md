# Spec: DuckDB + SQL Server — Phase 2: DuckDB App Database

## Overview

Replace Prisma + PostgreSQL + pgvector as the app's internal database with Drizzle ORM backed by DuckDB (embedded, file-on-disk). PostgreSQL remains fully functional when `DATABASE_ENGINE=postgres` is set. After this phase, `pnpm dev` works out of the box with no database infrastructure.

---

## Slice 1: DuckDB + Drizzle spike (risk validation)

Validate the two HIGH-risk technical bets before writing any production code. This slice produces a passing Vitest test and a confirmed DDL output from drizzle-kit. If either check fails, the approach must be revised before proceeding to Slice 2.

### Acceptance Criteria

- [ ] A Vitest test opens a DuckDB file at a temp path using `@duckdb/node-api`, loads the VSS extension, inserts one row with a `FLOAT[1536]` column, runs `array_cosine_similarity` against a second vector, and asserts a numeric similarity score is returned
- [ ] The `@duckdb/node-api` package version is pinned to an exact version (no `^` or `~`) in `packages/backend/package.json`
- [ ] A Drizzle schema file defines the `ColumnEmbedding` table with the embedding column declared as `sql<number[]>\`FLOAT[1536]\`` using Drizzle's raw SQL escape hatch
- [ ] Running `drizzle-kit generate` against the spike schema produces DDL that contains `FLOAT[1536]` for the embedding column (not `TEXT`, not `BLOB`, not omitted)
- [ ] The spike test is removed or moved to a `spike/` directory before Slice 2 begins — it is not part of the production test suite
- [ ] The test runs on macOS ARM and Linux x64 (CI must pass on both; if CI is Linux-only, developer verifies macOS ARM manually)

---

## Slice 2: Drizzle schema — 8 table definitions

Define the full Drizzle schema mirroring all 8 Prisma models. This is the data contract for all repositories in Slice 3.

### Acceptance Criteria

- [x] `packages/backend/src/infrastructure/drizzle/schema.ts` exists and exports one Drizzle table constant per model: `connectionConfigs`, `discoveredTables`, `discoveredColumns`, `discoveredForeignKeys`, `discoveredIndexes`, `dashboards`, `widgets`, `columnEmbeddings`
- [x] Every table uses `text` primary key columns (UUID stored as text, not a native UUID type)
- [x] Column names and table names in the Drizzle schema match the snake_case SQL names in the existing Prisma schema (e.g., `connection_id`, `database_name`, `encrypted_password`, `is_nullable`, `ordinal_position`, `chart_type`, `legend_labels`)
- [x] `discoveredTables` has a unique constraint on `(connection_id, schema_name, table_name)`
- [x] `columnEmbeddings` has a unique constraint on `(connection_id, table_id, column_id)`
- [x] `discoveredColumns`, `discoveredForeignKeys`, `discoveredIndexes`, and `widgets` declare cascade-delete foreign keys pointing to their parent tables
- [x] The `embedding` column in `columnEmbeddings` is defined as `sql<number[]>\`FLOAT[1536]\`` — no other column type is used
- [x] `widgets.columns` and `widgets.legendLabels` are typed as `text` columns holding JSON (serialised by the repository, not using a Drizzle `json()` column type that may not exist in DuckDB)
- [x] Running `drizzle-kit generate` against this schema produces DDL with no errors and no unresolved column types

### API Shape

```typescript
// packages/backend/src/infrastructure/drizzle/schema.ts
export const connectionConfigs = pgTable('connection_configs', { ... })
// or duckdbTable — exact helper depends on the drizzle-orm DuckDB dialect;
// use whatever dialect helper works for both DuckDB and PostgreSQL or use
// the generic sql`` escape hatch for the vector column only
```

---

## Slice 3: `DrizzleClientFactory` and `AppDatabaseModule` swap

Replace the Prisma factory inside `AppDatabaseModule` with a factory that returns a Drizzle client. This is the single swap point — all consumers remain unchanged in this slice.

### Acceptance Criteria

- [x] `packages/backend/src/infrastructure/drizzle/client.ts` exports a factory function `createDrizzleClient()` that reads `DATABASE_ENGINE` (default `'duckdb'`) and `DUCKDB_PATH` (default `'./data/genbi.db'`)
- [x] When `DATABASE_ENGINE=duckdb`: the factory opens the DuckDB file at `DUCKDB_PATH`, loads the VSS extension, and returns a Drizzle client wrapping that connection
- [x] When `DATABASE_ENGINE=postgres`: the factory creates a Drizzle client using `DATABASE_URL` and the Drizzle PostgreSQL driver — no DuckDB code runs
- [x] `AppDatabaseModule` (`packages/backend/src/database/app-database.module.ts`) replaces its Prisma factory with `createDrizzleClient()` and exports `DRIZZLE_CLIENT` instead of `PRISMA_CLIENT`
- [x] The token constant `DRIZZLE_CLIENT` is declared in `packages/backend/src/infrastructure/drizzle/client.ts` (or a co-located constants file) and exported for injection sites to import
- [x] `PRISMA_CLIENT` token is removed from `connections.service.ts` — the constant no longer exists at that path
- [x] The app starts without error when `DATABASE_ENGINE` is unset (defaults to `duckdb`, opens `./data/genbi.db`)
- [x] The app starts without error when `DATABASE_ENGINE=postgres` and a valid `DATABASE_URL` is set
- [x] When `DATABASE_ENGINE=duckdb` and the `./data/` directory does not exist, the factory creates it before opening the file (so the developer does not need to `mkdir data` manually)
- [x] A unit test for `createDrizzleClient` asserts that passing `DATABASE_ENGINE=duckdb` does not attempt to read `DATABASE_URL`, and that passing `DATABASE_ENGINE=postgres` does not attempt to open a DuckDB file

---

## Slice 4: Drizzle repositories — ConnectionsService and SchemaDiscoveryService

Replace every `this.prisma.*` call in `ConnectionsService` and `SchemaDiscoveryService` with Drizzle query builder calls. The injection token changes from `PRISMA_CLIENT` to `DRIZZLE_CLIENT` at both sites.

### Acceptance Criteria

- [x] `ConnectionsService` injects `DRIZZLE_CLIENT` (not `PRISMA_CLIENT`); the `private readonly prisma: any` field is replaced with a properly typed Drizzle client reference
- [x] `ConnectionsService.create` inserts a row into `connection_configs` using Drizzle and returns the same response shape as before
- [x] `ConnectionsService.findOne` fetches by `id` using Drizzle and throws `NotFoundException` when no row is found
- [x] `ConnectionsService.getTenantConnectionConfig` continues to return a correctly shaped `TenantConnectionConfig` including `dbType`
- [x] `SchemaDiscoveryService` injects `DRIZZLE_CLIENT` (not `PRISMA_CLIENT`); the `private readonly prisma: any` field is replaced with a properly typed Drizzle client reference
- [x] `SchemaDiscoveryService.getDiscoveredTables` fetches tables with their columns, foreign keys, and indexes using Drizzle joins or separate queries
- [x] `SchemaDiscoveryService.analyzeSchemas` deletes existing discovered tables for the connection and re-inserts tables, columns, foreign keys, and indexes using Drizzle — no Prisma nested `create` syntax
- [x] `SchemaDiscoveryService.getAnnotations` loads tables with columns using Drizzle
- [x] `SchemaDiscoveryService.saveAnnotations` updates `description` on `DiscoveredColumn` rows using Drizzle
- [x] `SchemaDiscoveryService.embedColumns` deletes and re-inserts `ColumnEmbedding` rows using Drizzle — no `$executeRaw` with `gen_random_uuid()` or `::vector` cast
- [x] UUID generation in `embedColumns` uses `crypto.randomUUID()` (Node.js built-in) — no PostgreSQL-specific UUID function
- [x] The embedding value is inserted as a plain `number[]` — no `::vector` cast or stringified bracket notation used as the column value
- [x] All existing unit tests for `ConnectionsService` and `SchemaDiscoveryService` pass after the swap (mocks updated to return Drizzle-shaped data instead of Prisma-shaped data)
- [x] No test uses the string `'PRISMA_CLIENT'` in these two service test files after this slice

---

## Slice 5: Drizzle repositories — DashboardsService

Replace every `this.prisma.*` call in `DashboardsService` with Drizzle query builder calls.

### Acceptance Criteria

- [x] `DashboardsService` injects `DRIZZLE_CLIENT` (not `PRISMA_CLIENT`)
- [x] `DashboardsService.createDashboard` inserts into `dashboards` using Drizzle
- [x] `DashboardsService.listDashboards` fetches dashboards for a connection ordered by `created_at desc`; widget count is returned (via a COUNT subquery or a separate count query — no Prisma `_count` relation)
- [x] `DashboardsService.getDashboard` fetches a dashboard with its widgets ordered by `position asc`; throws `NotFoundException` when the dashboard does not exist
- [x] `DashboardsService.addWidget` counts existing widgets for the dashboard to compute `position`, then inserts a new widget; `columns` and `legendLabels` are serialised to JSON strings before insert
- [x] `DashboardsService.updateWidget` updates the widget row; throws `NotFoundException` when `widgetId` or `dashboardId` does not match any row
- [x] `DashboardsService.removeWidget` deletes the widget row
- [x] `DashboardsService.deleteDashboard` deletes the dashboard row (widgets cascade-delete via the FK constraint)
- [x] `DashboardsService.executeWidgetSql` loads the widget and its `dashboard.connectionId` via Drizzle; the rest of the method (connect/query/disconnect) is unchanged
- [x] All existing unit tests for `DashboardsService` pass after the swap
- [x] The `P2025` Prisma error code check in `updateWidget` is replaced with a row-existence check that does not depend on Prisma error codes

---

## Slice 6: `DrizzleSchemaRetrievalAdapter` — fix JOIN bug + replace vector search

Replace `PrismaSchemaRetrievalAdapter` with `DrizzleSchemaRetrievalAdapter`. This slice also fixes the JOIN bug that causes vector search to return zero rows.

### Acceptance Criteria

- [x] `packages/backend/src/query/drizzle-schema-retrieval.adapter.ts` is created; `PrismaSchemaRetrievalAdapter` (`prisma-schema-retrieval.adapter.ts`) is deleted
- [x] `DrizzleSchemaRetrievalAdapter` implements `SchemaRetrievalPort` with the same two methods: `findRelevantColumns` and `hasEmbeddings`
- [x] `findRelevantColumns` joins `column_embeddings` to `discovered_tables` on `ce.table_id = dt.id` (UUID-to-UUID) — not on `dt.table_name = ce.table_id`
- [x] `findRelevantColumns` joins `column_embeddings` to `discovered_columns` on `ce.column_id = dc.id` (UUID-to-UUID) — not on `dc.column_name = ce.column_id`
- [x] When `DATABASE_ENGINE=duckdb`: the vector similarity ORDER BY uses `array_cosine_similarity(ce.embedding, ?)` (DuckDB VSS function); no `::vector` cast is used
- [x] When `DATABASE_ENGINE=postgres`: the ORDER BY uses pgvector's `<=>` operator with a `::vector` cast — the PostgreSQL path is not degraded by this change
- [x] `hasEmbeddings` counts rows in `column_embeddings` for the given `connectionId` using Drizzle and returns `true` when count > 0
- [x] `QueryModule` provides `SCHEMA_RETRIEVAL_PORT` using `DrizzleSchemaRetrievalAdapter` (not `PrismaSchemaRetrievalAdapter`)
- [x] A unit test for `DrizzleSchemaRetrievalAdapter.findRelevantColumns` asserts that the SQL executed contains `ce.table_id = dt.id` and `ce.column_id = dc.id` (not name comparisons)
- [x] A unit test for `DrizzleSchemaRetrievalAdapter.hasEmbeddings` asserts it returns `false` when the mocked query returns count 0 and `true` when count > 0

---

## Slice 7: Dependency cleanup

Remove Prisma and PostgreSQL production dependencies when running in DuckDB mode; remove unused devDependencies.

### Acceptance Criteria

- [x] `@prisma/client`, `@prisma/adapter-pg`, and `prisma` are removed from `packages/backend/package.json` `dependencies`
  <!-- -------- bee-comment -------- -->
  > **@developer**: original AC also listed `pg` and `@types/pg` for removal
  > **@bee**: `pg` and `@types/pg` are retained — `TenantDatabaseAdapter` uses `pg.Client` directly for PostgreSQL tenant connections and `createDrizzleClient()` uses `pg.Pool` for `DATABASE_ENGINE=postgres`. Removing them would break both paths. Phase 3 (SQL Server) does not remove the PostgreSQL tenant adapter, so `pg` remains a legitimate runtime dependency. Deferred to Phase 4 cleanup if the PostgreSQL tenant adapter is ever replaced.
  > - [ ] mark as resolved
  <!-- -------- /bee-comment -------- -->
- [x] `drizzle-orm` and `@duckdb/node-api` are added to `packages/backend/package.json` `dependencies` (pinned exact version for `@duckdb/node-api`)
- [x] `drizzle-kit` is added to `packages/backend/package.json` `devDependencies`
- [x] `jest` and `ts-jest` are removed from `packages/backend/package.json` `devDependencies` (project uses Vitest exclusively)
- [x] `pnpm install` runs without errors after these changes
- [x] `pnpm build` produces a clean build with no TypeScript errors after Prisma is removed
- [x] No import of `@prisma/client`, `@prisma/adapter-pg`, or the generated Prisma client (`generated/prisma`) remains in any `.ts` file under `packages/backend/src/`
- [x] The `packages/backend/generated/prisma/` directory is deleted (or excluded from the repo via `.gitignore` if the generator is still configured)
- [x] `packages/backend/prisma/schema.prisma` is retained as a reference artifact but is no longer used at runtime; a comment is added noting it is superseded by the Drizzle schema

---

## Out of Scope

- Migration tooling for existing PostgreSQL app-DB data — users on `DATABASE_ENGINE=postgres` continue as-is; no data migration path is provided
- DuckDB as a queryable tenant data source — DuckDB is only the app's internal database
- SQL Server tenant adapter — Phase 3
- DuckDB concurrent-write queue — the existing `progress.status === 'analyzing'` guard is the only serialisation mechanism; a full job queue is Phase 4 hardening
- The `pg_temp_*` / `pg_toast_temp_*` startsWith guards in `SchemaDiscoveryService.testConnection` — left as pre-existing defensive code; deferred to Phase 4
- End-to-end tests for the DuckDB path — Phase 4
- Adding `DUCKDB_PATH` and `DATABASE_ENGINE` to `.env.example` or README — Phase 4
- Removing the `prisma: any` anti-pattern typing notation — addressed implicitly by this phase (Drizzle types replace it), but formal typed-client enforcement is Phase 4

---

## Technical Context

### Injection sites to update (4 total)

| File | Current token | New token |
|------|--------------|-----------|
| `packages/backend/src/connections/connections.service.ts:5,18` | `PRISMA_CLIENT` | `DRIZZLE_CLIENT` |
| `packages/backend/src/schema-discovery/schema-discovery.service.ts:2,21` | `PRISMA_CLIENT` | `DRIZZLE_CLIENT` |
| `packages/backend/src/dashboards/dashboards.service.ts:2,10` | `PRISMA_CLIENT` | `DRIZZLE_CLIENT` |
| `packages/backend/src/query/prisma-schema-retrieval.adapter.ts:15` | `'PRISMA_CLIENT'` | deleted (file replaced) |

### Key file paths

- `AppDatabaseModule`: `packages/backend/src/database/app-database.module.ts` — the single swap point; currently provides `PRISMA_CLIENT`
- Drizzle schema (new): `packages/backend/src/infrastructure/drizzle/schema.ts`
- Drizzle client factory (new): `packages/backend/src/infrastructure/drizzle/client.ts`
- Drizzle repositories (new): `packages/backend/src/infrastructure/drizzle/repositories/` — one file per aggregate root (connections, schema-discovery, dashboards)
- Schema retrieval adapter (new): `packages/backend/src/query/drizzle-schema-retrieval.adapter.ts`
- Schema retrieval adapter (deleted): `packages/backend/src/query/prisma-schema-retrieval.adapter.ts`

### Known JOIN bug (fix in Slice 6)

Current bug in `prisma-schema-retrieval.adapter.ts:32-35`:
```
ON dt.table_name = ce.table_id   -- compares string name to UUID → always false
ON dc.column_name = ce.column_id -- compares string name to UUID → always false
```
Correct joins:
```
ON dt.id = ce.table_id           -- UUID to UUID
ON dc.id = ce.column_id          -- UUID to UUID
```

### Vector search replacement

- DuckDB path: `ORDER BY array_cosine_similarity(ce.embedding, CAST(? AS FLOAT[1536])) DESC`
- PostgreSQL path (preserved): `ORDER BY ce.embedding <=> ${vectorStr}::vector`

### Patterns to follow

- Hexagonal ports-and-adapters; adapters are leaf nodes, services depend only on port interfaces
- Immutable data: spread operator for updates, `crypto.randomUUID()` for ID generation
- No `any` typing — replace `private readonly prisma: any` with the inferred Drizzle client type
- Test framework: Vitest, co-located `*.spec.ts`; no real database in tests — mock the Drizzle client with `vi.fn()`

### Risk level: HIGH

- `@duckdb/node-api` maturity (Slice 1 spike must pass before Slice 2 starts)
- `FLOAT[1536]` column type via Drizzle escape hatch (Slice 1 spike must confirm DDL before Slice 2 starts)
- Full ORM replacement across 3 services + 1 adapter simultaneously

---

[x] Reviewed
