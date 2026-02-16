# TDD Plan: Slice 2 -- Sample Data Rows in Schema Context
<!-- -------- bee-comment -------- -->
> **@developer**: does it need design changes
> **@bee**: No — this slice is entirely backend. It adds sample rows to the schema context string sent to the LLM. No UI, no frontend, no design changes.
> - [ ] mark as resolved
<!-- -------- /bee-comment -------- -->

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it ([ ] -> [x]).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

## Context
- **Source**: `docs/specs/gen-bi-query-quality.md`
- **Phase/Slice**: Slice 2 -- Sample Data Rows in Schema Context
- **Risk level**: MODERATE
- **Success Criteria**:
  1. QueryService fetches up to 5 sample rows per relevant table from the tenant DB
  2. Sample row fetch failures are non-fatal (logged and skipped)
  3. buildSchemaContext accepts an optional sample-rows parameter alongside columns
  4. Schema context output includes sample rows formatted below each table's column listing
  5. Tables with no sample rows show columns only, no empty sample section

## Codebase Analysis

### Architecture
- Current: Hexagonal architecture already in place with ports, adapters, and pure utility functions
- `buildSchemaContext` is a pure function (no class, no DI) -- stays pure
- `QueryService` orchestrates via injected ports -- stays as the use case layer
- `TenantDatabasePort` already exists and is injected into QueryService

### Key Files
| Layer | File | Test File |
|-------|------|-----------|
| Pure utility | `packages/backend/src/query/schema-context-builder.ts` | `schema-context-builder.spec.ts` |
| Use case | `packages/backend/src/query/query.service.ts` | `query.service.spec.ts` |
| Port (existing) | `packages/backend/src/schema-discovery/tenant-database.port.ts` | -- |
| Integration | `packages/backend/src/query/query.integration.spec.ts` | -- |

### What Already Exists
- `TenantDatabasePort.query(sql)` -- can run `SELECT * FROM <table> LIMIT 5`
- `RelevantColumn.tableName` -- used to derive unique table names
- `buildSchemaContext(columns)` -- pure function, groups by table, formats columns
- `QueryService` connects to tenant DB before the retry loop -- sample fetch goes here

### No New Ports Needed
The outbound port (`TenantDatabasePort`) already exists. This slice adds a new call pattern on an existing port. No new interfaces required -- YAGNI.

---

## Outer Test (Integration)

**Write this test FIRST. It stays RED until all layers are built.**

### Scenario
User asks a question. The system fetches sample rows from relevant tables and includes them in the LLM prompt alongside schema columns. The LLM generates SQL, it executes, and results come back.

### Test Specification
- Test location: `packages/backend/src/query/query.integration.spec.ts`
- Test name: `'includes sample data rows in the prompt sent to LLM'`

### Setup
- Mock `tenantDatabasePort.query` to return sample rows on the LIMIT-5 queries and final result rows on the generated SQL query
- All other mocks same as existing integration tests

### Assertions
- [x] The prompt sent to `llmPort.generateQuery` contains sample row values (e.g., `'Alice'`, `'500'`)
- [x] The prompt contains the column listing (existing behavior preserved)
- [x] The final result is still correct

### Expected Failure Progression
| After Layer | Expected Failure |
|-------------|-----------------|
| (none) | Sample data not in prompt |
| Pure domain (buildSchemaContext) | QueryService not fetching sample rows yet |
| Use case (QueryService) | GREEN |

---

## Layer 1: Pure Domain -- buildSchemaContext with Sample Rows

This is pure code. No mocks. No I/O. Input leads to output.

### 1.1 Define the sample rows type

- [x] **CREATE TYPE**: Add a `SampleRows` type -- a `Map<string, Record<string, unknown>[]>` or equivalent, keyed by table name. Place it alongside existing types in `schema-context-builder.ts` or `query.types.ts` (whichever fits better with existing patterns).

### 1.2 Pure Test: sample rows appear below table columns

- [x] **RED**: Write test in `schema-context-builder.spec.ts`
  - Test name: `'includes sample rows below column listing when provided'`
  - Input: columns for one table + sample rows map with 2 rows for that table
  - Assert: output contains formatted sample data values

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Update `buildSchemaContext` to accept optional second parameter (sample rows map). When present and table has rows, format them below the columns.

- [x] **RUN**: Confirm test PASSES

### 1.3 Pure Test: tables without sample rows show columns only

- [x] **RED**: Write test in `schema-context-builder.spec.ts`
  - Test name: `'shows columns only for tables with no sample rows'`
  - Input: columns for two tables, sample rows for only one table
  - Assert: table with rows has sample section, table without does not. No empty "Sample rows:" header for the missing table.

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Implement the conditional -- skip sample section when table has no entry or empty array.

