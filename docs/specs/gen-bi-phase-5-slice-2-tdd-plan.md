# TDD Plan: Phase 5 Slice 2 -- Interactive Schema Annotation

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it ([ ] -> [x]).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

## Context
- **Source**: `docs/specs/gen-bi-phase-5-slice-2.md`
- **Phase/Slice**: Phase 5, Slice 2: Interactive Schema Annotation
- **Risk Level**: Moderate
- **Success Criteria**:
  - `POST /api/schema/discover` performs introspection only (no embedding)
  - Status returns `introspected` after introspection completes
  - New `POST /api/schema/:connectionId/embed` triggers embedding with descriptions
  - `DiscoveredColumn` gains nullable `description` field
  - `GET /api/schema/:connectionId/annotations` returns ambiguous columns with AI suggestions
  - `PATCH /api/schema/:connectionId/annotations` saves descriptions
  - `buildEmbeddingInput` includes description when present
  - `isAmbiguousColumnName` detects cryptic names
  - Frontend gains `introspected` and `embedding` statuses
  - Annotation screen shows ambiguous columns, editable descriptions
  - "Continue" saves + embeds, "Skip" embeds immediately
  - Zero ambiguous columns auto-advances to embedding

---

## Outer Test (Integration)

**Write this test FIRST. It stays RED until all layers are built and wired.**

### Scenario

Admin connects to a database, selects schemas, clicks Analyze. Backend introspects tables and columns. Frontend detects `introspected` status and shows the annotation screen with ambiguous columns and AI-suggested descriptions. Admin edits a description, clicks Continue. Backend saves descriptions and triggers embedding. Frontend shows embedding progress, then completes.

### Test Specification
- Test location: `packages/frontend/src/components/settings-form/SettingsForm.test.tsx`
- Test name: `test('annotation flow: introspect -> annotate -> embed')`

### Setup
- Mock `fetch` to simulate the full flow:
  1. `POST /api/connections` -> `{ id: 'conn-id' }`
  2. `POST /api/connections/:id/test` -> `{ schemas: ['public'] }`
  3. `POST /api/schema/discover` -> `{ tablesDiscovered: 2 }`
  4. `GET /api/schema/discover/status` -> `{ status: 'introspected', current: 2, total: 2 }`
  5. `GET /api/schema/conn-id/annotations` -> `{ columns: [{ columnId: 'col-1', tableName: 'orders', schemaName: 'public', columnName: 'amt_1', dataType: 'numeric', suggestedDescription: 'Order subtotal amount' }] }`
  6. `PATCH /api/schema/conn-id/annotations` -> `{ updated: 1 }`
  7. `POST /api/schema/conn-id/embed` -> `{ status: 'started' }`
  8. `GET /api/schema/discover/status` -> `{ status: 'done', current: 2, total: 2 }`

### Actions
1. Fill connection form, click Connect
2. Select "public" schema, click Analyze
3. Wait for annotation screen to appear
4. See "amt_1" with suggested description "Order subtotal amount"
5. Edit the description
6. Click "Continue"
7. Wait for embedding progress, then completion

### Assertions
- [ ] Annotation screen appears after introspection
- [ ] Ambiguous column `amt_1` is displayed with AI suggestion
- [ ] Description is editable
- [ ] Clicking Continue triggers PATCH then POST embed
- [ ] Embedding progress screen shows, then completes

### Expected Failure Progression
| After Part | Expected Failure |
|------------|-----------------|
| (none) | Status `introspected` not handled -- stays on progress screen or errors |
| Part 1 (description field + buildEmbeddingInput) | Same -- backend/frontend don't know `introspected` yet |
| Part 2 (ambiguity detection) | Same -- no annotation endpoints yet |
| Part 3 (pipeline split) | Frontend detects `introspected` but no annotation screen exists |
| Part 4 (AI suggestions + GET annotations) | Annotation screen shows but no save/embed wiring |
| Part 5 (save + embed) | PASSES |

