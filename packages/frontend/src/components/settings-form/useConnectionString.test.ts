import { describe, it, expect } from 'vitest';
import { buildConnectionString, parseConnectionString } from './useConnectionString';

describe('buildConnectionString', () => {
  it('builds connection string from individual fields', () => {
    const result = buildConnectionString({
      host: 'localhost',
      port: '5432',
      database: 'mydb',
      username: 'admin',
      password: 'secret',
    });
    expect(result).toBe('postgresql://admin:secret@localhost:5432/mydb');
  });
});

describe('parseConnectionString', () => {
  it('parses connection string into individual fields', () => {
    const result = parseConnectionString('postgresql://admin:secret@localhost:5432/mydb');
    expect(result).toEqual({
      host: 'localhost',
      port: '5432',
      database: 'mydb',
      username: 'admin',
      password: 'secret',
    });
  });

  it('handles missing parts gracefully', () => {
    const result = parseConnectionString('postgresql://localhost');
    expect(result).toEqual(
      expect.objectContaining({ host: 'localhost', port: '5432' }),
    );
  });

  it('handles empty string', () => {
    const result = parseConnectionString('');
    expect(result).toEqual({
      host: '',
      port: '5432',
      database: '',
      username: '',
      password: '',
    });
  });

  it('handles special characters in password', () => {
    const original = { host: 'localhost', port: '5432', database: 'mydb', username: 'admin', password: 'p@ss:w/rd#1' };
    const connStr = buildConnectionString(original);
    const parsed = parseConnectionString(connStr);
    expect(parsed.password).toBe('p@ss:w/rd#1');
  });
});
