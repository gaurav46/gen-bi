# Spec: Phase 5 Slice 2 -- Interactive Schema Annotation

## Overview

Split the current single-pass `analyzeSchemas` pipeline into two phases: introspection (discover tables/columns/FKs/indexes) and embedding (generate vectors). Between the two, the admin sees ambiguous columns with AI-suggested descriptions, reviews or edits them, and then triggers embedding with descriptions included. This gives the RAG system richer context for natural-language queries against databases with cryptic column names.

## Current Flow (being changed)

```
POST /api/schema/discover  ->  introspect + embed in one pass  ->  done
```

Frontend: schema selection -> single progress bar -> done.

## New Flow

```
POST /api/schema/discover        ->  introspect only  ->  introspected
GET  /api/schema/:connId/annotations  ->  return columns needing review
PATCH /api/schema/:connId/annotations ->  save descriptions
POST /api/schema/:connId/embed   ->  embed with descriptions  ->  done
```

Frontend: schema selection -> introspection progress -> annotation screen -> embedding progress -> done.

## Acceptance Criteria

### Backend: Split Pipeline

- [ ] `POST /api/schema/discover` performs introspection only (discover tables, columns, FKs, indexes and persist to DB) -- it no longer generates embeddings
- [ ] After introspection completes, the status endpoint returns `{ status: 'introspected' }` instead of `done`
- [ ] A new `POST /api/schema/:connectionId/embed` endpoint triggers the embedding phase
- [ ] The embed endpoint reads persisted `DiscoveredColumn` rows (including any saved descriptions) and generates embeddings
- [ ] The embed endpoint updates status through `analyzing` -> `done` the same way the current flow does
- [ ] If embed is called while already embedding, it returns an error (same mutex pattern as current `analyzeSchemas`)

### Backend: Column Descriptions (Prisma + Endpoints)

- [ ] `DiscoveredColumn` model gains a nullable `description` field (new Prisma migration)
- [ ] `GET /api/schema/:connectionId/annotations` returns columns that the AI flagged as ambiguous, each with an AI-suggested description
- [ ] `PATCH /api/schema/:connectionId/annotations` accepts an array of `{ columnId, description }` pairs and persists them to `DiscoveredColumn.description`
- [ ] Columns with clear names (e.g., `email`, `first_name`, `created_at`) are not flagged as ambiguous
- [ ] Columns with cryptic names (e.g., `amt_1`, `col_x`, `flg_yn`, `dt_cr`) are flagged as ambiguous

### Backend: AI Description Suggestion

- [ ] A new port interface (`DescriptionSuggestionPort`) defines the contract for suggesting column descriptions
- [ ] The adapter calls Claude (via existing Anthropic SDK) with table name, column name, data type, and neighboring column context
- [ ] The AI returns a short (one-sentence) business-friendly description per ambiguous column
- [ ] If the AI call fails, the annotation endpoint still returns the ambiguous columns but with empty suggestions (graceful degradation)

### Backend: Embedding Input Includes Descriptions

- [ ] `buildEmbeddingInput` includes the description when present: `"tableName.columnName dataType -- description"`
- [ ] When no description is set, the format stays unchanged: `"tableName.columnName dataType"`

### Frontend: New Status in State Machine

- [ ] `useSchemaAnalysis` gains an `introspected` status between `analyzing` and `done`
- [ ] When polling detects `status: 'introspected'`, the hook transitions to the annotation screen
- [ ] After the admin submits annotations, the hook calls the embed endpoint and transitions to `embedding` status
- [ ] The status flow becomes: idle -> discovering -> ready -> analyzing -> introspected -> embedding -> done | error

### Frontend: Annotation Screen

