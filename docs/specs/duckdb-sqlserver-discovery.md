# Discovery: DuckDB App Database + SQL Server Tenant Data Source

## Why

The application currently runs on PostgreSQL with Prisma ORM and the pgvector extension for semantic search. This creates two friction points:

1. **Setup friction for new developers and self-hosters.** Running PostgreSQL with pgvector requires a container or a managed database service just to boot the app for the first time. DuckDB is a single embedded file — no server to stand up, no extension to enable.

2. **SQL Server is a common enterprise data source that the app cannot reach today.** Many customers have their business data in SQL Server (on-premise or Azure SQL), and the current `TenantDatabasePort` has a single PostgreSQL-only adapter. Those customers cannot use the product at all until SQL Server is supported.

These two changes share a root cause: the codebase treats PostgreSQL as the universal database, both as an internal store and as the only queryable tenant source. The work here breaks that assumption at every layer.

## Who

- **Developers and self-hosters** who want to run the app locally without provisioning a database server.
- **Enterprise users** whose business data lives in SQL Server (on-premise, Azure SQL, or Azure SQL Managed Instance).
- **The engineering team**, who will maintain two app-DB backends (DuckDB default, PostgreSQL optional) and two tenant adapters (PostgreSQL + SQL Server) going forward.

## Success Criteria

- A developer can clone the repo, set one env var (`ANTHROPIC_API_KEY`), run `pnpm dev`, and have a fully working app backed by DuckDB with no other infrastructure.
- A user can add a SQL Server connection (SQL Auth, Windows/AD Auth, or Azure SQL / Entra ID), run schema discovery, ask a natural-language question, and get a T-SQL result — the same end-to-end flow that already works for PostgreSQL.
- The SQL dialect (PostgreSQL or T-SQL) is injected into the LLM system prompt so Claude generates syntactically correct SQL for each engine without manual intervention.
- Existing PostgreSQL app-DB deployments continue to work when `DATABASE_ENGINE=postgres` is set; no data migration is required.
- The known JOIN bug in `PrismaSchemaRetrievalAdapter` (comparing names to UUIDs) is fixed as part of this migration, so vector search returns correct results.

## Problem Statement

The app depends on PostgreSQL at two distinct layers — as its own internal database and as the only supported tenant data source — making it unnecessarily hard to run locally and impossible to use with SQL Server data. Replacing Prisma + PostgreSQL + pgvector with DuckDB + Drizzle ORM + the DuckDB VSS extension removes the infrastructure dependency for self-hosters, while adding a SQL Server `TenantDatabaseAdapter` alongside the existing PostgreSQL one closes the most common enterprise data-source gap.

## Hypotheses

- **H1**: The `TenantDatabasePort` interface (`connect`, `query`, `disconnect`) is sufficient to wrap the `mssql` (tedious) Node.js driver without changing any caller. A dispatcher that selects the right adapter by `dbType` at runtime is the only new wiring needed.
- **H2**: The ANSI `information_schema` queries used for table/column/FK discovery work on SQL Server without modification. Only the PostgreSQL-catalog index query (`pg_index`, `pg_class`) and the read-only session guard (`SET default_transaction_read_only`) need SQL Server replacements.
- **H3**: The DuckDB VSS extension (`vss_cosine_similarity` or equivalent array distance) can replace pgvector's `<=>` operator for the top-K embedding lookup with no change to the embedding generation logic or the 1536-dimension vector shape.
- **H4**: Drizzle ORM with its DuckDB and PostgreSQL drivers can replicate all 8 Prisma model operations (CRUD + `$executeRaw` for embedding inserts) without requiring raw SQL in the service layer, except for the vector similarity query.
- **H5**: Injecting `dbType` into Claude's system prompt — "generate T-SQL for SQL Server" vs "generate PostgreSQL SQL" — is sufficient to produce correct dialect output without separate prompt templates per engine.

## Out of Scope

- Migration tooling for existing PostgreSQL app-DB users (no migration path; they keep `DATABASE_ENGINE=postgres`).
- MySQL, Oracle, BigQuery, Snowflake, or any other tenant data source beyond SQL Server.
- DuckDB as a queryable **tenant** data source (DuckDB is only the **app** database in this epic).
- Multi-user / auth (out of scope for this project generally).
- Replicating the test-database seed scripts for SQL Server.
- Any changes to chart rendering, dashboard layout, or the AI annotation workflow.

