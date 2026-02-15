# TDD Plan: Phase 2 Slice 2+3 -- RAG Schema Retrieval + SQL Validation & Execution

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it ([ ] -> [x]).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

## Context
- **Source**: `docs/specs/gen-bi-phase-2.md`
- **Slices**: Slice 2 (RAG Schema Retrieval) + Slice 3 (SQL Validation + Execution)
- **Risk Level**: HIGH -- AI-generated SQL execution against tenant databases
- **Success Criteria**:
  1. Question is embedded via EmbeddingPort, top-k columns retrieved by cosine similarity
  2. Schema context built from retrieved columns (table, column, type, FKs)
  3. Only relevant context passed to Claude (not full schema)
  4. Error when no embeddings exist for connection
  5. Works with 100+ table databases (focused subset)
  6. SELECT-only validation (rejects INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE)
  7. Validates SQL references only discovered tables/columns
  8. Executes via TenantDatabasePort with timeout
  9. Returns `{ intent, title, sql, columns, rows }` on success
  10. Clear errors for validation failures and execution failures

## Codebase Analysis

### Architecture
- Current: NestJS modules with port/adapter pattern (not full onion, but close)
- DI pattern: token-based injection (`EMBEDDING_PORT`, `LLM_PORT`, `TENANT_DATABASE_PORT`)
- Convention: ports as interfaces + DI token in same file, adapters as `@Injectable()` classes

### Key Existing Files
| Concern | File |
|---------|------|
| Query orchestration | `src/query/query.service.ts` |
| Query controller | `src/query/query.controller.ts` |
| Query types | `src/query/query.types.ts` |
| LLM port | `src/query/llm.port.ts` |
| Claude adapter | `src/query/claude.adapter.ts` |
| Embedding port | `src/schema-discovery/embedding.port.ts` |
| Tenant DB port | `src/schema-discovery/tenant-database.port.ts` |
| Tenant DB adapter | `src/schema-discovery/tenant-database.adapter.ts` |
| Prisma schema | `prisma/schema.prisma` (has `column_embeddings` with pgvector) |
| Query module | `src/query/query.module.ts` |

### External Dependencies to Mock (in outer test)
- `EmbeddingPort` (OpenAI API) -- external
- `LlmPort` (Anthropic API) -- external
- `TenantDatabasePort` (tenant DB) -- external infrastructure
- `PrismaClient` (app DB) -- infrastructure

### Test Infrastructure
- Framework: Vitest
- Mocking: `vi.fn()`, `vi.mocked()`
- Tests: co-located `.spec.ts` files
- Pattern: constructor injection with mocked dependencies (see `query.service.spec.ts`)

---

## Outer Test (Integration)

**Write this test FIRST. It stays RED until all layers are built and wired.**

### Scenario
User submits a question for a connection that has embeddings. The system embeds the question, retrieves relevant schema columns, builds context, calls Claude with focused context, validates the generated SQL is SELECT-only and references known tables, executes against the tenant DB, and returns results with metadata.

### Test Specification
- Test location: `src/query/query.integration.spec.ts`
- Test name: `test('question -> embed -> retrieve -> generate -> validate -> execute -> results')`

### Setup
- Mock: `EmbeddingPort`, `LlmPort`, `TenantDatabasePort`, `PrismaClient`
- Prisma mock returns column embeddings for the connection
- EmbeddingPort returns a vector for the question
- Prisma mock returns similar columns via raw SQL (cosine similarity)
- LlmPort returns a valid SELECT query
- TenantDatabasePort returns result rows

### Actions
1. Call `queryService.query({ connectionId: 'conn-1', question: 'Show top customers' })`

### Assertions
- [x] EmbeddingPort called with the user's question
- [x] Prisma queried for similar embeddings (cosine similarity)
- [x] LlmPort called with prompt containing only relevant table/column context
- [x] TenantDatabasePort called with the generated SQL
- [x] Result contains `{ intent, title, sql, columns, rows }`

