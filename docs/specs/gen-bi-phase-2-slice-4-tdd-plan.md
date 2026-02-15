# TDD Plan: Phase 2, Slice 4 — Self-Correcting Retry Loop

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it ([ ] -> [x]).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

## Context
- **Source**: `docs/specs/gen-bi-phase-2.md` — Slice 4
- **Risk Level**: HIGH
- **Scope**: Backend only. Modify `QueryService.query()` to retry on SQL execution failure, feeding error context back to LLM. No frontend changes, no new modules, no new controllers.

### Success Criteria
1. On SQL execution failure, feeds error message back to Claude with original question and schema context
2. Claude generates corrected SQL on retry attempts
3. Retries up to 3 times before returning a final error
4. Each retry re-validates corrected SQL (same safety checks)
5. Response includes attempt count
6. Returns clear error when all 3 retries exhausted
7. Successful retry returns results normally (user does not see intermediate failures)

### Frontend Retry Indicator (deferred to Slice 5)
The `attempts` field in the API response enables Slice 5 to show a visual indicator when retries occurred (e.g., "Answer found after 2 attempts"). During the request, the frontend shows a loading state — since retries happen server-side within the same HTTP request, no additional backend work is needed here. The Slice 5 TDD plan will include tests for displaying attempt count > 1.
<!-- -------- bee-comment -------- -->
> **@developer**: we should add some ui/ux details here. I want some sort of visual indicator that the query is being retried.
> **@bee**: Added a "Frontend Retry Indicator" section noting that the `attempts` field already supports this. The visual indicator (showing attempt count, retry messaging) belongs in Slice 5 where the results UI is built. No backend changes needed — the response shape already carries the information.
> - [x] mark as resolved
<!-- -------- /bee-comment -------- -->

### Key Files
| File | Role |
|------|------|
| `src/query/query.service.ts` | Use case — gets the retry loop |
| `src/query/query.service.spec.ts` | Unit tests — add retry tests here |
| `src/query/query.integration.spec.ts` | Integration test — add retry integration test |
| `src/query/llm.port.ts` | Port — may need `correctQuery` method |
| `src/query/claude.adapter.ts` | Adapter — implements new port method |
| `src/query/query.types.ts` | Types — may need error context type |

### Architecture Decision: LlmPort Extension
The current `LlmPort.generateQuery(prompt: string)` takes a flat prompt string. For the retry, we need to pass error context. Two options:

**Option A**: Add a `correctQuery(prompt: string, previousSql: string, error: string)` method to `LlmPort`.
**Option B**: Build the retry prompt in `QueryService` and call the same `generateQuery(prompt)`.

**Choice: Option B.** The prompt construction is use-case logic, not port logic. `QueryService` already builds the initial prompt. It should also build the retry prompt. This keeps the port interface stable and the adapter untouched.

---

## Outer Test (Integration)

**Write FIRST. Stays RED until retry loop is built.**

- [x] **Add integration test**: Retry succeeds on second attempt

  File: `src/query/query.integration.spec.ts`

  Test: `'retries with error feedback when SQL execution fails, succeeds on second attempt'`

  Setup: `llmPort.generateQuery` returns bad SQL on first call, good SQL on second call. `tenantDatabasePort.query` fails on first SQL, succeeds on second.

  Assertions:
  - `llmPort.generateQuery` called twice
  - Second prompt contains the error message from the first failure
  - Result has `attempts: 2`
  - Result contains successful rows
  - `tenantDatabasePort.disconnect` called once (at the end)

- [x] **Add integration test**: All 3 retries exhausted

  File: `src/query/query.integration.spec.ts`

  Test: `'returns error after 3 failed attempts with attempt count'`

  Setup: `llmPort.generateQuery` always returns SQL that fails execution. `tenantDatabasePort.query` always rejects.

  Assertions:
  - `llmPort.generateQuery` called 3 times
  - Throws with message containing "after 3 attempts"
  - `tenantDatabasePort.disconnect` still called

- [x] **RUN**: Confirm both tests FAIL (no retry logic exists yet)

---

## Domain: Retry Prompt Builder (Pure)

The retry prompt is pure string construction logic. No I/O.

### D1. Build retry prompt from error context

- [x] **RED**: Write pure test

  File: `src/query/retry-prompt-builder.spec.ts`

  Test: `'builds retry prompt containing original question, schema, failed SQL, and error message'`

  Input: `{ question, schemaContext, failedSql, errorMessage }`
  Assert: returned string contains all four inputs in a structured format

- [x] **RUN**: Confirm FAIL

- [x] **GREEN**: Implement `buildRetryPrompt` function

  File: `src/query/retry-prompt-builder.ts`

  Pure function: `buildRetryPrompt({ question, schemaContext, failedSql, errorMessage }): string`

  Must include the original schema context so Claude has full context for correction.

- [x] **RUN**: Confirm PASS

### D2. Retry prompt includes attempt number for context

- [x] **RED**: Test that prompt contains attempt number

  Test: `'includes attempt number in retry prompt'`

  Input: add `attempt: 2` to the input
  Assert: returned string contains "Attempt 2"

- [x] **GREEN**: Add attempt to the function signature and output

- [x] **RUN**: Confirm PASS

- [x] **PURITY CHECK**: `retry-prompt-builder.ts` has zero imports from outside the query module (no NestJS, no SDK, no I/O)

---

## Use Case: QueryService Retry Loop

### U1. Retries once on execution failure and succeeds