---

## Decision Tree and Interdependencies

The two features (DuckDB app DB and SQL Server tenant source) are not independent. They share three prerequisite changes that must land before either feature can be built in isolation:

```
SHARED PREREQUISITES (must land first, in order)
  [P0-A] Add `dbType` to ConnectionConfig model + TenantConnectionConfig type
  [P0-B] Database-type selector UI in ConnectionForm (dbType + port default toggle)
  [P0-C] Break PRISMA_CLIENT circular dep — resolve ConnectionsModule ↔ SchemaDiscoveryModule forwardRef

FEATURE A: DuckDB App DB                    FEATURE B: SQL Server Tenant Source
  depends on P0-A, P0-C                          depends on P0-A, P0-B
  [A1] Drizzle schema (8 models)                [B1] SqlServerTenantDatabaseAdapter
  [A2] DuckDB provider + factory               [B2] SqlServer schema discovery
  [A3] Drizzle repositories (CRUD)             [B3] SQL Server system schema filter
  [A4] DuckDB VSS vector search                [B4] T-SQL dialect injection into LLM prompt
  [A5] Fix JOIN bug (name vs UUID)
  [A6] DATABASE_ENGINE env var switch
  [A7] Remove Prisma + pg deps when DuckDB
```

Feature A and Feature B can be built in **parallel** after the prerequisites land. They touch different files: Feature A rewrites the app DB layer; Feature B adds a new adapter sibling.

The one place they converge again at the end is the `TENANT_DATABASE_PORT` dispatcher (a factory/strategy that picks the right tenant adapter based on `dbType`), which requires both `TenantDatabaseAdapter` (PostgreSQL, already exists) and `SqlServerTenantDatabaseAdapter` (new) to be present.

---

## Module Structure

The architecture is hexagonal (ports and adapters) with NestJS modules. New and changed modules after this epic:

```
connections/
  connections.module.ts      -- owns PRISMA_CLIENT factory (→ DrizzleClient after Phase 1)
  connections.service.ts     -- owns ConnectionConfig CRUD; gains dbType field

schema-discovery/
  tenant-database.port.ts    -- unchanged interface (connect/query/disconnect)
  tenant-database.adapter.ts -- PostgreSQL adapter (existing, unchanged)
  sqlserver-tenant-database.adapter.ts  -- NEW: SQL Server adapter
  tenant-database.dispatcher.ts         -- NEW: picks adapter by dbType
  schema-discovery.module.ts -- wires dispatcher as TENANT_DATABASE_PORT

query/
  claude.adapter.ts          -- gains dbType param in system prompt
  drizzle-schema-retrieval.adapter.ts  -- NEW: replaces PrismaSchemaRetrievalAdapter

infrastructure/
  drizzle/
    schema.ts                -- NEW: Drizzle table definitions (8 models)
    client.ts                -- NEW: DuckDB or PostgreSQL connection factory
    repositories/            -- NEW: one file per aggregate root
```

---

## Milestone Map

### Phase 1: Shared Foundation — "Make the seams"

Everything that both features depend on. Delivers no visible end-user change but makes Phases 2 and 3 buildable in parallel.

Scope:
- Add `dbType: 'postgresql' | 'sqlserver'` to `ConnectionConfig` Prisma model (default `'postgresql'`) and to `TenantConnectionConfig` type in `tenant-database.port.ts`.
- Add `dbType` to `CreateConnectionDto` and `ConnectionsService.getTenantConnectionConfig`.
- Add database-type selector (dropdown: PostgreSQL / SQL Server) to `ConnectionForm.tsx`. Auto-update port default: 5432 for PostgreSQL, 1433 for SQL Server. Show/hide Windows Auth fields (`domain` field) when SQL Server is selected.
- Fix the `forwardRef` circular dependency between `ConnectionsModule` and `SchemaDiscoveryModule` — extract a shared `AppDatabaseModule` or restructure exports so neither module needs to reference the other at startup.
- Fix the `@anthropic-ai/sdnk` typo in `packages/backend/package.json`.
- Move `SYSTEM_SCHEMA_NAMES` from `schema-discovery.service.ts` to adapter-level so each adapter owns its own system schema list.

