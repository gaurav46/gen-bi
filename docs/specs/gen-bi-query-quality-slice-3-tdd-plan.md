# TDD Plan: Slice 3 -- Simplify SQL Validator + Remove Dead Code
<!-- -------- bee-comment -------- -->
> **@developer**: what do we plan to delete?
> **@bee**: Good news — the dead code is already gone. `sql-validator.ts` only has `validateSelectOnly`, `query.service.ts` has no `buildKnownSchema` or `validateTableReferences`. The functions `validateTableReferences`, `splitSelectColumns`, and the `TableSchema` type were removed in a prior session. This slice is effectively a verification pass — confirm everything is clean, no dead references, all tests pass.
> - [ ] mark as resolved
<!-- -------- /bee-comment -------- -->
<!-- -------- bee-comment -------- -->
> **@developer**: if the dead code is gone do we really need to work on this slice? Should we just close it?
> **@bee**: Exactly right. The dead code was already removed, no external references remain, and all 113 tests pass. Closing this slice as already complete — no execution needed.
> - [ ] mark as resolved
<!-- -------- /bee-comment -------- -->

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it ([ ] -> [x]).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

## Context
- **Source**: `docs/specs/gen-bi-query-quality.md`
- **Phase/Slice**: Slice 3 -- Simplify SQL Validator + Remove Dead Code
- **Risk Level**: MODERATE
- **Success Criteria**:
  1. `validateTableReferences` function is removed from `sql-validator.ts`
  2. `splitSelectColumns` function is removed from `sql-validator.ts`
  3. `TableSchema` type export is removed from `sql-validator.ts`
  4. `QueryService` no longer calls `validateTableReferences`
  5. `buildKnownSchema` private method is removed from `QueryService`
  6. `validateSelectOnly` continues to work and is the only validation applied to generated SQL
  7. Tests for removed functions are deleted; tests for `validateSelectOnly` remain

## Codebase Analysis

### Nature of This Slice
This is a DELETION slice. No new features, no new ports, no new layers. The work is removing dead code and verifying existing behavior survives intact. The TDD approach here is defensive: lock down the behavior that must survive, then delete everything else.

### Architecture
- Current: Hexagonal architecture already in place
- `sql-validator.ts` is a pure utility (no class, no DI, exported functions)
- `QueryService` is the use case layer, calls `validateSelectOnly` as its only validator
- No new ports or adapters needed -- this is purely subtraction

### Key Files
| File | Action |
|------|--------|
| `packages/backend/src/query/sql-validator.ts` | Remove `validateTableReferences`, `splitSelectColumns`, `TableSchema` |
| `packages/backend/src/query/sql-validator.spec.ts` | Remove tests for deleted functions |
| `packages/backend/src/query/query.service.ts` | Remove `buildKnownSchema` method, remove `validateTableReferences` calls |
| `packages/backend/src/query/query.service.spec.ts` | Remove tests for deleted functionality |

### Current State Assessment
The working tree shows `sql-validator.ts` already contains only `validateSelectOnly`. The plan below prescribes the safe order of operations: verify first, delete second.

---

## Step 1: Baseline -- Lock Down validateSelectOnly Behavior

**Before deleting anything, confirm the surviving function works. These tests are the safety net.**

- [ ] **RUN** existing tests: `cd /Users/sapanparikh/Development/clients/incubyte/gen-bi/packages/backend && pnpm vitest run src/query/sql-validator.spec.ts`
- [ ] **CONFIRM** all `validateSelectOnly` tests pass (the `describe('validateSelectOnly')` block)
- [ ] **CONFIRM** all QueryService tests pass: `pnpm vitest run src/query/query.service.spec.ts`
- [ ] **CONFIRM** integration tests pass: `pnpm vitest run src/query/query.integration.spec.ts`

---

## Step 2: Verify No External References to Dead Code

**Before deletion, confirm nothing outside the query module imports the functions being removed.**

- [ ] **SEARCH** the entire `packages/backend/src` directory for:
  - `validateTableReferences` -- must appear only in `sql-validator.ts` and `sql-validator.spec.ts`
  - `splitSelectColumns` -- must appear only in `sql-validator.ts` and `sql-validator.spec.ts`
  - `TableSchema` (from sql-validator) -- must not be imported anywhere outside the query module
  - `buildKnownSchema` -- must appear only in `query.service.ts` and `query.service.spec.ts`
