
---
## Codebase Context (from context-gatherer)

### Architecture Pattern
Hexagonal (Ports & Adapters) with NestJS feature-module shell.
- All external interactions behind port interfaces: `TenantDatabasePort`, `EmbeddingPort`, `SchemaRetrievalPort`, `LlmPort`, `DescriptionSuggestionPort`
- Business logic in services depends only on port interfaces — adapters are leaf nodes
- `PRISMA_CLIENT` token is the single injection point for the app DB, shared across 4 services

### App DB Layer (Prisma + PostgreSQL — to be replaced)
- `connections.module.ts:14-19` — `PRISMA_CLIENT` factory using `PrismaPg` adapter
- All Prisma calls scattered in: `ConnectionsService`, `SchemaDiscoveryService`, `PrismaSchemaRetrievalAdapter`, `DashboardsService`
- 7 Prisma models to port: `ConnectionConfig`, `DiscoveredTable`, `DiscoveredColumn`, `DiscoveredForeignKey`, `DiscoveredIndex`, `Dashboard`, `Widget`, `ColumnEmbedding`
- `ColumnEmbedding` uses `Unsupported("vector(1536)")` — pgvector type, must become DuckDB VSS FLOAT[1536]

### Vector Search (pgvector — to be replaced)
- `prisma-schema-retrieval.adapter.ts:24-41` — raw `$queryRaw` with `<=>` cosine similarity operator
- `schema-discovery.service.ts:243` — embedding insert with `::vector` cast and `gen_random_uuid()`
- **Known JOIN bug**: adapter joins `dt.table_name = ce.table_id` and `dc.column_name = ce.column_id` — compares string names to UUID IDs. Likely returns 0 rows in a correct DB. Must fix during migration.

### TenantDatabasePort (PostgreSQL-only)
- `tenant-database.adapter.ts` — uses `pg.Client` directly
- Schema discovery uses `information_schema` (ANSI-portable) BUT index query uses `pg_index`, `pg_class`, `pg_namespace`, `pg_attribute` (PostgreSQL-only)
- System schema filter hardcoded for PostgreSQL: `pg_catalog`, `pg_toast`, `pg_temp_*`
- Read-only: `SET default_transaction_read_only = on` — PostgreSQL-specific
- `TenantConnectionConfig` type has no `dbType` field yet

### Connection Form UI (frontend)
- `ConnectionForm.tsx` — fields: host, port (default 5432), database, username, password + derived connection string
- No `dbType` selector
- `POST /api/connections` body is PostgreSQL-only
- `ConnectionConfig` Prisma model has `port Int @default(5432)` — PostgreSQL default

### Module DI Wiring
- `ConnectionsModule` exports `PRISMA_CLIENT` + `ConnectionsService`
- `SchemaDiscoveryModule` provides `TENANT_DATABASE_PORT` → `TenantDatabaseAdapter`
- `QueryModule` provides `SCHEMA_RETRIEVAL_PORT` → `PrismaSchemaRetrievalAdapter`
- forwardRef circular dep between `ConnectionsModule` ↔ `SchemaDiscoveryModule`
- For SQL Server: `TENANT_DATABASE_PORT` needs to dispatch to correct adapter based on `dbType`

### Tidy Opportunities
1. **JOIN bug** in `prisma-schema-retrieval.adapter.ts:31-35` — must fix during DuckDB migration
2. **`@anthropic-ai/sdnk` typo** in backend `package.json:21` — should be `@anthropic-ai/sdk`
3. **Unused jest/ts-jest** in backend devDependencies — project uses Vitest exclusively
4. **`SYSTEM_SCHEMA_NAMES`** constant in `schema-discovery.service.ts:12` is PostgreSQL-specific — should move to adapter level for multi-dialect support
5. **`prisma: any`** typing in 3 services — typed as `any` instead of generated `PrismaClient`
6. **forwardRef circular dep** between `ConnectionsModule` ↔ `SchemaDiscoveryModule`

### Test Infrastructure
- Vitest 4, co-located specs (`*.spec.ts`)
- No real database in tests — all "integration" tests use `vi.fn()` mocks for all ports
- No test-database fixture, no docker-compose

### Design System
- shadcn/ui + Radix UI + Tailwind CSS 4 + lucide-react
- UI-involved: yes (connection form needs `dbType` selector + port default toggle)
