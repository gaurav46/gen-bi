import { describe, expect, it } from 'vitest';
import { calculateOffset, buildRowsQuery, buildCountQuery, buildPrimaryKeyQuery } from './pagination';

describe('calculateOffset', () => {
  it('returns 0 for page 1 with pageSize 25', () => {
    expect(calculateOffset(1, 25)).toBe(0);
  });

  it('returns 25 for page 2 with pageSize 25', () => {
    expect(calculateOffset(2, 25)).toBe(25);
  });

  it('returns 50 for page 3 with pageSize 25', () => {
    expect(calculateOffset(3, 25)).toBe(50);
  });
});

describe('buildRowsQuery', () => {
  it('quotes schema and table names', () => {
    const sql = buildRowsQuery('mySchema', 'myTable');
    expect(sql).toContain('"mySchema"."myTable"');
  });

  it('uses $1 and $2 placeholders for LIMIT and OFFSET', () => {
    const sql = buildRowsQuery('public', 'users');
    expect(sql).toContain('LIMIT $1 OFFSET $2');
    expect(sql).not.toMatch(/LIMIT \d/);
  });
});

describe('buildCountQuery', () => {
  it('quotes schema and table names', () => {
    const sql = buildCountQuery('mySchema', 'myTable');
    expect(sql).toBe('SELECT count(*) FROM "mySchema"."myTable"');
  });
});

describe('buildPrimaryKeyQuery', () => {
  it('uses parameterized schema and table name', () => {
    const sql = buildPrimaryKeyQuery();
    expect(sql).toContain('information_schema.table_constraints');
    expect(sql).toContain('key_column_usage');
    expect(sql).toContain('$1');
    expect(sql).toContain('$2');
  });
});
