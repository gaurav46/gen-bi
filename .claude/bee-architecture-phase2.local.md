# Architecture: Phase 2 — DuckDB App Database

## Pattern
Hexagonal (Ports & Adapters) — existing pattern. Infrastructure subfolder for Drizzle artifacts; single factory function as swap point inside `AppDatabaseModule`.

## File Structure
```
packages/backend/src/
  infrastructure/
    drizzle/
      schema.ts       — 8 table definitions (pgTable, pg-core dialect)
      client.ts       — createDrizzleClient() factory + DRIZZLE_CLIENT token
      migrations/     — generated SQL files, committed
  database/
    app-database.module.ts  — swap: Prisma factory → Drizzle factory, exports DRIZZLE_CLIENT
```

No repository layer. Drizzle query builder calls live inline in services.

## Packages
- `drizzle-orm` — latest (no pin needed)
- `@duckdb/node-api` — EXACT version pin (Slice 1 spike determines version)
- `drizzle-kit` — devDependency, latest compatible with drizzle-orm

## Table Definition Approach
Use `pgTable` from `drizzle-orm/pg-core` — DuckDB is PostgreSQL-compatible for DDL.

`FLOAT[1536]` embedding column uses a custom column type:
```typescript
const float1536 = customType<{ data: number[]; driverData: string }>({
  dataType() { return 'FLOAT[1536]'; },
  toDriver(value: number[]): string { return JSON.stringify(value); },
  fromDriver(value: string): number[] { return JSON.parse(value); },
});
// Usage: float1536('embedding').notNull()
```

## Migration Strategy
- **DuckDB path**: `drizzle-kit generate` → committed SQL files in `migrations/` → auto-run at startup via `migrate(db, { migrationsFolder })` inside factory
- **PostgreSQL path**: Keep existing Prisma migrations. Drizzle client wraps `pg.Pool` against already-migrated DB. No Drizzle migrations for PostgreSQL path.

## DRIZZLE_CLIENT Token + Type
```typescript
export const DRIZZLE_CLIENT = 'DRIZZLE_CLIENT' as const;
export type AppDatabase = NodePgDatabase<typeof schema>;
// Factory returns Promise<AppDatabase>; DuckDB instance uses `as AppDatabase` assertion
```
Services use: `@Inject(DRIZZLE_CLIENT) private readonly db: AppDatabase`

## VSS Extension Loading
Eager load at factory creation (not lazy):
```typescript
const instance = await DuckDBInstance.create(dbPath);
const connection = await instance.connect();
await connection.run('LOAD vss');
await connection.run('SET hnsw_enable_experimental_persistence = true');
const db = drizzle(connection, { schema });
```
(Exact API confirmed during Slice 1 spike)

## Slice Order
Validated as correct:
1. Spike → 2. Schema → 3. Factory+Module → 4. ConnectionsService+SchemaDiscoveryService → 5. DashboardsService → 6. DrizzleSchemaRetrievalAdapter → 7. Cleanup

Note: Between Slice 3 and Slice 6, the app will fail at runtime (services still call prisma.* on a Drizzle client). Unit tests remain green throughout. This is expected.

## New Files
- `src/infrastructure/drizzle/schema.ts`
- `src/infrastructure/drizzle/client.ts`
- `src/infrastructure/drizzle/migrations/`
- `src/query/drizzle-schema-retrieval.adapter.ts`

## Modified Files
- `src/database/app-database.module.ts` — Prisma → Drizzle factory
- `src/connections/connections.service.ts` — PRISMA_CLIENT → DRIZZLE_CLIENT
- `src/schema-discovery/schema-discovery.service.ts` — PRISMA_CLIENT → DRIZZLE_CLIENT
- `src/dashboards/dashboards.service.ts` — PRISMA_CLIENT → DRIZZLE_CLIENT
- `src/query/query.module.ts` — PrismaSchemaRetrievalAdapter → DrizzleSchemaRetrievalAdapter
- `packages/backend/package.json` — add drizzle-orm, @duckdb/node-api, drizzle-kit; remove Prisma, jest, ts-jest (Slice 7)

## Deleted Files
- `src/query/prisma-schema-retrieval.adapter.ts`
- `generated/prisma/` directory

[x] Reviewed