Deliverable: A clean, compiling codebase with `dbType` threaded through the model and form, ready for both feature branches.

---

### Phase 2: DuckDB App Database — "Zero-infrastructure dev experience"

Replace Prisma + PostgreSQL + pgvector as the app's own internal database. PostgreSQL remains available via `DATABASE_ENGINE=postgres`.

Scope:
- Install `drizzle-orm`, `drizzle-kit`, `@duckdb/node-api` (or `duckdb-async`), `@electric-sql/pglite` (optional fallback). Remove `@prisma/*`, `pg`, `pgvector` from production dependencies when `DATABASE_ENGINE=duckdb`.
- Define Drizzle schema in `packages/backend/src/infrastructure/drizzle/schema.ts` mirroring all 8 Prisma models. Use `text` primary keys (UUID), `real[]` for the embedding column (DuckDB native float array).
- Create `DrizzleClientFactory` that reads `DATABASE_ENGINE` and `DUCKDB_PATH` env vars. When DuckDB: opens file at `DUCKDB_PATH` (default `./data/genbi.db`), loads VSS extension, runs migrations. When PostgreSQL: creates a `drizzle(postgres(...))` instance against `DATABASE_URL`.
- Replace `PRISMA_CLIENT` injection token with `DRIZZLE_CLIENT` (or keep the same token name and change what it resolves to — decision for the architect).
- Implement Drizzle repositories replacing each Prisma call in:
  - `ConnectionsService` — connectionConfig CRUD
  - `SchemaDiscoveryService` — discoveredTable, discoveredColumn, discoveredForeignKey, discoveredIndex CRUD
  - `DashboardsService` — dashboard and widget CRUD
- Replace `PrismaSchemaRetrievalAdapter` with `DrizzleSchemaRetrievalAdapter`:
  - Fix the JOIN bug: join on `ce.table_id = dt.id` and `ce.column_id = dc.id` (UUID-to-UUID), not name-to-UUID.
  - Replace pgvector's `<=> ::vector` syntax with DuckDB VSS `array_cosine_similarity` (or the VSS extension's distance function).
  - PostgreSQL path: keep the pgvector syntax for the `DATABASE_ENGINE=postgres` branch.
- Replace raw `gen_random_uuid()` + `::vector` cast in `embedColumns` with DuckDB-native UUID generation and plain float-array insert.
- Remove unused `jest`/`ts-jest` devDependencies.

Deliverable: `pnpm dev` works out of the box with DuckDB. No PostgreSQL required. `DATABASE_ENGINE=postgres` preserves existing behaviour. The JOIN bug is fixed; vector search returns correct results.

---

### Phase 3: SQL Server Tenant Data Source — "Connect enterprise data"

Add SQL Server as a queryable tenant data source alongside the existing PostgreSQL tenant adapter. Builds on Phase 1 only (can be parallelised with Phase 2).

Scope:
- Install `mssql` (tedious-based Node.js SQL Server driver).
- Implement `SqlServerTenantDatabaseAdapter` implementing `TenantDatabasePort`:
  - SQL Auth: `{ server, port, database, user, password, options: { encrypt, trustServerCertificate } }`.
  - Windows / Active Directory Auth: integrated security via `options.domain` or NTLM config.
  - Azure SQL / Entra ID: `authentication: { type: 'azure-active-directory-default' }`.
  - Read-only enforcement: wrap every query in a `SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED` or check that the connected login has only `SELECT` permission (relied on the existing `validateSelectOnly` SQL validator — no DDL verbs allowed through the app layer regardless).
  - TLS: trust server certificate by default (`trustServerCertificate: true`); expose an "Encrypt connection" toggle that maps to `options.encrypt`.
  - Error code mapping: translate tedious error codes to the same friendly messages the PostgreSQL adapter raises (`Invalid credentials`, `Unable to reach host`, etc.).
