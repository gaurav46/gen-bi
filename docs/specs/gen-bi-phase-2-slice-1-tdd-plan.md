# TDD Plan: Phase 2, Slice 1 -- LLM Port + Query Endpoint Skeleton

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it ([ ] -> [x]).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

## Context
- **Source**: `docs/specs/gen-bi-phase-2.md`
- **Phase/Slice**: Phase 2, Slice 1
- **Risk Level**: HIGH
- **Success Criteria**:
  1. `LlmPort` interface with structured JSON response
  2. `ClaudeAdapter` implements `LlmPort` via Anthropic SDK
  3. `QueryModule` with `LLM_PORT` DI token
  4. `POST /api/query` accepts `{ connectionId, question }` and returns `{ intent, title, sql, visualization, columns }`
  5. Error when `ANTHROPIC_API_KEY` not configured
  6. Error when `connectionId` invalid
  7. Frontend sidebar gains "Workspace" nav item
  8. Workspace page with input bar for questions
  9. Submit calls backend and displays raw JSON response

## Codebase Analysis

### Existing Patterns to Follow
| Pattern | Backend Example | Frontend Example |
|---------|----------------|-----------------|
| Port interface | `embedding.port.ts` (`EmbeddingPort` + `EMBEDDING_PORT` token) | `schema-data-port.ts` (`SchemaDataPort`) |
| Adapter | `openai-embedding.adapter.ts` | `fetch-schema-data-adapter.ts` |
| Module DI wiring | `schema-discovery.module.ts` (`useExisting` pattern) | `App.tsx` (instantiate adapter, pass to shell) |
| Controller | `schema.controller.ts` | -- |
| Service with port injection | `schema-discovery.service.ts` (`@Inject(EMBEDDING_PORT)`) | -- |
| Hook with port injection | -- | `useSchemaExplorer.ts` (port parameter) |
| Page routing | -- | `AppShell.tsx` (`PageId` union, conditional render) |
| Integration test | `schema-discovery.service.spec.ts` | `App.integration.test.tsx` |

### Directory Structure
| Layer | Directory | Test Location |
|-------|-----------|---------------|
| Inbound Adapter (controller) | `packages/backend/src/query/` | co-located `.spec.ts` |
| Use Case (service) | `packages/backend/src/query/` | co-located `.spec.ts` |
| Ports | `packages/backend/src/query/` | tested via service/adapter tests |
| Domain (response types) | `packages/backend/src/query/` | pure tests if logic exists |
| Outbound Adapter (Claude) | `packages/backend/src/query/` | co-located `.spec.ts` |
| Frontend Port | `packages/frontend/src/ports/` | tested via hook tests |
| Frontend Adapter | `packages/frontend/src/adapters/` | co-located `.test.ts` |
| Frontend Hook | `packages/frontend/src/hooks/` | co-located `.test.ts` |
| Frontend Page | `packages/frontend/src/components/workspace/` | co-located `.test.tsx` |

### External Dependencies to Mock
- **Anthropic SDK** (`@anthropic-ai/sdk`) -- mocked in adapter unit tests and backend outer test
- **`fetch`** -- mocked in frontend integration test (already established pattern)

---

## BACKEND

### Outer Test (Integration): QueryController

**Write this test FIRST. It stays RED until all backend layers are built and wired.**

### Scenario
User sends a natural language question with a connectionId. The system validates the connection, sends the question to Claude, and returns structured JSON.

- [x] **Write outer test file**: `packages/backend/src/query/query.controller.spec.ts`

**Test 1: happy path** -- `POST /api/query` returns structured JSON
- Setup: mock `ConnectionsService.findOne` to return a valid config, mock `LLM_PORT` to return a canned structured response
- Action: call controller's `query()` with `{ connectionId: 'conn-1', question: 'Show top customers' }`
- Assert: returns `{ intent, title, sql, visualization, columns }` with correct shape

**Test 2: invalid connectionId** -- returns error when connection not found
- Setup: mock `ConnectionsService.findOne` to throw `NotFoundException`
- Assert: error propagates (NestJS exception filter handles it)

**Test 3: missing API key** -- returns error when `ANTHROPIC_API_KEY` not set
- Setup: mock `LLM_PORT` to throw "ANTHROPIC_API_KEY is not configured"
- Assert: error with that message reaches the caller

### Expected Failure Progression
| After Layer | Expected Failure |
|-------------|-----------------|
| (none) | "Cannot find module" / file does not exist |
| Port + Controller shell | "query service method not implemented" |
| Service + domain types | "LLM port not wired" |
| Claude adapter | All pass |

---

## Layer 1: Domain Types (Pure)

### 1.1 Define the LLM response type

No test needed -- these are plain TypeScript types with no logic.

