# Spec: Gen-BI Phase 2 — Ask & Answer

## Overview

User types a plain English question in the **Workspace** — a dedicated space that starts as a query interface and evolves into a full dashboard editor. The system retrieves relevant schema via RAG, generates SQL through Claude, validates and executes it against the tenant database, and displays the results as a table alongside the generated SQL. This is the core intelligence loop of Gen-BI.

## Slice 1: LLM Port + Query Endpoint Skeleton

The walking skeleton: a new backend module with an LLM port, a query controller, and a frontend page wired together. Claude receives a hardcoded schema context and returns structured JSON. No RAG retrieval yet.

- [x] New `LlmPort` interface with a method that accepts a prompt and returns structured JSON (intent, title, SQL, visualization config, column metadata)
- [x] `ClaudeAdapter` implements `LlmPort` using the Anthropic SDK with chain-of-thought prompting
- [x] New `QueryModule` with DI token pattern matching existing modules (`LLM_PORT`)
- [x] `QueryController` exposes `POST /api/query` accepting `{ connectionId, question }`
- [x] Returns structured JSON: `{ intent, title, sql, visualization, columns }`
- [x] Returns an error when `ANTHROPIC_API_KEY` is not configured
- [x] Returns an error when connectionId is invalid
- [x] Frontend adds a "Workspace" nav item to the sidebar (`PageId` extended with `'workspace'`)
- [x] Workspace page renders an input bar where the user types a question and submits
- [x] Submit calls the backend and displays the raw JSON response (temporary — replaced in later slices)

## Slice 2: RAG Schema Retrieval

The query embeds the user's question and retrieves relevant columns from pgvector to build focused schema context for the LLM prompt.

- [x] `QueryService` embeds the user's question using the existing `EmbeddingPort`
- [x] Retrieves top-k relevant columns via cosine similarity search against `column_embeddings`
- [x] Builds a schema context string from retrieved columns (table name, column name, data type, foreign keys)
- [x] Passes only the relevant schema context to Claude (not the full schema)
- [x] Returns an error when no embeddings exist for the given connection (schema not yet analyzed)
- [x] Works with databases that have 100+ tables (retrieves focused subset, not all)

## Slice 3: SQL Validation + Execution

Generated SQL is validated for safety, executed against the tenant database with a timeout, and results are returned.

- [x] Validates generated SQL is SELECT-only (rejects INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE)
- [x] Validates generated SQL references only tables/columns that exist in the discovered schema
- [x] Executes validated SQL against the tenant database via the existing `TenantDatabasePort`
- [x] Query execution enforces a timeout (prevents runaway queries against tenant DB)
- [x] Returns query results as rows with column metadata
- [x] Returns an error when SQL validation fails (with reason: not SELECT-only, or references unknown table/column)
- [x] Returns an error when query execution fails (with the database error message)
- [x] `POST /api/query` response now includes `{ intent, title, sql, columns, rows }` on success

## Slice 4: Self-Correcting Retry Loop

When SQL execution fails, the error is fed back to Claude to generate corrected SQL. Retries up to 3 times before giving up.

- [x] On SQL execution failure, feeds the error message back to Claude with the original question and schema context
- [x] Claude generates corrected SQL on retry attempts
- [x] Retries up to 3 times before returning a final error to the user
- [x] Each retry re-validates the corrected SQL (same safety checks as Slice 3)
- [x] Response includes the attempt count so the frontend can show it
- [x] Returns a clear error when all 3 retry attempts are exhausted
- [x] Successful retry returns results normally (user does not see intermediate failures)

## Slice 5: Results Table + SQL Display

The frontend displays query results as a data table and shows the generated SQL for transparency.

- [ ] Frontend `QueryPort` interface and `QueryAdapter` for API calls (matching existing port/adapter pattern)
- [ ] After submitting a question, results display in a data table using the existing Table component
- [ ] Table columns are derived from the response column metadata
- [ ] Table renders all result rows with appropriate formatting (numbers right-aligned, nulls shown as muted italic)
- [ ] Generated SQL is displayed in a collapsible section with monospace font (`font-mono text-xs`)
- [ ] Shows a loading state while the query is processing
- [ ] Shows an error message when the query fails (after all retries exhausted)
- [ ] Shows "No results" when the query returns zero rows
- [ ] The AI-generated title is displayed above the results table

## API Shape

```
POST /api/query
  { connectionId: string, question: string }
  -> 200 {
    intent: string,
    title: string,
    sql: string,
    columns: [{ name: string, type: string, role: "dimension" | "measure" }],
    rows: Record<string, unknown>[],
    attempts: number
  }
  -> 400 { error: "No embeddings found for this connection" }
  -> 400 { error: "SQL validation failed: ..." }
  -> 502 { error: "Query failed after 3 attempts: ..." }
```

## Out of Scope

- Visualization beyond table (Phase 3)
- Pinning/saving queries (Phase 4)
- Query history or suggestions (Phase 5)
- Business-friendly column descriptions in prompts (Phase 5)
- Chat conversation memory (multi-turn context)
- Streaming responses
- Authentication / authorization

## Technical Context

- **Multi-DB readiness:** The `TenantDatabasePort` interface already abstracts the database. Adding new RDBMS types means implementing a new adapter behind the same port — no Knex needed since we execute raw AI-generated SQL.
- **Patterns to follow:** Onion/Outside-In with ports and adapters. New `LlmPort` + `ClaudeAdapter` mirrors existing `EmbeddingPort` + `OpenAIEmbeddingAdapter`. DI token pattern: `LLM_PORT` provided via `useExisting`.
- **Existing code to reuse:** `TenantDatabasePort` for query execution, `EmbeddingPort` for question embedding, `column_embeddings` table for RAG retrieval, `ConnectionsService.findOne()` for connection config, `AppShell` with `PageId` routing, `SchemaDataPort` pattern for frontend ports.
- **New dependencies:** `@anthropic-ai/sdk` for Claude API
- **Key constraints:** Read-only tenant DB (already enforced by adapter). SQL validation adds defense-in-depth. Query timeout prevents runaway queries.
- **Risk level:** HIGH — AI-generated SQL execution against tenant databases requires careful validation and read-only enforcement

---

[x] Reviewed