- Add system schema filter for SQL Server: exclude `sys`, `INFORMATION_SCHEMA`, `db_owner`, `db_datareader`, and similar built-in schemas. Discovery returns user-defined schemas only.
- Verify that the existing ANSI `information_schema` queries for tables, columns, and FKs work on SQL Server. Replace the PostgreSQL-catalog index query with SQL Server equivalent (`sys.indexes`, `sys.index_columns`, `sys.columns`).
- Implement `TenantDatabaseDispatcher` in `SchemaDiscoveryModule`: reads `dbType` from the connection config and routes to `TenantDatabaseAdapter` (PostgreSQL) or `SqlServerTenantDatabaseAdapter`. Provide `TENANT_DATABASE_PORT` token via this dispatcher.
- Update `ClaudeAdapter.generateQuery` to accept `dbType` and inject it into the system prompt: "Generate valid T-SQL for SQL Server" vs "Generate valid PostgreSQL SQL". Update `QueryService` to pass `dbType` when calling the LLM port.
- Update `LlmPort` interface to carry `dbType` in the `generateQuery` call signature.
- Extend `ConnectionForm.tsx` for SQL Server-specific fields: authentication type selector (SQL Auth / Windows Auth / Azure SQL), domain field (Windows Auth only), encrypt connection toggle.

Deliverable: A user can add a SQL Server connection, run schema discovery against all user-defined schemas, and run natural-language queries that produce T-SQL results. PostgreSQL tenant connections are unchanged.

---

### Phase 4: Hardening and Cleanup — "Production-ready"

Close remaining gaps after both features are running.

Scope:
- End-to-end test coverage for both DuckDB and SQL Server paths using Vitest with a real DuckDB instance (in-memory, no file) and a mocked SQL Server adapter.
- Remove `prisma: any` typing in all three services — replace with the generated Drizzle types.
- Resolve or document any remaining `forwardRef` circularity.
- Add `DUCKDB_PATH`, `DATABASE_ENGINE`, and SQL Server auth env vars to `.env.example` and README.
- Verify `validateSelectOnly` rejects T-SQL-specific DDL verbs (`EXEC`, `sp_`, `xp_`). Add if missing.
- Connection test endpoint (`POST /api/connections/:id/test`) should return the detected SQL Server dialect in its response so the frontend can display it.
- Confirm DuckDB VSS extension version compatibility with the node-api package version in use.

---

## Architectural Risks and Open Technical Questions

### Risk 1 — DuckDB Node.js API maturity (HIGH)
DuckDB's Node.js bindings have historically had breaking changes between minor versions. The `@duckdb/node-api` package is newer than `duckdb-async` (the older community wrapper). The team must pin a specific version and test on both macOS (ARM) and Linux x64 before committing to it. The VSS extension must be verified to load correctly in the same Node.js process, not just in the DuckDB CLI.

Mitigation: Spike with a minimal Vitest test that opens a DuckDB file, loads VSS, inserts a float[1536] row, and runs a cosine similarity query. Do this before writing any Drizzle schema.

### Risk 2 — Drizzle + DuckDB vector column type (HIGH)
Drizzle does not have a first-class "vector" type for DuckDB. The `ColumnEmbedding` model needs a `FLOAT[1536]` column. This may need a custom Drizzle column type or raw SQL in the table definition. It must also work with Drizzle's migration runner (`drizzle-kit`), which may not know how to diff array column types.

Mitigation: Define the embedding column as `sql<number[]>\`FLOAT[1536]\`` using Drizzle's escape hatch. Validate that `drizzle-kit generate` produces correct DDL before wiring up repositories.

### Risk 3 — forwardRef circular dependency (MEDIUM)
`ConnectionsModule` and `SchemaDiscoveryModule` already have a `forwardRef` circular dependency. Adding a `TenantDatabaseDispatcher` (which lives in `SchemaDiscoveryModule` and reads connection config from `ConnectionsService` which lives in `ConnectionsModule`) could tighten this cycle. The cleanest resolution is to extract a thin `AppDatabaseModule` that provides the Drizzle client and is imported by both, breaking the cycle entirely. This needs to be resolved in Phase 1 before either feature branch starts.

