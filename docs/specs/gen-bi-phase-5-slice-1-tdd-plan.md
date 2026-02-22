# TDD Plan: Phase 5 Slice 1 -- Post-Connection Embedding Progress Screen

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it ([ ] -> [x]).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

## Context
- **Source**: `docs/specs/gen-bi-phase-5.md`
- **Slice**: Phase 5 Slice 1 -- Post-Connection Embedding Progress Screen
- **Risk Level**: MODERATE
- **Acceptance Criteria**:
  1. After successful connection, connection form is replaced by schema selection screen
  2. Schema selection shows database name, checkboxes, Analyze button
  3. Schema discovery error shows error with retry
  4. Clicking Analyze replaces schema selection with embedding progress screen
  5. Progress screen shows current table message, numeric progress (N of M), progress bar
  6. Completion shows success summary
  7. Error during analysis shows error with retry
  8. Page refresh during analysis recovers progress screen
  9. "Change connection" link from any post-connection screen
  10. Post-connection screen reachable via sidenav

## Codebase Analysis

### File Structure
- Hook: `packages/frontend/src/components/settings-form/useSchemaAnalysis.ts`
- Parent: `packages/frontend/src/components/settings-form/SettingsForm.tsx`
- Tests: `packages/frontend/src/components/settings-form/SettingsForm.test.tsx`
- Connection form: `packages/frontend/src/components/settings-form/ConnectionForm.tsx`
- Test helpers: `packages/frontend/src/components/settings-form/test-helpers.ts`
- New files to create:
  - `packages/frontend/src/components/settings-form/SchemaSelectionScreen.tsx`
  - `packages/frontend/src/components/settings-form/EmbeddingProgressScreen.tsx`

### Test Infrastructure
- Framework: Vitest + Testing Library + userEvent
- Run command: `pnpm --filter frontend test`
- Run single file: `pnpm --filter frontend test SettingsForm`
- Mocking: `vi.stubGlobal('fetch', ...)` for API calls
- Helpers: `fillAllFields(user)` and `deferred<T>()` in `test-helpers.ts`
- Existing test file: 18 tests, 418 lines -- many will need updating

### Design Constraints (from DESIGN.md)
- Progress bar: install shadcn `progress` component
- Dense type: `text-sm` base, `text-xs` for metadata
- Spacing: `p-3` cards, `gap-2` between items
- Status colors: `--success` for completion, `--destructive` for errors
- Step indicator states: completed (Check icon), active (spinner), error (AlertCircle)

---

## Pre-work: Install shadcn Progress Component

- [x] **RUN**: `cd packages/frontend && npx shadcn@latest add progress`
- [x] **VERIFY**: `packages/frontend/src/components/ui/progress.tsx` exists

---

## Part A: Extend useSchemaAnalysis Hook (expose current/total, add resetConnection, add mount-time recovery)

### Behavior A1: Hook exposes current and total from poll responses

**Given** the hook is analyzing and status poll returns `{ status: 'analyzing', current: 3, total: 12, message: '...' }`
**When** the poll response is processed
**Then** the hook exposes `current: 3` and `total: 12`

- [x] **RED**: Write failing test
  - Location: `packages/frontend/src/components/settings-form/useSchemaAnalysis.test.ts` (new file)
  - Test name: `test('exposes current and total from poll response during analysis')`
  - Use `renderHook` from Testing Library to test the hook directly
  - Trigger `analyze`, mock the poll to return `{ status: 'analyzing', current: 3, total: 12, message: 'Analyzing orders' }`
  - Assert `result.current.current === 3` and `result.current.total === 12`

- [x] **RUN**: Confirm test FAILS (properties not returned)

- [x] **GREEN**: Implement minimum code
  - Location: `packages/frontend/src/components/settings-form/useSchemaAnalysis.ts`
  - Add `const [current, setCurrent] = useState(0)` and `const [total, setTotal] = useState(0)`
  - In `pollStatus`, read `statusData.current` and `statusData.total` and set them
  - Add `current` and `total` to the return object

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: None needed

### Behavior A2: Hook provides resetConnection to return to idle state

**Given** the hook is in any post-idle state
**When** `resetConnection()` is called
**Then** status returns to `idle` and all state is cleared

- [x] **RED**: Write failing test
  - Location: same hook test file
  - Test name: `test('resetConnection resets all state to idle')`
  - Start from `ready` state (after discoverSchemas succeeds), then call `resetConnection()`
  - Assert status is `idle`, discoveredSchemas is `[]`, selectedSchemas is `[]`, etc.

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Implement minimum code
  - Add `resetConnection` function that sets status to `idle`, clears all arrays and messages
  - Also clears `connectionId` from localStorage so the connection form appears fresh
  - Add to return object

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: None needed

### Behavior A3: Hook recovers in-progress analysis state on mount

**Given** `connectionId` exists in localStorage
**When** the hook mounts
**Then** it calls `/api/schema/discover/status` and if status is `analyzing`, sets hook to `analyzing` with current/total

