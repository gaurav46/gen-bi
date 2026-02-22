# TDD Plan: Schema Explorer Phase 1, Slice 1 -- Backend Paginated Row Fetch + PK Detection

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it (`[ ]` -> `[x]`).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

## Context
- **Source**: `docs/specs/schema-explorer-phase-1.md`
- **Slice**: 1 -- Backend paginated row fetch + PK detection
- **Risk Level**: MODERATE
- **Success Criteria**:
  - Endpoint returns paginated rows (25/page default) for connection + schema + table
  - Returns total row count alongside page data
  - 1-based page param, defaults to page 1
  - Quoted schema/table names in SQL (handles reserved words)
  - Parameterized LIMIT/OFFSET (no string interpolation)
  - 404 when connection ID not found
  - 404 when table does not exist in tenant DB
  - Empty rows array (not error) for zero-row tables
  - 400 when page < 1
  - Detects and returns primary key columns

## Codebase Analysis

### Architecture
- **Current**: NestJS with token-based DI; `TenantDatabasePort` interface with `connect/query/disconnect` lifecycle; `ConnectionsService` resolves connection configs. Tests mock ports via `{ provide: TOKEN, useValue: mockObj }`.
- **Target**: Add a new service (`TableRowsService`) that owns the row-fetch + PK-detection use case, keeping `SchemaDiscoveryService` focused on schema analysis. New controller endpoint on `SchemaController`. Follows existing hexagonal patterns.

### Directory Structure
| Layer | Location | Test Location |
|-------|----------|---------------|
| Inbound Adapter | `packages/backend/src/schema-discovery/schema.controller.ts` | `schema.controller.spec.ts` (co-located) |
| Use Case | `packages/backend/src/schema-discovery/table-rows.service.ts` (new) | `table-rows.service.spec.ts` (co-located) |
| Domain | Pure pagination math + SQL builder functions (inline or extracted) | Tested in use case spec or dedicated pure spec |
| Outbound Adapter | `TenantDatabasePort` (existing) | Already tested in `tenant-database.adapter.spec.ts` |

### External Dependencies to Mock (in outer test)
- `TenantDatabasePort` -- tenant database (already an interface)
- `ConnectionsService` -- app database lookup (already injectable)

### Test Infrastructure
- Framework: Vitest
- Mocking: `vi.fn()`, NestJS `Test.createTestingModule`
- Pattern: mock ports as plain objects with `vi.fn()` methods

---

## Outer Test (Integration)

**Write this test FIRST. It stays RED until all layers are built and wired.**

### Scenario
A caller hits `GET /api/schema/:connectionId/tables/:schemaName/:tableName/rows?page=1` and receives paginated rows, total count, and PK info from the tenant database.

### Test Specification
- Location: `packages/backend/src/schema-discovery/table-rows.integration.spec.ts`
- Test name: `GET /schema/:connectionId/tables/:schema/:table/rows returns paginated rows with PK info`

### Setup
- Create NestJS testing module with real `SchemaController`, real `TableRowsService`
- Mock `ConnectionsService.getTenantConnectionConfig` to return a canned config
- Mock `TenantDatabasePort` to simulate tenant DB responses (count query, data query, PK query)

### Actions
1. Send GET request to the endpoint via NestJS `app.inject()` or supertest

### Assertions
- [x] Response status is 200
- [x] Body contains `rows` (array of 25 or fewer records), `totalRows` (number), `page` (1), `pageSize` (25), `primaryKeyColumns` (string array)

### Expected Failure Progression
| After Layer | Expected Failure |
|-------------|-----------------|
| (none) | 404 -- route not defined |
| Controller endpoint added | Error -- `TableRowsService` not provided / method not implemented |
| Service implemented | Test passes |

---

## Layer 1: Inbound Adapter (Controller Endpoint)

### 1.0 Define the Use Case contract

Before writing the controller test, define what the controller needs to call.

