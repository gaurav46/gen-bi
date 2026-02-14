# TDD Plan: Gen-BI Phase 1 -- Slice 2: Connect + Schema Discovery

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it ([ ] -> [x]).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

**Important constraints:**
- Use `pg` npm package (libpq) for tenant DB connections -- NOT Prisma
- Tenant DB connections must be read-only: set `default_transaction_read_only = on` on the pg Client
- Never run UPDATE/DELETE/DROP on tenant databases
- Use CLI tools for dependencies (`pnpm add`) -- never manually edit package.json
- Do not commit unless explicitly asked to
- SRP, DRY, YAGNI at all times

## Context
- **Source**: `docs/specs/gen-bi-phase-1.md`
- **Slice**: Slice 2: Connect + Schema Discovery
- **Risk level**: HIGH (external DB connections, security-sensitive, error-prone network I/O)
- **API endpoint**: `POST /api/connections/:id/test`
- **Acceptance Criteria**:
  1. Clicking Connect attempts a read-only connection to the tenant PostgreSQL via libpq
  2. Shows "Connecting..." progress step during connection attempt
  3. Shows an error message when connection fails (invalid credentials, unreachable host, etc.)
  4. Connection is read-only -- only SELECT queries are executed against the tenant DB
  5. On successful connection, discovers all schemas via `information_schema`
  6. Shows "Discovering schemas..." progress step during discovery
  7. Displays a list of discovered schemas with checkboxes for the user to select
  8. User selects one or more schemas and clicks Analyze
  9. Shows an error when the connected database has zero non-system schemas

## Codebase Analysis

### Existing Structure
- **Backend**: NestJS at `packages/backend/src/`
  - `ConnectionsModule` with controller, service, encryption utilities
  - `ConnectionsService.findOne()` decrypts password -- we can reuse this to get connection details
  - DI uses custom `PRISMA_CLIENT` token with `@Inject(PRISMA_CLIENT)` and type `any`
  - Vitest with `unplugin-swc` for NestJS decorator support
- **Frontend**: Vite + React + shadcn/ui at `packages/frontend/src/`
  - `SettingsForm` already has `status` state and shows "Connected" on save success
  - Uses `fetch` directly, stores `connectionId` in localStorage
  - shadcn components available: button, input, label, card
  - Vitest with jsdom, mock localStorage in test-setup.ts

### Architecture for Slice 2
| Layer | Role | Location |
|-------|------|----------|
| Inbound Adapter | Controller endpoint `POST /connections/:id/test` | `connections.controller.ts` (extend) |
| Use Case | `SchemaDiscoveryService` -- orchestration, filter system schemas | `schema-discovery/schema-discovery.service.ts` |
| Outbound Port | `TenantDatabasePort` interface -- connect, query, disconnect | `schema-discovery/tenant-database.port.ts` |
| Outbound Adapter | `TenantDatabaseAdapter` -- wraps `pg.Client`, enforces read-only | `schema-discovery/tenant-database.adapter.ts` |
| Frontend | Schema discovery UI -- progress steps, schema list, checkboxes | `SettingsForm.tsx` (extend) |

### Test Infrastructure
- **Backend**: Vitest, `@nestjs/testing`, `vi.fn()` for mocks
- **Frontend**: Vitest, React Testing Library, `vi.stubGlobal('fetch', ...)` for API mocks
- **Run commands**: `pnpm --filter backend test`, `pnpm --filter frontend test`

---

## Step 0: Install dependencies

- [x] Install `pg` and types in backend: `pnpm --filter backend add pg @types/pg`
- [x] Install shadcn checkbox in frontend: `cd packages/frontend && npx shadcn@latest add checkbox`
- [x] Verify both test suites still pass after installs

---

## Behavior 1: Controller accepts POST /connections/:id/test and delegates to service

**Given** a connection config exists with the given id
**When** `POST /api/connections/:id/test` is called
**Then** the controller delegates to `SchemaDiscoveryService` and returns the result

This is the outermost layer. We define the use case port (service interface) and mock it.