- [x] **Write the outer test now. Confirm it FAILS.** — 27 pass, 1 fails. Extracted `mockFetchRoutes`/`jsonOk` helpers to `test-helpers.ts`.

---

## Part 1: Prisma Migration + buildEmbeddingInput with Description

**Goal**: Add `description` field to DB, extend the pure function to include it in embedding input.

### 1.1 Pure Test: buildEmbeddingInput includes description when present

- [x] **RED+GREEN**: Test added and passes. Also added empty string edge case.
- [x] Prisma migration `20260219113624_add_column_description` applied. Client regenerated.
- [x] **ALL BACKEND TESTS**: 152 pass. **OUTER TEST**: Still fails (expected).

---

## Part 2: Ambiguity Detection

**Goal**: Pure function that identifies columns with cryptic names.

### 2.1 Pure Test: Clear column names are not ambiguous

- [x] **RED+GREEN**: Created `ambiguity.spec.ts` and `ambiguity.ts`. Clear names (email, first_name, created_at, order_total, id) return false.

### 2.2 Pure Test: Cryptic column names are ambiguous

- [x] **RED+GREEN**: Cryptic names (amt_1, col_x, flg_yn, dt_cr, val) return true. Heuristic uses known-clear suffixes and exact names.

### After Part 2
- [x] **ALL BACKEND TESTS**: 154 pass. **OUTER TEST**: Still fails (expected).

---

## Part 3: Pipeline Split -- Introspection Stops Before Embedding

**Goal**: `POST /api/schema/discover` stops after introspection. Status returns `introspected`. Frontend detects this status.

- [x] **3.1**: `analyzeSchemas` sets status to `introspected`, no embedding calls. Updated existing embedding tests to match.
- [x] **3.2**: Controller tests pass (delegates to service, no change needed).
- [x] **3.3**: Frontend hook handles `introspected` status — stops polling, sets status.
- [x] **3.4**: SettingsForm renders `<div data-testid="annotation-screen">` placeholder for `introspected`.
- [x] **ALL TESTS**: Backend 151 pass, Frontend 230 pass + 1 outer (expected fail).

---

## Part 4: AI Description Suggestions + GET Annotations Endpoint

**Goal**: New port+adapter for Claude to suggest descriptions. New GET endpoint returns ambiguous columns with suggestions. Frontend fetches and displays them.

### 4.1 Backend Port: DescriptionSuggestionPort

- [x] **CREATE**: `packages/backend/src/schema-discovery/description-suggestion.port.ts`
  - Export interface `DescriptionSuggestionPort` with method: `suggestDescriptions(columns: { tableName: string; columnName: string; dataType: string; neighborColumns: string[] }[]): Promise<{ columnName: string; tableName: string; description: string }[]>`
  - Export token: `DESCRIPTION_SUGGESTION_PORT = 'DESCRIPTION_SUGGESTION_PORT'`

### 4.2 Backend Service Test: getAnnotations returns ambiguous columns with suggestions

- [x] **RED**: Add test to `packages/backend/src/schema-discovery/schema-discovery.service.spec.ts`
  - Test name: `it('getAnnotations returns ambiguous columns with AI-suggested descriptions')`
  - Setup: mock `prisma.discoveredTable.findMany` to return tables with columns `amt_1` (ambiguous) and `email` (clear). Mock `descriptionSuggestionPort.suggestDescriptions` to return a suggestion for `amt_1`.
  - Assert: result contains `amt_1` with suggestion, does NOT contain `email`

- [x] **RUN**: Confirm test FAILS (method does not exist)

- [x] **GREEN**: Add `getAnnotations(connectionId: string)` to `SchemaDiscoveryService`:
  - Inject `DESCRIPTION_SUGGESTION_PORT` in constructor
  - Fetch tables+columns from Prisma
  - Filter columns using `isAmbiguousColumnName`
  - Call `descriptionSuggestionPort.suggestDescriptions` for ambiguous columns
  - Return shaped response

- [x] **RUN**: Confirm test PASSES