### Expected Failure Progression
| After Layer | Expected Failure |
|-------------|-----------------|
| (none) | "query method signature changed" or missing deps |
| Domain (validators) | Tests pass in isolation; service not wired yet |
| QueryService updated | "schema retrieval port not implemented" |
| SchemaRetrievalPort impl | "sql validator not called" |
| Full wiring | PASSES |

---

## Layer 1: Domain Core -- SQL Validator (Pure)

Business rules that must be pure functions: no I/O, no mocks, input -> output.

### 1.1 Pure Test: SELECT-only validation

**Behavior**: Rejects any SQL that is not a SELECT statement.

- [x] **RED**: Write test
  - Location: `src/query/sql-validator.spec.ts`
  - Tests:
    - `'accepts a simple SELECT query'`
    - `'accepts SELECT with JOIN, WHERE, GROUP BY, ORDER BY, LIMIT'`
    - `'accepts SELECT with subqueries'`
    - `'rejects INSERT statement'`
    - `'rejects UPDATE statement'`
    - `'rejects DELETE statement'`
    - `'rejects DROP statement'`
    - `'rejects ALTER statement'`
    - `'rejects TRUNCATE statement'`
    - `'rejects CREATE statement'`
    - `'rejects SELECT with semicolon followed by DROP (injection attempt)'`
    - `'rejects case-insensitive variations (DeLeTe, drop)'`
    - `'rejects SQL with comments hiding mutations (-- DROP)'`
  - Input: SQL string
  - Output: `{ valid: true }` or `{ valid: false, reason: string }`

- [x] **RUN**: Confirm tests FAIL (function does not exist)

- [x] **GREEN**: Implement `validateSelectOnly`
  - Location: `src/query/sql-validator.ts`
  - Pure function, no imports from infrastructure
  - Returns a result object (not throws)

- [x] **RUN**: Confirm tests PASS

- [x] **REFACTOR**: Extract constants if needed

### 1.2 Pure Test: Table/column reference validation

**Behavior**: Validates that SQL only references tables and columns from the discovered schema.

- [x] **RED**: Write test
  - Location: `src/query/sql-validator.spec.ts` (same file, new describe block)
  - Tests:
    - `'accepts SQL referencing known tables and columns'`
    - `'rejects SQL referencing an unknown table'`
    - `'rejects SQL referencing an unknown column'`
    - `'handles schema-qualified table names (public.users)'`
    - `'handles table aliases'`
    - `'is case-insensitive for table/column matching'`
  - Input: SQL string + array of `{ tableName, columns: string[] }`
  - Output: `{ valid: true }` or `{ valid: false, reason: string }`

- [x] **RUN**: Confirm tests FAIL

- [x] **GREEN**: Implement `validateTableReferences`
  - Location: `src/query/sql-validator.ts`
  - Pure function
  - NOTE: This is best-effort validation -- regex/parse based. It should catch obvious cases but does not need to be a full SQL parser. The read-only DB connection is the true safety net.

- [x] **RUN**: Confirm tests PASS

- [x] **REFACTOR**

### 1.3 Pure Test: Schema context builder

**Behavior**: Builds a schema context string from retrieved columns for the LLM prompt.

- [x] **RED**: Write test
  - Location: `src/query/schema-context-builder.spec.ts`
  - Tests:
    - `'builds context string with table, column, and type'`
    - `'groups columns by table'`
    - `'includes foreign key info when present'`
    - `'handles columns from multiple tables'`
    - `'returns empty string for empty input'`
  - Input: array of retrieved column metadata (table name, column name, data type, optional FK info)
  - Output: formatted context string

- [x] **RUN**: Confirm tests FAIL

- [x] **GREEN**: Implement `buildSchemaContext`
  - Location: `src/query/schema-context-builder.ts`
  - Pure function

- [x] **RUN**: Confirm tests PASS

- [x] **REFACTOR**

- [x] **ARCHITECTURE CHECK**: `sql-validator.ts` and `schema-context-builder.ts` have zero imports from NestJS, Prisma, or any adapter