### Risk 4 — SQL Server authentication variety (MEDIUM)
Windows / Active Directory auth from a Linux Node.js process requires either NTLM support in tedious (available, but sometimes fragile outside a domain-joined machine) or Kerberos configuration. Azure SQL / Entra ID requires the `@azure/identity` package and an active Azure credential chain. These are non-trivial to test locally. The Phase 3 scope should validate at least SQL Auth first and treat Windows Auth and Azure SQL as a follow-on if integration test environments are unavailable.

### Risk 5 — SQL Server `information_schema` FK query behaviour (LOW)
SQL Server's `information_schema.referential_constraints` and `key_column_usage` are ANSI-standard but have known limitations (e.g., they do not return FKs defined on computed columns, and schema names in SQL Server use dot-separated three-part names). The FK discovery query in `analyzeSchemas` should be tested against a real SQL Server instance or Azure SQL before shipping.

### Risk 6 — T-SQL system prompt quality (LOW)
The current Claude system prompt includes PostgreSQL-specific examples (e.g., `DATE_TRUNC`, `EXTRACT`). When `dbType=sqlserver` these examples may confuse the model into mixing dialects. The mitigation is to replace the PostgreSQL-specific examples in the system prompt with dialect-neutral ones, and add a T-SQL example (e.g., using `DATETRUNC` or `FORMAT`) when SQL Server is detected. This is a prompt-engineering concern, not a code architecture concern.

---

## Shared Changes That Must Land First (Phase 1 summary)

These four changes are prerequisites for both Phase 2 and Phase 3. No feature branch should start until all four are merged:

| Change | File(s) | Why it blocks |
|---|---|---|
| Add `dbType` to `ConnectionConfig` model | `schema.prisma`, `connections.service.ts`, `tenant-database.port.ts` | Phase 2 needs it for DB factory switch; Phase 3 needs it for adapter dispatch |
| Add `dbType` UI to `ConnectionForm` | `ConnectionForm.tsx`, `useConnectionString.ts` | Phase 3 cannot be tested end-to-end without it; Phase 2 needs port default change |
| Resolve `ConnectionsModule` ↔ `SchemaDiscoveryModule` circular dep | `connections.module.ts`, `schema-discovery.module.ts` | Phase 2 AppDatabaseModule extraction depends on clean module graph |
| Move `SYSTEM_SCHEMA_NAMES` to adapter level | `schema-discovery.service.ts`, `tenant-database.adapter.ts` | Phase 3 SQL Server adapter needs its own list; service must not hardcode PostgreSQL names |

---

## Open Questions

1. **Injection token name**: Should the Drizzle client reuse the `PRISMA_CLIENT` token name (fewer call-site changes) or introduce a new `DRIZZLE_CLIENT` token (cleaner break)? The `DRIZZLE_CLIENT` name is more honest but requires updating all four injection sites simultaneously.

2. **DuckDB file location in production**: `./data/genbi.db` works for local dev, but in a containerised deployment the `data/` directory needs to be a mounted volume. Should the default path be `/tmp/genbi.db` (ephemeral, safe for demos) or should the app refuse to start without an explicit `DUCKDB_PATH`?

3. **Windows Auth in CI**: Is there a SQL Server instance available for integration tests, or will SQL Server tests be permanently mocked? If mocked, the adapter will ship without real-path validation until a test environment is stood up.

4. **`validateSelectOnly` for T-SQL stored procedures**: SQL Server users often query via `EXEC dbo.MyProc`. Should the app allow `EXEC` for read-only stored procedures, or keep the current block-all-non-SELECT policy? This is a product decision.

5. **DuckDB concurrent writes**: DuckDB has limited write concurrency. If two `embedColumns` jobs run simultaneously (one per connection), the second will block or fail. Is request-level serialisation of embedding jobs (which already exists via the `progress.status === 'analyzing'` guard) sufficient, or does a queue need to be introduced?

---

## Revised Assessment

Size: EPIC
Greenfield: no (existing hexagonal NestJS + React app)
Risk: HIGH (two distinct database replacements, shared prerequisites, production-readiness concerns around DuckDB Node API and SQL Server auth)
Recommended phase count: 4
Parallelisable after Phase 1: yes (Phase 2 and Phase 3 can be built concurrently on separate branches)

[x] Reviewed
