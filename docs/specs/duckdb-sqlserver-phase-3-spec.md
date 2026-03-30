# Spec: DuckDB + SQL Server — Phase 3: SQL Server Tenant Data Source

## Overview

Add SQL Server as a queryable tenant data source alongside the existing PostgreSQL tenant adapter. A user can configure a SQL Server connection, run schema discovery against all user-defined schemas, and ask natural-language questions that produce T-SQL results — the same end-to-end flow that already works for PostgreSQL.

Phase 1 prerequisites that are already in place:
- `dbType: 'postgresql' | 'sqlserver'` in `TenantConnectionConfig` and `connectionConfigs` schema
- `dbType` selector (PostgreSQL / SQL Server) in `ConnectionForm.tsx` with port default toggle (5432 / 1433)
- `AppDatabaseModule` using `DRIZZLE_CLIENT` (Phase 2)

---

## Slice 1: `SqlServerTenantDatabaseAdapter` — SQL Auth + `$N` parameter translation

Implement `TenantDatabasePort` for SQL Server using the `mssql` (tedious) driver. SQL Auth only in this slice. The adapter translates `$N` positional placeholders from the service layer into `@pN` named parameters that `mssql` requires, making it transparent to all callers.

### Acceptance Criteria

- [ ] `packages/backend/package.json` adds `mssql` and `@types/mssql` as dependencies
- [ ] `packages/backend/src/schema-discovery/sqlserver-tenant-database.adapter.ts` exports `SqlServerTenantDatabaseAdapter` implementing `TenantDatabasePort`
- [ ] `connect(config)`: opens a `mssql.ConnectionPool` using `{ server: host, port, database, user: username, password, options: { encrypt, trustServerCertificate: !encrypt } }` where `encrypt` comes from `config.encrypt ?? false`
- [ ] `connect(config)`: on connection failure, maps known `mssql` error codes to friendly messages:
  - Login failed / credentials error → `'Invalid credentials for tenant database'`
  - ECONNREFUSED / network unreachable → `'Unable to reach tenant database host'`
  - All others → `'Failed to connect to tenant database: <message>'`
- [ ] `query(sql, params?)`: translates `$1, $2, …` placeholders in the SQL string to `@p1, @p2, …` and binds each value via `request.input('p1', value)` etc. before executing
- [ ] `query(sql, params?)`: returns `{ rows: Record<string, unknown>[] }` in the same shape as the PostgreSQL adapter
- [ ] `disconnect()`: calls `pool.close()` and clears internal pool reference; does not throw if already disconnected
- [ ] `readonly systemSchemaNames` is a `ReadonlySet<string>` containing SQL Server system schemas: `'sys'`, `'INFORMATION_SCHEMA'`, `'db_owner'`, `'db_accessadmin'`, `'db_securityadmin'`, `'db_backupoperator'`, `'db_datareader'`, `'db_datawriter'`, `'db_ddladmin'`
- [ ] Unit tests cover: `$N` → `@pN` translation for 0, 1, and multiple params; error code mapping for login failure, connection refused, and unknown error; `disconnect()` no-op when not connected; `systemSchemaNames` contents

### API Shape

```typescript
// packages/backend/src/schema-discovery/sqlserver-tenant-database.adapter.ts
@Injectable()
export class SqlServerTenantDatabaseAdapter implements TenantDatabasePort {
  readonly systemSchemaNames: ReadonlySet<string> = new Set([
    'sys', 'INFORMATION_SCHEMA', 'db_owner', 'db_accessadmin',
    'db_securityadmin', 'db_backupoperator', 'db_datareader',
    'db_datawriter', 'db_ddladmin',
  ]);

  async connect(config: TenantConnectionConfig): Promise<void> { ... }
  async query(sql: string, params?: unknown[]): Promise<QueryResult> { ... }
  async disconnect(): Promise<void> { ... }
}
```

---

## Slice 2: `queryIndexes` port method — dialect-specific index discovery

The existing `analyzeSchemas` runs a PostgreSQL-catalog (`pg_index`, `pg_class`) query that fails on SQL Server. Extract this into a new `queryIndexes(schemas: string[])` method on `TenantDatabasePort` so each adapter can use its own dialect-appropriate SQL. `SchemaDiscoveryService` calls the method instead of the raw query.

