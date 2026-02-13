# Spec: Gen-BI Phase 1 — Connect & Explore

## Overview

User connects a PostgreSQL database via a Settings screen, selects schemas to analyze, and sees discovered tables/columns displayed in the UI. This is the foundation: no data exploration is possible until a database is connected and its schema is understood.

<!-- bee:comment — Added Tech Stack section before slices to lock down tooling decisions. Vite, shadcn/ui, Tailwind, pnpm monorepo, NestJS defaults. These choices are baked into Slice 1's scaffold. -->

## Tech Stack

| Layer | Choice |
|---|---|
| **Repo structure** | pnpm monorepo with workspaces (`packages/frontend`, `packages/backend`) |
| **Package manager** | pnpm |
| **Frontend** | Vite + React + TypeScript |
| **UI components** | shadcn/ui + Tailwind CSS |
| **Backend** | NestJS + TypeScript (Express adapter, default) |
| **Tenant DB access** | libpq (read-only) |
| **Internal DB** | PostgreSQL (cloud-agnostic — AWS, Azure, on-prem) |
| **ORM / Migrations** | Prisma |
| **Embeddings** | Voyage AI (generation) + pgvector (storage + search) |


## Slice 1: Project Scaffold + Settings Form

The walking skeleton: apps boot, user can see and fill in the connection form.

- [ ] NestJS backend starts and serves a health-check endpoint
- [ ] React frontend starts and renders a Settings screen at the default route
- [ ] Settings form has separate fields: host, port, database, username, password
- [ ] A connection string textbox updates live as individual fields are filled
- [ ] User can edit the connection string directly and individual fields update to match
- [ ] Port defaults to 5432
- [ ] Connect button is disabled until all required fields have values
- [ ] Supabase migration creates a table to store connection configurations
- [ ] On submit, connection config is persisted to Supabase (password stored, not plain text)
- [ ] On reload, previously saved connection config is loaded into the form

## Slice 2: Connect + Schema Discovery

User clicks Connect, app connects to the tenant DB read-only, discovers available schemas, and lets the user pick which to analyze.

- [ ] Clicking Connect attempts a read-only connection to the tenant PostgreSQL via libpq
- [ ] Shows "Connecting..." progress step during connection attempt
- [ ] Shows an error message when connection fails (invalid credentials, unreachable host, etc.)
- [ ] Connection is read-only — only SELECT queries are executed against the tenant DB
- [ ] On successful connection, discovers all schemas via `information_schema`
- [ ] Shows "Discovering schemas..." progress step during discovery
- [ ] Displays a list of discovered schemas with checkboxes for the user to select
- [ ] User selects one or more schemas and clicks Analyze
- [ ] Shows an error when the connected database has zero non-system schemas

## Slice 3: Table & Column Analysis

For selected schemas, discover all tables, columns, types, foreign keys, and indexes. Store in Supabase.

- [ ] Discovers tables, columns, data types, foreign keys, and indexes for selected schemas
- [ ] Shows "Analyzing tables..." progress step with count (e.g., "Analyzing table 3 of 12")
- [ ] Stores discovered schema metadata (tables, columns, types, FKs, indexes) in Supabase
- [ ] Supabase migration creates tables for schema metadata storage
- [ ] Shows an error when a selected schema contains zero tables
- [ ] Analysis can handle databases with 100+ tables without timeout

## Slice 4: Embedding Generation

Generate column-level embeddings via Voyage AI, store in Supabase pgvector for later RAG retrieval.

- [ ] Generates an embedding for each column using Voyage AI (input: table name + column name + data type)
- [ ] Shows "Generating embeddings..." progress step
- [ ] Stores embeddings in Supabase using pgvector
- [ ] Supabase migration creates a table with a vector column for embeddings
- [ ] Shows "Done" when all steps complete successfully
- [ ] Shows an error if Voyage AI is unreachable or returns an error
- [ ] Re-running analysis on the same database replaces previous embeddings (not duplicates)

## Slice 5: Schema Explorer UI

Display discovered schema in the UI so the user can browse what was found.

- [ ] After analysis completes, displays a browsable list of discovered tables grouped by schema
- [ ] Each table expands to show its columns with name, data type, and nullable flag
- [ ] Foreign key relationships are indicated on relevant columns
- [ ] Indexed columns are visually distinguished
- [ ] User can search/filter tables by name
- [ ] Schema explorer loads from Supabase (not re-queried from tenant DB)

## API Shape

```
POST /api/connections         — save connection config
GET  /api/connections/:id     — load saved connection config
POST /api/connections/:id/test — test connectivity, return available schemas

POST /api/schema/discover     — { connectionId, schemas: ["public", "sales"] }
                              — kicks off discovery + embedding pipeline
GET  /api/schema/discover/status — progress of current discovery
GET  /api/schema/:connectionId/tables — discovered tables, columns, types, FKs, indexes
```

## Out of Scope

- Authentication / authorization (no auth for MVP)
- Connectors beyond PostgreSQL
- Business-friendly column descriptions (Phase 5)
- AI-suggested schema annotations (Phase 5)
- Query execution or NL-to-SQL (Phase 2)
- Multi-tenant isolation (Phase 6)
- Editing or deleting data in tenant databases (never — read-only by design)

## Technical Context

- **Greenfield repo** — no existing code
- **Stack:** NestJS + TypeScript backend, React + TypeScript frontend
- **DB library:** libpq for tenant PostgreSQL connections
- **Internal DB:** Supabase with pgvector extension (migrations only, never reset)
- **Embeddings:** Voyage AI for generation, pgvector for storage + similarity search
- **Tenant DB access:** read-only, SELECT only — never UPDATE/DELETE/DROP
- **Patterns:** Connector module abstracts DB access behind an interface; Schema Engine owns discovery + embedding
- **Risk level:** HIGH — greenfield setup, external service dependencies (Voyage AI), security-sensitive (DB credentials)

---

[ ] Reviewed
