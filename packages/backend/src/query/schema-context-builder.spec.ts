import { describe, expect, it } from 'vitest';
import { buildSchemaContext } from './schema-context-builder';
import type { RelevantColumn } from './schema-retrieval.port';

describe('buildSchemaContext', () => {
  it('builds context string with table, column, and type', () => {
    const columns: RelevantColumn[] = [
      { tableName: 'users', columnName: 'id', dataType: 'int4' },
    ];
    const result = buildSchemaContext(columns);
    expect(result).toContain('users');
    expect(result).toContain('id');
    expect(result).toContain('int4');
  });

  it('groups columns by table', () => {
    const columns: RelevantColumn[] = [
      { tableName: 'users', columnName: 'id', dataType: 'int4' },
      { tableName: 'users', columnName: 'name', dataType: 'varchar' },
    ];
    const result = buildSchemaContext(columns);
    const tableMatches = result.match(/users/g);
    expect(tableMatches).toBeTruthy();
    expect(result).toContain('id');
    expect(result).toContain('name');
  });

  it('includes foreign key info when present', () => {
    const columns: RelevantColumn[] = [
      {
        tableName: 'orders',
        columnName: 'user_id',
        dataType: 'int4',
        foreignKey: { table: 'users', column: 'id' },
      },
    ];
    const result = buildSchemaContext(columns);
    expect(result).toContain('users.id');
  });

  it('handles columns from multiple tables', () => {
    const columns: RelevantColumn[] = [
      { tableName: 'users', columnName: 'name', dataType: 'varchar' },
      { tableName: 'orders', columnName: 'total', dataType: 'numeric' },
    ];
    const result = buildSchemaContext(columns);
    expect(result).toContain('users');
    expect(result).toContain('orders');
  });

  it('returns empty string for empty input', () => {
    expect(buildSchemaContext([])).toBe('');
  });
});
