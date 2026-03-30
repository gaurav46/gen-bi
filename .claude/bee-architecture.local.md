# Architecture: Phase 1 — Shared Foundation

## Pattern
Hexagonal (Ports & Adapters) — existing pattern, continue it.

## Key Decision: AppDatabaseModule extraction

Create `packages/backend/src/database/app-database.module.ts` — owns the `PRISMA_CLIENT` factory.
- `ConnectionsModule` imports `AppDatabaseModule`, drops its own `PRISMA_CLIENT` factory
- `SchemaDiscoveryModule` imports `AppDatabaseModule` + `ConnectionsModule`, drops `forwardRef`
- This resolves the circular dep completely and creates the seam for Phase 2 (DuckDB replaces Prisma inside this single file)

## Key Decision: systemSchemaNames on TenantDatabasePort

```typescript
export interface TenantDatabasePort {
  readonly systemSchemaNames: ReadonlySet<string>;
  connect(config: TenantConnectionConfig): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  disconnect(): Promise<void>;
}
```

- PostgreSQL adapter: `readonly systemSchemaNames = new Set(['information_schema', 'pg_catalog', 'pg_toast'])`
- Phase 3 SQL Server adapter owns its own set (`sys`, `INFORMATION_SCHEMA`, etc.)
- SchemaDiscoveryService uses `this.tenantDatabasePort.systemSchemaNames` — dialect-agnostic

## Key Decision: portManuallyEdited flag in ConnectionForm

```typescript
const [portManuallyEdited, setPortManuallyEdited] = useState(false);
// Set to true on port change, and when loading an existing connection from API
```
- On dbType change: only auto-toggle port if `!portManuallyEdited`
- On loading existing connection: set `portManuallyEdited = true` to lock it

## Slice Order

Keep spec order as written (1 → 2 → 3 → 4 → 5). No reorder needed.

## Dependency Direction After Phase 1

```
AppModule
  → ConnectionsModule → AppDatabaseModule (PRISMA_CLIENT)
  → SchemaDiscoveryModule → AppDatabaseModule + ConnectionsModule
  → QueryModule → ConnectionsModule (forwardRef stays, QueryModule is not in the cycle)
  → DashboardsModule → ConnectionsModule + SchemaDiscoveryModule
```

## Evolution Triggers

- Phase 2: Swap provider inside AppDatabaseModule only (DuckDB/Drizzle replaces Prisma)
- Phase 3: Add SqlServerTenantDatabaseAdapter + TenantDatabaseDispatcher; swap TENANT_DATABASE_PORT token
- Future: If ConnectionForm grows many dbType-specific field groups, extract a per-dbType field config object

## Files Created / Modified

### New
- `packages/backend/src/database/app-database.module.ts`

### Modified
- `packages/backend/src/connections/connections.module.ts` — imports AppDatabaseModule, removes PRISMA_CLIENT factory
- `packages/backend/src/schema-discovery/schema-discovery.module.ts` — imports AppDatabaseModule, removes forwardRef
- `packages/backend/src/schema-discovery/tenant-database.port.ts` — add systemSchemaNames property
- `packages/backend/src/schema-discovery/tenant-database.adapter.ts` — add PostgreSQL system schema set
- `packages/backend/src/schema-discovery/schema-discovery.service.ts` — remove SYSTEM_SCHEMA_NAMES constant, use port property
- `packages/backend/prisma/schema.prisma` — add dbType field to ConnectionConfig
- `packages/backend/src/connections/connections.service.ts` — add dbType to DTO + service methods
- `packages/frontend/src/components/settings-form/ConnectionForm.tsx` — add dbType Select + portManuallyEdited
- `packages/backend/package.json` — fix @anthropic-ai/sdnk typo