- [x]**CREATE** `packages/backend/src/query/query.types.ts`
  - `LlmQueryResponse`: `{ intent: string; title: string; sql: string; visualization: { chartType: string }; columns: { name: string; type: string; role: 'dimension' | 'measure' }[] }`
  - `QueryRequest`: `{ connectionId: string; question: string }`
  - Keep it minimal -- just data shapes

- [x]**ARCHITECTURE CHECK**: types file imports nothing from outside its own directory

---

## Layer 2: Port Interface

### 2.0 Define Port: LlmPort

- [x]**CREATE** `packages/backend/src/query/llm.port.ts`
  - Interface: `LlmPort` with method `generateQuery(prompt: string): Promise<LlmQueryResponse>`
  - Export DI token: `export const LLM_PORT = 'LLM_PORT'`
  - Follow `embedding.port.ts` pattern exactly

---

## Layer 3: Use Case (QueryService)

### 3.1 Unit Test: QueryService orchestration

- [x]**RED**: Write `packages/backend/src/query/query.service.spec.ts`
  - **Test: "validates connection, builds prompt, calls LLM port, returns response"**
    - Mock: `ConnectionsService.findOne` returns valid config
    - Mock: `LlmPort.generateQuery` returns canned `LlmQueryResponse`
    - Action: `service.query({ connectionId: 'conn-1', question: 'Show top customers' })`
    - Assert: `connectionsService.findOne` called with `'conn-1'`, `llmPort.generateQuery` called with a string containing the question, result matches LLM response shape

  - **Test: "throws when connectionId not found"**
    - Mock: `ConnectionsService.findOne` throws `NotFoundException`
    - Assert: rejects with `NotFoundException`

  - **Test: "throws when LLM port errors (e.g. missing API key)"**
    - Mock: `llmPort.generateQuery` throws `Error('ANTHROPIC_API_KEY is not configured')`
    - Assert: rejects with that error

  - **Test: "includes question in the prompt sent to LLM"**
    - Assert: the string passed to `generateQuery` contains the question text

- [x]**RUN**: Confirm all tests FAIL

- [x]**GREEN**: Implement `packages/backend/src/query/query.service.ts`
  - `@Injectable()` class `QueryService`
  - Constructor: `@Inject(LLM_PORT) private readonly llmPort: LlmPort`, `private readonly connectionsService: ConnectionsService`
  - `async query(request: QueryRequest): Promise<LlmQueryResponse>` -- validates connection, builds prompt string, calls `llmPort.generateQuery(prompt)`, returns result
  - Follow `SchemaDiscoveryService` injection pattern

- [x]**RUN**: Confirm all tests PASS

- [x]**REFACTOR**: Extract prompt building to a private method if it grows

- [x]**ARCHITECTURE CHECK**: Service imports only port interface and domain types, not adapters

---

## Layer 4: Inbound Adapter (QueryController)

### 4.1 Unit Test: QueryController

- [x]**RED**: Write controller tests in `packages/backend/src/query/query.controller.spec.ts`
  - **Test: "POST /api/query delegates to QueryService and returns result"**
    - Mock: `QueryService.query` returns canned response
    - Action: call `controller.query({ connectionId: 'conn-1', question: 'Show top customers' })`
    - Assert: returns the service result, service called with correct args

  - **Test: "propagates NotFoundException from service"**
    - Mock: `QueryService.query` throws `NotFoundException`
    - Assert: exception propagates

  - **Test: "propagates LLM configuration errors"**
    - Mock: `QueryService.query` throws `BadRequestException('ANTHROPIC_API_KEY is not configured')`
    - Assert: exception propagates

- [x]**RUN**: Confirm tests FAIL

- [x]**GREEN**: Implement `packages/backend/src/query/query.controller.ts`
  - `@Controller('query')` with `@Post()` handler
  - Delegates to `QueryService.query(body)`
  - Follow `schema.controller.ts` pattern

- [x]**RUN**: Confirm tests PASS

- [x]**ARCHITECTURE CHECK**: Controller depends only on `QueryService`, not on ports or adapters directly

---

## Layer 5: Outbound Adapter (ClaudeAdapter)

### 5.1 Unit Test: ClaudeAdapter

- [x]**RED**: Write `packages/backend/src/query/claude.adapter.spec.ts`
  - **Test: "throws when ANTHROPIC_API_KEY is not set"**
    - Unset `process.env.ANTHROPIC_API_KEY`
    - Assert: constructing adapter throws "ANTHROPIC_API_KEY is not configured"

  - **Test: "calls Anthropic SDK and parses structured JSON response"**
    - Set `process.env.ANTHROPIC_API_KEY = 'test-key'`
    - Mock the Anthropic SDK's `messages.create` method
    - Return a canned response with JSON in the content block
    - Assert: `generateQuery(prompt)` returns parsed `LlmQueryResponse`

  - **Test: "throws when Anthropic API returns an error"**
    - Mock SDK to reject
    - Assert: adapter throws descriptive error

