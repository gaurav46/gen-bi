# Spec: NL-to-SQL Pipeline Quality Improvements

## Overview

Improve the quality of generated SQL by enabling extended thinking on Sonnet 4.5 (native chain-of-thought), adding few-shot examples, enriching schema context with sample data rows, and simplifying the validator by removing the unreliable table/column reference check.

## Slice 1: Extended Thinking + Few-Shot Examples

Enable Sonnet 4.5's extended thinking for native chain-of-thought reasoning, and add few-shot examples to the system prompt.

<!-- @bee: Using extended thinking instead of manual CoT. Temperature must be 1 (API requirement with thinking mode). -->

- [ ] ClaudeAdapter enables extended thinking on the Anthropic API call
- [ ] System prompt includes at least 2 few-shot example pairs (question, SQL, expected output shape)
- [ ] Extended thinking reasoning stays internal to the model (does not appear in JSON output)
- [ ] Existing generateQuery contract (returns LlmQueryResponse) is unchanged

## Slice 2: Sample Data Rows in Schema Context

Fetch sample rows from the tenant DB and include them in the prompt so the LLM sees real data values.

- [ ] QueryService fetches up to 5 sample rows per relevant table from the tenant DB
- [ ] Sample row fetch failures are non-fatal (logged and skipped, query continues without sample data)
- [ ] buildSchemaContext accepts an optional sample-rows parameter alongside columns
- [ ] Schema context output includes sample rows formatted below each table's column listing
- [ ] Tables with no sample rows (fetch failed or empty table) show columns only, no empty sample section

## Slice 3: Simplify SQL Validator + Remove Dead Code

Remove validateTableReferences and all code that only exists to support it.

- [ ] validateTableReferences function is removed from sql-validator.ts
- [ ] splitSelectColumns function is removed from sql-validator.ts
- [ ] TableSchema type export is removed from sql-validator.ts
- [ ] QueryService no longer calls validateTableReferences
- [ ] buildKnownSchema private method is removed from QueryService
- [ ] validateSelectOnly continues to work and is the only validation applied to generated SQL
- [ ] Tests for removed functions are deleted; tests for validateSelectOnly remain

## Out of Scope

- Changing the LLM model (stays on claude-sonnet-4-5-20250929)
- Changing the retry loop or MAX_ATTEMPTS
- Adding query result caching
- Modifying the OUTPUT_SCHEMA JSON schema
- UI changes

## Technical Context

- Patterns to follow: hexagonal architecture, pure utility functions for schema-context-builder and sql-validator
- Key files: `claude.adapter.ts`, `schema-context-builder.ts`, `query.service.ts`, `sql-validator.ts` and their `.spec.ts` counterparts
- TenantDatabasePort.query() is already available in QueryService for sample data fetching
- TenantDatabaseAdapter enforces read-only mode so sample queries are safe
- RelevantColumn has `tableName` field to construct `SELECT * FROM <table> LIMIT 5`
- Extended thinking API: requires `thinking: { type: 'enabled', budget_tokens: N }` and temperature must be 1
- Risk level: MODERATE

[ ] Reviewed
