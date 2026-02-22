# Gen BI

**Ask questions about your data in plain English. Get answers instantly.**

Gen BI is an open-source business intelligence tool that connects to your PostgreSQL database and lets you query it using natural language. Built by [Incubyte](https://incubyte.co) as a production-grade implementation of Anthropic's [Text-to-SQL cookbook](https://github.com/anthropics/claude-cookbooks/blob/main/capabilities/text_to_sql/guide.ipynb).

Instead of writing SQL or learning yet another dashboard builder, just ask: *"Show me the top 5 customers by revenue"* — and get a chart or table of results in seconds.

## How It Works

1. **Connect** — Point Gen BI at any PostgreSQL database
2. **Analyze** — The system discovers your schema, flags ambiguous column names for annotation, and generates vector embeddings
3. **Ask** — Type a question in plain English in the Workspace
4. **Visualize** — Gen BI retrieves relevant schema via RAG, generates SQL through Claude, validates and executes it, and displays results as charts or tables
5. **Save** — Pin useful queries to dashboards for repeated use

The generated SQL is always visible in a collapsible section for full transparency. If the first attempt fails, a self-correcting retry loop feeds errors back to Claude for up to 3 attempts.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Frontend (React + Vite + shadcn/ui + Tailwind v4)  │
│  ports/ → adapters/ → hooks/ → components/          │
├─────────────────────────────────────────────────────┤
│  Backend (NestJS + Prisma + pgvector)               │
│  Ports & Adapters — LlmPort, EmbeddingPort,         │
│  TenantDatabasePort, SchemaRetrievalPort            │
├─────────────────────────────────────────────────────┤
│  App DB (PostgreSQL + pgvector)                     │
│  Stores connections, discovered schema, embeddings  │
├─────────────────────────────────────────────────────┤
│  Tenant DB (PostgreSQL — read-only access)          │
│  Your actual database. Gen BI only runs SELECT.     │
└─────────────────────────────────────────────────────┘
```

**Safety by design:**
- SQL validation rejects anything that isn't a SELECT query
- Table and column references are checked against discovered schema
- Tenant database connections are read-only
- Query execution has a timeout to prevent runaway queries

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, TypeScript, Tailwind v4, shadcn/ui, Recharts |
| Backend | NestJS 11, TypeScript, Prisma 7, pg (libpq) |
| AI | Claude (Anthropic SDK), OpenAI Embeddings |
| Database | PostgreSQL with pgvector extension |
| Testing | Vitest, React Testing Library |
| Monorepo | pnpm workspaces |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+ with the [pgvector](https://github.com/pgvector/pgvector) extension
- An Anthropic API key (for Claude)
- An OpenAI API key (for embeddings)

### Setup

```bash
# Clone the repo
git clone https://github.com/incubyte/gen-bi.git
cd gen-bi

# Install dependencies
pnpm install

# Create the app database
createdb genbi
psql genbi -c "CREATE EXTENSION IF NOT EXISTS vector"

# Configure environment
cp packages/backend/.env.example packages/backend/.env
# Edit .env with your DATABASE_URL, ANTHROPIC_API_KEY, and OPENAI_API_KEY

# Run migrations
cd packages/backend
npx prisma migrate deploy

# Start development servers
pnpm --filter backend start:dev   # Backend on :3000
pnpm --filter frontend dev        # Frontend on :5173
```

### Running Tests

```bash
pnpm --filter backend test    # Backend tests
pnpm --filter frontend test   # Frontend tests
```

## Project Structure

```
gen-bi/
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── connections/      # DB connection management
│   │   │   ├── schema-discovery/ # Schema analysis, annotation, embedding generation
│   │   │   └── query/            # NL→SQL pipeline (LLM, validation, execution, retry)
│   │   └── prisma/               # Schema + migrations
│   └── frontend/
│       └── src/
│           ├── ports/            # Interface definitions
│           ├── adapters/         # API fetch implementations
│           ├── domain/           # Types + pure transform functions
│           ├── hooks/            # React hooks (orchestration)
│           └── components/       # UI components
│               ├── ui/           # shadcn/ui primitives
│               ├── app-shell/    # Layout, sidebar, navigation
│               ├── settings-form/# Connection, schema annotation, embedding
│               ├── schema-explorer/ # Browse discovered tables + data preview
│               ├── dashboards/   # Saved dashboards + widget management
│               └── workspace/    # Ask questions, view results + charts
└── docs/specs/                   # Phase specs + TDD plans
```

## Roadmap

- [x] **Phase 1** — Connect & Discover (schema analysis, embeddings, schema explorer)
- [x] **Phase 2** — Ask & Answer (NL→SQL, validation, execution, retry loop, results table)
- [x] **Phase 3** — Visualize (chart type selection, Recharts integration)
- [x] **Phase 4** — Dashboards (save queries as widgets, dashboard CRUD, widget editing)
- [ ] **Phase 5** — Schema Intelligence (ambiguity detection, AI-suggested column descriptions, annotation workflow)

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

Built with care by [Incubyte](https://incubyte.co) | Inspired by Anthropic's [Text-to-SQL cookbook](https://github.com/anthropics/claude-cookbooks/blob/main/capabilities/text_to_sql/guide.ipynb)