---

## Layer 2: Port Definition -- Schema Retrieval Port

### 2.0 Define Port: SchemaRetrievalPort

The QueryService needs to retrieve relevant schema columns by embedding similarity. This is an outbound port.

- [x] **CREATE PORT INTERFACE**
  - Location: `src/query/schema-retrieval.port.ts`
  - Interface: `SchemaRetrievalPort`
  - Token: `SCHEMA_RETRIEVAL_PORT`
  - Method: `findRelevantColumns(connectionId: string, questionEmbedding: number[], topK: number): Promise<RelevantColumn[]>`
  - Type `RelevantColumn`: `{ tableName: string, columnName: string, dataType: string, foreignKey?: { table: string, column: string } }`
  - Also add: `hasEmbeddings(connectionId: string): Promise<boolean>`

---

## Layer 3: Use Case -- QueryService (updated)

### 3.1 Use Case Test: Embeds question and retrieves schema context

**Behavior**: QueryService embeds the question, retrieves relevant columns, builds context.

- [x] **RED**: Write test
  - Location: `src/query/query.service.spec.ts` (extend existing file)
  - Test: `'embeds question and retrieves relevant columns for schema context'`
  - New mocks needed: `SchemaRetrievalPort`, `EmbeddingPort`
  - Setup: `embeddingPort.generateEmbeddings` returns `[[0.1, 0.2, ...]]`
  - Setup: `schemaRetrievalPort.hasEmbeddings` returns `true`
  - Setup: `schemaRetrievalPort.findRelevantColumns` returns relevant columns
  - Assert: `embeddingPort.generateEmbeddings` called with `[question]`
  - Assert: `schemaRetrievalPort.findRelevantColumns` called with connectionId, embedding vector, topK
  - Assert: `llmPort.generateQuery` prompt contains table/column info from retrieved columns, NOT a hardcoded schema

- [x] **RUN**: Confirm test FAILS (QueryService constructor does not accept new deps)

- [x] **GREEN**: Update QueryService constructor to accept `EmbeddingPort` and `SchemaRetrievalPort`. Update `query()` to embed, retrieve, build context, pass to LLM.

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: Extract prompt building into a private method that uses `buildSchemaContext`

### 3.2 Use Case Test: Error when no embeddings exist

- [x] **RED**: Write test
  - Test: `'throws BadRequestException when no embeddings exist for connection'`
  - Setup: `schemaRetrievalPort.hasEmbeddings` returns `false`
  - Assert: throws `BadRequestException` with message containing "No embeddings found"

- [x] **RUN**: Confirm FAILS

- [x] **GREEN**: Add guard clause in `query()` checking `hasEmbeddings`

- [x] **RUN**: Confirm PASSES

### 3.3 Use Case Test: SQL validation before execution

**Behavior**: After LLM generates SQL, validate it before executing.

- [x] **RED**: Write test
  - Test: `'validates generated SQL is SELECT-only before execution'`
  - Setup: `llmPort.generateQuery` returns SQL with `DELETE` statement
  - Assert: throws `BadRequestException` with reason "not SELECT-only"
  - Assert: `tenantDatabasePort.query` NOT called

- [x] **RUN**: Confirm FAILS

- [x] **GREEN**: Add SQL validation step after LLM response, before execution

- [x] **RUN**: Confirm PASSES

### 3.4 Use Case Test: Validates table references

- [x] **RED**: Write test
  - Test: `'validates SQL references only known tables from retrieved schema'`
  - Setup: LLM returns SQL referencing a table not in the retrieved columns
  - Setup: `schemaRetrievalPort.findRelevantColumns` returns columns for `users` table only
  - Assert: throws `BadRequestException` with reason mentioning unknown table

- [x] **RUN**: Confirm FAILS

- [x] **GREEN**: Pass retrieved columns to `validateTableReferences` before execution

- [x] **RUN**: Confirm PASSES

### 3.5 Use Case Test: Executes SQL and returns rows

