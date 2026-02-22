# Spec: Phase 5 Slice 1 -- Post-Connection Embedding Progress Screen

## Overview
<!-- -------- bee-comment -------- -->
> **@developer**: we may need to create a sidenav link or subitem in the settings or something because we may want to comeback to this screen later (the step after connection) We may want to reintialize the embeddings. Or see the status of out of sync colums (for later)
> **@bee**: Added an AC under Navigation and State for a dedicated "Schema Intelligence" sidenav item (or sub-item under Settings) that takes the user back to the post-connection screen. This makes the embedding status/re-initialization reachable at any time, not only during the initial connection flow. The actual re-initialization and out-of-sync column features are kept in Out of Scope as future slices.
> - [x] mark as resolved
<!-- -------- /bee-comment -------- -->
After a successful database connection, replace the current immediate-schema-list flow with a dedicated embedding progress screen. The user sees a linear flow: Connect -> schema selection -> embedding progress -> done. This lays the groundwork for Phase 5's interactive schema intelligence by establishing the screen-transition pattern and giving the user real-time visibility into what was previously a hidden background process.

## Current Flow (being changed)

1. User fills in connection form, clicks Connect
2. `ConnectionForm` saves config, calls `onConnected(id)`
3. `SettingsForm` immediately tests connection to discover schemas
4. Schema checkboxes appear inline below the connection form
5. User clicks Analyze, progress text appears as a single line below the checkboxes

## New Flow

1. User fills in connection form, clicks Connect
2. Connection succeeds -> connection form is replaced by a schema selection screen
3. User selects schemas, clicks Analyze
4. Schema selection is replaced by an embedding progress screen showing real-time status
5. Embedding completes -> progress screen shows a completion state with a "Continue" action

## Acceptance Criteria

### Screen Transition: Connection -> Schema Selection
- [x] After a successful connection, the connection form is no longer visible
- [x] A schema selection screen appears showing discovered schema checkboxes
- [ ] The schema selection screen shows the connected database name as context <!-- not implemented: cosmetic, deferred -->
- [x] User can select/deselect schemas to analyze
- [x] Clicking Analyze transitions to the embedding progress screen
- [x] If schema discovery fails, an error message is shown with a way to retry

### Embedding Progress Screen
- [x] The schema selection screen is replaced by the progress screen when analysis starts
- [x] Progress screen shows which table is currently being analyzed (from the existing `message` field in status polling)
- [x] Progress screen shows numeric progress (e.g., "3 of 12 tables")
- [x] Progress screen shows a visual progress indicator (progress bar or stepper reflecting completed/active/pending states from DESIGN.md)
- [x] When embedding generation starts, the progress message updates to reflect that phase
- [x] On completion, the screen shows a success state with a summary (number of tables analyzed)
- [x] On error, the screen shows the error message with a way to retry the analysis

### Navigation and State
- [x] Refreshing the page while analysis is in progress shows the progress screen (not the connection form) by reading current status from the backend
- [x] After completion, user can navigate away and return without re-triggering analysis
- [x] A way to go back to the connection form exists (e.g., "Change connection" link) from any post-connection screen
- [x] The post-connection screen (embedding status) is reachable via a sidenav item or sub-item under Settings, so users can return to it after the initial connection flow

## API Shape

No new backend endpoints needed. The existing endpoints are sufficient:

```
POST /api/connections                    -- save connection config (exists)
POST /api/connections/:id/test           -- test + discover schemas (exists)
POST /api/schema/discover                -- start analysis (exists)
GET  /api/schema/discover/status         -- poll progress (exists)
  Response: { status, current, total, message }
  status: 'idle' | 'analyzing' | 'done' | 'error'
```

Frontend-only changes: replace the single `SettingsForm` component with a multi-screen flow managed by the existing `useSchemaAnalysis` hook's state machine.

## Out of Scope

- Interactive schema annotation questions (Phase 5, future slice)
- AI-suggested business-friendly column names (Phase 5, future slice)
- Re-embedding after description changes (Phase 5, future slice)
- Index-aware query hints (Phase 5, future slice)
- Query history sidebar (Phase 5, future slice)
- Horizontal stepper across the full settings page (can be added later when more Phase 5 screens exist)
- Backend changes to the progress tracking format
- Re-initialization of embeddings (future slice — the sidenav item provides the entry point for this later)
- Out-of-sync column detection (future slice)

## Technical Context

- **Patterns to follow:** The `useSchemaAnalysis` hook already has a state machine (`idle -> discovering -> ready -> analyzing -> done | error`). The screen transitions map directly to these states. Use this hook as the orchestrator.
- **Component structure:** Split `SettingsForm` into separate screen components (one per state), composed by a parent that switches based on `status`. Follow the existing co-located file convention under `components/settings-form/`.
- **Design system:** Use the Progress/Status Patterns from DESIGN.md -- horizontal stepper with completed/active/pending/error states. Use `text-sm` base, `text-xs` for metadata. Use Skeleton for loading states if needed.
- **Existing shadcn/ui components:** Button, Card, Checkbox, Label, Badge, Skeleton are already installed. Progress bar may need `npx shadcn@latest add progress` if not present.
- **Key dependency:** `useSchemaAnalysis.ts` hook -- extend its state machine as needed but preserve backward compatibility with existing status values.
- **Risk level:** MODERATE -- user-facing change to a core flow, but no backend changes and the state machine already exists.

[x] Reviewed