### 4.3 Backend Service Test: getAnnotations returns empty suggestions on AI failure

- [x] **RED**: Add test
  - Test name: `it('getAnnotations returns ambiguous columns with null suggestions when AI fails')`
  - Setup: mock `descriptionSuggestionPort.suggestDescriptions` to reject
  - Assert: result contains ambiguous columns with `suggestedDescription: null`

- [x] **RUN -> GREEN -> REFACTOR**

### 4.4 Backend Controller Test: GET /schema/:connectionId/annotations

- [x] **RED**: Add test to `packages/backend/src/schema-discovery/schema.controller.spec.ts`
  - Test name: `it('GET /schema/:connectionId/annotations delegates to service')`
  - Mock: `mockService.getAnnotations` returns canned response
  - Assert: controller returns the response

- [x] **RUN**: Confirm test FAILS (no endpoint)

- [x] **GREEN**: Add `@Get(':connectionId/annotations')` to `SchemaController` that delegates to `service.getAnnotations(connectionId)`

- [x] **RUN**: Confirm test PASSES

### 4.5 Backend Adapter: ClaudeDescriptionAdapter

- [x] **CREATE**: `packages/backend/src/schema-discovery/claude-description.adapter.ts`
  - Implements `DescriptionSuggestionPort`
  - Uses existing Anthropic SDK pattern from `claude.adapter.ts`
  - Sends table/column/dataType/neighbors as prompt, asks for short descriptions
  - `@Injectable()` class

- [x] **RED**: Create `packages/backend/src/schema-discovery/claude-description.adapter.spec.ts`
  - Test name: `it('returns descriptions from Claude response')`
  - Mock the Anthropic client
  - Assert: adapter parses response into `{ columnName, tableName, description }[]`

- [x] **RUN -> GREEN -> REFACTOR**

### 4.6 Frontend: AnnotationScreen component

- [x] **RED**: Create `packages/frontend/src/components/settings-form/AnnotationScreen.test.tsx`
  - Test name: `it('renders ambiguous columns grouped by table with editable descriptions')`
  - Props: `columns` array with one ambiguous column, `onContinue` callback, `onSkip` callback
  - Assert: table name visible, column name visible, input with suggested description, "Continue" button, "Skip" button

- [x] **RUN**: Confirm test FAILS (component does not exist)

- [x] **GREEN**: Create `packages/frontend/src/components/settings-form/AnnotationScreen.tsx`
  - Props: `{ columns: AnnotationColumn[]; onContinue: (annotations: { columnId: string; description: string }[]) => void; onSkip: () => void; loading?: boolean }`
  - Render columns grouped by table, each with an editable `Input` for description
  - "Continue" button calls `onContinue` with current descriptions
  - "Skip" button calls `onSkip`
  - Follow DESIGN.md: `text-sm` base, `text-xs` for metadata, `p-3` card padding, `gap-2`

- [x] **RUN**: Confirm test PASSES

### 4.7 Frontend: AnnotationScreen shows empty field when no suggestion

- [x] **RED**: Add test
  - Test name: `it('shows empty input when suggestedDescription is null')`
  - Props: column with `suggestedDescription: null`
  - Assert: input has empty value

- [x] **RUN -> GREEN -> REFACTOR** -- passed immediately (null handling already in place from 4.6)

### 4.8 Frontend: AnnotationScreen editing

- [x] **RED**: Add test
  - Test name: `it('user can edit description and Continue sends updated values')`
  - Action: clear input, type new description, click Continue
  - Assert: `onContinue` called with updated description

- [x] **RUN -> GREEN -> REFACTOR**

### 4.9 Frontend Hook: fetch annotations on introspected status

