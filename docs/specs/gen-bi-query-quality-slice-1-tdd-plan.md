# TDD Plan: Query Quality Slice 1 -- Extended Thinking + Few-Shot Examples

## Execution Instructions
Read this plan. Work on every item in order.
Mark each checkbox done as you complete it ([ ] -> [x]).
Continue until all items are done.
If stuck after 3 attempts, mark with a warning and move to the next independent step.

## Context
- **Source**: `docs/specs/gen-bi-query-quality.md`
- **Phase/Slice**: Slice 1 -- Extended Thinking + Few-Shot Examples
- **Risk Level**: MODERATE
- **Success Criteria**:
  1. ClaudeAdapter enables extended thinking on the Anthropic API call
  2. System prompt includes at least 2 few-shot example pairs (question, SQL, expected output shape)
  3. Extended thinking reasoning stays internal to the model (does not appear in JSON output)
  4. Existing generateQuery contract (returns LlmQueryResponse) is unchanged

## Codebase Analysis

### Scope
This slice modifies a single file: `packages/backend/src/query/claude.adapter.ts` and its test. No new ports, no new layers, no interface changes. The `LlmPort` contract stays identical. This is adapter-internal work.

### What Changes
| Change | File |
|--------|------|
| Add `thinking` parameter to API call | `claude.adapter.ts` |
| Set `temperature: 1` (API requirement) | `claude.adapter.ts` |
| Increase `max_tokens` to accommodate thinking budget | `claude.adapter.ts` |
| Add few-shot examples to `SYSTEM_PROMPT` | `claude.adapter.ts` |
| Remove `OUTPUT_SCHEMA` (incompatible with extended thinking) | `claude.adapter.ts` |
| Filter out `thinking` blocks from response | `claude.adapter.ts` |
| Update tests to verify all above | `claude.adapter.spec.ts` |

### What Does NOT Change
- `LlmPort` interface -- untouched
- `LlmQueryResponse` type -- untouched
- `QueryService` -- untouched
- `QueryModule` wiring -- untouched
- Integration test -- should still pass as-is

### Key API Constraints (Anthropic Extended Thinking)
- Requires `thinking: { type: 'enabled', budget_tokens: N }` in `messages.create()`
- `temperature` must be set to `1` when extended thinking is enabled
- Response `content` array will contain `thinking` blocks (type: `'thinking'`) before the `text` block
- Only the `text` block contains the JSON output -- `thinking` blocks must be skipped
- `output_config` with `json_schema` format is not compatible with extended thinking -- removed

---

## Outer Test (Integration)

**The existing integration test in `query.integration.spec.ts` serves as the outer test. It mocks `LlmPort` at the port boundary, so it is unaffected by adapter-internal changes. We verify it still passes at the end.**

- [x] **RUN** existing integration test: `packages/backend/src/query/query.integration.spec.ts`
- [x] **CONFIRM** it passes before any changes (baseline)

---

## Step 1: Update Test -- Extended Thinking Parameters

**Behavior**: The adapter passes `thinking` config and `temperature: 1` to the Anthropic SDK.

- [x] **RED**: Add test to `packages/backend/src/query/claude.adapter.spec.ts`
  - Test name: `'passes extended thinking config to Anthropic SDK'`
  - Action: call `adapter.generateQuery('test prompt')`
  - Assert on `mockCreate.mock.calls[0][0]`:
    - `thinking.type` equals `'enabled'`
    - `thinking.budget_tokens` is a positive number
    - `temperature` equals `1`

- [x] **RUN**: Confirm test FAILS (current adapter does not send these params)

- [x] **GREEN**: Update `generateQuery` in `claude.adapter.ts`
  - Add `thinking: { type: 'enabled', budget_tokens: 10000 }` to `messages.create()` call
  - Add `temperature: 1`
  - Increase `max_tokens` to `16000` (must exceed budget_tokens)
  - Remove `output_config` (incompatible with extended thinking)

- [x] **RUN**: Confirm test PASSES