- [x]**RUN**: Confirm tests FAIL

- [x]**GREEN**: Implement `packages/backend/src/query/claude.adapter.ts`
  - `@Injectable()` class `ClaudeAdapter implements LlmPort`
  - Constructor checks `process.env.ANTHROPIC_API_KEY`, throws `BadRequestException` if missing
  - `generateQuery(prompt)`: calls `anthropic.messages.create()` with chain-of-thought system prompt, parses JSON from response
  - Follow `openai-embedding.adapter.ts` pattern (env check in constructor, SDK call in method)

- [x]**RUN**: Confirm tests PASS

- [x]**ARCHITECTURE CHECK**: Adapter imports only `LlmPort` interface + Anthropic SDK, no service or controller imports

---

## Layer 6: Module Wiring

- [x]**CREATE** `packages/backend/src/query/query.module.ts`
  - Import `ConnectionsModule`
  - Provide `QueryService`, `ClaudeAdapter`
  - Provide `{ provide: LLM_PORT, useExisting: ClaudeAdapter }`
  - Controller: `QueryController`
  - Follow `schema-discovery.module.ts` pattern exactly

- [x]**Register** `QueryModule` in `packages/backend/src/app.module.ts`
  - Add to `imports` array

- [x]**RUN all backend tests**: Confirm everything passes

- [x]**INSTALL** `@anthropic-ai/sdk` in backend package: `cd packages/backend && pnpm add @anthropic-ai/sdk`

---

## FRONTEND

### Outer Test (Integration): Workspace Page

**Write this test FIRST. It stays RED until all frontend layers are built.**

- [x]**Write outer test** in `packages/frontend/src/App.integration.test.tsx` (add to existing file)

**Test: "user navigates to Workspace, types a question, sees JSON response"**
- Setup: `localStorage.setItem('connectionId', 'conn-1')`, stub `fetch` to handle `/api/query` POST returning canned `LlmQueryResponse`, plus existing schema/connections stubs
- Actions:
  1. Render `<App />`
  2. Click "Workspace" in sidebar
  3. Type "Show top customers" in input
  4. Click submit button
- Assertions:
  1. Workspace page is visible
  2. After submit, raw JSON response is displayed (check for `intent` or `title` text)

### Expected Failure Progression
| After Layer | Expected Failure |
|-------------|-----------------|
| (none) | "Workspace" nav item not found |
| Sidebar + PageId | Workspace page component not found |
| WorkspacePage component | Port/hook not wired |
| Hook + Adapter | All pass |

---

## Layer F1: Sidebar + PageId Extension

### F1.1 Unit Test: AppSidebar shows Workspace

- [x]**RED**: Add test to `packages/frontend/src/components/app-shell/AppSidebar.test.tsx` (create if needed)
  - **Test: "renders Workspace nav item"**
    - Render `<AppSidebar activePage="schema-explorer" onNavigate={vi.fn()} />`
    - Assert: "Workspace" text is visible

- [x]**RUN**: Confirm FAILS

- [x]**GREEN**: Update `packages/frontend/src/components/app-shell/AppSidebar.tsx`
  - Add `'workspace'` to `PageId` union
  - Add `{ id: 'workspace', label: 'Workspace', icon: MessageSquare }` to `navItems` (use `MessageSquare` or `Search` from lucide-react)

- [x]**RUN**: Confirm PASSES

---

## Layer F2: Frontend Port + Domain Types

- [x]**CREATE** `packages/frontend/src/domain/query-types.ts`
  - `QueryResponse`: `{ intent: string; title: string; sql: string; visualization: { chartType: string }; columns: { name: string; type: string; role: string }[] }`
  - `QueryRequest`: `{ connectionId: string; question: string }`

- [x]**CREATE** `packages/frontend/src/ports/query-port.ts`
  - `QueryPort` interface with `submitQuery(request: QueryRequest): Promise<QueryResponse>`
  - Follow `schema-data-port.ts` pattern

---

## Layer F3: Hook (useWorkspace)

### F3.1 Unit Test: useWorkspace hook

- [x]**RED**: Write `packages/frontend/src/hooks/useWorkspace.test.ts`
  - **Test: "submitQuery calls port and sets response"**
    - Mock: `QueryPort.submitQuery` returns canned `QueryResponse`
    - Render hook with `renderHook`
    - Call `result.current.submit('conn-1', 'Show top customers')`
    - Assert: `result.current.response` matches canned response, `result.current.isLoading` transitions false -> true -> false

  - **Test: "sets error when port rejects"**
    - Mock: port rejects with "ANTHROPIC_API_KEY is not configured"
    - Assert: `result.current.error` contains the message