- [x] **RED**: Write test
  - Test: `'executes validated SQL against tenant DB and returns rows with metadata'`
  - Setup: LLM returns valid SELECT SQL
  - Setup: `tenantDatabasePort.query` returns `{ rows: [{ name: 'Alice', total: 100 }] }`
  - Assert: result includes `{ intent, title, sql, columns, rows }`
  - Assert: `tenantDatabasePort.connect` called with connection config
  - Assert: `tenantDatabasePort.query` called with the SQL
  - Assert: `tenantDatabasePort.disconnect` called (cleanup)

- [x] **RUN**: Confirm FAILS

- [x] **GREEN**: Update QueryService to inject `TenantDatabasePort`, connect, execute, disconnect, return full response

- [x] **RUN**: Confirm PASSES

### 3.6 Use Case Test: Query timeout enforcement

- [x] **RED**: Write test
  - Test: `'enforces query timeout on tenant DB execution'`
  - Setup: `tenantDatabasePort.query` hangs (never resolves)
  - Assert: rejects with timeout error after configured duration
  - Assert: `tenantDatabasePort.disconnect` still called

- [x] **RUN**: Confirm FAILS

- [x] **GREEN**: Wrap tenant query execution with `Promise.race` and a timeout

- [x] **RUN**: Confirm PASSES

### 3.7 Use Case Test: Execution error handling

- [x] **RED**: Write test
  - Test: `'returns error when SQL execution fails'`
  - Setup: `tenantDatabasePort.query` rejects with DB error
  - Assert: error propagated with DB error message
  - Assert: `tenantDatabasePort.disconnect` still called

- [x] **RUN**: Confirm FAILS

- [x] **GREEN**: Wrap execution in try/finally for disconnect

- [x] **RUN**: Confirm PASSES

### 3.8 Use Case Test: Disconnect always called

- [x] **RED**: Write test
  - Test: `'disconnects tenant DB even when validation fails'`
  - Assert: disconnect called when validation rejects the SQL

- [x] **RUN**: Confirm FAILS then GREEN

- [x] **REFACTOR**: Ensure try/finally pattern covers all paths

- [x] **ARCHITECTURE CHECK**:
  - QueryService imports only port interfaces (LlmPort, EmbeddingPort, SchemaRetrievalPort, TenantDatabasePort)
  - QueryService imports domain functions (validateSelectOnly, validateTableReferences, buildSchemaContext)
  - QueryService does NOT import any adapter

### 3.9 Update existing tests

- [x] **FIX**: Existing `query.service.spec.ts` tests will break because constructor signature changes. Update them to provide the new dependencies (mocked). Keep all existing assertions passing.

---

## Layer 4: Update Types

### 4.1 Update QueryResponse type

- [x] **UPDATE** `src/query/query.types.ts`:
  - Add `QueryResponse` type: `{ intent, title, sql, columns, rows: Record<string, unknown>[], attempts: number }`
  - Keep `LlmQueryResponse` as the LLM-specific shape
  - `QueryService.query()` return type changes from `LlmQueryResponse` to `QueryResponse`

---

## Layer 5: Outbound Adapter -- Schema Retrieval (Prisma + pgvector)

### 5.1 Integration Test: findRelevantColumns via cosine similarity

- [x] **RED**: Write test
  - Location: `src/query/prisma-schema-retrieval.adapter.spec.ts`
  - Test: `'retrieves top-k columns by cosine similarity'`
  - Mock: `PrismaClient.$queryRaw` (unit-level; true integration against test DB is optional)
  - Setup: mock returns rows with `table_id`, `column_id`, `data_type`, FK info
  - Assert: returns `RelevantColumn[]` sorted by similarity

- [x] **RUN**: Confirm FAILS

- [x] **GREEN**: Implement `PrismaSchemaRetrievalAdapter`
  - Location: `src/query/prisma-schema-retrieval.adapter.ts`
  - Implements: `SchemaRetrievalPort`
  - Uses `prisma.$queryRaw` with pgvector cosine distance operator (`<=>`)
  - Joins `column_embeddings` with `discovered_tables` and `discovered_columns` for metadata
  - Also joins `discovered_foreign_keys` for FK info
  - topK defaults to 20 (configurable)