- [x] **RED**: Write failing controller test
  - Location: `packages/backend/src/schema-discovery/schema-discovery.controller.spec.ts`
  - Test name: `'POST /connections/:id/test delegates to SchemaDiscoveryService and returns schemas'`
  - Create a mock `SchemaDiscoveryService` with a `testConnection` method
  - Mock returns `{ schemas: ['public', 'sales'] }`
  - Assert the controller calls `testConnection(id)` and returns the result

- [x] **RUN**: Confirm test FAILS (file/class does not exist)

- [x] **GREEN**: Implement minimum code
  - Create `SchemaDiscoveryService` as an injectable with a `testConnection(connectionId: string)` method signature (empty/throw for now)
  - Add `@Post(':id/test')` handler to the connections controller (or create a new controller for schema-discovery -- prefer extending the existing controller to keep the route nesting under `/connections`)
  - Controller calls `schemaDiscoveryService.testConnection(id)`

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: Verify the controller is thin -- just delegates, no logic

---

## Behavior 2: TenantDatabaseAdapter connects with read-only mode and disconnects

**Given** valid connection parameters
**When** a connection is established
**Then** `default_transaction_read_only` is set to `on` on the pg Client

This is the innermost layer -- the outbound adapter. We define the port interface first, then test the adapter against a mocked `pg.Client`.

- [x] **DEFINE PORT**: Create `TenantDatabasePort` interface
  - Location: `packages/backend/src/schema-discovery/tenant-database.port.ts`
  - Methods:
    - `connect(config: TenantConnectionConfig): Promise<void>`
    - `query(sql: string): Promise<QueryResult>`
    - `disconnect(): Promise<void>`
  - Define `TenantConnectionConfig` type: `{ host, port, database, username, password }`
  - Define `QueryResult` type: `{ rows: Record<string, unknown>[] }`

- [x] **RED**: Write failing adapter test
  - Location: `packages/backend/src/schema-discovery/tenant-database.adapter.spec.ts`
  - Test name: `'connects with default_transaction_read_only set to on'`
  - Mock `pg.Client` using `vi.mock('pg')` -- mock `connect()` and `query()`
  - Create `TenantDatabaseAdapter`, call `connect(config)`
  - Assert `pg.Client` was constructed with `{ host, port, database, user, password }`
  - Assert `client.connect()` was called
  - Assert `client.query('SET default_transaction_read_only = on')` was called

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Implement `TenantDatabaseAdapter` implementing `TenantDatabasePort`
  - Location: `packages/backend/src/schema-discovery/tenant-database.adapter.ts`
  - On `connect()`: create `pg.Client`, call `client.connect()`, then `SET default_transaction_read_only = on`
  - On `query(sql)`: delegate to `client.query(sql)` and return `{ rows }`
  - On `disconnect()`: call `client.end()`

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: None expected

---

## Behavior 3: TenantDatabaseAdapter delegates query and disconnects cleanly

- [x] **RED**: Write failing test
  - Location: same adapter spec file
  - Test name: `'query delegates to pg client and returns rows'`
  - Mock `client.query` to return `{ rows: [{ schema_name: 'public' }] }`
  - Call `adapter.query('SELECT ...')`
  - Assert result is `{ rows: [{ schema_name: 'public' }] }`

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Should pass with existing implementation from Behavior 2. If not, adjust.

- [x] **RUN**: Confirm test PASSES

- [x] **RED**: Write failing test
  - Test name: `'disconnect ends the pg client connection'`
  - Call `adapter.disconnect()`
  - Assert `client.end()` was called

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Implement or verify `disconnect()` calls `client.end()`

- [x] **RUN**: Confirm test PASSES

---

## Behavior 4: TenantDatabaseAdapter throws on connection failure

- [x] **RED**: Write failing test
  - Test name: `'throws descriptive error when connection fails'`
  - Mock `client.connect()` to reject with `Error('connection refused')`
  - Call `adapter.connect(config)`
  - Assert it rejects with an error containing a meaningful message

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Wrap `client.connect()` in try/catch, throw a descriptive error

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: None expected

---

## Behavior 5: SchemaDiscoveryService orchestrates connection, discovery, and filtering

