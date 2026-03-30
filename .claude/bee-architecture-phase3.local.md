# Architecture: Phase 3 — SQL Server Tenant Data Source

## Pattern
Hexagonal (Ports & Adapters) — existing pattern. New sibling adapter + dispatcher inside `schema-discovery/`. No changes to any feature module outside `schema-discovery/` and `query/` except for the `LlmPort` signature and `ClaudeAdapter`.

## File Structure
```
packages/backend/src/
  schema-discovery/
    tenant-database.port.ts         — add queryIndexes(schemas) method
    tenant-database.adapter.ts      — implement queryIndexes (pg_index SQL)
    sqlserver-tenant-database.adapter.ts   — NEW: SQL Server adapter
    tenant-database.dispatcher.ts   — NEW: routes by config.dbType
    schema-discovery.module.ts      — wire dispatcher as TENANT_DATABASE_PORT
    schema-discovery.service.ts     — replace inline pg_index SQL with queryIndexes()
  query/
    llm.port.ts                     — add dbType param to generateQuery
    claude.adapter.ts               — dynamic system prompt based on dbType
    query.service.ts                — pass config.dbType to llmPort.generateQuery
  infrastructure/
    drizzle/
      schema.ts                     — add encrypt column to connectionConfigs
      migrations/                   — new migration for encrypt column
  connections/
    connections.service.ts          — map encrypt to/from TenantConnectionConfig

packages/frontend/src/
  components/settings-form/
    ConnectionForm.tsx              — add encrypt checkbox (SQL Server only)
```

## Dispatcher Design
`TenantDatabaseDispatcher` implements `TenantDatabasePort`. Both adapters are injected via constructor (no NestJS injection tokens — they are concrete classes). Adapter is selected at `connect()` time and stored until `disconnect()`.

```typescript
@Injectable()
export class TenantDatabaseDispatcher implements TenantDatabasePort {
  private activeAdapter: TenantDatabasePort | null = null;

  constructor(
    private readonly pgAdapter: TenantDatabaseAdapter,
    private readonly sqlServerAdapter: SqlServerTenantDatabaseAdapter,
  ) {}

  readonly systemSchemaNames: ReadonlySet<string> = new Set([
    // union of both adapters' sets — computed at construction time
  ]);

  async connect(config: TenantConnectionConfig): Promise<void> {
    this.activeAdapter = config.dbType === 'sqlserver'
      ? this.sqlServerAdapter
      : this.pgAdapter;
    return this.activeAdapter.connect(config);
  }
  // query / queryIndexes / disconnect delegate to this.activeAdapter
}
```

`SchemaDiscoveryModule` wiring:
```typescript
providers: [
  TenantDatabaseAdapter,
  SqlServerTenantDatabaseAdapter,
  TenantDatabaseDispatcher,
  { provide: TENANT_DATABASE_PORT, useExisting: TenantDatabaseDispatcher },
  ...
]
```

## SQL Server Parameter Translation
`SqlServerTenantDatabaseAdapter.query(sql, params)` replaces `$N` → `@pN` and binds via `request.input('pN', value)`. This is internal to the adapter — callers use the same `$N` convention as with PostgreSQL.

```typescript
async query(sql: string, params?: unknown[]): Promise<QueryResult> {
  const request = this.pool.request();
  let translated = sql;
  if (params) {
    params.forEach((value, i) => {
      const name = `p${i + 1}`;
      translated = translated.replace(`$${i + 1}`, `@${name}`);
      request.input(name, value);
    });
  }
  const result = await request.query(translated);
  return { rows: result.recordset as Record<string, unknown>[] };
}
```

## `queryIndexes` Port Method
Each adapter provides its own SQL. Result columns are identical: `{ schemaname, tablename, indexname, columnname, is_unique }`.

PostgreSQL SQL (existing, moved from service):
```sql
SELECT n.nspname AS schemaname, t.relname AS tablename, i.relname AS indexname,
       a.attname AS columnname, ix.indisunique AS is_unique
FROM pg_index ix
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE n.nspname IN ($1, $2, ...)
```

SQL Server SQL (new):
```sql
SELECT s.name AS schemaname, t.name AS tablename, i.name AS indexname,
       c.name AS columnname, i.is_unique
FROM sys.indexes i
JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
JOIN sys.tables t ON i.object_id = t.object_id
JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE i.type > 0 AND s.name IN (@p1, @p2, ...)
```

## Dialect Injection Design
`LlmPort` gains `dbType` as a second parameter. `ClaudeAdapter` builds the system prompt dynamically — no module-level `const SYSTEM_PROMPT`. The PostgreSQL-specific examples (`DATE_TRUNC`, `EXTRACT`) stay in the `postgresql` branch; T-SQL examples (`FORMAT`, `YEAR`/`MONTH`) are added for the `sqlserver` branch.

```typescript
// llm.port.ts
export interface LlmPort {
  generateQuery(
    prompt: string,
    dbType: 'postgresql' | 'sqlserver',
  ): Promise<LlmQueryResponse>;
}

// query.service.ts — in the attempt loop
const llmResponse = await this.llmPort.generateQuery(currentPrompt, config.dbType);
```

## TenantConnectionConfig Extension
`encrypt` is added as an optional field. Defaults to `false` if absent (existing configs unaffected).

```typescript
export type TenantConnectionConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  dbType: 'postgresql' | 'sqlserver';
  encrypt?: boolean;      // NEW — SQL Server only; ignored by PostgreSQL adapter
};
```

`connectionConfigs` Drizzle schema gains: `encrypt: boolean('encrypt').default(false)`. A `drizzle-kit generate` migration is committed.

## Packages
- `mssql` — production dependency
- `@types/mssql` — devDependency

## Slice Order
1. `SqlServerTenantDatabaseAdapter` (isolated, testable)
2. `queryIndexes` port method + both adapters + service update
3. `TenantDatabaseDispatcher` + module wiring
4. Dialect injection (LlmPort + ClaudeAdapter + QueryService)
5. `encrypt` field (schema + config + form)

Slices 4 and 5 are independent of each other and could be done in either order.

## New Files
- `src/schema-discovery/sqlserver-tenant-database.adapter.ts`
- `src/schema-discovery/tenant-database.dispatcher.ts`
- `src/infrastructure/drizzle/migrations/<timestamp>_add_encrypt_to_connection_configs.sql`

## Modified Files
- `src/schema-discovery/tenant-database.port.ts` — add `queryIndexes`
- `src/schema-discovery/tenant-database.adapter.ts` — implement `queryIndexes`
- `src/schema-discovery/schema-discovery.module.ts` — add new providers + dispatcher
- `src/schema-discovery/schema-discovery.service.ts` — replace pg_index SQL with `queryIndexes()`
- `src/query/llm.port.ts` — add `dbType` param
- `src/query/claude.adapter.ts` — dynamic system prompt
- `src/query/query.service.ts` — pass `dbType` to `generateQuery`
- `src/infrastructure/drizzle/schema.ts` — add `encrypt` column
- `src/connections/connections.service.ts` — map `encrypt` field
- `packages/backend/package.json` — add `mssql`, `@types/mssql`
- `packages/frontend/.../ConnectionForm.tsx` — encrypt checkbox

[x] Reviewed
