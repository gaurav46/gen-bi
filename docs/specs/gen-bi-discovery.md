# Gen-BI: AI-First Business Intelligence Platform — Discovery

## Vision
@bee can you drop a layout as wireframe here
DIY dashboard BI products are outdated. Gen-BI is an AI-first BI platform where users describe what they want in plain language and get back the right query, the right visualization, and a polished dashboard — no SQL, no drag-and-drop chart builders.

Think of it as a human Business Analyst who gathers data, runs reports, picks the best visualization, and shares results — except it's instant and available 24/7.

## Business Model

- **White-label SaaS** — companies embed Gen-BI in their own products or deploy it as a standalone branded app
- **Incubyte** provides managed services, implementation support, and tenant onboarding
- Revenue through licensing + implementation services

## User Personas

### End Users (within tenant companies)
- **Everyone** — no SQL knowledge required
- Business managers asking "how many team members took a day off yesterday?"
- Executives viewing high-level dashboards
- Analysts who want faster answers without writing queries

### Tenant Admins
- Connect databases, configure schema context, manage branding
- Initially Incubyte-assisted, goal is self-service onboarding over time

## Key Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| MVP data connector | PostgreSQL only | Nail the experience first, expand later |
| AI backend | Claude API | Primary LLM for NL→SQL and visualization selection |
| Frontend | React + TypeScript | Large ecosystem, good charting libraries |
| Backend | NestJS + TypeScript | TypeScript everywhere, structured framework |
| DB library | libpq | Per project conventions |
| Authentication | None for MVP | Focus on core BI experience first |
| White-label delivery | Standalone app + embeddable (both) | Tenant chooses deployment model |
| Onboarding | Incubyte-assisted now, self-service later | Build toward self-service as product matures |
| Report sharing | Personal pins only for MVP | Cross-product sharing needs parent system user data — defer |
| DB connections | Read-only required | Gen-BI only runs SELECT queries |
| Schema understanding | Auto-discover + interactive | AI discovers schema, asks clarifying questions, stores index data for query optimization hints |

## Core Capabilities

### 1. Natural Language Query Engine
- User types a question in plain English
- Relevant schema retrieved via embeddings (not full schema per query)
- Claude generates structured JSON: intent, title, SQL, visualization config
- SQL validated and executed with self-correcting retry loop (max 3 attempts)
- Results transformed for the selected chart type

### 2. Dynamic Visualization
- AI picks the visualization type based on data shape and query intent
- Bar, line, pie, KPI card, **table** (first-class) — chosen automatically
- Table for ranked lists and multi-column data
- User can override the AI's chart choice if needed

### 3. Widgets & Reports
- **Widget** = one query + one visualization + AI-generated title
- **Report** = a named collection of widgets in a layout
- Widgets load deterministically (stored SQL re-executed, fresh data, stable layout)
- Personal widgets and reports per user for MVP

### 4. Schema Context Engine
- Auto-discovers tables, columns, types, foreign keys, indexes from connected PostgreSQL
- AI suggests business-friendly descriptions for cryptic column names
- Tenant admin confirms/corrects AI suggestions
- Stores index metadata to warn about potentially inefficient queries

### 5. Data Connector Framework
- PostgreSQL connector for MVP
- Designed so adding MySQL, BigQuery, CSV, REST API connectors later is straightforward
- Each connector implements a common interface

### 6. White-Label Support
- Theming: logo, colors, fonts configurable per tenant
- Deployment options: standalone app with custom domain OR embeddable component
- Embedding via iframe or JS SDK (future)

## What MVP is NOT

- No authentication (handled by parent system or deferred)
- No report sharing between users
- No real-time streaming dashboards
- No data write-back or ETL
- No connectors beyond PostgreSQL
- No self-service tenant onboarding (Incubyte-assisted)

## Technical Architecture (High-Level)