- [x] **RUN**: Confirm test PASSES

### 1.4 Pure Test: empty sample rows map treated same as omitted

- [x] **RED**: Write test in `schema-context-builder.spec.ts`
  - Test name: `'omitting sample rows parameter produces same output as before'`
  - Input: same columns as existing tests, no sample rows parameter
  - Assert: output matches existing behavior exactly (backward compatible)

- [x] **RUN**: Passes immediately (backward compatible via default parameter)

- [x] **GREEN**: Ensure default parameter handles this.

- [x] **RUN**: Confirm test PASSES

- [x] **PURITY CHECK**: `schema-context-builder.ts` imports nothing from adapters, ports, or infrastructure.

### After Layer 1
- [x] **RUN OUTER TEST**: Confirm it still fails -- QueryService is not fetching sample rows yet.

---

## Layer 2: Use Case -- QueryService Fetches Sample Rows

### 2.1 Unit Test: fetches sample rows for each unique table

- [x] **RED**: Write test in `query.service.spec.ts`
  - Test name: `'fetches sample rows for each relevant table before building prompt'`
  - Mock: `tenantDatabasePort.query` to return sample rows for `SELECT * FROM users LIMIT 5` and then the final query result
  - Assert: `tenantDatabasePort.query` was called with a `SELECT * FROM "users" LIMIT 5` style query (one per unique table from relevantColumns)
  - Assert: prompt sent to LLM contains sample data values

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: In `QueryService.query()`, after connecting and retrieving relevant columns:
  - Extract unique table names from `relevantColumns`
  - For each table, call `tenantDatabasePort.query('SELECT * FROM "<table>" LIMIT 5')`
  - Collect results into a map
  - Pass the map to `buildSchemaContext(relevantColumns, sampleRowsMap)`

- [x] **RUN**: Confirm test PASSES

### 2.2 Unit Test: sample row fetch failure is non-fatal

- [x] **RED**: Write test in `query.service.spec.ts`
  - Test name: `'continues without sample data when sample row fetch fails'`
  - Mock: `tenantDatabasePort.query` to reject on the LIMIT-5 call, then resolve on the final SQL execution
  - Assert: query still succeeds and returns results
  - Assert: no sample data in prompt (graceful degradation)

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Wrap each sample fetch in try/catch, log the error, continue with empty map for that table.

- [x] **RUN**: Confirm test PASSES

### 2.3 Unit Test: partial failure -- some tables succeed, some fail

- [x] **RED**: Write test in `query.service.spec.ts`
  - Test name: `'includes sample rows for tables that succeeded even when others fail'`
  - Mock: two relevant tables, first sample fetch succeeds, second rejects
  - Assert: prompt contains sample data from the successful table
  - Assert: prompt does not have an empty sample section for the failed table

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Per-table try/catch already handles this if implemented correctly in 2.2.

- [x] **RUN**: Confirm test PASSES

- [x] **ARCHITECTURE CHECK**: QueryService imports `buildSchemaContext` (pure utility) and `TenantDatabasePort` (port interface). No adapter imports.

### After Layer 2
- [x] **RUN OUTER TEST**: Should now PASS.

---

## Wiring Phase

No new wiring needed. `TenantDatabasePort` is already injected into `QueryService`. `buildSchemaContext` is a direct import (pure function). The new parameter flows through existing connections.

- [x] **RUN OUTER TEST**: Confirm it PASSES
- [x] **RUN ALL TESTS**: `cd /Users/sapanparikh/Development/clients/incubyte/gen-bi/packages/backend && pnpm test`
- [x] **Confirm no regressions**: All 113 tests pass

---

## Final Architecture Verification

- [x] `schema-context-builder.ts` imports NOTHING from outside its own module (pure)
- [x] `query.service.ts` imports only: port interfaces, pure utilities, NestJS decorators
- [x] No new port interfaces created (YAGNI -- existing port suffices)
- [x] Sample fetch uses read-only SELECT queries only
- [x] Error handling logs and skips, never throws on sample fetch failure

## Test Summary
| Layer | Type | # Tests | Mocks Used | Status |
|-------|------|---------|------------|--------|
| Outer (Integration) | Integration | 1 | External ports | PASS |
| Pure utility | Pure | 3 | None | PASS |
| Use case (QueryService) | Unit | 3 | TenantDatabasePort | PASS |
| **Total** | | **7** | | **PASS** |

<center>[x] Reviewed</center>
