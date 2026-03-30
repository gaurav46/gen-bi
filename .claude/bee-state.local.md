---
feature: "DuckDB + SQL Server support"
size: "EPIC"
risk: "HIGH"
discovery: "docs/specs/duckdb-sqlserver-discovery.md"
design_brief: ""
boundaries: ""
current_phase: "Phase 3 spec written — awaiting review"
phase_spec: "docs/specs/duckdb-sqlserver-phase-3-spec.md — pending review"
architecture: "hexagonal; pgTable+FLOAT[1536] customType; DrizzleClientFactory; DRIZZLE_CLIENT token; migrate-at-startup for DuckDB; no repo layer; TenantDatabaseDispatcher for SQL Server"
tdd_plan: "not yet written"
current_slice: "n/a — spec under review"
---

# Bee State

## Feature
DuckDB + SQL Server support

## Triage
Size: EPIC
Risk: HIGH

## Discovery
docs/specs/duckdb-sqlserver-discovery.md

## Current Phase
architecture decided

## Phase Spec
docs/specs/duckdb-sqlserver-phase-2-spec.md — confirmed

## Architecture
hexagonal; pgTable+FLOAT[1536] customType; DrizzleClientFactory; DRIZZLE_CLIENT token; migrate-at-startup for DuckDB; no repo layer

## Current Slice
n/a — Phase 3 spec under review

## TDD Plan
not yet written

## Phase Progress
Phase 2: complete (7/7 slices, 279 tests passing)
Phase 3: spec written, awaiting review

## Slice Progress
Phase 2 — all done
Phase 3 — pending