- [x] **RED**: Add test to `packages/frontend/src/components/settings-form/useSchemaAnalysis.test.ts`
  - Test name: `it('fetches annotations when status transitions to introspected')`
  - Setup: mock status to return `introspected`, mock `GET /api/schema/:connectionId/annotations`
  - Assert: hook exposes `annotations` array with fetched columns

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: In `useSchemaAnalysis.ts`:
  - Add `annotations` state
  - When status becomes `introspected`, fetch `GET /api/schema/${connectionId}/annotations`
  - Store result in `annotations`
  - Expose `annotations` from hook

- [x] **RUN**: Confirm test PASSES

### 4.10 Frontend SettingsForm: Wire AnnotationScreen to real data

- [x] **RED**: Update test in `SettingsForm.test.tsx`
  - Test name: `it('annotation screen shows fetched ambiguous columns')`
  - Setup: full flow mock through introspection + annotations fetch
  - Assert: column name and suggestion visible in annotation screen

- [x] **RUN**: Confirm test FAILS (SettingsForm still renders placeholder)

- [x] **GREEN**: In `SettingsForm.tsx`, replace the `introspected` placeholder with `<AnnotationScreen>`, passing `annotations` from hook and wiring `onContinue`/`onSkip` callbacks.

- [x] **RUN**: Confirm test PASSES

### After Part 4
- [x] **RUN ALL TESTS**: All pass
- [x] **RUN OUTER TEST**: Fails -- Continue/Skip do not save or trigger embedding yet

---

## Part 5: Save Annotations + Trigger Embedding

**Goal**: PATCH saves descriptions, POST embed triggers embedding with descriptions, frontend wires Continue/Skip buttons.

### 5.1 Backend Service Test: saveAnnotations persists descriptions

- [x] **RED**: Add test to `packages/backend/src/schema-discovery/schema-discovery.service.spec.ts`
  - Test name: `it('saveAnnotations updates column descriptions in database')`
  - Setup: mock `prisma.discoveredColumn.update`
  - Input: `[{ columnId: 'col-1', description: 'Order subtotal' }]`
  - Assert: `prisma.discoveredColumn.update` called with correct where/data

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Add `saveAnnotations(connectionId: string, annotations: { columnId: string; description: string }[])` to `SchemaDiscoveryService`

- [x] **RUN**: Confirm test PASSES

### 5.2 Backend Service Test: embedColumns generates embeddings with descriptions

- [x] **RED**: Add test
  - Test name: `it('embedColumns reads columns with descriptions and generates embeddings')`
  - Setup: mock `prisma.discoveredTable.findMany` returning columns with descriptions. Mock embedding port.
  - Assert: `buildEmbeddingInputs` called with description-enriched data
  - Assert: `embeddingPort.generateEmbeddings` called with inputs including `-- description`
  - Assert: status transitions through `analyzing` to `done`

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Add `embedColumns(connectionId: string)` to `SchemaDiscoveryService`:
  - Guard with mutex (same pattern as current `analyzeSchemas`)
  - Read tables+columns from Prisma (including descriptions)
  - Call `buildEmbeddingInputs` with description-enriched column metadata
  - Call `embeddingPort.generateEmbeddings`
  - Persist embeddings (same raw SQL as current code)
  - Set status to `done`

- [x] **RUN**: Confirm test PASSES

### 5.3 Backend Service Test: embedColumns rejects if already in progress

- [x] **RED**: Add test
  - Test name: `it('embedColumns rejects when already embedding')`
  - Same blocking pattern as existing `second analyzeSchemas call while one is running rejects` test

- [x] **RUN -> GREEN -> REFACTOR** -- passed immediately (mutex guard already in `embedColumns` from 5.2)

### 5.4 Backend Controller Test: PATCH /schema/:connectionId/annotations

- [x] **RED**: Add test to `schema.controller.spec.ts`
  - Test name: `it('PATCH /schema/:connectionId/annotations delegates to service')`
  - Mock: `mockService.saveAnnotations`
  - Assert: controller calls service with correct args

- [x] **RUN -> GREEN -> REFACTOR**

### 5.5 Backend Controller Test: POST /schema/:connectionId/embed