- [x] **CREATE**: `TableRowsService` as an injectable NestJS service class (can start as empty/stub)
  - Location: `packages/backend/src/schema-discovery/table-rows.service.ts`
  - Public method signature: `fetchRows(connectionId: string, schemaName: string, tableName: string, page: number): Promise<TableRowsResult>`
  - The `TableRowsResult` type: `{ rows: Record<string, unknown>[], totalRows: number, page: number, pageSize: number, primaryKeyColumns: string[] }`
  - Stub the method to throw `new Error('Not implemented')` so tests can reference the class

### 1.1 Controller test: happy path delegation

**Behavior**: Controller parses route params and query param, delegates to `TableRowsService`, returns result as-is.

- [x] **RED**: Write test
  - Location: `packages/backend/src/schema-discovery/schema.controller.spec.ts` (add to existing describe block)
  - Test name: `GET :connectionId/tables/:schema/:table/rows delegates to TableRowsService and returns result`
  - Mock: `TableRowsService.fetchRows` returns a canned `TableRowsResult`
  - Assert: controller method returns the canned result; `fetchRows` called with correct args including parsed page number

- [x] **RUN**: Confirm test FAILS (method does not exist on controller)

- [x] **GREEN**: Add endpoint to `SchemaController`
  - `@Get(':connectionId/tables/:schemaName/:tableName/rows')`
  - Inject `TableRowsService`, parse `@Query('page')` with `parseInt`, default to 1
  - Delegate to `tableRowsService.fetchRows(connectionId, schemaName, tableName, page)`

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: Extract `ParseIntPipe` or `DefaultValuePipe` for the page param if NestJS pipes are cleaner

### 1.2 Controller test: page defaults to 1 when omitted

- [x] **RED**: Write test
  - Test name: `GET rows defaults to page 1 when query param is omitted`
  - Call without `?page=`, assert `fetchRows` was called with page `1`

- [x] **RUN -> GREEN -> REFACTOR**

### 1.3 Controller test: invalid page returns 400

- [x] **RED**: Write test
  - Test name: `GET rows returns 400 when page is less than 1`
  - Mock: `TableRowsService.fetchRows` throws `BadRequestException`
  - Assert: the exception propagates (NestJS converts to 400)

- [x] **RUN -> GREEN -> REFACTOR**

### 1.4 Controller test: connection not found returns 404

- [x] **RED**: Write test
  - Test name: `GET rows returns 404 when connection does not exist`
  - Mock: `TableRowsService.fetchRows` throws `NotFoundException`
  - Assert: exception propagates

- [x] **RUN -> GREEN -> REFACTOR**

- [x] **ARCHITECTURE CHECK**: Controller imports only `TableRowsService` (injected). No direct imports of `TenantDatabasePort` or `ConnectionsService`.

### After Layer 1
- [x] **RUN OUTER TEST**: Confirm it fails with "Not implemented" from the stubbed service (outer test will be written during wiring)
- [x] **COMMIT**: skipping commit per user preference (will commit at end)

---

## Layer 2: Use Case (TableRowsService) + Domain Logic

### 2.0 Define outbound dependencies

The service needs:
- `ConnectionsService.getTenantConnectionConfig(connectionId)` -- already exists
- `TenantDatabasePort` (connect/query/disconnect) -- already exists as interface

No new port interfaces needed; both are already defined and injected via tokens.

### 2.1 Domain: pagination offset calculation (pure)

- [x] **RED**: Write pure test
  - Location: `packages/backend/src/schema-discovery/pagination.spec.ts`
  - Test name: `calculateOffset returns 0 for page 1 with pageSize 25`
  - Test name: `calculateOffset returns 25 for page 2 with pageSize 25`
  - Test name: `calculateOffset returns 50 for page 3 with pageSize 25`
  - Input: `(page, pageSize)` -> output: offset number

- [x] **RUN**: Confirm tests FAIL

