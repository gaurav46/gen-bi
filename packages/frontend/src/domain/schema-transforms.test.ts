import { describe, it, expect } from 'vitest';
import { enrichColumnsForDisplay, groupTablesBySchema, filterTablesByName } from './schema-transforms';
import type { DiscoveredTable } from './schema-types';

describe('enrichColumnsForDisplay', () => {
  it('enriches columns with FK and index info', () => {
    const columns = [
      { columnName: 'id', dataType: 'int4', isNullable: false, ordinalPosition: 1 },
      { columnName: 'user_id', dataType: 'int4', isNullable: false, ordinalPosition: 2 },
      { columnName: 'name', dataType: 'varchar', isNullable: true, ordinalPosition: 3 },
    ];
    const foreignKeys = [
      { columnName: 'user_id', foreignTableSchema: 'public', foreignTableName: 'users', foreignColumnName: 'id', constraintName: 'fk_user' },
    ];
    const indexes = [
      { indexName: 'orders_pkey', columnName: 'id', isUnique: true },
    ];

    const result = enrichColumnsForDisplay(columns, foreignKeys, indexes);

    expect(result[0].indexType).toBe('PK');
    expect(result[0].foreignKey).toBeNull();
    expect(result[1].foreignKey).toEqual({ tableName: 'users', columnName: 'id' });
    expect(result[1].indexType).toBeNull();
    expect(result[2].foreignKey).toBeNull();
    expect(result[2].indexType).toBeNull();
  });

  it('distinguishes PK from UQ indexes', () => {
    const columns = [
      { columnName: 'id', dataType: 'int4', isNullable: false, ordinalPosition: 1 },
      { columnName: 'email', dataType: 'varchar', isNullable: false, ordinalPosition: 2 },
    ];
    const indexes = [
      { indexName: 'users_pkey', columnName: 'id', isUnique: true },
      { indexName: 'users_email_key', columnName: 'email', isUnique: true },
    ];

    const result = enrichColumnsForDisplay(columns, [], indexes);

    expect(result[0].indexType).toBe('PK');
    expect(result[1].indexType).toBe('UQ');
  });
});

describe('groupTablesBySchema', () => {
  it('groups tables by schema name', () => {
    const tables: DiscoveredTable[] = [
      { id: '1', connectionId: 'c1', schemaName: 'public', tableName: 'users', columns: [], foreignKeys: [], indexes: [] },
      { id: '2', connectionId: 'c1', schemaName: 'sales', tableName: 'orders', columns: [], foreignKeys: [], indexes: [] },
      { id: '3', connectionId: 'c1', schemaName: 'public', tableName: 'products', columns: [], foreignKeys: [], indexes: [] },
    ];

    const result = groupTablesBySchema(tables);

    expect(result.get('public')?.length).toBe(2);
    expect(result.get('sales')?.length).toBe(1);
  });
});

describe('filterTablesByName', () => {
  const tables: DiscoveredTable[] = [
    { id: '1', connectionId: 'c1', schemaName: 'public', tableName: 'users', columns: [], foreignKeys: [], indexes: [] },
    { id: '2', connectionId: 'c1', schemaName: 'public', tableName: 'orders', columns: [], foreignKeys: [], indexes: [] },
    { id: '3', connectionId: 'c1', schemaName: 'public', tableName: 'user_roles', columns: [], foreignKeys: [], indexes: [] },
  ];

  it('filters tables by name case-insensitively', () => {
    const result = filterTablesByName(tables, 'USER');
    expect(result.length).toBe(2);
    expect(result.map((t) => t.tableName)).toEqual(['users', 'user_roles']);
  });

  it('returns all tables when search is empty', () => {
    expect(filterTablesByName(tables, '').length).toBe(3);
    expect(filterTablesByName(tables, '  ').length).toBe(3);
  });
});
