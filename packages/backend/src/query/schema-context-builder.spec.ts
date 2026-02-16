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

  it('includes sample rows below column listing when provided', () => {
    const columns: RelevantColumn[] = [
      { tableName: 'users', columnName: 'name', dataType: 'varchar' },
      { tableName: 'users', columnName: 'age', dataType: 'int4' },
    ];
    const sampleRows = new Map([
      ['users', [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ]],
    ]);

    const result = buildSchemaContext(columns, sampleRows);

    expect(result).toContain('Alice');
    expect(result).toContain('Bob');
    expect(result).toContain('30');
    expect(result).toContain('25');
    expect(result).toContain('Sample rows');
  });

  it('shows columns only for tables with no sample rows', () => {
    const columns: RelevantColumn[] = [
      { tableName: 'users', columnName: 'name', dataType: 'varchar' },
      { tableName: 'orders', columnName: 'total', dataType: 'numeric' },
    ];
    const sampleRows = new Map([
      ['users', [{ name: 'Alice' }]],
    ]);

    const result = buildSchemaContext(columns, sampleRows);

    expect(result).toContain('Alice');
    const lines = result.split('\n');
    const ordersIndex = lines.findIndex(l => l.includes('Table: orders'));
    const afterOrders = lines.slice(ordersIndex);
    expect(afterOrders.join('\n')).not.toContain('Sample rows');
  });

  it('omitting sample rows parameter produces same output as before', () => {
    const columns: RelevantColumn[] = [
      { tableName: 'users', columnName: 'name', dataType: 'varchar' },
    ];

    const withoutParam = buildSchemaContext(columns);
    const withEmptyMap = buildSchemaContext(columns, new Map());

    expect(withoutParam).toBe(withEmptyMap);
    expect(withoutParam).not.toContain('Sample rows');
  });
});