- [x] **GREEN**: Implement
  - Location: `packages/backend/src/schema-discovery/pagination.ts`
  - Pure function: `calculateOffset(page: number, pageSize: number): number`
  - Formula: `(page - 1) * pageSize`

- [x] **RUN**: Confirm tests PASS

- [x] **REFACTOR**: Keep it minimal

### 2.2 Domain: build quoted SELECT query (pure)

- [x] **RED**: Write pure test
  - Location: `packages/backend/src/schema-discovery/pagination.spec.ts` (same file)
  - Test name: `buildRowsQuery quotes schema and table names`
  - Assert: output SQL contains `"mySchema"."myTable"` with double quotes
  - Test name: `buildRowsQuery uses $1 and $2 placeholders for LIMIT and OFFSET`
  - Assert: SQL contains `LIMIT $1 OFFSET $2`, never literal numbers

- [x] **RUN**: Confirm tests FAIL

- [x] **GREEN**: Implement
  - Location: `packages/backend/src/schema-discovery/pagination.ts`
  - Pure function: `buildRowsQuery(schemaName: string, tableName: string): string`
  - Returns: `SELECT * FROM "schemaName"."tableName" LIMIT $1 OFFSET $2`

- [x] **RUN**: Confirm tests PASS

### 2.3 Domain: build quoted COUNT query (pure)

- [x] **RED**: Write pure test
  - Test name: `buildCountQuery quotes schema and table names`
  - Assert: `SELECT count(*) FROM "schema"."table"`

- [x] **RUN -> GREEN -> REFACTOR**

### 2.4 Domain: build PK detection query (pure)

- [x] **RED**: Write pure test
  - Test name: `buildPrimaryKeyQuery uses parameterized schema and table name`
  - Assert: query references `information_schema.table_constraints` and `key_column_usage` with `$1` and `$2` placeholders for schema and table

- [x] **RUN -> GREEN -> REFACTOR**

- [x] **PURITY CHECK**: `pagination.ts` has zero imports from NestJS, `pg`, adapters, or services

### 2.5 Service test: happy path -- fetches rows, count, and PK

**Behavior**: Service connects to tenant DB, runs three queries (count, rows, PK), disconnects, returns assembled result.

- [x] **RED**: Write test
  - Location: `packages/backend/src/schema-discovery/table-rows.service.spec.ts`
  - Test name: `fetchRows returns paginated rows, total count, and PK columns`
  - Mock: `ConnectionsService.getTenantConnectionConfig` returns canned config
  - Mock: `TenantDatabasePort.query` returns different results based on SQL content (count -> `{ count: '42' }`, rows -> 25 row objects, PK -> `[{ column_name: 'id' }]`)
  - Assert: result matches `{ rows: [...], totalRows: 42, page: 1, pageSize: 25, primaryKeyColumns: ['id'] }`
  - Assert: `connect` called with config, `disconnect` called in finally

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Implement `TableRowsService.fetchRows`
  - Inject `ConnectionsService` and `TenantDatabasePort` (via `@Inject(TENANT_DATABASE_PORT)`)
  - Validate page >= 1, throw `BadRequestException` if not
  - Get config via `connectionsService.getTenantConnectionConfig(connectionId)` (throws 404 if missing)
  - Connect, run count query, run rows query with `[pageSize, offset]` params, run PK query with `[schemaName, tableName]` params, disconnect in finally
  - Use pure functions from `pagination.ts` for query building and offset calculation

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**

### 2.6 Service test: page < 1 throws BadRequestException

- [x] **RED**: Write test
  - Test name: `fetchRows throws BadRequestException when page is less than 1`
  - Call with page `0` and page `-1`
  - Assert: `BadRequestException` thrown
  - Assert: `TenantDatabasePort.connect` never called (fail fast)

- [x] **RUN -> GREEN -> REFACTOR**

### 2.7 Service test: connection not found propagates NotFoundException