**Given** a connectionId for a saved config
**When** `testConnection(connectionId)` is called
**Then** it loads the config, connects via the port, queries schemas, filters system schemas, disconnects, and returns user schemas

This is the use case layer. It uses the real `ConnectionsService.findOne()` (already built) and mocks the `TenantDatabasePort`.

- [x] **RED**: Write failing service test
  - Location: `packages/backend/src/schema-discovery/schema-discovery.service.spec.ts`
  - Test name: `'loads config, connects, discovers schemas, filters system schemas, and disconnects'`
  - Mock `ConnectionsService.findOne` to return decrypted config
  - Mock `TenantDatabasePort` -- `connect`, `query`, `disconnect`
  - Mock `query` to return rows: `[{ schema_name: 'public' }, { schema_name: 'sales' }, { schema_name: 'information_schema' }, { schema_name: 'pg_catalog' }, { schema_name: 'pg_toast' }]`
  - Call `service.testConnection('conn-id')`
  - Assert `connect` was called with the decrypted config
  - Assert `query` was called with a SELECT from `information_schema.schemata`
  - Assert result contains only `['public', 'sales']` (system schemas filtered out)
  - Assert `disconnect` was called

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Implement `SchemaDiscoveryService`
  - Location: `packages/backend/src/schema-discovery/schema-discovery.service.ts`
  - Inject `ConnectionsService` and `TenantDatabasePort` (use a token like `TENANT_DATABASE_PORT`)
  - `testConnection(connectionId)`:
    1. Call `connectionsService.findOne(connectionId)` to get decrypted config
    2. Call `port.connect({ host, port, database, username, password })`
    3. Call `port.query(...)` for schema discovery
    4. Filter out system schemas (`information_schema`, `pg_catalog`, `pg_toast`, `pg_temp_*`)
    5. Call `port.disconnect()`
    6. Return `{ schemas: [...] }`

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: Extract the system schema filter list to a constant

---

## Behavior 6: SchemaDiscoveryService returns error when connection fails

- [x] **RED**: Write failing test
  - Location: same service spec
  - Test name: `'returns connection error when tenant DB is unreachable'`
  - Mock `TenantDatabasePort.connect` to reject
  - Assert `testConnection` throws/rejects with a meaningful error
  - Assert `disconnect` is still called (cleanup)

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Add try/catch in `testConnection`, ensure `disconnect` is called in a finally block

- [x] **RUN**: Confirm test PASSES

---

## Behavior 7: SchemaDiscoveryService errors when zero non-system schemas found

- [x] **RED**: Write failing test
  - Test name: `'throws error when database has zero non-system schemas'`
  - Mock `query` to return only system schemas: `[{ schema_name: 'information_schema' }, { schema_name: 'pg_catalog' }]`
  - Assert `testConnection` throws with message indicating no schemas found

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: After filtering, if schemas list is empty, throw an appropriate error

- [x] **RUN**: Confirm test PASSES

---

## Behavior 8: Wire up the module -- register service, port, and adapter

- [x] Create `SchemaDiscoveryModule`
  - Location: `packages/backend/src/schema-discovery/schema-discovery.module.ts`
  - Provide `SchemaDiscoveryService`
  - Provide `TenantDatabaseAdapter` as the implementation for the `TENANT_DATABASE_PORT` token
  - Import `ConnectionsModule` (to get `ConnectionsService`)
  - Export `SchemaDiscoveryService`

- [x] Register the new endpoint
  - Either add `@Post(':id/test')` to `ConnectionsController` and inject `SchemaDiscoveryService`
  - Or create a dedicated controller in the schema-discovery module and mount the route accordingly
  - Whichever approach is cleaner, keep it consistent with the existing route prefix `/connections/:id/test`

- [x] Import `SchemaDiscoveryModule` in `AppModule`

- [x] **RUN**: Full backend test suite passes: `pnpm --filter backend test`

---

## Behavior 9: Frontend shows "Connecting..." progress step

**Given** the user has saved a connection config
**When** the user clicks Connect
**Then** the UI shows "Connecting..." while the test-connection API call is in flight

