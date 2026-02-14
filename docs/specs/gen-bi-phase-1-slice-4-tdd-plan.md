# TDD Plan: Gen-BI Phase 1 -- Slice 4: Embedding Generation

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it ([ ] -> [x]).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

**Important constraints:**
- Use `pnpm add` for dependencies, `npx prisma migrate dev` for migrations -- never manually edit package.json
- Never reset the database
- SRP, DRY, YAGNI at all times
- Import Prisma client from `generated/prisma/client`
- Do not commit unless explicitly asked to
- OpenAI API key via `process.env.OPENAI_API_KEY`
- Prisma does not natively support pgvector -- use `Unsupported("vector(1536)")` in schema, raw SQL for vector ops

## Context
- **Source**: `docs/specs/gen-bi-phase-1.md`
- **Slice**: Slice 4: Embedding Generation
- **Risk level**: HIGH (external API dependency, new infrastructure pgvector, vector storage, re-run idempotency)
- **Acceptance Criteria**:
  1. Generates an embedding for each column using OpenAI text-embedding-3-small (input: `table_name + column_name + data_type`)
  2. Shows "Generating embeddings..." progress step
  3. Stores embeddings in internal PostgreSQL using pgvector
  4. Prisma migration creates a table with a vector column for embeddings
  5. Shows "Done" when all steps complete successfully
  6. Shows an error if OpenAI is unreachable or returns an error
  7. Re-running analysis on the same database replaces previous embeddings (not duplicates)

## Codebase Analysis

### Existing Structure
- **Backend**: NestJS at `packages/backend/src/`
  - `SchemaDiscoveryModule` with `SchemaDiscoveryService.analyzeSchemas()` -- discovers tables/columns/FKs/indexes, persists via Prisma
  - `SchemaController` with POST /schema/discover, GET /schema/discover/status, GET /:connectionId/tables
  - Progress tracking: `getDiscoveryStatus()` returns `{ status, current, total, message }`
  - Port/adapter pattern established: `TenantDatabasePort` / `TenantDatabaseAdapter` with DI token
  - Prisma models: `DiscoveredTable`, `DiscoveredColumn`, `DiscoveredForeignKey`, `DiscoveredIndex`
  - Vitest with `unplugin-swc`
- **Frontend**: `SettingsForm.tsx` polls GET /api/schema/discover/status and displays progress messages

### Architecture for Slice 4
| Layer | Role | Location |
|-------|------|----------|
| Inbound Adapter | `SchemaController` -- no new endpoints, existing discover flow triggers embedding | `schema-discovery/schema.controller.ts` |
| Use Case | `SchemaDiscoveryService` -- extend `analyzeSchemas()` to call embedding after metadata | `schema-discovery/schema-discovery.service.ts` |
| Domain | `buildEmbeddingInput()` -- pure function to format column metadata into embedding text | `schema-discovery/embedding-input.ts` |
| Outbound Port | `EmbeddingPort` -- interface for generating embeddings | `schema-discovery/embedding.port.ts` |
| Outbound Adapter | `OpenAIEmbeddingAdapter` -- calls OpenAI text-embedding-3-small | `schema-discovery/openai-embedding.adapter.ts` |
| Persistence | Prisma model `ColumnEmbedding` + raw SQL for vector operations | `prisma/schema.prisma` |
| Frontend | Existing progress polling shows "Generating embeddings..." -- no code changes needed if backend reports the message |

### Test Infrastructure
- **Framework**: Vitest
- **Mocking**: `vi.fn()`, manual mocks for ports
- **Patterns**: Service tests instantiate directly with mock dependencies (no NestJS test module)
- **Controller tests**: Use `@nestjs/testing` Test module with `useValue` mocks

---

## Outer Test (Integration)

**Write this test FIRST. It stays RED until all layers are built and wired.**

### Scenario
After schema metadata is discovered, the service generates embeddings for every column via OpenAI, stores them in the internal DB, and reports progress including "Generating embeddings..." and "Done".

### Test Specification
- Test location: `packages/backend/src/schema-discovery/embedding-integration.spec.ts`
- Test name: `test('analyzeSchemas discovers metadata then generates and stores embeddings')`

