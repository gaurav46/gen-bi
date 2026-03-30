import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DrizzleSchemaRetrievalAdapter } from './drizzle-schema-retrieval.adapter';
import { DRIZZLE_CLIENT } from '../infrastructure/drizzle/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Flatten a Drizzle SQL object's queryChunks into a single string so we can
 * make readable assertions about the SQL content without running a database.
 *
 * Each chunk is one of:
 *   { value: string[] }          — raw SQL text
 *   { name: string }             — column reference
 *   SQL object (nested)          — recursive (e.g. sql.raw())
 *   primitive / array            — bound parameter value
 */
function drizzleSqlToString(sqlObj: unknown): string {
  if (!sqlObj || typeof sqlObj !== 'object') {
    return String(sqlObj ?? '');
  }

  const obj = sqlObj as Record<string, unknown>;

  if (Array.isArray(obj)) {
    return obj.map(drizzleSqlToString).join(', ');
  }

  if ('queryChunks' in obj && Array.isArray(obj.queryChunks)) {
    return (obj.queryChunks as unknown[]).map(drizzleSqlToString).join('');
  }

  if ('value' in obj && Array.isArray(obj.value)) {
    return (obj.value as string[]).join('');
  }

  if ('name' in obj) {
    return String(obj.name);
  }

  return '';
}

// ---------------------------------------------------------------------------
// Mock db builder — captures orderBy argument and innerJoin arguments
// ---------------------------------------------------------------------------

type CapturedJoinArgs = { condition: unknown }[];
type CapturedCall = {
  orderByArg: unknown;
  innerJoinArgs: CapturedJoinArgs;
  resolvedValue: unknown[];
};

function buildMockDb(resolvedValue: unknown[]) {
  const captured: CapturedCall = {
    orderByArg: null,
    innerJoinArgs: [],
    resolvedValue,
  };

  const limitMock = vi.fn().mockResolvedValue(resolvedValue);
  const orderByMock = vi.fn().mockImplementation((arg: unknown) => {
    captured.orderByArg = arg;
    return { limit: limitMock };
  });
  const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
  const innerJoinMock = vi.fn().mockImplementation((_table: unknown, condition: unknown) => {
    captured.innerJoinArgs.push({ condition });
    // Return self so chained .innerJoin() calls work
    return {
      innerJoin: innerJoinMock,
      where: whereMock,
    };
  });
  const fromMock = vi.fn().mockReturnValue({
    innerJoin: innerJoinMock,
    where: whereMock,
  });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });

  const db = { select: selectMock };
  return { db, captured };
}

// ---------------------------------------------------------------------------
// Descriptive tests
// ---------------------------------------------------------------------------