<!-- bee:comment — Reviewed Claude text-to-SQL cookbook (https://github.com/anthropics/claude-cookbooks/blob/main/capabilities/text_to_sql/guide.ipynb). Key takeaways incorporated: (1) Schema preprocessing with embeddings-based retrieval instead of passing full schema per query, (2) Self-correcting SQL generation loop, (3) Chain-of-thought prompting for better SQL. Also redesigned for structured query engine output and chart data storage for pinned widgets. -->

### Schema Preprocessing (inspired by Claude cookbook)

The cookbook uses a RAG approach — embed column-level schema items, retrieve only relevant ones per query. We adapt this for our needs:

**On database connect (preprocessing):**
1. Auto-discover all tables, columns, types, FKs, indexes via `information_schema`
2. Generate embeddings for each column (table name + column name + type + any business description)
3. Store embeddings + metadata in Supabase (not re-read from tenant DB on every query)
4. Tenant admin can enrich with business descriptions → re-embed affected columns

**On each query (retrieval):**
1. Embed the user's natural language question
2. Retrieve top-k relevant columns/tables via similarity search
3. Pass only relevant schema context to Claude (not the full schema)
4. This scales to databases with hundreds of tables

### Query Engine Output Format

The AI query engine returns a structured JSON response, not raw SQL:

```json
{
  "intent": "count_leave_yesterday",
  "title": "Team members on leave yesterday",
  "sql": "SELECT ... FROM ...",
  "visualization": {
    "type": "kpi_card",
    "config": { "label": "Leave count", "value_column": "count" }
  },
  "columns": [
    { "name": "count", "type": "number", "role": "measure" }
  ]
}
```

This structured output drives: the chart type selection, the data transformation for the charting library, and the human-readable title for pinned widgets.

### SQL-to-Graph Data Pipeline

Each charting library (Recharts, etc.) expects data in specific shapes. The pipeline:

1. **Query engine** returns SQL + visualization config (chart type, which columns are axes/measures/categories)
2. **Data transformer** takes raw SQL result rows and reshapes them for the selected chart type
3. **Chart renderer** receives pre-shaped data and renders

**For pinned widgets, we store:**
- The original SQL (deterministic reload)
- The visualization config (chart type + axis mappings)
- The widget title (from AI's intent mapping)
- NOT the data itself — data is re-fetched on load from stored SQL

This means pinned widgets always show fresh data but with a stable, deterministic layout.

### Self-Correcting Query Loop (from cookbook)

1. Claude generates SQL with chain-of-thought reasoning
2. Validate: is it SELECT-only? Does it reference real tables/columns?
3. Execute against tenant DB with timeout
4. If execution fails → feed error back to Claude → retry (max 3 attempts)
5. If success → transform results → render

<!-- bee:comment — Rearchitected with decoupling as a first-class concern. Each module has a single reason to change, communicates via defined interfaces, and can be swapped independently. The LLM is behind the Query Engine; the DB is behind the Connector; the chart format is behind the Data Transformer. No module reaches into another's internals. -->

### Decoupled Module Boundaries

Each module owns one concern, has one reason to change, and communicates through defined interfaces:

| Module | Responsibility | Changes when | Depends on |
|---|---|---|---|
| **Connector** | Abstract DB connections, expose query execution | New DB types added | Nothing (leaf) |
| **Schema Engine** | Discover, enrich, embed schema metadata | Embedding strategy or DB type changes | Connector |
| **Query Engine** | NL → structured JSON (intent, title, SQL, viz config) | LLM provider or prompt strategy changes | Schema Engine (for context retrieval) |
| **SQL Executor** | Validate SQL, execute with timeout, retry loop | Security rules change | Connector, Query Engine (receives SQL) |
| **Data Transformer** | Reshape SQL results into chart-ready format | New chart types added | Nothing (pure function: rows + viz config → chart data) |
| **Widget Store** | CRUD for pinned widgets and reports | Sharing model changes | Nothing (persistence only) |

**Key decoupling points:**
- **LLM is swappable**: Query Engine owns the Claude API call. Swap to OpenAI or local model → only Query Engine changes.
- **DB is swappable**: Connector abstracts libpq. Add MySQL → implement the Connector interface, nothing else changes.
- **Charts are swappable**: Data Transformer maps to a chart-neutral format. Swap Recharts for D3 → only the React renderer changes.
- **SQL Executor doesn't know who generated the SQL**: it receives SQL string + validation rules, doesn't import Query Engine.

```
┌──────────────────────────────────────────────┐
│              React Frontend                  │
│   (Query Bar, Chart Renderer, Widget Grid)   │
└──────────────┬───────────────────────────────┘
               │ REST API
┌──────────────▼───────────────────────────────┐
│             NestJS Backend                   │
│                                              │
│  ┌──────────────┐                            │
│  │ Query Engine │─── uses ──┐               │
│  │ (NL→JSON)   │           │               │
│  └──────┬───────┘           │               │
│         │                   ▼               │
│         │            ┌──────────────┐       │
│         │            │ Schema Engine│       │
│         │            │ (discover +  │       │
│         │            │  embed + RAG)│       │
│         │            └──────┬───────┘       │
│         │                   │               │
│         ▼                   │               │
│  ┌──────────────┐           │               │
│  │ SQL Executor │           │               │
│  │ (validate +  │           │               │
│  │  run + retry)│           │               │
│  └──────┬───────┘           │               │
│         │                   │               │
│         ▼                   ▼               │
│  ┌──────────────────────────────────┐       │
│  │         Connector                │       │
│  │  (abstract DB interface, libpq)  │       │
│  └──────────────┬───────────────────┘       │
│                 │                            │
│  ┌──────────────┴──┐  ┌─────────────────┐   │
│  │ Data Transformer│  │ Widget Store    │   │
│  │ (rows → chart   │  │ (CRUD for pins  │   │
│  │  format)        │  │  and reports)   │   │
│  └─────────────────┘  └─────────────────┘   │
│                                              │
└──────────────────────────────────────────────┘
               │ libpq (read-only)
  ┌────────────▼────────────┐
  │  Tenant's PostgreSQL DB │
  └─────────────────────────┘
```

**Internal database (Supabase):** stores tenant config, schema embeddings, widget definitions, reports, theming. Migrations only — never reset.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| AI generates incorrect SQL | Users get wrong data, lose trust | Validate generated SQL, show query to user, allow correction |
| AI generates slow queries | Tenant DB performance impact | Query timeout enforcement, index-aware prompting, EXPLAIN analysis |
| SQL injection via AI output | Security breach | Parameterized queries, read-only connections, SQL validation layer |
| Schema with no business context | AI can't understand cryptic column names | Interactive schema learning, tenant admin can add descriptions |
| White-label complexity bloat | Slows down MVP | Minimal theming for MVP (logo + primary color), expand later |

## Phased Delivery Plan

<!-- bee:comment — Completely reworked phases to be end-to-end verifiable from the UI. Every phase ships something a user can see and interact with. No backend-only phases. The principle: if you can't demo it in a browser, it's not a phase. -->

**Principle:** Every phase is verifiable from the frontend. No backend-only phases.

### Phase 1: Connect & Explore
**Verify by:** Open the app → Settings screen → enter PostgreSQL connection string → click Connect → see schema analysis progress → see list of discovered tables and columns.

- NestJS project setup + React app scaffold
- Settings screen UI: form to enter PostgreSQL connection details
- Connector module: connect to tenant PostgreSQL via libpq (read-only)
- Schema Engine: auto-discover tables, columns, types, FKs, indexes via `information_schema`
- Store discovered schema in Supabase
- Generate column-level embeddings for RAG retrieval
- Display discovered schema in the UI (tables, columns, types) with analysis progress indicator

### Phase 2: Ask & Answer
**Verify by:** Open the app → type a plain English question in the chat box → see the AI-generated SQL → see raw results in a table.

- Chat-style query input bar in the UI
- Claude API integration with chain-of-thought prompting
- RAG-based schema retrieval: embed user query → retrieve relevant columns → pass to Claude
- Structured JSON output from Claude: intent, title, SQL, visualization config, column metadata
- SQL validation (SELECT-only, references real tables/columns, timeout)
- Self-correcting loop: if SQL fails, feed error back to Claude, retry up to 3 times
- Execute query against tenant PostgreSQL via Connector
- Display results as a table (the first-class table visualization)
- Show the generated SQL to the user (transparency + trust)

### Phase 3: Visualize
**Verify by:** Ask a question → see AI pick the right chart type → see a rendered chart (bar, line, pie, KPI card, or table) → override chart type manually.

- AI-selected visualization type based on data shape and intent
- Supported types: bar, line, pie, KPI card, **table** (first-class)
- Data Transformer: reshapes SQL result rows into chart-ready format per chart type
- Render charts via Recharts or similar
- Chart type override: user can switch between visualization types
- Polish the query → result → chart flow into a smooth single-screen experience

### Phase 4: Pin & Report
**Verify by:** Run a query → pin it as a widget → see it on a dashboard → create a report with multiple widgets → reload and see fresh data with stable layout.

- **Widget**: pin any query result (stores SQL + viz config + AI-generated title)
- **Report**: create a named report, add multiple widgets to it
- Dashboard view: grid of widgets, each showing its chart + title
- Widgets re-execute stored SQL on load (fresh data, deterministic layout)
- Personal widgets and reports per user

### Phase 5: Schema Intelligence
**Verify by:** Connect a DB with cryptic column names → see AI suggest business descriptions → confirm/correct them → ask a query using business terms → see it work.

- Interactive schema annotation: AI suggests business-friendly names, admin confirms/corrects
- Re-embed columns after business descriptions are added
- Index-aware query hints: warn user when generated query may be slow
- Query history sidebar with suggestions

### Phase 6: White-Label & Multi-Tenancy
**Verify by:** Configure tenant branding (logo + colors) → see the app themed → embed via iframe in a test page → verify tenant data isolation.

- Tenant configuration UI: DB connection, branding (logo, primary color)
- Theming engine: apply tenant branding across the app
- Tenant isolation: separate connection pools, data separation in Supabase
- Embeddable mode: iframe-ready deployment option

---
[x] Reviewed
