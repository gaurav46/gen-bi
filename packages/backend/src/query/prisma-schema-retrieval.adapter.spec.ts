import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaSchemaRetrievalAdapter } from './prisma-schema-retrieval.adapter';

describe('PrismaSchemaRetrievalAdapter', () => {
  let adapter: PrismaSchemaRetrievalAdapter;
  let prisma: { $queryRaw: ReturnType<typeof vi.fn>; columnEmbedding: { count: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    prisma = {
      $queryRaw: vi.fn(),
      columnEmbedding: {
        count: vi.fn(),
      },
    };
    adapter = new PrismaSchemaRetrievalAdapter(prisma as never);
  });

  describe('findRelevantColumns', () => {
    it('retrieves top-k columns by cosine similarity', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          table_name: 'users',
          column_name: 'name',
          data_type: 'varchar',
          fk_table: null,
          fk_column: null,
        },
        {
          table_name: 'orders',
          column_name: 'total',
          data_type: 'numeric',
          fk_table: null,
          fk_column: null,
        },
      ]);

      const result = await adapter.findRelevantColumns('conn-1', [0.1, 0.2], 20);

      expect(result).toEqual([
        { tableName: 'users', columnName: 'name', dataType: 'varchar' },
        { tableName: 'orders', columnName: 'total', dataType: 'numeric' },
      ]);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('includes foreign key info when present', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          table_name: 'orders',
          column_name: 'user_id',
          data_type: 'int4',
          fk_table: 'users',
          fk_column: 'id',
        },
      ]);

      const result = await adapter.findRelevantColumns('conn-1', [0.1], 10);

      expect(result).toEqual([
        {
          tableName: 'orders',
          columnName: 'user_id',
          dataType: 'int4',
          foreignKey: { table: 'users', column: 'id' },
        },
      ]);
    });
  });

  describe('hasEmbeddings', () => {
    it('returns true when embeddings exist for connection', async () => {
      prisma.columnEmbedding.count.mockResolvedValue(5);
      expect(await adapter.hasEmbeddings('conn-1')).toBe(true);
    });

    it('returns false when no embeddings exist', async () => {
      prisma.columnEmbedding.count.mockResolvedValue(0);
      expect(await adapter.hasEmbeddings('conn-1')).toBe(false);
    });
  });
});