- [x] **RED**: Write failing test
  - Test name: `test('recovers analyzing state on mount when connectionId exists')`
  - Set `localStorage.connectionId` before rendering
  - Mock fetch to return `{ status: 'analyzing', current: 5, total: 10, message: 'Analyzing users' }`
  - Assert hook status is `analyzing`, current is 5, total is 10

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Implement minimum code
  - Add a `useEffect` that checks localStorage for `connectionId` on mount
  - If found, call `/api/schema/discover/status`
  - If response shows `analyzing`, set status/current/total/message accordingly
  - If response shows `done`, set status to `done`
  - If `idle` or error, leave as `idle` (user can re-connect)

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: None needed

### Behavior A4: Hook recovers done state on mount

**Given** `connectionId` exists in localStorage and backend status is `done`
**When** the hook mounts
**Then** it sets hook to `done`

- [x] **RED**: Write failing test
  - Test name: `test('recovers done state on mount when connectionId exists')`
  - Mock status endpoint to return `{ status: 'done', current: 10, total: 10, message: 'Complete' }`
  - Assert hook status is `done`

- [x] **RUN**: Confirm test FAILS — already GREEN (done case handled in A3 implementation)

- [x] **GREEN**: Extend the mount useEffect to handle the `done` case

- [x] **RUN**: Confirm test PASSES

- [x] **COMMIT**: "feat: extend useSchemaAnalysis with current/total, reset, and mount recovery"

---

## Part B: Extract SchemaSelectionScreen Component

### Behavior B1: SchemaSelectionScreen renders schema checkboxes

**Given** discoveredSchemas is `['public', 'sales']` and status is `ready`
**When** the component renders
**Then** checkboxes for each schema are visible

- [x] **RED**: Write failing test
  - Location: `packages/frontend/src/components/settings-form/SchemaSelectionScreen.test.tsx` (new file)
  - Test name: `test('renders a checkbox for each discovered schema')`
  - Render `<SchemaSelectionScreen>` with props: `discoveredSchemas`, `selectedSchemas: []`, `toggleSchema: vi.fn()`, `analyze: vi.fn()`, `status: 'ready'`, `onChangeConnection: vi.fn()`
  - Assert checkboxes for 'public' and 'sales' are in the document

- [x] **RUN**: Confirm test FAILS (component does not exist)

- [x] **GREEN**: Create `SchemaSelectionScreen.tsx`
  - Accept props from the hook: `discoveredSchemas`, `selectedSchemas`, `toggleSchema`, `analyze`, `status`, `errorMessage`, `onChangeConnection`
  - Render checkboxes for each schema with `aria-label` matching schema name
  - Render Analyze button (disabled when no schemas selected or status is analyzing)

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: None needed yet

### Behavior B2: Analyze button disabled when no schemas selected

**Given** no schemas are selected
**When** SchemaSelectionScreen renders
**Then** the Analyze button is disabled

- [x] **RED**: Write failing test
  - Test name: `test('Analyze button is disabled when no schemas are selected')`
  - Render with `selectedSchemas: []`
  - Assert Analyze button is disabled

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Wire the disabled prop: `disabled={selectedSchemas.length === 0}`

- [x] **RUN**: Confirm test PASSES

### Behavior B3: Schema selection shows "Change connection" link

**Given** the schema selection screen is visible
**When** user clicks "Change connection"
**Then** `onChangeConnection` callback fires

- [x] **RED**: Write failing test
  - Test name: `test('Change connection link calls onChangeConnection')`
  - Render with `onChangeConnection: vi.fn()`
  - Click the "Change connection" link/button
  - Assert the callback was called

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Add a "Change connection" button/link that calls `onChangeConnection`

- [x] **RUN**: Confirm test PASSES

### Behavior B4: Schema selection shows error message when discovery fails

**Given** status is `error` and errorMessage is `'Connection failed: invalid credentials'`
**When** the schema selection screen renders (from a discovery error context)
**Then** the error message is visible

- [x] **RED**: Write failing test
  - Test name: `test('shows error message when provided')`
  - Render with `status: 'error'`, `errorMessage: 'Connection failed: invalid credentials'`
  - Assert error text is visible

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Conditionally render error message paragraph when `errorMessage` is truthy

- [x] **RUN**: Confirm test PASSES

- [x] **COMMIT**: "feat: extract SchemaSelectionScreen component"

---

## Part C: Create EmbeddingProgressScreen Component

### Behavior C1: Progress screen shows current analysis message

**Given** status is `analyzing` and analysisMessage is `'Analyzing table orders'`
**When** the progress screen renders
**Then** the message `'Analyzing table orders'` is visible

- [x] **RED**: Write failing test — C1 through C6 all written
- [x] **RUN**: Confirm test FAILS (component does not exist)
- [x] **GREEN**: Create `EmbeddingProgressScreen.tsx` with all behaviors
- [x] **RUN**: Confirm all 6 tests PASS

### Behaviors C2-C6: All implemented and passing
- [x] C2: Shows numeric progress as N of M tables
- [x] C3: Renders a progress bar (Radix Progress does not expose aria-valuenow — tested via role)
- [x] C4: Shows success summary when done (deduplicated heading vs message)
- [x] C5: Error state with retry button
- [x] C6: Change connection link fires callback

