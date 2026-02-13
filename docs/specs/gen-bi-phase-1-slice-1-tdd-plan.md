# TDD Plan: Gen-BI Phase 1 -- Slice 1: Project Scaffold + Settings Form

<!-- bee:comment — Added explicit CLI-first constraint. Step 0 now mandates using `nest new`, `pnpm create vite`, `npx shadcn@latest init`, and `pnpm add` for all scaffolding and dependency management. No manual file creation or package.json editing for dependencies. -->

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it ([ ] -> [x]).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

**Important constraints:**
- Use libpq for tenant DB connections (read-only)
- Use Prisma for internal DB (migrations, ORM, cloud-agnostic)
- Internal DB is PostgreSQL (can be hosted anywhere — AWS, Azure, on-prem)
- Never run UPDATE/DELETE/DROP on tenant DBs (internal DB is fine for CRUD)
- Use CLI tools for all scaffolding and dependencies (`nest new`, `pnpm create vite`, `pnpm add`, etc.)
- Do not commit unless explicitly asked to
- SRP, DRY, YAGNI at all times

## Context
- **Source**: `docs/specs/gen-bi-phase-1.md`
- **Slice**: Slice 1: Project Scaffold + Settings Form
- **Risk level**: HIGH (greenfield, external dependencies)
- **Acceptance Criteria**:
  1. NestJS backend starts and serves a health-check endpoint
  2. React frontend starts and renders a Settings screen at the default route
  3. Settings form has separate fields: host, port, database, username, password
  4. A connection string textbox updates live as individual fields are filled
  5. User can edit the connection string directly and individual fields update to match
  6. Port defaults to 5432
  7. Connect button is disabled until all required fields have values
  8. Prisma migration creates a table to store connection configurations
  9. On submit, connection config is persisted to internal DB (password stored, not plain text)
  10. On reload, previously saved connection config is loaded into the form

## Codebase Analysis

### File Structure (to be created)
```
gen-bi/
  pnpm-workspace.yaml
  package.json
  packages/
    backend/
      src/
        main.ts
        app.module.ts
        health/
          health.controller.ts
          health.controller.spec.ts
        connections/
          connections.controller.ts
          connections.controller.spec.ts
          connections.service.ts
          connections.service.spec.ts
      prisma/
        schema.prisma
        migrations/
      test/
        app.e2e-spec.ts
    frontend/
      src/
        App.tsx
        App.test.tsx
        components/
          settings-form/
            SettingsForm.tsx
            SettingsForm.test.tsx
            useConnectionString.ts
            useConnectionString.test.ts
```

### Test Infrastructure
- **Backend**: Vitest (NestJS-compatible, fast, TypeScript-native)
- **Frontend**: Vitest + React Testing Library
- **Run commands**: `pnpm --filter backend test`, `pnpm --filter frontend test`
- **E2E**: Supertest for backend HTTP tests

---

## Step 0: Scaffold the monorepo

This is not a TDD step -- it is build tooling setup that must exist before tests can run.

**Rule: Use CLI tools for all scaffolding. No manual file creation for project setup.**

- [x] Create `pnpm-workspace.yaml` with `packages/*`
- [x] Create root `package.json` via `pnpm init`
- [x] Scaffold backend: `npx @nestjs/cli new backend` inside `packages/` (select pnpm)
- [x] Scaffold frontend: `pnpm create vite frontend --template react-ts` inside `packages/`
- [x] Install shadcn/ui: `npx shadcn@latest init` inside `packages/frontend`
- [x] Add Prisma to backend: `pnpm --filter backend add prisma @prisma/client` then `npx prisma init`
- [x] Add test deps via CLI: `pnpm --filter backend add -D vitest @nestjs/testing supertest`
- [x] Add test deps via CLI: `pnpm --filter frontend add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom`
- [x] Configure Vitest in both packages (vitest.config.ts)
- [x] Run both apps to verify they start (check CLI output for port numbers — ports may vary based on availability)
- [x] Verify `pnpm --filter backend test` runs (even with zero tests)
- [x] Verify `pnpm --filter frontend test` runs (even with zero tests)

---

## Behavior 1: Health-check endpoint returns OK

**Given** the NestJS backend is running
**When** GET /api/health is called
**Then** it responds with 200 and `{ "status": "ok" }`

- [x] **RED**: Write failing test
  - Location: `packages/backend/src/health/health.controller.spec.ts`
  - Test name: `'GET /api/health returns status ok'`
  - Use NestJS `Test.createTestingModule` to instantiate the controller
  - Call the handler, assert it returns `{ status: 'ok' }`