### Setup
- Mock: `TenantDatabasePort` (returns table/column data as in existing tests)
- Mock: `EmbeddingPort` (the external OpenAI call -- this is the external dependency we mock)
- Mock: `PRISMA_CLIENT` (as in existing tests, but extended with `$executeRaw` and `$queryRaw` for vector ops)
- Real: `SchemaDiscoveryService` (the orchestrator under test)
- Real: `buildEmbeddingInput()` (pure domain function)

### Actions
1. Call `service.analyzeSchemas('conn-id', ['public'])`
2. Tenant DB returns 1 table with 2 columns

### Assertions
- [x] `EmbeddingPort.generateEmbeddings` was called with correctly formatted inputs
- [x] Prisma `$executeRaw` was called to delete old embeddings for the connectionId
- [x] Prisma `$executeRaw` was called to insert new embeddings with vector data
- [x] Final progress status is `{ status: 'done', message: 'Analysis complete' }`
- [x] Progress included "Generating embeddings..." at some point during execution

### Expected Failure Progression
| After Layer | Expected Failure |
|-------------|-----------------|
| (none) | "EmbeddingPort not defined" or similar -- service does not call embeddings |
| Domain (buildEmbeddingInput) | Same -- function exists but not wired |
| Port interface defined | Same -- no implementation injected |
| Service extended | "generateEmbeddings is not a function" or mock not wired |
| Adapter created + wired | PASSES |

- [x] **Write the outer integration test** (described above). Confirm it FAILS.

---

## Layer 1: Domain Core (Pure)

**Pure function -- no mocks, no I/O. Input to output.**

### 1.1 Pure Test: buildEmbeddingInput formats column metadata into embedding text

- [x] **RED**: Write test
  - Location: `packages/backend/src/schema-discovery/embedding-input.spec.ts`
  - Test: `test('formats table name, column name, and data type into embedding input string')`
  - Input: `{ tableName: 'users', columnName: 'email', dataType: 'varchar' }`
  - Assert: returns `'users.email varchar'` (or similar concise format)

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Implement
  - Location: `packages/backend/src/schema-discovery/embedding-input.ts`
  - Export `buildEmbeddingInput(column: { tableName: string; columnName: string; dataType: string }): string`
  - Pure function, no imports from outside domain

- [x] **RUN**: Confirm test PASSES

### 1.2 Pure Test: buildEmbeddingInputs handles batch of columns

- [x] **RED**: Write test
  - Test: `test('builds embedding inputs for multiple columns')`
  - Input: array of 3 column metadata objects
  - Assert: returns array of 3 formatted strings

- [x] **RUN**: Confirm FAILS then GREEN after implementation

- [x] **REFACTOR** if needed

- [x] **ARCHITECTURE CHECK**: `embedding-input.ts` imports nothing from adapters, ports, or infrastructure

---

## Layer 2: Outbound Port Interface

### 2.0 Define Port: EmbeddingPort

- [x] **CREATE PORT INTERFACE**
  - Location: `packages/backend/src/schema-discovery/embedding.port.ts`
  - Interface:
    ```typescript
    export interface EmbeddingPort {
      generateEmbeddings(inputs: string[]): Promise<number[][]>;
    }
    ```
  - Export DI token: `export const EMBEDDING_PORT = 'EMBEDDING_PORT';`

- [x] **ARCHITECTURE CHECK**: Port uses domain language, accepts strings, returns number arrays

---

## Layer 3: Use Case Extension (SchemaDiscoveryService)

### 3.1 Service Test: generates embeddings after metadata discovery

- [x] **RED**: Write test
  - Location: `packages/backend/src/schema-discovery/schema-discovery.service.spec.ts` (add to existing describe block)
  - Test: `test('analyzeSchemas generates embeddings for discovered columns after metadata persistence')`
  - Setup: existing mock pattern + add `mockEmbeddingPort: EmbeddingPort` with `generateEmbeddings: vi.fn().mockResolvedValue([[0.1, 0.2], [0.3, 0.4]])`
  - Add `mockPrisma.$executeRaw = vi.fn().mockResolvedValue(undefined)` for vector ops
  - Tenant DB returns 1 table with 2 columns
  - Assert: `mockEmbeddingPort.generateEmbeddings` called with formatted inputs from `buildEmbeddingInput`
  - Assert: `mockPrisma.$executeRaw` called for delete (old embeddings) and inserts (new embeddings)

- [x] **RUN**: Confirm test FAILS (service constructor does not accept EmbeddingPort yet)

