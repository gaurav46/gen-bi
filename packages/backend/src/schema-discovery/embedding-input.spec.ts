import { describe, it, expect } from 'vitest';
import { buildEmbeddingInput, buildEmbeddingInputs } from './embedding-input';

describe('buildEmbeddingInput', () => {
  it('formats table name, column name, and data type into embedding input string', () => {
    const result = buildEmbeddingInput({
      tableName: 'users',
      columnName: 'email',
      dataType: 'varchar',
    });

    expect(result).toBe('users.email varchar');
  });

  it('appends description to embedding input when present', () => {
    const result = buildEmbeddingInput({
      tableName: 'orders',
      columnName: 'amt_1',
      dataType: 'numeric',
      description: 'Total order amount in cents',
    });

    expect(result).toBe('orders.amt_1 numeric -- Total order amount in cents');
  });

  it('omits description suffix when description is empty string', () => {
    const result = buildEmbeddingInput({
      tableName: 'users',
      columnName: 'email',
      dataType: 'varchar',
      description: '',
    });

    expect(result).toBe('users.email varchar');
  });

  it('builds embedding inputs for multiple columns', () => {
    const columns = [
      { tableName: 'users', columnName: 'id', dataType: 'uuid' },
      { tableName: 'users', columnName: 'email', dataType: 'varchar' },
      { tableName: 'orders', columnName: 'total', dataType: 'numeric' },
    ];

    const result = buildEmbeddingInputs(columns);

    expect(result).toEqual([
      'users.id uuid',
      'users.email varchar',
      'orders.total numeric',
    ]);
  });
});
