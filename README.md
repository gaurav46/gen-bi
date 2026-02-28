# Gen BI

**Ask questions about your data in plain English. Get answers instantly.**

Gen BI is a free, open-source alternative to tools like PowerBI, Tableau, and Looker. Connect it to your PostgreSQL database and start asking questions — no SQL required, no dashboards to configure.

Built by [Incubyte](https://incubyte.co) as a production-grade implementation of Anthropic's [Text-to-SQL cookbook](https://github.com/anthropics/claude-cookbooks/blob/main/capabilities/text_to_sql/guide.ipynb).

## Features

**Natural language queries** — Ask *"Show me top 5 customers by revenue"* and get results in seconds. No SQL knowledge needed.

**Automatic schema understanding** — Gen BI connects to your database, discovers tables and columns, and builds a semantic index so it knows what your data means.

**Smart column annotation** — Cryptic column names like `amt_1` or `flg_yn`? Gen BI flags them and suggests human-readable descriptions using AI, so queries are more accurate.

**Charts and tables** — Results are displayed as interactive charts or tables. Pick the visualization that fits your data.

**Dashboards** — Save useful queries as widgets and organize them into dashboards you can revisit anytime.

**Schema explorer** — Browse your database structure, preview data, and understand relationships between tables.

**Full transparency** — The generated SQL is always visible. You can see exactly what query was run and verify it yourself.

**Self-correcting** — If a query fails, Gen BI automatically retries with error context, fixing issues like wrong column names or joins.

**Safe by design** — Only SELECT queries are allowed. Your database is connected read-only. Query execution has timeouts. No data is ever modified.

## How It Works

1. **Connect** — Point Gen BI at any PostgreSQL database
2. **Analyze** — It discovers your schema, flags ambiguous columns for review, and generates embeddings
3. **Ask** — Type a question in plain English
4. **Get answers** — Gen BI finds relevant tables, generates SQL via Claude, validates it, runs it, and shows you results

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+ with [pgvector](https://github.com/pgvector/pgvector)
- Anthropic API key (for Claude)
- OpenAI API key (for embeddings)

### Setup

```bash
git clone https://github.com/incubyte/gen-bi.git
cd gen-bi
pnpm install

# Create the app database
createdb genbi
psql genbi -c "CREATE EXTENSION IF NOT EXISTS vector"

# Configure environment
cp packages/backend/.env.example packages/backend/.env
# Edit .env with your DATABASE_URL, ANTHROPIC_API_KEY, and OPENAI_API_KEY

# Run migrations and start
cd packages/backend && npx prisma migrate deploy
pnpm --filter backend start:dev   # Backend on :3000
pnpm --filter frontend dev        # Frontend on :5173
```

## Tech Stack

React, NestJS, TypeScript, Prisma, PostgreSQL + pgvector, Claude (Anthropic), OpenAI Embeddings, Recharts, Tailwind, shadcn/ui.

## Roadmap

- [x] Connect & Discover — schema analysis, embeddings, schema explorer
- [x] Ask & Answer — natural language to SQL, validation, execution, retry loop
- [x] Visualize — chart type selection
- [x] Dashboards — save queries as widgets, dashboard management
- [ ] Schema Intelligence — AI-suggested column descriptions, annotation workflow

## License

MIT — see [LICENSE](LICENSE).

---

Built by [Incubyte](https://incubyte.co) | Inspired by Anthropic's [Text-to-SQL cookbook](https://github.com/anthropics/claude-cookbooks/blob/main/capabilities/text_to_sql/guide.ipynb)