- [x] **RED**: Add test to `schema.controller.spec.ts`
  - Test name: `it('POST /schema/:connectionId/embed delegates to service')`
  - Mock: `mockService.embedColumns`
  - Assert: controller calls service, returns `{ status: 'started' }`

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: Add `@Post(':connectionId/embed')` and `@Patch(':connectionId/annotations')` to `SchemaController`

- [x] **RUN**: Confirm test PASSES

### 5.6 Backend Module Wiring

- [x] **Wire**: In `schema-discovery.module.ts`:
  - Add `ClaudeDescriptionAdapter` to providers
  - Add `{ provide: DESCRIPTION_SUGGESTION_PORT, useExisting: ClaudeDescriptionAdapter }` to providers

### 5.7 Frontend Hook: saveAnnotations + triggerEmbedding

- [x] **RED**: Add test to `useSchemaAnalysis.test.ts`
  - Test name: `it('saveAndEmbed sends PATCH then POST embed and transitions to embedding')`
  - Setup: mock fetch for PATCH and POST embed calls, then status polling returns `done`
  - Action: call `saveAndEmbed([{ columnId: 'col-1', description: 'desc' }])`
  - Assert: PATCH called with annotations, POST embed called, status becomes `embedding`, then `done`

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: In `useSchemaAnalysis.ts`:
  - Add `saveAndEmbed(annotations)` function: PATCH annotations, POST embed, set status to `embedding`, start polling
  - Add `skipAnnotations()` function: POST embed directly, set status to `embedding`, start polling
  - In `pollStatus`, handle polling during `embedding` status (same as `analyzing`)
  - Expose `saveAndEmbed` and `skipAnnotations` from hook

- [x] **RUN**: Confirm test PASSES

### 5.8 Frontend Hook: skipAnnotations triggers embed without saving

- [x] **RED**: Add test
  - Test name: `it('skipAnnotations posts embed without saving annotations')`
  - Assert: no PATCH call, only POST embed, status becomes `embedding`

- [x] **RUN -> GREEN -> REFACTOR** -- passed immediately (skipAnnotations was implemented in 5.7)

### 5.9 Frontend SettingsForm: Wire Continue and Skip buttons

- [x] **RED**: Add test to `SettingsForm.test.tsx`
  - Test name: `it('Continue button saves annotations and triggers embedding')`
  - Full flow through introspection -> annotation screen -> click Continue -> embedding progress -> done

- [x] **RUN**: Confirm test FAILS

- [x] **GREEN**: In `SettingsForm.tsx`:
  - Pass `saveAndEmbed` as `onContinue` to `AnnotationScreen`
  - Pass `skipAnnotations` as `onSkip` to `AnnotationScreen`
  - Add `case 'embedding':` to `renderScreen()` rendering `EmbeddingProgressScreen` (reuse existing component with embedding-appropriate props)

- [x] **RUN**: Confirm test PASSES

### 5.10 Frontend SettingsForm: Skip button flow

- [x] **RED**: Add test
  - Test name: `it('Skip button triggers embedding without saving annotations')`
  - Flow: introspection -> annotation -> click Skip -> embedding -> done

- [x] **RUN -> GREEN -> REFACTOR**

### After Part 5
- [x] **RUN ALL TESTS**: Backend 160 pass, Frontend 240 pass
- [x] **RUN OUTER TEST**: PASSES

---

## Part 6: Edge Cases

### 6.1 Zero ambiguous columns auto-advances

- [ ] **RED (frontend hook)**: Add test to `useSchemaAnalysis.test.ts`
  - Test name: `it('auto-advances to embedding when annotations response has zero columns')`
  - Setup: `GET /annotations` returns `{ columns: [] }`
  - Assert: hook auto-calls POST embed, status goes to `embedding`

- [ ] **RUN -> GREEN -> REFACTOR**

- [ ] **RED (SettingsForm)**: Add test
  - Test name: `it('skips annotation screen when no ambiguous columns')`
  - Assert: annotation screen never appears, goes straight to embedding progress

- [ ] **RUN -> GREEN -> REFACTOR**