- [ ] After introspection completes, an annotation screen appears showing ambiguous columns grouped by table
- [ ] Each ambiguous column shows: table name, column name, data type, and the AI-suggested description in an editable text field
- [ ] The admin can accept a suggestion as-is or edit the text
- [ ] Columns with no AI suggestion show an empty text field the admin can optionally fill in
- [ ] A "Continue" button saves all descriptions and triggers embedding
- [ ] A "Skip" option allows the admin to proceed without reviewing any annotations (triggers embedding immediately)
- [ ] If there are zero ambiguous columns, the screen auto-advances to embedding without showing the annotation screen

### Frontend: Progress Screens

- [ ] The introspection phase shows progress using the existing `EmbeddingProgressScreen` pattern (reuse or adapt)
- [ ] The embedding phase shows its own progress indicator after annotations are submitted
- [ ] Error during introspection shows an error with retry (same pattern as current)
- [ ] Error during embedding shows an error with retry that re-triggers embedding only (not re-introspection)

## API Shape

```
# Introspect only (changed -- no longer embeds)
POST /api/schema/discover
  Body: { connectionId, schemas: string[] }
  Response: { tablesDiscovered: number }
  Status progression: idle -> analyzing -> introspected

# Get ambiguous columns with AI suggestions
GET /api/schema/:connectionId/annotations
  Response: {
    columns: [
      {
        columnId: string,
        tableName: string,
        schemaName: string,
        columnName: string,
        dataType: string,
        suggestedDescription: string | null
      }
    ]
  }

# Save column descriptions
PATCH /api/schema/:connectionId/annotations
  Body: { annotations: [{ columnId: string, description: string }] }
  Response: { updated: number }

# Trigger embedding (new)
POST /api/schema/:connectionId/embed
  Response: { status: 'started' }
  Status progression: analyzing -> done

# Status (changed -- new 'introspected' value)
GET /api/schema/discover/status
  Response: { status, current, total, message }
  status: 'idle' | 'analyzing' | 'introspected' | 'done' | 'error'
```

## Out of Scope

- Re-embedding after changing descriptions on already-embedded columns (future slice)
- Admin editing descriptions for non-ambiguous columns from this screen (they can do it later from the schema explorer)
- Bulk import of descriptions from CSV or external source
- Customizing ambiguity detection rules
- Index-aware query hints (Phase 5, future slice)
- Query history sidebar (Phase 5, future slice)

## Technical Context

- **Patterns to follow:** Ports-and-adapters for the new AI description suggestion (same pattern as `EmbeddingPort` and `LlmPort`). New `DescriptionSuggestionPort` + `ClaudeDescriptionAdapter`.
- **Existing Anthropic SDK:** Already used in `packages/backend/src/query/claude.adapter.ts`. Reuse the same SDK setup for the description suggestion adapter.
- **Prisma migration:** Add `description String? @map("description")` to `DiscoveredColumn`. Run `prisma migrate dev`. Never reset the database.
- **Frontend state machine:** Extend `useSchemaAnalysis` hook. Add `introspected` and `embedding` to the `SchemaAnalysisStatus` type. New annotation screen component co-located in `components/settings-form/`.
- **Design system:** Follow DESIGN.md dense patterns -- `text-sm` base, `text-xs` for metadata, `p-3` card padding, `gap-2` between items. Editable text fields use shadcn `Input` component.
- **Key files to modify:**
  - `packages/backend/prisma/schema.prisma` (add description field)
  - `packages/backend/src/schema-discovery/schema-discovery.service.ts` (split pipeline)
  - `packages/backend/src/schema-discovery/schema.controller.ts` (new endpoints)
  - `packages/backend/src/schema-discovery/embedding-input.ts` (include descriptions)
  - `packages/frontend/src/components/settings-form/useSchemaAnalysis.ts` (new statuses)
  - `packages/frontend/src/components/settings-form/SettingsForm.tsx` (new screen routing)
- **Risk level:** MODERATE -- changes a working backend pipeline and frontend flow, adds new AI integration point, but follows existing patterns throughout.

[x] Reviewed
