import { describe, expect, it } from 'vitest';
import { validateSelectOnly, validateTableReferences } from './sql-validator';

describe('validateSelectOnly', () => {
  it('accepts a simple SELECT query', () => {
    expect(validateSelectOnly('SELECT * FROM users')).toEqual({ valid: true });
  });

  it('accepts SELECT with JOIN, WHERE, GROUP BY, ORDER BY, LIMIT', () => {
    const sql = `SELECT u.name, COUNT(o.id) FROM users u
      JOIN orders o ON u.id = o.user_id
      WHERE u.active = true
      GROUP BY u.name
      ORDER BY COUNT(o.id) DESC
      LIMIT 10`;
    expect(validateSelectOnly(sql)).toEqual({ valid: true });
  });

  it('accepts SELECT with subqueries', () => {
    const sql = 'SELECT * FROM users WHERE id IN (SELECT user_id FROM orders)';
    expect(validateSelectOnly(sql)).toEqual({ valid: true });
  });

  it('rejects INSERT statement', () => {
    const result = validateSelectOnly('INSERT INTO users (name) VALUES (\'test\')');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('INSERT');
  });

  it('rejects UPDATE statement', () => {
    const result = validateSelectOnly('UPDATE users SET name = \'test\'');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('UPDATE');
  });

  it('rejects DELETE statement', () => {
    const result = validateSelectOnly('DELETE FROM users WHERE id = 1');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('DELETE');
  });

  it('rejects DROP statement', () => {
    const result = validateSelectOnly('DROP TABLE users');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('DROP');
  });

  it('rejects ALTER statement', () => {
    const result = validateSelectOnly('ALTER TABLE users ADD COLUMN age INT');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('ALTER');
  });

  it('rejects TRUNCATE statement', () => {
    const result = validateSelectOnly('TRUNCATE TABLE users');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('TRUNCATE');
  });

  it('rejects CREATE statement', () => {
    const result = validateSelectOnly('CREATE TABLE users (id INT)');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('CREATE');
  });

  it('rejects SELECT with semicolon followed by DROP (injection attempt)', () => {
    const result = validateSelectOnly('SELECT * FROM users; DROP TABLE users');
    expect(result.valid).toBe(false);
  });

  it('rejects case-insensitive variations (DeLeTe, drop)', () => {
    expect(validateSelectOnly('DeLeTe FROM users').valid).toBe(false);
    expect(validateSelectOnly('drop table users').valid).toBe(false);
  });

  it('rejects SQL with comments hiding mutations (-- DROP)', () => {
    const result = validateSelectOnly('SELECT * FROM users\n-- )\nDROP TABLE users');
    expect(result.valid).toBe(false);
  });
});

describe('validateTableReferences', () => {
  const knownSchema = [
    { tableName: 'users', columns: ['id', 'name', 'email'] },
    { tableName: 'orders', columns: ['id', 'user_id', 'total', 'created_at'] },
  ];

  it('accepts SQL referencing known tables and columns', () => {
    const sql = 'SELECT name, email FROM users';
    expect(validateTableReferences(sql, knownSchema)).toEqual({ valid: true });
  });

  it('rejects SQL referencing an unknown table', () => {
    const sql = 'SELECT * FROM payments';
    const result = validateTableReferences(sql, knownSchema);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('payments');
  });

  it('rejects SQL referencing an unknown column', () => {
    const sql = 'SELECT salary FROM users';
    const result = validateTableReferences(sql, knownSchema);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('salary');
  });

  it('handles schema-qualified table names (public.users)', () => {
    const sql = 'SELECT name FROM public.users';
    expect(validateTableReferences(sql, knownSchema)).toEqual({ valid: true });
  });

  it('handles table aliases', () => {
    const sql = 'SELECT u.name FROM users u JOIN orders o ON u.id = o.user_id';
    expect(validateTableReferences(sql, knownSchema)).toEqual({ valid: true });
  });

  it('is case-insensitive for table/column matching', () => {
    const sql = 'SELECT NAME FROM USERS';
    expect(validateTableReferences(sql, knownSchema)).toEqual({ valid: true });
  });
});
