# Architecture Assessment: Gen-BI

**Date**: 2026-02-17
**Scope**: Full codebase (`packages/backend/src/`, `packages/frontend/src/`)
**Git history**: 7 commits over ~6 months (project is early-stage)

---

## Architecture Summary

**Pattern**: Hexagonal (Ports & Adapters) — consistently applied in both backend and frontend.

- Backend: NestJS modules with port interfaces (`LlmPort`, `EmbeddingPort`, `TenantDatabasePort`, `SchemaRetrievalPort`) bound to adapters via DI tokens
- Frontend: Port interfaces in `ports/` with fetch-based adapters in `adapters/`, domain types in `domain/`, ports injected as props from composition root (`App.tsx`)
- Four backend modules map cleanly to product phases: `connections` (Connect), `schema-discovery` (Explore), `query` (Ask), `dashboards` (Dashboards)

---

## Domain Vocabulary

| Concept | Source | Code Match |
|---------|--------|------------|
| Connection | README, Phase 1 spec | `connections/` module, `ConnectionConfig` model, `ConnectionForm` |
| Schema / Table / Column | README, Phase 1 spec | `schema-discovery/` module, `DiscoveredTable`/`DiscoveredColumn` models |
| Embedding | Phase 1 spec | `ColumnEmbedding` model, `EmbeddingPort`, `OpenAIEmbeddingAdapter` |
| Query | README, Phase 2 spec | `query/` module, `QueryService`, `QueryRequest`/`QueryResponse` types |
| Workspace | README, Phase 2 spec | `workspace/` frontend component directory |
| Dashboard | Phase 4 spec | `dashboards/` module, `Dashboard` model, `DashboardPort` |
| Widget | Phase 4 spec | `Widget` model, `CreateWidgetDto`, `AddToDashboardDropdown` |
| Chart / Visualization | Phase 3 spec | `chart-types.ts`, `chart-transforms.ts`, `ChartRenderer.tsx` |
| Column Role (Dimension/Measure) | Phase 2-3 specs | `role: 'dimension' | 'measure'` in column metadata |
| Tenant Database | All specs | `TenantDatabasePort`, `TenantDatabaseAdapter` |
| SQL Validation | Phase 2 spec | `sql-validator.ts` (`validateSelectOnly`) |

---

## Boundary Map

| Module | Owns | Depends On |
|--------|------|------------|
| `backend/connections/` | ConnectionConfig CRUD, password encryption, `PRISMA_CLIENT` token | — |
| `backend/schema-discovery/` | Table/Column/Embedding models, `TenantDatabasePort`, `EmbeddingPort`, schema analysis | `connections/` |
| `backend/query/` | NL-to-SQL pipeline, `LlmPort`, `SchemaRetrievalPort`, SQL validation, retry loop | `connections/`, `schema-discovery/` |
| `backend/dashboards/` | Dashboard/Widget CRUD, widget execution | `connections/`, `schema-discovery/` |
| `frontend/domain/` | Type definitions, pure transform functions | — |
| `frontend/ports/` | `SchemaDataPort`, `QueryPort`, `DashboardPort` interfaces | `domain/` types |
| `frontend/adapters/` | Fetch implementations for each port | `ports/`, `domain/` |
| `frontend/components/` | UI pages and components | `ports/` interfaces (via props) |

---

## Healthy Boundaries

1. **Domain-code alignment is strong.** The four backend modules map cleanly to product phases. No naming confusion between module responsibilities.

2. **Ports-and-adapters consistently applied.** Backend ports (`LlmPort`, `EmbeddingPort`, `TenantDatabasePort`, `SchemaRetrievalPort`) and frontend ports (`SchemaDataPort`, `QueryPort`, `DashboardPort`) enforce clear adapter boundaries. Components never instantiate adapters directly.

3. **Frontend domain layer is pure and stable.** Types in `domain/`, transforms are pure functions, no UI imports. Changed in only 1 commit each after creation.

4. **Adapter wiring centralized at composition root.** `App.tsx` creates all adapters and passes them as props. No component creates its own adapter.

5. **Chart rendering is modular.** Each chart type has its own panel component, `ChartRenderer` dispatches by type, and `chart-transforms.ts` handles data transformation. Reused cleanly in both Workspace and Dashboard detail pages.

6. **Dashboard vocabulary evolution was clean.** "Pin/Report" from discovery doc was deliberately replaced with "Dashboard/Widget" — zero residual terminology in code.

---

## Hotspots