- [x]**RUN**: Confirm FAILS

- [x]**GREEN**: Implement `packages/frontend/src/hooks/useWorkspace.ts`
  - `useWorkspace(port: QueryPort)` hook
  - State: `response`, `isLoading`, `error`
  - `submit(connectionId, question)` calls `port.submitQuery(...)`, updates state
  - Follow `useSchemaExplorer.ts` pattern

- [x]**RUN**: Confirm PASSES

---

## Layer F4: WorkspacePage Component

### F4.1 Unit Test: WorkspacePage

- [x]**RED**: Write `packages/frontend/src/components/workspace/WorkspacePage.test.tsx`
  - **Test: "renders input bar and submit button"**
    - Render with mock `QueryPort`
    - Assert: input with placeholder like "Ask a question..." is visible, submit button is visible

  - **Test: "calls port on submit and displays response JSON"**
    - Mock port returns canned response
    - Type question, click submit
    - Assert: raw JSON text appears (e.g., check for `"intent"` or the title string)

  - **Test: "shows error message when query fails"**
    - Mock port rejects
    - Submit
    - Assert: error text visible

- [x]**RUN**: Confirm FAILS

- [x]**GREEN**: Implement `packages/frontend/src/components/workspace/WorkspacePage.tsx`
  - Props: `port: QueryPort`
  - Renders input + button, uses `useWorkspace` hook
  - On submit, displays `JSON.stringify(response, null, 2)` in a `<pre>` block (temporary)
  - connectionId from `localStorage.getItem('connectionId')`

- [x]**RUN**: Confirm PASSES

---

## Layer F5: Frontend Adapter

### F5.1 Unit Test: FetchQueryAdapter

- [x]**RED**: Write `packages/frontend/src/adapters/fetch-query-adapter.test.ts`
  - **Test: "POST /api/query with correct body and returns parsed JSON"**
    - Stub `fetch` to return canned response
    - Call `adapter.submitQuery({ connectionId: 'c1', question: 'test' })`
    - Assert: `fetch` called with `/api/query`, method POST, correct body; result matches canned response

  - **Test: "throws on non-ok response"**
    - Stub `fetch` to return `{ ok: false, status: 400 }`
    - Assert: rejects with error

- [x]**RUN**: Confirm FAILS

- [x]**GREEN**: Implement `packages/frontend/src/adapters/fetch-query-adapter.ts`
  - `FetchQueryAdapter implements QueryPort`
  - `submitQuery(request)`: POST to `/api/query`, parse JSON
  - Follow `fetch-schema-data-adapter.ts` pattern

- [x]**RUN**: Confirm PASSES

---

## Layer F6: Frontend Wiring

- [x]**Update** `packages/frontend/src/components/app-shell/AppShell.tsx`
  - Accept `queryPort: QueryPort` in props (alongside `schemaPort`)
  - Add `{activePage === 'workspace' && <WorkspacePage port={queryPort} />}` to render

- [x]**Update** `packages/frontend/src/App.tsx`
  - Instantiate `FetchQueryAdapter`
  - Pass to `<AppShell queryPort={queryPort} />`

- [x]**Update frontend outer test** stub for `/api/query` if not already done

- [x]**RUN all frontend tests**: Confirm everything passes, including integration test

---

## Final Architecture Verification

- [x]**Backend port** (`llm.port.ts`) imports only domain types
- [x]**Backend service** (`query.service.ts`) imports only port interface + `ConnectionsService` + domain types
- [x]**Backend controller** (`query.controller.ts`) imports only service
- [x]**Backend adapter** (`claude.adapter.ts`) imports only port interface + Anthropic SDK
- [x]**Frontend port** (`query-port.ts`) imports only domain types
- [x]**Frontend adapter** (`fetch-query-adapter.ts`) imports only port interface + domain types
- [x]**Frontend hook** (`useWorkspace.ts`) imports only port interface + domain types
- [x]**No circular dependencies** between layers

## Test Summary
| Layer | Type | # Tests | Mocks Used | Status |
|-------|------|---------|------------|--------|
| Backend Outer (Controller) | Unit | 3 | Service mock | PASS |
| Backend Service | Unit | 4 | ConnectionsService + LlmPort mocks | PASS |
| Backend Adapter (Claude) | Unit | 3 | Anthropic SDK mock | PASS |
| Frontend Outer (Integration) | Integration | 1 | fetch stub | PASS |
| Frontend Sidebar | Unit | 1 | None | PASS |
| Frontend Hook | Unit | 2 | QueryPort mock | PASS |
| Frontend Page | Unit | 3 | QueryPort mock | PASS |
| Frontend Adapter | Unit | 2 | fetch stub | PASS |
| **Total** | | **19** | | **ALL PASS** |
[x] reviewed