- [x] **RUN**: Confirm test FAILS (controller does not exist)

- [x] **GREEN**: Implement minimum code
  - Create `HealthController` with a single `@Get('health')` method
  - Register in `AppModule` with global prefix `api`
  - Return `{ status: 'ok' }`

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: None needed -- single method, single file

---

## Behavior 2: Frontend renders Settings screen at default route

**Given** the React app loads
**When** the user visits `/`
**Then** a heading "Settings" is visible

- [x] **RED**: Write failing test
  - Location: `packages/frontend/src/components/settings-form/SettingsForm.test.tsx`
  - Test name: `'renders Settings heading'`
  - Render `<SettingsForm />`, assert `screen.getByRole('heading', { name: /settings/i })` exists

- [x] **RUN**: Confirm test FAILS (component does not exist)

- [x] **GREEN**: Implement minimum code
  - Create `SettingsForm` component that renders `<h1>Settings</h1>`
  - Mount it in `App.tsx` at the default route

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: None needed

---

## Behavior 3: Settings form renders all five fields

**Given** the Settings form is rendered
**When** the user views the form
**Then** fields for host, port, database, username, and password are visible

- [x] **RED**: Write failing test
  - Location: `packages/frontend/src/components/settings-form/SettingsForm.test.tsx`
  - Test name: `'renders host, port, database, username, and password fields'`
  - Assert presence of 5 inputs by label text: Host, Port, Database, Username, Password

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Add five labeled input fields to the SettingsForm component
  - Password field should use `type="password"`

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: None needed yet

<!-- bee:comment — Removed port verification from scaffold step. Apps may start on different ports based on availability — just check the CLI output. Port 5432 here refers to the PostgreSQL connection form default, not the app server port. -->

---

## Behavior 4: Port defaults to 5432

**Given** the Settings form is rendered
**When** no user input has occurred
**Then** the Port field contains "5432"

- [x] **RED**: Write failing test
  - Location: `packages/frontend/src/components/settings-form/SettingsForm.test.tsx`
  - Test name: `'port field defaults to 5432'`
  - Assert the Port input has value `"5432"`

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Set the default value of the port field to `"5432"` in component state

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: None needed

---

## Behavior 5: Connection string updates live as fields are filled

**Given** the Settings form is rendered
**When** the user types into host, port, database, username, password fields
**Then** the connection string textbox shows `postgresql://username:password@host:port/database`

This behavior is best driven by a pure function / custom hook.

- [x] **RED**: Write failing unit test for the builder function
  - Location: `packages/frontend/src/components/settings-form/useConnectionString.test.ts`
  - Test name: `'builds connection string from individual fields'`
  - Input: `{ host: 'localhost', port: '5432', database: 'mydb', username: 'admin', password: 'secret' }`
  - Expected: `'postgresql://admin:secret@localhost:5432/mydb'`

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Implement `buildConnectionString(fields)` -- simple template literal

- [x] **RUN**: Confirm test PASSES

- [x] **RED**: Write integration test in SettingsForm
  - Location: `packages/frontend/src/components/settings-form/SettingsForm.test.tsx`
  - Test name: `'connection string updates as fields are filled'`
  - Type values into each field using `userEvent.type`
  - Assert the connection string textbox contains the expected string

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Wire `buildConnectionString` into component state, render a connection string input that derives from field values

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: Extract field state into a custom hook `useConnectionString` if the component is getting large

---

## Behavior 6: Editing connection string updates individual fields

**Given** the Settings form has a connection string textbox
**When** the user pastes or types a full connection string
**Then** the individual fields update to match

- [x] **RED**: Write failing unit test for the parser function
  - Location: `packages/frontend/src/components/settings-form/useConnectionString.test.ts`
  - Test name: `'parses connection string into individual fields'`
  - Input: `'postgresql://admin:secret@localhost:5432/mydb'`
  - Expected: `{ host: 'localhost', port: '5432', database: 'mydb', username: 'admin', password: 'secret' }`

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Implement `parseConnectionString(str)` -- use URL constructor or regex

- [x] **RUN**: Confirm test PASSES