### Acceptance Criteria

- [ ] `TenantDatabasePort` gains a new method: `queryIndexes(schemas: string[]): Promise<QueryResult>`
- [ ] The result rows have the shape `{ schemaname: string; tablename: string; indexname: string; columnname: string; is_unique: boolean }`
- [ ] `TenantDatabaseAdapter` (PostgreSQL) implements `queryIndexes` using the existing `pg_index`/`pg_class`/`pg_namespace`/`pg_attribute` query, parameterized with `$N` placeholders
- [ ] `SqlServerTenantDatabaseAdapter` implements `queryIndexes` using `sys.indexes`, `sys.index_columns`, `sys.columns`, `sys.tables`, `sys.schemas`; filters to `i.type > 0` (excludes heaps); returns the same five column names
- [ ] `SchemaDiscoveryService.analyzeSchemas` calls `this.tenantDatabasePort.queryIndexes(schemas)` instead of the inline `pg_index` query; the `placeholders` string and the raw `pg_index` SQL are removed from `analyzeSchemas`
- [ ] Unit tests for each adapter's `queryIndexes`: mock the internal `query` call and assert the SQL contains the correct catalog tables for each dialect

---

## Slice 3: `TenantDatabaseDispatcher` + `SchemaDiscoveryModule` wiring

Create a dispatcher that selects the correct adapter at `connect()` time based on `config.dbType`, and wire it as the `TENANT_DATABASE_PORT` provider.

### Acceptance Criteria

- [ ] `packages/backend/src/schema-discovery/tenant-database.dispatcher.ts` exports `TenantDatabaseDispatcher` implementing `TenantDatabasePort`
- [ ] `TenantDatabaseDispatcher` is injected with both `TenantDatabaseAdapter` and `SqlServerTenantDatabaseAdapter` (constructor injection, not via NestJS tokens — plain constructor params)
- [ ] `connect(config)`: selects the PostgreSQL adapter when `config.dbType === 'postgresql'` and the SQL Server adapter when `config.dbType === 'sqlserver'`; stores the selected adapter instance; delegates `connect(config)` to it
- [ ] `query(sql, params?)`: delegates to the adapter stored in `connect()`; throws `'Dispatcher not connected'` if called before `connect()`
- [ ] `queryIndexes(schemas)`: delegates to the stored adapter; throws `'Dispatcher not connected'` if called before `connect()`
- [ ] `disconnect()`: delegates to the stored adapter; clears the stored reference; no-op if not connected
- [ ] `systemSchemaNames`: returns a union of both adapters' system schema sets (safe superset — callers filter, so being inclusive is correct)
- [ ] `SchemaDiscoveryModule` provides `TenantDatabaseDispatcher` as `TENANT_DATABASE_PORT` and declares `TenantDatabaseAdapter` and `SqlServerTenantDatabaseAdapter` as providers
- [ ] `QueryModule` receives `TENANT_DATABASE_PORT` from `SchemaDiscoveryModule` imports (no change needed if it already imports `SchemaDiscoveryModule`)
- [ ] Unit tests: `connect()` routes to the correct adapter for each `dbType`; `query()` throws before `connect()`; `disconnect()` clears state; `systemSchemaNames` is a superset of both adapters' sets

### API Shape

```typescript
// packages/backend/src/schema-discovery/tenant-database.dispatcher.ts
@Injectable()
export class TenantDatabaseDispatcher implements TenantDatabasePort {
  constructor(
    private readonly pgAdapter: TenantDatabaseAdapter,
    private readonly sqlServerAdapter: SqlServerTenantDatabaseAdapter,
  ) {}

  private activeAdapter: TenantDatabasePort | null = null;

  readonly systemSchemaNames: ReadonlySet<string>; // union of both adapters' sets

  async connect(config: TenantConnectionConfig): Promise<void> { ... }
  async query(sql: string, params?: unknown[]): Promise<QueryResult> { ... }
  async queryIndexes(schemas: string[]): Promise<QueryResult> { ... }
  async disconnect(): Promise<void> { ... }
}
```

---

## Slice 4: Dialect injection into LLM system prompt