describe('DrizzleSchemaRetrievalAdapter', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // -------------------------------------------------------------------------
  // findRelevantColumns — join correctness
  // -------------------------------------------------------------------------

  describe('findRelevantColumns — joins use UUID columns (not name columns)', () => {
    it('joins column_embeddings to discovered_tables on table_id = id (UUID join)', async () => {
      const { db, captured } = buildMockDb([]);
      const adapter = new DrizzleSchemaRetrievalAdapter(db as never);

      await adapter.findRelevantColumns('conn-1', [0.1, 0.2], 10);

      expect(captured.innerJoinArgs).toHaveLength(2);

      const tableJoinCondition = captured.innerJoinArgs[0].condition;
      const tableJoinSql = drizzleSqlToString(tableJoinCondition);

      // Guard: ensure serialization produced non-empty output before content assertions
      expect(tableJoinSql.length).toBeGreaterThan(0);
      // Must reference 'table_id' and 'id', not table_name or any name comparison
      expect(tableJoinSql).toContain('table_id');
      expect(tableJoinSql).toContain('id');
      expect(tableJoinSql).not.toContain('table_name');
    });

    it('joins column_embeddings to discovered_columns on column_id = id (UUID join)', async () => {
      const { db, captured } = buildMockDb([]);
      const adapter = new DrizzleSchemaRetrievalAdapter(db as never);

      await adapter.findRelevantColumns('conn-1', [0.1, 0.2], 10);

      expect(captured.innerJoinArgs).toHaveLength(2);

      const columnJoinCondition = captured.innerJoinArgs[1].condition;
      const columnJoinSql = drizzleSqlToString(columnJoinCondition);

      expect(columnJoinSql.length).toBeGreaterThan(0);
      // Must reference 'column_id' and 'id', not column_name
      expect(columnJoinSql).toContain('column_id');
      expect(columnJoinSql).toContain('id');
      expect(columnJoinSql).not.toContain('column_name');
    });

    it('does not use name-to-UUID comparison in either join (the original bug)', async () => {
      const { db, captured } = buildMockDb([]);
      const adapter = new DrizzleSchemaRetrievalAdapter(db as never);

      await adapter.findRelevantColumns('conn-1', [0.5], 5);

      for (const { condition } of captured.innerJoinArgs) {
        const conditionSql = drizzleSqlToString(condition);
        expect(conditionSql.length).toBeGreaterThan(0);
        // The old bug compared table_name = ce.table_id and column_name = ce.column_id
        // Neither join should contain 'table_name' or 'column_name' on either side
        expect(conditionSql).not.toMatch(/table_name/);
        expect(conditionSql).not.toMatch(/column_name/);
      }
    });
  });

  // -------------------------------------------------------------------------
  // findRelevantColumns — DuckDB vector search
  // -------------------------------------------------------------------------

  describe('findRelevantColumns — DuckDB path uses array_cosine_similarity', () => {
    it('uses array_cosine_similarity when DATABASE_ENGINE=duckdb', async () => {
      vi.stubEnv('DATABASE_ENGINE', 'duckdb');
      const { db, captured } = buildMockDb([]);
      const adapter = new DrizzleSchemaRetrievalAdapter(db as never);

      await adapter.findRelevantColumns('conn-1', [0.1, 0.2], 10);

      const orderBySql = drizzleSqlToString(captured.orderByArg);
      expect(orderBySql.length).toBeGreaterThan(0);
      expect(orderBySql).toContain('array_cosine_similarity');
    });

    it('does not use <=> operator when DATABASE_ENGINE=duckdb', async () => {
      vi.stubEnv('DATABASE_ENGINE', 'duckdb');
      const { db, captured } = buildMockDb([]);
      const adapter = new DrizzleSchemaRetrievalAdapter(db as never);

      await adapter.findRelevantColumns('conn-1', [0.1, 0.2], 10);

      const orderBySql = drizzleSqlToString(captured.orderByArg);
      expect(orderBySql.length).toBeGreaterThan(0);
      expect(orderBySql).not.toContain('<=>');
    });

    it('does not use ::vector cast when DATABASE_ENGINE=duckdb', async () => {
      vi.stubEnv('DATABASE_ENGINE', 'duckdb');
      const { db, captured } = buildMockDb([]);
      const adapter = new DrizzleSchemaRetrievalAdapter(db as never);

      await adapter.findRelevantColumns('conn-1', [0.1, 0.2], 10);

      const orderBySql = drizzleSqlToString(captured.orderByArg);
      expect(orderBySql.length).toBeGreaterThan(0);
      expect(orderBySql).not.toContain('::vector');
    });

    it('defaults to duckdb path when DATABASE_ENGINE is not set', async () => {
      // Delete the env var so process.env.DATABASE_ENGINE is undefined.
      // The production code uses ?? so only undefined/null triggers the default,
      // not an empty string — we must use delete, not stub to ''.
      delete process.env.DATABASE_ENGINE;
      const { db, captured } = buildMockDb([]);
      const adapter = new DrizzleSchemaRetrievalAdapter(db as never);

      await adapter.findRelevantColumns('conn-1', [0.1], 10);

      const orderBySql = drizzleSqlToString(captured.orderByArg);
      expect(orderBySql.length).toBeGreaterThan(0);
      expect(orderBySql).toContain('array_cosine_similarity');
    });
  });

  // -------------------------------------------------------------------------
  // findRelevantColumns — PostgreSQL vector search
  // -------------------------------------------------------------------------

  describe('findRelevantColumns — PostgreSQL path uses <=> with ::vector cast', () => {
    it('uses <=> operator when DATABASE_ENGINE=postgres', async () => {
      vi.stubEnv('DATABASE_ENGINE', 'postgres');
      const { db, captured } = buildMockDb([]);
      const adapter = new DrizzleSchemaRetrievalAdapter(db as never);

      await adapter.findRelevantColumns('conn-1', [0.1, 0.2], 10);

      const orderBySql = drizzleSqlToString(captured.orderByArg);
      expect(orderBySql.length).toBeGreaterThan(0);
      expect(orderBySql).toContain('<=>');
    });

    it('uses ::vector cast when DATABASE_ENGINE=postgres', async () => {
      vi.stubEnv('DATABASE_ENGINE', 'postgres');
      const { db, captured } = buildMockDb([]);
      const adapter = new DrizzleSchemaRetrievalAdapter(db as never);

      await adapter.findRelevantColumns('conn-1', [0.1, 0.2], 10);

      const orderBySql = drizzleSqlToString(captured.orderByArg);
      expect(orderBySql.length).toBeGreaterThan(0);
      expect(orderBySql).toContain('::vector');
    });

    it('does not use array_cosine_similarity when DATABASE_ENGINE=postgres', async () => {
      vi.stubEnv('DATABASE_ENGINE', 'postgres');
      const { db, captured } = buildMockDb([]);
      const adapter = new DrizzleSchemaRetrievalAdapter(db as never);

      await adapter.findRelevantColumns('conn-1', [0.1, 0.2], 10);

      const orderBySql = drizzleSqlToString(captured.orderByArg);
      expect(orderBySql.length).toBeGreaterThan(0);
      expect(orderBySql).not.toContain('array_cosine_similarity');
    });
  });

  // -------------------------------------------------------------------------
  // findRelevantColumns — return shape
  // -------------------------------------------------------------------------

  describe('findRelevantColumns — return shape', () => {
    it('maps raw DB rows to RelevantColumn shape with tableName, columnName, dataType', async () => {
      const rawRows = [
        {
          table_name: 'orders',
          schema_name: 'public',
          column_name: 'total',
          data_type: 'numeric',
        },
        {
          table_name: 'users',
          schema_name: 'public',
          column_name: 'email',
          data_type: 'text',
        },
      ];

      const { db } = buildMockDb(rawRows);
      const adapter = new DrizzleSchemaRetrievalAdapter(db as never);

      const result = await adapter.findRelevantColumns('conn-1', [0.1], 5);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        tableName: 'orders',
        columnName: 'total',
        dataType: 'numeric',
      });
      expect(result[1]).toMatchObject({
        tableName: 'users',
        columnName: 'email',
        dataType: 'text',
      });
    });

    it('returns an empty array when no rows match', async () => {
      const { db } = buildMockDb([]);
      const adapter = new DrizzleSchemaRetrievalAdapter(db as never);

      const result = await adapter.findRelevantColumns('conn-1', [0.1], 10);

      expect(result).toEqual([]);
    });

    it('result objects do not expose raw snake_case DB fields', async () => {
      const rawRows = [
        {
          table_name: 'orders',
          schema_name: 'public',
          column_name: 'total',
          data_type: 'numeric',
        },
      ];

      const { db } = buildMockDb(rawRows);
      const adapter = new DrizzleSchemaRetrievalAdapter(db as never);

      const result = await adapter.findRelevantColumns('conn-1', [0.1], 5);

      expect(result[0]).not.toHaveProperty('table_name');
      expect(result[0]).not.toHaveProperty('column_name');
      expect(result[0]).not.toHaveProperty('data_type');
      expect(result[0]).not.toHaveProperty('schema_name');
    });

    it('respects the topK limit by passing it to the query builder', async () => {
      const { db, captured } = buildMockDb([]);

      // Replace limitMock to capture the argument
      let capturedTopK: unknown;
      const limitSpy = vi.fn().mockImplementation((k: unknown) => {
        capturedTopK = k;
        return Promise.resolve([]);
      });

      // Rebuild mock with limit spy
      const innerJoinCaptures: unknown[] = [];
      const innerJoinMock2: ReturnType<typeof vi.fn> = vi.fn().mockImplementation(
        (_table: unknown, condition: unknown) => {
          innerJoinCaptures.push(condition);
          return { innerJoin: innerJoinMock2, where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockReturnValue({ limit: limitSpy }) }) };
        },
      );
      const dbWithLimit = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({ innerJoin: innerJoinMock2 }),
        }),
      };
      const adapterWithLimit = new DrizzleSchemaRetrievalAdapter(dbWithLimit as never);

      await adapterWithLimit.findRelevantColumns('conn-1', [0.1], 42);

      expect(limitSpy).toHaveBeenCalledWith(42);
    });
  });

  // -------------------------------------------------------------------------
  // hasEmbeddings
  // -------------------------------------------------------------------------

  describe('hasEmbeddings', () => {
    function buildCountMockDb(total: number) {
      const whereMock = vi.fn().mockResolvedValue([{ total }]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });
      return { select: selectMock };
    }

    it('returns false when count is 0', async () => {
      const db = buildCountMockDb(0);
      const adapter = new DrizzleSchemaRetrievalAdapter(db as never);

      const result = await adapter.hasEmbeddings('conn-1');

      expect(result).toBe(false);
    });

    it('returns true when count is 1', async () => {
      const db = buildCountMockDb(1);
      const adapter = new DrizzleSchemaRetrievalAdapter(db as never);

      const result = await adapter.hasEmbeddings('conn-1');

      expect(result).toBe(true);
    });

    it('returns true when count is greater than 1', async () => {
      const db = buildCountMockDb(100);
      const adapter = new DrizzleSchemaRetrievalAdapter(db as never);

      const result = await adapter.hasEmbeddings('conn-1');

      expect(result).toBe(true);
    });

    it('returns false when the query result is an empty array', async () => {
      const whereMock = vi.fn().mockResolvedValue([]);
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const selectMock = vi.fn().mockReturnValue({ from: fromMock });
      const db = { select: selectMock };
      const adapter = new DrizzleSchemaRetrievalAdapter(db as never);

      const result = await adapter.hasEmbeddings('conn-1');

      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // NestJS DI wiring
  // -------------------------------------------------------------------------

  describe('NestJS injection', () => {
    it('can be instantiated via NestJS testing module with DRIZZLE_CLIENT token', async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 0 }]),
          }),
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DrizzleSchemaRetrievalAdapter,
          { provide: DRIZZLE_CLIENT, useValue: mockDb },
        ],
      }).compile();

      const adapter = module.get(DrizzleSchemaRetrievalAdapter);
      expect(adapter).toBeInstanceOf(DrizzleSchemaRetrievalAdapter);
    });
  });
});