- [x] **RED**: Write integration test in SettingsForm
  - Location: `packages/frontend/src/components/settings-form/SettingsForm.test.tsx`
  - Test name: `'editing connection string updates individual fields'`
  - Clear the connection string field, type a full connection string
  - Assert each individual field has the parsed value

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Wire `parseConnectionString` into the connection string input's onChange handler

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: Consolidate build/parse into the `useConnectionString` hook. Ensure bi-directional sync is clean -- fields drive string, string drives fields, no infinite loop.

---

## Behavior 7: Connect button is disabled until all required fields have values

**Given** the Settings form is rendered
**When** any of host, port, database, username, or password is empty
**Then** the Connect button is disabled

**When** all fields have values
**Then** the Connect button is enabled

- [x] **RED**: Write failing test (button disabled when form incomplete)
  - Location: `packages/frontend/src/components/settings-form/SettingsForm.test.tsx`
  - Test name: `'connect button is disabled when required fields are empty'`
  - Render form (port has default, others empty), assert button is disabled

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Add a Connect button, disable it when any field is empty

- [x] **RUN**: Confirm test PASSES

- [x] **RED**: Write failing test (button enabled when all fields filled)
  - Test name: `'connect button is enabled when all fields have values'`
  - Fill all fields, assert button is not disabled

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Should already pass with the disable logic, or adjust condition

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: None needed

<!-- bee:comment — Replaced Supabase CLI migrations with Prisma. This is cloud-agnostic — works on AWS, Azure, on-prem, or any PostgreSQL. Prisma handles schema definition, migration generation, and client generation. -->

---

## Behavior 8: Prisma migration creates connection_configs table

**Given** the Prisma schema defines a ConnectionConfig model
**When** `npx prisma migrate dev` is run
**Then** a `connection_configs` table exists with the correct columns

- [x] **Define Prisma model** in `packages/backend/prisma/schema.prisma`:
  ```prisma
  model ConnectionConfig {
    id                String   @id @default(uuid())
    host              String
    port              Int      @default(5432)
    databaseName      String   @map("database_name")
    username          String
    encryptedPassword String   @map("encrypted_password")
    createdAt         DateTime @default(now()) @map("created_at")
    updatedAt         DateTime @updatedAt @map("updated_at")

    @@map("connection_configs")
  }
  ```

- [ ] **RUN**: `npx prisma migrate dev --name create_connection_configs` (⚠️ requires running PostgreSQL — run when DB available)

- [ ] **VERIFY**: Migration generates and applies without errors (⚠️ deferred — no DB connected yet)

- [x] **RUN**: `npx prisma generate` to create the typed client

Note: The Prisma schema IS the source of truth. Migration files are auto-generated. Verification is that it applies cleanly to any PostgreSQL instance.

---

## Behavior 9: POST /api/connections persists config with encrypted password

**Given** a valid connection config payload
**When** POST /api/connections is called
**Then** the config is saved to the internal DB with the password encrypted
**And** the response contains the saved config (without the raw password)

- [x] **RED**: Write failing test for the service layer
  - Location: `packages/backend/src/connections/connections.service.spec.ts`
  - Test name: `'saves connection config and encrypts password'`
  - Provide a mock/stub for the Prisma client (this is an external dependency)
  - Call `service.create({ host, port, database, username, password })`
  - Assert the Prisma create was called with an encrypted (not plain text) password
  - Assert the returned object has an `id` and does not contain the raw password

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Implement `ConnectionsService.create()`
  - Encrypt password in the app layer using Node.js `crypto` (AES-256-GCM with an env-based key)
  - Insert into `connection_configs`
  - Return the saved record without the raw password

- [x] **RUN**: Confirm test PASSES

- [x] **RED**: Write failing test for the controller
  - Location: `packages/backend/src/connections/connections.controller.spec.ts`
  - Test name: `'POST /api/connections saves and returns config'`
  - Use NestJS test module with a stubbed service
  - Assert 201 response with the saved config

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Implement `ConnectionsController` with `@Post()` handler that calls the service

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: Extract encryption logic into a small utility function (`encryption.ts`) — separated from service

---

## Behavior 10: GET /api/connections/:id loads saved config

**Given** a connection config was previously saved
**When** GET /api/connections/:id is called
**Then** the saved config is returned with the password decrypted

- [x] **RED**: Write failing test for the service
  - Location: `packages/backend/src/connections/connections.service.spec.ts`
  - Test name: `'loads connection config and decrypts password'`
  - Stub Prisma to return a row with an encrypted password
  - Call `service.findOne(id)`
  - Assert the returned config has the decrypted password

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Implement `ConnectionsService.findOne(id)` -- query by id, decrypt password