- [ ] **CONFIRM** no external consumers exist. If any are found, they must be updated first.

---

## Step 3: Remove Dead Code from sql-validator.ts

- [ ] **DELETE** `validateTableReferences` function from `sql-validator.ts`
- [ ] **DELETE** `splitSelectColumns` function from `sql-validator.ts`
- [ ] **DELETE** `TableSchema` type export from `sql-validator.ts`
- [ ] **VERIFY** the file exports only `validateSelectOnly` (and its `ValidationResult` type if used)
- [ ] **RUN** `pnpm vitest run src/query/sql-validator.spec.ts` -- expect failures for deleted function tests

---

## Step 4: Remove Dead Tests from sql-validator.spec.ts

- [ ] **DELETE** all test blocks for `validateTableReferences` (the `describe('validateTableReferences')` block)
- [ ] **DELETE** all test blocks for `splitSelectColumns` (the `describe('splitSelectColumns')` block)
- [ ] **DELETE** unused imports (`validateTableReferences`, `splitSelectColumns`, `TableSchema`)
- [ ] **VERIFY** only the `describe('validateSelectOnly')` block remains
- [ ] **RUN** `pnpm vitest run src/query/sql-validator.spec.ts` -- all remaining tests PASS

---

## Step 5: Remove Dead Code from QueryService

- [ ] **DELETE** `buildKnownSchema` private method from `query.service.ts`
- [ ] **DELETE** any call to `validateTableReferences` in `query.service.ts`
- [ ] **DELETE** `validateTableReferences` import from `query.service.ts`
- [ ] **VERIFY** `validateSelectOnly` import remains and is still called in the retry loop
- [ ] **VERIFY** `QueryService` still validates SQL with `validateSelectOnly` before execution
- [ ] **RUN** `pnpm vitest run src/query/query.service.spec.ts` -- expect failures for deleted method tests

---

## Step 6: Remove Dead Tests from query.service.spec.ts

- [ ] **DELETE** any tests that specifically test `validateTableReferences` or `buildKnownSchema` behavior
- [ ] **DELETE** unused imports related to removed functionality
- [ ] **VERIFY** tests for `validateSelectOnly` integration remain (the test `'validates generated SQL is SELECT-only before execution'`)
- [ ] **RUN** `pnpm vitest run src/query/query.service.spec.ts` -- all remaining tests PASS

---

## Step 7: Full Test Suite Verification

- [ ] **RUN** all query module tests: `pnpm vitest run src/query/`
- [ ] **RUN** full backend test suite: `pnpm test`
- [ ] **CONFIRM** no regressions -- all tests pass
- [ ] **CONFIRM** `validateSelectOnly` is the only validation applied to generated SQL (grep for `validate` in `query.service.ts`)

---

## Step 8: Architecture Verification

- [ ] **VERIFY** `sql-validator.ts` exports only `validateSelectOnly` -- pure function, no imports from adapters/ports/infrastructure
- [ ] **VERIFY** `query.service.ts` imports `validateSelectOnly` from `sql-validator` (pure utility import)
- [ ] **VERIFY** no orphaned types or dead code remain in `query.types.ts` related to table validation
- [ ] **VERIFY** no circular dependencies introduced

---

## Final Acceptance Criteria Check

| Criterion | Verified |
|-----------|----------|
| `validateTableReferences` removed from `sql-validator.ts` | [ ] |
| `splitSelectColumns` removed from `sql-validator.ts` | [ ] |
| `TableSchema` type export removed from `sql-validator.ts` | [ ] |
| `QueryService` no longer calls `validateTableReferences` | [ ] |
| `buildKnownSchema` removed from `QueryService` | [ ] |
| `validateSelectOnly` continues to work | [ ] |
| Tests for removed functions deleted; `validateSelectOnly` tests remain | [ ] |

## Test Summary
| Layer | Type | # Tests | Status |
|-------|------|---------|--------|
| sql-validator (validateSelectOnly) | Pure | 11 | PASS |
| QueryService (SELECT-only validation) | Unit | remaining tests | PASS |
| Integration | Integration | 4 | PASS |
| **Deleted tests** | -- | N removed | -- |

<center>[ ] Reviewed</center>