- [x] **RED**: Write unit test

  File: `src/query/query.service.spec.ts`

  Test: `'retries with error feedback when execution fails, returns result on success'`

  Setup:
  - `llmPort.generateQuery` call 1 returns valid SELECT SQL that passes validation
  - `tenantDatabasePort.query` call 1 rejects with execution error
  - `llmPort.generateQuery` call 2 returns corrected SQL
  - `tenantDatabasePort.query` call 2 resolves with rows

  Assert:
  - `llmPort.generateQuery` called twice
  - Second call prompt contains the error message
  - Result `attempts` is `2`
  - Result has the successful rows

- [x] **RUN**: Confirm FAIL

- [x] **GREEN**: Implement retry loop in `QueryService.query()`

  Wrap the validate-execute block in a loop (max 3 iterations). On execution failure:
  1. Catch the error
  2. Build retry prompt via `buildRetryPrompt`
  3. Call `llmPort.generateQuery` again with the retry prompt
  4. Loop back to validate-execute

  On success at any attempt, return result with correct `attempts` count.

- [x] **RUN**: Confirm PASS

### U2. Exhausts all 3 attempts and throws

- [x] **RED**: Write unit test

  Test: `'throws after 3 failed execution attempts with clear error'`

  Setup: every `tenantDatabasePort.query` call rejects (different errors each time)

  Assert:
  - `llmPort.generateQuery` called exactly 3 times
  - Throws `BadRequestException` with message matching `'Query failed after 3 attempts:'`
  - Message includes the last error
  - `tenantDatabasePort.disconnect` still called

- [x] **RUN**: Confirm FAIL (loop probably already exists from U1 but may not cap at 3)

- [x] **GREEN**: Ensure loop exits after 3 attempts, throws `BadRequestException`

- [x] **RUN**: Confirm PASS

### U3. Each retry re-validates corrected SQL

- [x] **RED**: Write unit test

  Test: `'re-validates corrected SQL on each retry attempt'`

  Setup:
  - First `generateQuery` returns valid SQL that fails execution
  - Second `generateQuery` returns SQL with `DELETE` (validation should catch it)
  - Third `generateQuery` returns valid SQL that succeeds

  Assert:
  - Final result has `attempts: 3`
  - `tenantDatabasePort.query` called only twice (first attempt + third attempt; second was caught by validation)

  Note: validation failures should also consume a retry attempt and feed back the validation error.

- [x] **RUN**: Confirm FAIL

- [x] **GREEN**: Ensure validation failures inside the retry loop are caught and retried (not thrown immediately)

- [x] **RUN**: Confirm PASS

### U4. Successful first attempt still returns attempts: 1

- [x] **RED**: Write unit test (or verify existing test still passes)

  Test: existing test `'validates connection, builds prompt, calls LLM port, returns response'` should still pass with `attempts: 1`

- [x] **RUN**: Confirm existing tests still PASS (no regression)

### U5. Timeout errors trigger retry

- [x] **RED**: Write unit test

  Test: `'retries on query timeout'`

  Setup: first `tenantDatabasePort.query` hangs (timeout triggers), second `generateQuery` returns SQL that succeeds

  Assert: `attempts: 2`, result has rows

- [x] **RUN**: Confirm FAIL

- [x] **GREEN**: Timeout errors are caught by the same retry mechanism

- [x] **RUN**: Confirm PASS

### U6. Disconnect called exactly once regardless of retry count

- [x] **RED**: Write unit test

  Test: `'disconnects tenant DB exactly once after retries complete'`

  Setup: 2 failed attempts, 3rd succeeds

  Assert: `tenantDatabasePort.disconnect` called exactly once

- [x] **RUN**: Confirm FAIL or PASS depending on implementation from U1

- [x] **GREEN**: Adjust if needed — disconnect should be in a `finally` block wrapping the entire retry loop, not inside each attempt

- [x] **RUN**: Confirm PASS

---

## Update Existing Test: Execution Failure Now Retries

The existing test `'returns error when SQL execution fails'` currently expects immediate failure. It needs updating.

- [x] **UPDATE**: Modify existing test to account for retry behavior

  The test currently has `tenantDatabasePort.query` rejecting once and expects immediate throw. Now it should mock `generateQuery` to keep returning bad SQL (query keeps failing) and expect the error after 3 attempts.

- [x] **RUN**: Confirm all existing tests pass with retry logic

---

## Wiring Phase

No new modules or DI tokens needed. The changes are internal to `QueryService`.

- [x] **RUN OUTER TESTS**: Confirm integration tests in `query.integration.spec.ts` PASS

- [x] **RUN ALL**: `npx vitest run` — all tests pass

---

## Final Architecture Verification

- [x] `retry-prompt-builder.ts` is pure — no NestJS imports, no I/O, no side effects
- [x] `QueryService` calls `buildRetryPrompt` (domain) and `llmPort.generateQuery` (port) — no direct LLM calls
- [x] `LlmPort` interface unchanged — adapter (`claude.adapter.ts`) requires zero modifications
- [x] No new ports or adapters introduced — this slice is entirely use-case and domain logic
- [x] Dependency direction preserved: `QueryService` -> `LlmPort` (interface), `QueryService` -> `buildRetryPrompt` (pure function)

## Test Summary
| Layer | Type | New Tests | Mocks Used |
|-------|------|-----------|------------|
| Outer (Integration) | Integration | 2 | All ports (same as existing) |
| Domain (retry-prompt-builder) | Pure | 2 | None |
| Use Case (QueryService) | Unit | 5 new + 2 modified | LlmPort, TenantDatabasePort, etc. |
| **Total** | | **9 new + 2 modified** | |

[x] Reviewed