Pass `dbType` through the query pipeline so `ClaudeAdapter` generates T-SQL for SQL Server connections and PostgreSQL SQL for PostgreSQL connections.

### Acceptance Criteria

- [ ] `LlmPort.generateQuery` signature changes to `generateQuery(prompt: string, dbType: 'postgresql' | 'sqlserver'): Promise<LlmQueryResponse>`
- [ ] `ClaudeAdapter.generateQuery` builds the system prompt dynamically based on `dbType`:
  - Both dialects: the prompt states which SQL dialect to use and instructs the model to avoid dialect-specific functions not available in the target engine
  - `postgresql`: prompt line `sql: a valid SELECT query answering the question (PostgreSQL dialect)` and the two existing PostgreSQL examples (`DATE_TRUNC`, `EXTRACT`)
  - `sqlserver`: prompt line `sql: a valid SELECT query answering the question (T-SQL / SQL Server dialect)` and two T-SQL examples using `FORMAT(date, 'yyyy-MM')` and `YEAR()` / `MONTH()` in place of `DATE_TRUNC` / `EXTRACT`
- [ ] `ClaudeAdapter` does not hardcode dialect in a module-level `const SYSTEM_PROMPT` — the prompt is constructed inside `generateQuery` or via a private helper that takes `dbType`
- [ ] `QueryService.query` retrieves `config.dbType` from `getTenantConnectionConfig` and passes it as the second argument to `this.llmPort.generateQuery(currentPrompt, config.dbType)`
- [ ] `QueryService` passes `config.dbType` on every attempt including retry attempts
- [ ] `ClaudeAdapter` unit tests assert that the generated system prompt contains `'T-SQL'` when `dbType='sqlserver'` and `'PostgreSQL'` when `dbType='postgresql'`
- [ ] `QueryService` unit tests assert that `llmPort.generateQuery` is called with the correct `dbType` value from the tenant config

---

## Slice 5: `ConnectionForm` encrypt toggle + `TenantConnectionConfig` extension

Expose the "Encrypt connection" toggle in the UI for SQL Server connections. Thread the `encrypt` flag through the config types, Drizzle schema, `ConnectionsService`, and `SqlServerTenantDatabaseAdapter`.

### Acceptance Criteria

- [ ] `TenantConnectionConfig` gains an optional `encrypt?: boolean` field (defaults to `false` in the adapter if absent)
- [ ] `connectionConfigs` Drizzle schema (`packages/backend/src/infrastructure/drizzle/schema.ts`) gains a nullable `encrypt` boolean column; a Drizzle migration is generated and committed
- [ ] `ConnectionsService.create` reads `encrypt` from the DTO and persists it
- [ ] `ConnectionsService.getTenantConnectionConfig` maps the persisted value to `encrypt` in the returned `TenantConnectionConfig`
- [ ] `ConnectionForm.tsx` renders an "Encrypt connection" checkbox visible only when `dbType === 'sqlserver'`; its value is sent as `encrypt` in the POST body
- [ ] When `encrypt` is `true`, `SqlServerTenantDatabaseAdapter.connect` sets `options.encrypt = true` and `options.trustServerCertificate = false`; when `false` or absent, sets `options.encrypt = false` and `options.trustServerCertificate = true`
- [ ] `ConnectionForm` test covers: encrypt checkbox appears only for `sqlserver`; checkbox value is included in the submitted body
- [ ] `ConnectionsService` test covers: `getTenantConnectionConfig` returns `encrypt: true` when the persisted value is truthy

---

## Phase 3 Definition of Done

All five slices are complete when:

- [ ] `npx vitest run` in `packages/backend` passes with 0 failures
- [ ] `pnpm test` in `packages/frontend` passes with 0 failures
- [ ] A SQL Server connection can be saved through the UI with `dbType = 'sqlserver'`
- [ ] `SchemaDiscoveryService.analyzeSchemas` no longer contains any `pg_index`, `pg_class`, `pg_namespace`, or `pg_attribute` SQL
- [ ] `ClaudeAdapter.SYSTEM_PROMPT` (or equivalent) no longer hardcodes `PostgreSQL dialect` unconditionally
- [ ] `LlmPort` carries `dbType` in `generateQuery`

[x] Reviewed