- [x] **GREEN**: Extend `SchemaDiscoveryService`
  - Add `@Inject(EMBEDDING_PORT) private readonly embeddingPort: EmbeddingPort` to constructor
  - After the metadata persistence loop in `analyzeSchemas()`, add embedding generation step:
    1. Update progress to "Generating embeddings..."
    2. Collect all columns with their table names from the just-persisted data
    3. Call `buildEmbeddingInput` for each column
    4. Call `embeddingPort.generateEmbeddings(inputs)` in batches
    5. Delete old embeddings for connectionId via `$executeRaw`
    6. Insert new embeddings via `$executeRaw` (with vector data)
  - Update final progress message

- [x] **RUN**: Confirm test PASSES

- [x] **Update existing service tests**: The constructor now requires an `EmbeddingPort` parameter. Add a mock `embeddingPort` to the `beforeEach` in existing tests so they continue to pass. The mock should resolve with empty arrays by default.

- [x] **RUN**: Confirm ALL existing service tests still PASS (47 tests)

### 3.2 Service Test: progress shows "Generating embeddings..." step

- [x] **RED**: Write test
  - Test: `test('analyzeSchemas updates progress to Generating embeddings during embedding step')`
  - Capture progress updates during execution (e.g., by inspecting `getDiscoveryStatus()` inside mock implementations)
  - Assert: progress message contains "Generating embeddings" at the appropriate step

- [x] **RUN**: Confirm FAILS then GREEN (should already pass if 3.1 was implemented correctly, verify)

### 3.3 Service Test: re-run deletes previous embeddings before inserting

- [x] **RED**: Write test
  - Test: `test('analyzeSchemas deletes existing embeddings for connectionId before storing new ones')`
  - Assert: `$executeRaw` delete call happens before insert calls
  - Assert: delete targets the correct connectionId

- [x] **RUN**: Confirm FAILS then GREEN

### 3.4 Service Test: OpenAI error does not lose metadata

- [x] **RED**: Write test
  - Test: `test('analyzeSchemas reports error when embedding generation fails')`
  - Setup: `mockEmbeddingPort.generateEmbeddings` rejects with `new Error('OpenAI API unreachable')`
  - Assert: error is thrown/reported in progress
  - Assert: metadata tables were still persisted (the `discoveredTable.create` calls happened before embedding)

- [x] **RUN**: Confirm FAILS then GREEN

- [x] **REFACTOR**: Ensure embedding failure path updates progress to error state with meaningful message

### 3.5 Service Test: empty column list skips embedding call

- [x] **RED**: Write test
  - Test: `test('analyzeSchemas skips embedding generation when no columns are discovered')`
  - Setup: tables exist but return no columns
  - Assert: `embeddingPort.generateEmbeddings` was NOT called

- [x] **RUN**: Confirm FAILS then GREEN

- [x] **ARCHITECTURE CHECK**:
  - Service imports `EmbeddingPort` interface only (not the adapter)
  - Service imports `buildEmbeddingInput` (pure domain)
  - Service does NOT import OpenAI SDK or any HTTP library

### After Layer 3
- [x] **RUN OUTER TEST**: Confirm it now passes (since we use mocks for all outbound ports, the integration test should pass once the orchestration is wired)

---

## Layer 4: Outbound Adapter (OpenAIEmbeddingAdapter)

### 4.1 Unit Test: adapter calls OpenAI API correctly

- [x] **RED**: Write test
  - Location: `packages/backend/src/schema-discovery/openai-embedding.adapter.spec.ts`
  - Test: `test('calls OpenAI embeddings API with text-embedding-3-small model')`
  - Mock: the HTTP client or OpenAI SDK call (use `vi.mock` or inject a fetch-like dependency)
  - Input: `['users.email varchar', 'users.id uuid']`
  - Assert: correct model, correct input array, returns parsed embeddings

- [x] **RUN**: Confirm FAILS

- [x] **GREEN**: Implement
  - Location: `packages/backend/src/schema-discovery/openai-embedding.adapter.ts`
  - `@Injectable() class OpenAIEmbeddingAdapter implements EmbeddingPort`
  - Uses raw fetch to POST to `https://api.openai.com/v1/embeddings`
  - Model: `text-embedding-3-small`
  - Returns `number[][]`

- [x] **RUN**: Confirm test PASSES

### 4.2 Unit Test: adapter throws on API error