| Rank | File | Commits | Lines | Risk |
|------|------|---------|-------|------|
| 1 | `frontend/.../SettingsForm.tsx` | 5/7 | 151 | **High** — `handleAnalyze` is 61 lines with polling, timers, dual error paths |
| 2 | `backend/.../schema-discovery.service.ts` | 4/7 | 205 | **High** — `analyzeSchemas` is 137 lines, 4 levels deep nesting |
| 3 | `backend/.../query.service.ts` | 2/7 | 142 | **High** — `query()` is 87 lines, 5 injected dependencies, retry+timeout+validation |

**Note:** With only 7 commits, these hotspots reflect early-project patterns. Re-evaluate after 20+ commits.

---

## Mismatches

### Vocabulary Drift

| Domain Term | Code Term | Severity | Notes |
|-------------|-----------|----------|-------|
| Schema Engine | `schema-discovery/` | Low | "Discovery" is more specific and accurate |
| Connector | `connections/` + `TenantDatabasePort` | Low | Split across two modules; functional but naming differs from discovery doc |
| SQL Executor | Inline in `QueryService` | Low | Not a separate module; lives in helper files within `query/` |
| Report | Dashboard | None | Deliberate evolution — but discovery doc still uses "Report/Pin" language |

### Boundary Violations

**1. `TENANT_DATABASE_PORT` token lives in `schema-discovery.service.ts` instead of `tenant-database.port.ts`** — Moderate

The DI token constant is defined in the service file but should be co-located with the port interface (like `LLM_PORT` in `llm.port.ts` and `EMBEDDING_PORT` in `embedding.port.ts`). Developer confirmed `schema-discovery/` is the right owning module — the token just needs to move to the port file.

**Fix:** Move `TENANT_DATABASE_PORT` constant into `tenant-database.port.ts`. Quick win.

**2. Circular dependency between `ConnectionsModule` and `SchemaDiscoveryModule`** — Accepted

Both use `forwardRef`. Developer decision: leave as-is for now. The `forwardRef` works and the project is early-stage.

**3. `PRISMA_CLIENT` token co-located with `ConnectionsService`** — Moderate

Infrastructure token bundled with a service class. Every consumer imports from `connections.service.ts` for the token.

**Fix:** Extract to `connections/prisma-client.token.ts` or a shared `tokens.ts`. Quick win.

**4. Hardcoded `'PRISMA_CLIENT'` string in `prisma-schema-retrieval.adapter.ts`** — Moderate

Line 15 uses the string literal `'PRISMA_CLIENT'` instead of importing the constant. Will silently break if the token value changes.

**Fix:** Import the constant. Quick win.

**5. Tenant DB connect/disconnect pattern duplicated 4 times** — Moderate (Developer: extract now)

Three services (`QueryService`, `DashboardsService`, `SchemaDiscoveryService`) each duplicate the "lookup connection → map fields → connect → try/finally disconnect" pattern. The `databaseName` → `database` field mapping is error-prone.

**Fix:** Extract a `connectToTenant(connectionId)` method on `ConnectionsService`. Developer confirmed this should be done now.

**6. Column type `{ name, type, role }` defined inline in 6+ places with inconsistent `role` typing** — Moderate

`query.types.ts` uses `role: 'dimension' | 'measure'` but `dashboards.types.ts` uses `role: string`. This forces `as any` casts in `DashboardDetailPage.tsx`.

**Fix:** Extract a shared `ColumnDescriptor` type in each package. Quick win.

**7. `connectionId` localStorage key scattered as magic string** — Low

`'connectionId'` literal repeated across `AppShell`, `WorkspacePage`, `SchemaExplorerPage`, and test files. `AppShell` already holds the value in state but children read localStorage independently.

**Fix:** Pass `connectionId` as prop from `AppShell` instead of re-reading localStorage. Quick win.

---

## Temporal Coupling

| File Pair | Co-occurrence | Hidden Dependency |
|-----------|--------------|-------------------|
| `SettingsForm.tsx` ↔ `schema-discovery.service.ts` | 3/7 commits | Feature coupling — backend schema changes force frontend settings changes |
| `schema-discovery.module.ts` ↔ `connections.module.ts` | 3/7 commits | Circular `forwardRef` dependency — both must change when either gains providers |
| `prisma/schema.prisma` → `service.ts` → `SettingsForm.tsx` | 3-file chain | Data model cascade — Prisma changes ripple through service to frontend |
| `query/` directory (14 files in one commit) | High fan-out | `query.types.ts` acts as shared kernel — type changes propagate to all query files |

---

## Validation Notes

1. **TenantDatabasePort location**: Developer confirmed `schema-discovery/` is the correct owning module. The token just needs to move from the service file to the port file.
2. **Circular forwardRef**: Developer chose to leave as-is. Accepted for now.
3. **Tenant DB connect pattern**: Developer confirmed extraction should happen now — add `connectToTenant()` to `ConnectionsService`.

---

[x] Reviewed