---

## Step 2: Update Test -- Thinking Blocks Filtered from Response

**Behavior**: When the API response contains `thinking` blocks, they are ignored. Only the `text` block is parsed.

- [x] **RED**: Add test to `claude.adapter.spec.ts`
  - Test name: `'ignores thinking blocks and parses only the text block'`
  - Setup: mock `mockCreate` to return a response with both a `thinking` block and a `text` block:
    - `{ type: 'thinking', thinking: 'Let me reason about this...' }`
    - `{ type: 'text', text: JSON.stringify(cannedLlmResponse) }`
  - Action: call `adapter.generateQuery('test')`
  - Assert: returns the parsed JSON from the `text` block (same shape as `LlmQueryResponse`)
  - Assert: the returned object does NOT contain any `thinking` key or reasoning text

- [x] **RUN**: Confirm test passes (existing `.find(b => b.type === 'text')` already handles this -- confirmation test)

- [x] **GREEN**: Existing response parsing code already skips non-text blocks. No code change needed.

- [x] **RUN**: Confirm test PASSES

---

## Step 3: Update Test -- Few-Shot Examples in System Prompt

**Behavior**: The system prompt includes at least 2 few-shot example pairs showing (question, SQL, expected output JSON).

- [x] **RED**: Add test to `claude.adapter.spec.ts`
  - Test name: `'includes few-shot examples in the system prompt'`
  - Action: call `adapter.generateQuery('any question')`
  - Assert on `mockCreate.mock.calls[0][0].system`:
    - Contains at least 2 `Example N:` headers
    - Contains at least 2 SQL `SELECT` snippets in example context

- [x] **RUN**: Confirm test FAILS (current SYSTEM_PROMPT has no examples)

- [x] **GREEN**: Update the `SYSTEM_PROMPT` constant in `claude.adapter.ts`
  - Added 2 few-shot example pairs after the existing instructions
  - Each example has: a business question, the expected SQL, and the expected JSON output
  - Examples are generic (not tied to any specific tenant schema)
  - Examples demonstrate different chart types (bar, line) and query patterns (GROUP BY + COUNT, DATE_TRUNC + SUM)

- [x] **RUN**: Confirm test PASSES

- [x] **REFACTOR**: Examples are clearly delimited with `Example 1:` / `Example 2:` headers

---

## Step 4: Update Existing Test -- SDK Call Args

**Behavior**: The existing test `'calls Anthropic SDK with structured output schema and parses response'` should still pass and also verify the new parameters.

- [x] **UPDATE** existing test assertions to also check:
  - `callArgs.thinking.type` equals `'enabled'`
  - `callArgs.temperature` equals `1`
  - `callArgs.system` contains example text (`.toContain('Example')`)

- [x] **RUN**: Confirm updated test PASSES

---

## Step 5: Contract Preservation Check

**Behavior**: The `generateQuery` method still returns `LlmQueryResponse` with the exact same shape.

- [x] **RUN** full adapter test suite: all tests in `claude.adapter.spec.ts` pass (6 tests)
- [x] **RUN** integration test: `query.integration.spec.ts` still passes (3 tests)
- [x] **RUN** all backend tests: `pnpm test` — 116 tests pass

---

## Architecture Verification

- [x] `claude.adapter.ts` still imports only `LlmPort` interface + `LlmQueryResponse` type + Anthropic SDK + NestJS decorators
- [x] `llm.port.ts` is unchanged (no diff)
- [x] `query.types.ts` is unchanged (no diff)
- [x] `query.service.ts` is unchanged by this slice (earlier logging changes are separate)
- [x] No new files created -- this is purely adapter-internal

## Test Summary
| Layer | Type | # Tests | Mocks Used | Status |
|-------|------|---------|------------|--------|
| ClaudeAdapter | Unit | 6 | Anthropic SDK mock | PASS |
| Integration (existing) | Integration | 3 | Port-level mocks | PASS |
| **Total** | | **9** | | **PASS** |
[x] reviewed