- [x] **RED**: Write test
  - Test: `test('throws descriptive error when OpenAI API returns non-200')`
  - Mock: API returns 429 or 500
  - Assert: error message includes status info

- [x] **RUN**: Confirm FAILS then GREEN

### 4.3 Unit Test: adapter throws when API key is missing

- [x] **RED**: Write test
  - Test: `test('throws error when OPENAI_API_KEY is not set')`
  - Assert: meaningful error about missing configuration

- [x] **RUN**: Confirm FAILS then GREEN

- [x] **ARCHITECTURE CHECK**: Adapter implements `EmbeddingPort` interface, no domain logic in adapter

---

## Layer 5: Prisma Migration (pgvector)

### 5.1 Add pgvector extension and ColumnEmbedding model

- [x] **Add Prisma model** to `packages/backend/prisma/schema.prisma`:
  ```prisma
  model ColumnEmbedding {
    id           String   @id @default(uuid())
    connectionId String   @map("connection_id")
    tableId      String   @map("table_id")
    columnId     String   @map("column_id")
    inputText    String   @map("input_text")
    embedding    Unsupported("vector(1536)")
    createdAt    DateTime @default(now()) @map("created_at")

    @@unique([connectionId, columnId])
    @@map("column_embeddings")
  }
  ```

- [x] **Run migration**: `npx prisma migrate dev --name add-column-embeddings`
  - Manually added `CREATE EXTENSION IF NOT EXISTS vector;` to migration SQL
  - Installed pgvector in Docker container (`apt-get install postgresql-16-pgvector`)

- [x] **Verify**: migration applies without error, table exists with vector column

---

## Layer 6: Wiring Phase

### 6.1 Register adapter in module

- [x] **Update `SchemaDiscoveryModule`**:
  - Import `OpenAIEmbeddingAdapter`
  - Add provider: `{ provide: EMBEDDING_PORT, useExisting: OpenAIEmbeddingAdapter }`
  - Uses raw fetch — no OpenAI SDK needed

- [x] **Install OpenAI dependency** (if using the SDK): Skipped — using raw fetch instead

### 6.2 Verify outer test passes

- [x] **RUN OUTER TEST**: Confirm it PASSES with all mocks
- [x] **RUN ALL TESTS**: 76 tests pass (51 backend + 25 frontend), no regressions

---

## Layer 7: Frontend Verification

The frontend already polls GET /api/schema/discover/status and displays `statusData.message`. Since the backend now reports "Generating embeddings..." as a progress message, the frontend should display it without code changes.

### 7.1 Frontend Test: shows embedding progress message

- [x] **Verify** existing frontend test coverage: the test `'shows Analyzing tables progress step with count during analysis'` already proves the frontend displays whatever message the status endpoint returns
- [x] **If needed**, add one test: Not needed — existing test covers generic message display
  - Location: `packages/frontend/src/components/settings-form/SettingsForm.test.tsx`
  - Test: `test('shows Generating embeddings progress step during analysis')`
  - Mock status endpoint to return `{ status: 'analyzing', message: 'Generating embeddings...' }`
  - Assert: "Generating embeddings..." is visible on screen

---

## Final Architecture Verification

- [x] **Inbound adapter** (`SchemaController`): imports only `SchemaDiscoveryService` -- no changes needed for this slice
- [x] **Use case** (`SchemaDiscoveryService`): imports `EmbeddingPort` (interface), `buildEmbeddingInputs` (pure), Prisma client
- [x] **Domain** (`embedding-input.ts`): imports NOTHING from outside -- pure function
- [x] **Outbound port** (`embedding.port.ts`): defines interface only, no implementation
- [x] **Outbound adapter** (`openai-embedding.adapter.ts`): implements `EmbeddingPort`, uses raw fetch
- [x] **No circular dependencies** between layers

## Test Summary
| Layer | Type | # Tests | Mocks Used | Status |
|-------|------|---------|------------|--------|
| Outer (Integration) | Integration | 1 | TenantDB + EmbeddingPort + Prisma | |
| Domain (buildEmbeddingInput) | **Pure** | 2 | **None** | |
| Use Case (Service) | Unit | 5 | EmbeddingPort + Prisma + TenantDB | |
| Outbound Adapter (OpenAI) | Unit | 3 | HTTP/SDK mock | |
| Frontend | Unit | 0-1 | fetch stub | |
| **Total** | | **11-12** | | |


[x] Reviewed