- [x] **RED**: Write test
  - Test name: `fetchRows propagates NotFoundException when connection does not exist`
  - Mock: `ConnectionsService.getTenantConnectionConfig` throws `NotFoundException`
  - Assert: `NotFoundException` thrown

- [x] **RUN -> GREEN -> REFACTOR**

### 2.8 Service test: table does not exist returns 404

- [x] **RED**: Write test
  - Test name: `fetchRows throws NotFoundException when table does not exist in tenant DB`
  - Mock: `TenantDatabasePort.query` throws a PG error with code `42P01` (undefined_table) on the count query
  - Assert: `NotFoundException` thrown with descriptive message

- [x] **RUN -> GREEN -> REFACTOR**

### 2.9 Service test: empty table returns empty rows (not error)

- [x] **RED**: Write test
  - Test name: `fetchRows returns empty rows array when table has zero rows`
  - Mock: count query returns `{ count: '0' }`, rows query returns `{ rows: [] }`
  - Assert: result has `rows: []`, `totalRows: 0`

- [x] **RUN -> GREEN -> REFACTOR**

### 2.10 Service test: table with no primary key returns empty PK array

- [x] **RED**: Write test
  - Test name: `fetchRows returns empty primaryKeyColumns when table has no PK`
  - Mock: PK query returns `{ rows: [] }`
  - Assert: `primaryKeyColumns` is `[]`

- [x] **RUN -> GREEN -> REFACTOR**

### 2.11 Service test: disconnect called even when query fails

- [x] **RED**: Write test
  - Test name: `fetchRows disconnects even when a query fails`
  - Mock: rows query throws
  - Assert: `disconnect` still called

- [x] **RUN -> GREEN -> REFACTOR**

- [x] **ARCHITECTURE CHECK**:
  - `TableRowsService` imports: `ConnectionsService`, `TenantDatabasePort` (interface), `pagination.ts` (pure)
  - `TableRowsService` does NOT import `pg`, `TenantDatabaseAdapter`, or any infrastructure
  - `pagination.ts` imports NOTHING from outside its own file

### After Layer 2
- [x] **RUN OUTER TEST**: Service tests all pass; outer integration test will validate wiring next
- [x] **COMMIT**: skipping commit per user preference (will commit at end)

---

## Wiring Phase

- [x] **Register `TableRowsService`** in `SchemaDiscoveryModule` providers
  - Location: `packages/backend/src/schema-discovery/schema-discovery.module.ts`
  - Add `TableRowsService` to `providers` array
  - Ensure `ConnectionsModule` is imported (already is via `forwardRef`)

- [x] **Inject `TableRowsService`** into `SchemaController` constructor
  - This should already be done from Layer 1, but verify the module provides it

- [x] **RUN OUTER TEST**: Confirm it PASSES

- [x] **RUN full test suite**: `pnpm --filter backend test` -- all 150 tests pass across 22 files

- [x] **COMMIT**: skipping commit per user preference (will commit at end)

---

## Final Architecture Verification

- [x] **Inbound adapter** (`SchemaController`): imports only `TableRowsService` (injected), NestJS decorators
- [x] **Use case** (`TableRowsService`): imports `ConnectionsService`, `TenantDatabasePort` type, pure functions from `pagination.ts`
- [x] **Domain** (`pagination.ts`): imports nothing -- pure functions only
- [x] **No circular dependencies** between layers

## Test Summary
| Layer | Type | Tests | Mocks Used | Status |
|-------|------|-------|------------|--------|
| Outer (Integration) | Integration | 1 | TenantDatabasePort, ConnectionsService | |
| Controller | Unit | 4 | TableRowsService | |
| Service (Use Case) | Unit | 7 | TenantDatabasePort, ConnectionsService | |
| Domain (pagination) | Pure | ~6 | None | |
| **Total** | | **~18** | | |

[x] Reviewed