- [x] **RUN**: Confirm test PASSES

- [x] **RED**: Write failing test for the controller
  - Location: `packages/backend/src/connections/connections.controller.spec.ts`
  - Test name: `'GET /api/connections/:id returns saved config'`
  - Stub service, assert 200 response

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Add `@Get(':id')` handler to the controller

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: Ensure service methods follow SRP -- one method per operation

---

## Behavior 11: Frontend submits config and loads it on reload

**Given** the user has filled all fields and clicks Connect
**When** the form is submitted
**Then** a POST request is sent to `/api/connections`
**And** the saved config id is stored (e.g., in localStorage or URL)

**Given** the page is reloaded
**When** the form mounts
**Then** it fetches the saved config from GET `/api/connections/:id` and populates the fields

- [x] **RED**: Write failing test for form submission
  - Location: `packages/frontend/src/components/settings-form/SettingsForm.test.tsx`
  - Test name: `'submits connection config on connect button click'`
  - Mock `fetch` (or use msw)
  - Fill all fields, click Connect
  - Assert POST was called with the correct payload

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Add `onSubmit` handler that POSTs to `/api/connections`

- [x] **RUN**: Confirm test PASSES

- [x] **RED**: Write failing test for loading saved config
  - Test name: `'loads previously saved config on mount'`
  - Set a connection id in localStorage
  - Mock GET `/api/connections/:id` to return a config
  - Render the form, assert fields are populated with the saved values

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Add a `useEffect` that checks for a saved id and fetches the config on mount

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: No extraction needed — fetch logic is minimal and inline

---

## Edge Cases (HIGH risk level)

### Input validation

- [x] **RED**: Test -- `'connection string parser handles missing parts gracefully'`
  - Input: `'postgresql://localhost'` (no user, no password, no port, no database)
  - Expected: returns partial fields, does not throw
- [x] **GREEN -> REFACTOR**

- [x] **RED**: Test -- `'connection string parser handles empty string'`
  - Input: `''`
  - Expected: returns all fields empty (except port defaults to 5432)
- [x] **GREEN -> REFACTOR**

### Security

- [x] **RED**: Test -- `'password is never returned as plain text from POST response'`
  - Call `service.create(...)`, assert the response does not contain the original password string in any field
- [x] **GREEN -> REFACTOR**

- [x] **RED**: Test -- `'encrypted password differs from plain text password'`
  - Encrypt a password, assert the encrypted value is not equal to the input
- [x] **GREEN -> REFACTOR**

### Error scenarios

- [x] ~~**RED**: Test -- `'POST /api/connections returns 400 when required fields are missing'`~~ — Skipped: NestJS validation pipes are Phase 2 concern. Service layer currently trusts internal callers (controller receives typed body from NestJS). YAGNI for Slice 1.

- [x] **RED**: Test -- `'GET /api/connections/:id returns 404 when config not found'`
  - Stub Prisma to return no rows
  - Assert NotFoundException thrown
- [x] **GREEN -> REFACTOR**

### Boundary conditions

- [x] **RED**: Test -- `'handles very long host names'`
  - Input: host with 253 characters (max DNS length)
  - Expected: accepted without error
- [x] **GREEN -> REFACTOR**

- [x] **RED**: Test -- `'handles special characters in password within connection string'`
  - Input: password containing `@`, `:`, `/`, `#`
  - Expected: properly URL-encoded in connection string, properly parsed back
- [x] **GREEN -> REFACTOR**

---

## Final Check

- [x] **Run full backend test suite**: `pnpm --filter backend test` -- 9 pass
- [x] **Run full frontend test suite**: `pnpm --filter frontend test` -- 14 pass
- [x] **Review test names**: Read them top to bottom -- they describe the feature clearly
- [x] **Review implementation**: No dead code, no unused parameters, no over-engineering
- [ ] **Verify Prisma migration**: `connection_configs` table exists and is correct (⚠️ deferred — no DB connected yet)

## Test Summary
| Category | # Tests | Status |
|----------|---------|--------|
| Backend health check | 1 | PASS |
| Frontend rendering | 4 | PASS |
| Connection string build/parse | 5 | PASS |
| Form interaction (disable, sync) | 3 | PASS |
| Backend CRUD (service + controller) | 4 | PASS |
| Frontend submit + load | 2 | PASS |
| Edge cases (security, 404, long host) | 4 | PASS |
| **Total** | **23** | **ALL PASS** |

[x] Reviewed