- [x] **RUN**: Confirm PASSES

### 5.2 Integration Test: hasEmbeddings

- [x] **RED**: Write test
  - Test: `'returns true when embeddings exist for connection'`
  - Test: `'returns false when no embeddings exist'`
  - Mock: `PrismaClient.columnEmbedding.count`

- [x] **RUN**: Confirm FAILS

- [x] **GREEN**: Implement `hasEmbeddings` using `prisma.columnEmbedding.count`

- [x] **RUN**: Confirm PASSES

- [x] **ARCHITECTURE CHECK**: Adapter imports only the port interface and Prisma. No domain logic in the adapter.

---

## Layer 6: Inbound Adapter -- Controller Update

### 6.1 Update controller tests for new response shape

- [x] **RED**: Write test
  - Location: `src/query/query.controller.spec.ts` (extend existing)
  - Test: `'POST /api/query returns rows in response on success'`
  - Setup: mock `queryService.query` returns `{ intent, title, sql, columns, rows, attempts: 1 }`
  - Assert: controller returns same shape

- [x] **RED**: Write test
  - Test: `'POST /api/query returns 400 when no embeddings exist'`
  - Setup: mock throws `BadRequestException('No embeddings found...')`
  - Assert: propagates BadRequestException

- [x] **RED**: Write test
  - Test: `'POST /api/query returns 400 when SQL validation fails'`
  - Setup: mock throws `BadRequestException('SQL validation failed: ...')`
  - Assert: propagates BadRequestException

- [x] **RUN**: Confirm new tests FAIL then pass (controller likely needs no code changes -- it delegates)

- [x] **GREEN**: Controller should already work since it delegates to QueryService. Verify.

---

## Wiring Phase

### 7.1 Update QueryModule DI

- [x] **UPDATE** `src/query/query.module.ts`:
  - Import `SchemaDiscoveryModule` (to access `EMBEDDING_PORT` and `TENANT_DATABASE_PORT`)
  - Register `PrismaSchemaRetrievalAdapter`
  - Provide `SCHEMA_RETRIEVAL_PORT` using `useExisting: PrismaSchemaRetrievalAdapter`
  - Inject `PRISMA_CLIENT` for the adapter
  - Update `QueryService` provider to have access to all 4 ports

- [x] **RUN OUTER TEST**: Confirm integration test PASSES

---

## Final Architecture Verification

- [x] **Pure domain** (`sql-validator.ts`, `schema-context-builder.ts`): zero imports from NestJS, Prisma, adapters
- [x] **Ports** (`schema-retrieval.port.ts`, `llm.port.ts`, `embedding.port.ts`, `tenant-database.port.ts`): interfaces + tokens only
- [x] **QueryService**: imports only ports (interfaces) + domain functions
- [x] **Adapters** (`prisma-schema-retrieval.adapter.ts`): imports port interface + Prisma
- [x] **Controller**: imports only QueryService (inbound adapter -> use case)
- [x] **No circular dependencies** between query module and schema-discovery module

## Test Summary
| Layer | Type | # Tests | Mocks Used | Status |
|-------|------|---------|------------|--------|
| Outer (Integration) | Integration | 1 | All ports mocked | PASS |
| Domain: SQL Validator | **Pure** | 19 | **None** | PASS |
| Domain: Schema Context Builder | **Pure** | 5 | **None** | PASS |
| Use Case: QueryService | Unit | 12 (8 new + 4 existing) | Outbound ports | PASS |
| Outbound Adapter: SchemaRetrieval | Unit | 4 | PrismaClient | PASS |
| Inbound Adapter: Controller | Unit | 6 (3 new + 3 existing) | QueryService | PASS |
| **Total** | | **47** | | **ALL PASS** |

[x] Reviewed
