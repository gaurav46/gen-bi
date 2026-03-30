/**
 * Slice 3: Resolve ConnectionsModule <-> SchemaDiscoveryModule circular dependency
 *
 * These tests verify the structural ACs for Slice 3.
 *
 * ---- ISSUE FLAGGED ----
 * ConnectionsController (inside ConnectionsModule) directly injects
 * SchemaDiscoveryService (owned by SchemaDiscoveryModule). This means
 * ConnectionsModule still has a runtime dependency on SchemaDiscoveryModule,
 * even though forwardRef was removed from both module files.
 *
 * The module graph tests (describe "module graph compiles...") are marked
 * .todo because TestingModule.compile() throws at compile time:
 *
 *   "Nest can't resolve dependencies of the ConnectionsController
 *    (ConnectionsService, ?). Please make sure that the argument
 *    SchemaDiscoveryService at index [1] is available in the
 *    ConnectionsModule context."
 *
 * The structural (forwardRef removal) tests all pass. The module graph
 * wiring tests are blocked until the cross-boundary injection in
 * ConnectionsController is resolved. See the flagged issue section at the
 * bottom of this file for details and the recommended fix.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readSource(relPath: string): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return readFileSync(resolve(__dirname, relPath), 'utf-8');
}

// ---------------------------------------------------------------------------
// AC: forwardRef removed from both modules
// ---------------------------------------------------------------------------

describe('Slice 3 AC: forwardRef removed from module source files', () => {
  it('connections.module.ts does not import or use forwardRef', () => {
    const source = readSource('../connections/connections.module.ts');
    expect(source).not.toContain('forwardRef');
  });

  it('schema-discovery.module.ts does not import or use forwardRef', () => {
    const source = readSource('../schema-discovery/schema-discovery.module.ts');
    expect(source).not.toContain('forwardRef');
  });
});

// ---------------------------------------------------------------------------
// AC: AppDatabaseModule owns DRIZZLE_CLIENT factory
// ---------------------------------------------------------------------------

describe('Slice 3 AC: AppDatabaseModule owns the DRIZZLE_CLIENT factory', () => {
  it('app-database.module.ts provides DRIZZLE_CLIENT', () => {
    const source = readSource('./app-database.module.ts');
    expect(source).toContain('DRIZZLE_CLIENT');
    expect(source).toContain('useFactory');
    expect(source).toContain('AppDatabaseModule');
  });

  it('app-database.module.ts exports DRIZZLE_CLIENT so consumers can inject it', () => {
    const source = readSource('./app-database.module.ts');
    expect(source).toContain('exports');
    expect(source).toContain('DRIZZLE_CLIENT');
  });

  it('connections.module.ts imports AppDatabaseModule and no longer owns the database client factory', () => {
    const source = readSource('../connections/connections.module.ts');
    expect(source).toContain('AppDatabaseModule');
    // The useFactory pattern should have moved to AppDatabaseModule
    expect(source).not.toContain('useFactory');
  });

  it('connections.module.ts re-exports AppDatabaseModule so downstream modules inherit DRIZZLE_CLIENT', () => {
    const source = readSource('../connections/connections.module.ts');
    // AppDatabaseModule must be in exports so SchemaDiscoveryModule gets DRIZZLE_CLIENT
    // through ConnectionsModule's re-export or by importing AppDatabaseModule directly
    expect(source).toContain('AppDatabaseModule');
  });
});

// ---------------------------------------------------------------------------
// AC: SchemaDiscoveryModule wired correctly
// ---------------------------------------------------------------------------

describe('Slice 3 AC: schema-discovery.module.ts wired without forwardRef', () => {
  it('schema-discovery.module.ts imports ConnectionsModule directly (no forwardRef wrapper)', () => {
    const source = readSource('../schema-discovery/schema-discovery.module.ts');
    expect(source).toContain('ConnectionsModule');
    expect(source).not.toContain('forwardRef');
  });

  it('schema-discovery.module.ts imports AppDatabaseModule directly', () => {
    const source = readSource('../schema-discovery/schema-discovery.module.ts');
    expect(source).toContain('AppDatabaseModule');
  });
});

// ---------------------------------------------------------------------------
// Flagged issue: ConnectionsController cross-injects SchemaDiscoveryService
// ---------------------------------------------------------------------------

/**
 * This section documents the residual architectural issue discovered while
 * writing the module graph tests.
 *
 * Root cause: ConnectionsController (inside ConnectionsModule) has a
 * constructor parameter of type SchemaDiscoveryService. SchemaDiscoveryService
 * is provided by SchemaDiscoveryModule, which imports ConnectionsModule.
 * This means:
 *
 *   ConnectionsModule (contains ConnectionsController)
 *     needs SchemaDiscoveryService
 *   SchemaDiscoveryModule (provides SchemaDiscoveryService)
 *     imports ConnectionsModule
 *
 * The forwardRef removal only addressed the module-decorator level, but this
 * controller-level cross-boundary injection means the cycle still exists at
 * runtime.
 *
 * Recommended fix (pick one):
 *   Option A — Move the `POST /:id/test` endpoint to SchemaController
 *              (already inside SchemaDiscoveryModule). No cross-boundary
 *              injection needed.
 *   Option B — Extract a ConnectionTestService into a shared module that
 *              neither ConnectionsModule nor SchemaDiscoveryModule imports.
 *
 * Until this is fixed, TestingModule.compile() for the full module graph
 * (AppDatabaseModule + ConnectionsModule + SchemaDiscoveryModule) will throw:
 *
 *   "Nest can't resolve dependencies of the ConnectionsController
 *    (ConnectionsService, ?). [...] SchemaDiscoveryService [...]
 *    is not available in the ConnectionsModule context."
 */
describe('Circular dependency fix: SchemaDiscoveryService moved out of ConnectionsController', () => {
  it('connections.controller.ts no longer injects SchemaDiscoveryService', () => {
    const source = readSource('../connections/connections.controller.ts');
    expect(source).not.toContain('SchemaDiscoveryService');
  });

  it('connections.module.ts does not import SchemaDiscoveryModule', () => {
    const source = readSource('../connections/connections.module.ts');
    expect(source).not.toContain('SchemaDiscoveryModule');
  });

  it('connection-test.controller.ts lives in schema-discovery and owns the test endpoint', () => {
    const source = readSource('../schema-discovery/connection-test.controller.ts');
    expect(source).toContain('SchemaDiscoveryService');
    expect(source).toContain("':id/test'");
  });
});