- [x] **COMMIT**: "feat: create EmbeddingProgressScreen component"

---

## Part D: Refactor SettingsForm as Screen Switcher + Update Integration Tests

This part changes `SettingsForm` to switch between screens based on `status`. Many existing tests will break because the UI structure changes (connection form hides after connect, schema checkboxes move to a new screen, etc.).

### Behavior D1: SettingsForm shows ConnectionForm when status is idle

**Given** no connection exists (status is idle)
**When** SettingsForm renders
**Then** the connection form fields are visible

- [x] **GREEN**: Refactor `SettingsForm.tsx` as screen switcher based on status
- [x] **RUN**: All 24 existing + new tests pass

### Behaviors D2-D6: All implemented and passing
- [x] D1: SettingsForm shows ConnectionForm when idle
- [x] D2: Connection form hidden after successful connection (new test: `hides connection form after successful connection`)
- [x] D3: Analyze replaces schema selection with progress screen
- [x] D4: Numeric progress and progress bar during analysis (new test: `shows progress bar and numeric progress during analysis`)
- [x] D5: Change connection from schema selection returns to connection form (new test)
- [x] D6: Change connection from progress screen returns to connection form (new test)
- [x] Fixed 1 broken test: `shows Connecting progress step` — updated to expect discovering state instead of Connected button

- [x] **COMMIT**: "feat: refactor SettingsForm as screen switcher with progress screen"

---

## Part E: Page Refresh Recovery (Integration)

### Behavior E1: Page refresh during analysis shows progress screen

**Given** `connectionId` is in localStorage and backend status is `analyzing`
**When** SettingsForm mounts (simulating page refresh)
**Then** the progress screen is visible (not the connection form)

- [x] **RED+GREEN**: E1 — shows progress screen on mount when backend reports analyzing
- [x] **RED+GREEN**: E2 — shows completion screen on mount when backend reports done
- [x] **RUN**: Both tests pass — 26 total SettingsForm tests

- [x] **COMMIT**: "feat: page refresh recovery for embedding progress"

---

## Part F: Update Existing Tests That Break

After the refactor, several existing SettingsForm tests will need adjustments because the connection form is no longer always visible alongside schemas. Review and update each:

- [x] **REVIEW**: Run full test suite: `pnpm --filter frontend test SettingsForm`
- [x] **FIX**: No additional fixes needed — all test updates were done during Part D refactor
- [x] **RUN**: All SettingsForm tests pass (26 tests)
- [x] **RUN**: All ConnectionForm tests still pass (10 tests)
- [x] **RUN**: Full frontend test suite: `pnpm --filter frontend test` — 223 tests, 37 files, all passing

- [x] **COMMIT**: skipped — no separate changes needed, fixes already committed in Part D

---

## Edge Cases (Moderate Risk)

### Edge E1: Progress bar handles zero total gracefully

- [x] **RED**: Test written — already GREEN (guard already in implementation)
- [x] **GREEN -> REFACTOR**: Guard `total > 0 ? ... : 0` already present

### Edge E2: Mount recovery when status endpoint returns network error

- [x] **RED**: Test written — already GREEN (`.catch(() => {})` handles network errors)
- [x] **GREEN -> REFACTOR**: Mount useEffect already has `.catch(() => {})`, status stays `idle`

### Edge E3: Mount recovery when status endpoint returns idle

- [x] **RED**: Test written — already GREEN (only `analyzing`/`done` trigger state transition)
- [x] **GREEN -> REFACTOR**: Already only transitions for `analyzing` or `done`

### Edge E4: Retry from error state on progress screen re-triggers analysis

- [x] **RED+GREEN**: Integration test written and passing — full flow: connect → discover → select → analyze → error → Retry → success
- [x] **GREEN -> REFACTOR**: `analyze` preserves `selectedSchemas` on error (confirmed)

- [x] **COMMIT**: skipped — no separate commit needed, tests pass

---

## Final Check

- [x] **Run full test suite**: `pnpm --filter frontend test` — 227 tests, 37 files, all passing
- [x] **Review test names**: All test names describe behavior clearly
- [x] **Review implementation**: No dead code, no unused parameters, logic is minimal
- [x] **Verify design compliance**: Progress bar uses shadcn Progress, `text-sm` base, `text-xs` metadata, `text-destructive` for errors — matches DESIGN.md

## Test Summary
| Category | # Tests | Status |
|----------|---------|--------|
| Hook unit (A1-A4 + E2-E3) | 6 | PASS |
| SchemaSelectionScreen (B1-B4) | 4 | PASS |
| EmbeddingProgressScreen (C1-C6 + E1) | 7 | PASS |
| SettingsForm integration (D1-D6 + E4) | 27 | PASS |
| Page refresh recovery (E1-E2) | included above | PASS |
| Existing test updates (F) | no changes needed | PASS |
| Edge cases (E1-E4) | 4 | |
| **Total new + updated** | **~26 new + ~18 updated** | |

[x] Reviewed