### 6.2 Network error on annotations fetch

- [ ] **RED**: Add test to `useSchemaAnalysis.test.ts`
  - Test name: `it('sets error status when annotations fetch fails')`
  - Setup: `GET /annotations` rejects
  - Assert: status becomes `error`, error message is set

- [ ] **RUN -> GREEN -> REFACTOR**

### 6.3 Embedding error shows retry that re-triggers embed only

- [ ] **RED**: Add test to `useSchemaAnalysis.test.ts`
  - Test name: `it('embedding error can be retried without re-introspecting')`
  - Setup: POST embed fails first time, succeeds on retry
  - Assert: retry calls POST embed again (not POST discover), eventually reaches `done`

- [ ] **RUN -> GREEN -> REFACTOR**

### 6.4 Mount recovery for introspected status

- [ ] **RED**: Add test to `useSchemaAnalysis.test.ts`
  - Test name: `it('recovers introspected status on mount and fetches annotations')`
  - Setup: `localStorage` has `connectionId`, status endpoint returns `introspected`
  - Assert: hook transitions to `introspected`, fetches annotations

- [ ] **RUN -> GREEN -> REFACTOR**

### 6.5 Existing service tests: update broken assertions

- [ ] **UPDATE**: Any tests in `schema-discovery.service.spec.ts` that assert `status: 'done'` after `analyzeSchemas` should be updated to assert `status: 'introspected'`
- [ ] **UPDATE**: Any tests that assert `embeddingPort.generateEmbeddings` was called from `analyzeSchemas` should be moved or updated to test `embedColumns` instead
- [ ] **RUN ALL BACKEND TESTS**: Confirm all pass

### After Part 6
- [ ] **RUN ALL TESTS** (frontend + backend): All pass
- [ ] **RUN OUTER TEST**: PASSES

---

## Final Architecture Verification

- [ ] **Pure functions** (`buildEmbeddingInput`, `isAmbiguousColumnName`) have zero infrastructure imports
- [ ] **Port interface** (`DescriptionSuggestionPort`) lives in `schema-discovery/` alongside other ports
- [ ] **Adapter** (`ClaudeDescriptionAdapter`) implements port, uses Anthropic SDK
- [ ] **Service** (`SchemaDiscoveryService`) depends on port interfaces, not adapters
- [ ] **Controller** (`SchemaController`) delegates to service, no business logic
- [ ] **Frontend hook** (`useSchemaAnalysis`) manages state and fetch calls, no business logic
- [ ] **Frontend component** (`AnnotationScreen`) receives data via props, no direct API calls
- [ ] **No circular dependencies** between layers

---

## Test Summary

| Layer | Type | Tests | Mocks Used |
|-------|------|-------|------------|
| Outer (SettingsForm integration) | Integration | 1 | fetch |
| Pure (buildEmbeddingInput) | Pure | 2 | None |
| Pure (isAmbiguousColumnName) | Pure | 2 | None |
| Backend Service | Unit | ~6 new | Prisma, ports |
| Backend Controller | Unit | ~3 new | Service |
| Backend Adapter | Unit | 1 | Anthropic SDK |
| Frontend Hook | Unit | ~6 new | fetch |
| Frontend AnnotationScreen | Component | ~3 | vi.fn() callbacks |
| Frontend SettingsForm | Integration | ~4 new | fetch |
| **Total** | | **~28 new** | |

## Risk Mitigation (Moderate)

- **Pipeline split breaks existing tests**: Part 3 explicitly handles updating existing `analyzeSchemas` tests
- **AI failure graceful degradation**: Part 4.3 covers the case where Claude fails -- columns still appear with null suggestions
- **Zero ambiguous columns**: Part 6.1 ensures auto-advance so the user is never stuck on an empty screen
- **Mount recovery**: Part 6.4 handles page refresh during `introspected` status
- **Embedding retry without re-introspection**: Part 6.3 ensures retry only re-embeds

[x] Reviewed
