import { describe, expect, it } from 'vitest';
import { validateSelectOnly } from './sql-validator';

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