- [x] **RED**: Write failing test
  - Location: `packages/frontend/src/components/settings-form/SettingsForm.test.tsx`
  - Test name: `'shows Connecting progress step when testing connection'`
  - Mock `fetch` for POST `/api/connections` (save) to return `{ id: 'conn-id' }`
  - Mock `fetch` for POST `/api/connections/conn-id/test` to return a promise that does not resolve immediately (use a deferred/pending promise)
  - Fill fields, click Connect
  - Assert "Connecting..." text appears on screen

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Update `SettingsForm` submit handler
  - After successful save (POST /connections), immediately call POST `/api/connections/:id/test`
  - While the test call is in flight, show "Connecting..." status text

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: None expected

---

## Behavior 10: Frontend shows "Discovering schemas..." progress step

**Given** the connection test API is in progress
**When** the response starts arriving (or a second phase begins)
**Then** the UI shows "Discovering schemas..."

Note: Since the API does connect + discover in a single call, we can show "Connecting..." initially and then switch to "Discovering schemas..." based on timing or keep it simpler: show "Connecting..." then "Discovering schemas..." sequentially. Given the single API call, simplest approach is to show both as a multi-step progress indicator. The exact UX can be:
- "Connecting..." shown while the API call is in flight
- "Discovering schemas..." shown as a brief transition before results appear

For MVP, the simplest approach: show "Connecting..." when the fetch starts, then show "Discovering schemas..." briefly before rendering results. Since this is a single API call, we can use a state machine: `idle -> connecting -> discovering -> done | error`.

- [x] **RED**: Write failing test
  - Location: same SettingsForm test file
  - Test name: `'shows Discovering schemas progress step then displays schema list'`
  - Mock `fetch` for save to return `{ id: 'conn-id' }`
  - Mock `fetch` for test to return `{ schemas: ['public', 'sales'] }`
  - Fill fields, click Connect
  - Assert "Discovering schemas..." text appears (use `findByText` for async)
  - Then assert schema list appears with "public" and "sales"

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Update the submit flow state machine
  - After the test-connection fetch resolves, briefly set status to `discovering`, then to `done` with the schemas
  - Render the schema list when status is `done` and schemas are available

- [x] **RUN**: Confirm test PASSES

---

## Behavior 11: Frontend shows error message when connection fails

**Given** the connection test API returns an error
**When** the response indicates failure
**Then** an error message is displayed

- [x] **RED**: Write failing test
  - Test name: `'shows error message when connection test fails'`
  - Mock `fetch` for save to return `{ id: 'conn-id' }`
  - Mock `fetch` for test to return `{ ok: false, status: 500 }` or a JSON body with an error message
  - Fill fields, click Connect
  - Assert an error message appears on screen (e.g., "Connection failed" or the server error message)

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Handle error response from the test-connection API, set status to `error` with a message

- [x] **RUN**: Confirm test PASSES

---

## Behavior 12: Frontend displays schema checkboxes and tracks selection

**Given** schemas have been discovered
**When** the schema list is displayed
**Then** each schema has a checkbox, and the user can select one or more

- [x] **RED**: Write failing test
  - Test name: `'renders checkboxes for each discovered schema'`
  - Mock the full connect flow to return `{ schemas: ['public', 'sales', 'analytics'] }`
  - Fill fields, click Connect, wait for schema list
  - Assert three checkboxes exist, labeled "public", "sales", "analytics"
  - Assert none are checked by default

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Render a list of schemas with shadcn `Checkbox` components
  - Store selected schemas in state as a `Set<string>` or `string[]`

- [x] **RUN**: Confirm test PASSES

- [x] **RED**: Write failing test
  - Test name: `'user can select schemas and click Analyze'`
  - Same mock setup
  - Click checkboxes for "public" and "analytics"
  - Assert an "Analyze" button appears (or becomes enabled)
  - Click Analyze
  - Assert the selected schemas are captured (for now, just verify the button click works -- actual Analyze API is Slice 3)

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Add checkbox toggle logic and an "Analyze" button
  - Analyze button is disabled until at least one schema is selected
  - On click, store selected schemas (preparation for Slice 3 -- the actual API call is out of scope)

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: Extract schema list into its own component if SettingsForm is getting large

---

## Edge Cases (HIGH risk level)

### Connection security

- [x] **RED**: Test -- `'adapter rejects queries that are not SELECT statements'`
  - Location: adapter spec
  - Call `adapter.query('DROP TABLE users')` after connecting
  - Assert it throws or the read-only setting causes pg to reject
  - Note: With `default_transaction_read_only = on`, pg itself rejects writes. Test that the adapter does not strip this setting.

- [x] **GREEN -> REFACTOR**

### Connection lifecycle

- [x] **RED**: Test -- `'disconnect is called even when query fails'`
  - Location: service spec
  - Mock `query` to reject with an error
  - Assert `disconnect` is still called

- [x] **GREEN -> REFACTOR**

- [x] **RED**: Test -- `'disconnect handles already-disconnected client gracefully'`
  - Location: adapter spec
  - Mock `client.end()` to reject (e.g., already closed)
  - Call `adapter.disconnect()`
  - Assert it does not throw (swallows the error)

- [x] **GREEN -> REFACTOR**

### Schema filtering

- [x] **RED**: Test -- `'filters all known PostgreSQL system schemas'`
  - Location: service spec
  - Input schemas: `['public', 'information_schema', 'pg_catalog', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1']`
  - Assert only `['public']` remains

- [x] **GREEN -> REFACTOR**

### Error messages

- [x] **RED**: Test -- `'returns meaningful error for invalid credentials'`
  - Location: adapter spec
  - Mock `client.connect()` to reject with pg error code `28P01` (invalid password)
  - Assert the thrown error contains a user-friendly message

- [x] **GREEN -> REFACTOR**

- [x] **RED**: Test -- `'returns meaningful error for unreachable host'`
  - Location: adapter spec
  - Mock `client.connect()` to reject with `ECONNREFUSED`
  - Assert the thrown error contains a user-friendly message

- [x] **GREEN -> REFACTOR**

### Frontend edge cases

- [x] **RED**: Test -- `'shows error when database has zero non-system schemas'`
  - Location: SettingsForm test
  - Mock test-connection API to return error with "no schemas found" message
  - Assert the error message appears in the UI

- [x] **GREEN -> REFACTOR**

- [x] **RED**: Test -- `'Analyze button is disabled when no schemas are selected'`
  - Location: SettingsForm test
  - Mock connect flow, wait for schema list to appear
  - Assert Analyze button is disabled
  - Select a schema, assert button becomes enabled
  - Deselect it, assert button is disabled again

- [x] **GREEN -> REFACTOR**

### Connection config not found

- [x] **RED**: Test -- `'returns 404 when connection config does not exist'`
  - Location: service spec
  - Mock `ConnectionsService.findOne` to throw NotFoundException
  - Assert `testConnection` propagates the 404

- [x] **GREEN -> REFACTOR**

---

## Final Check

- [x] **Run full backend test suite**: `pnpm --filter backend test` -- all pass
- [x] **Run full frontend test suite**: `pnpm --filter frontend test` -- all pass
- [x] **Review test names**: Read them top to bottom -- they describe the feature clearly
- [x] **Review implementation**: No dead code, no unused parameters, no over-engineering
- [x] **Architecture check**:
  - Controller is thin -- just delegates to service
  - Service orchestrates and contains business logic (schema filtering)
  - Adapter wraps pg and enforces read-only
  - Port interface is the contract between service and adapter
  - No infrastructure code leaks into the service layer

## Test Summary
| Category | # Tests | Layer |
|----------|---------|-------|
| Controller (POST /connections/:id/test) | 1 | Inbound Adapter |
| TenantDatabaseAdapter (connect, query, disconnect) | 4 | Outbound Adapter |
| SchemaDiscoveryService (orchestration + filtering) | 3 | Use Case |
| Frontend (progress steps, schema list, checkboxes) | 5 | Inbound Adapter (UI) |
| Edge cases (security, lifecycle, errors, filtering) | 9 | Mixed |
| **Total** | **22** | |

[x] Reviewed
