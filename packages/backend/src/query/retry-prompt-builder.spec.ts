import { describe, expect, it } from 'vitest';
import { buildRetryPrompt } from './retry-prompt-builder';

describe('buildRetryPrompt', () => {
  it('builds retry prompt containing original question, schema, failed SQL, and error message', () => {
    const result = buildRetryPrompt({
      question: 'Show top customers',
      schemaContext: 'Table: users\n  - name (varchar)\n  - total (numeric)',
      failedSql: 'SELECT bad_col FROM users',
      errorMessage: 'column "bad_col" does not exist',
      attempt: 1,
    });

    expect(result).toContain('Show top customers');
    expect(result).toContain('Table: users');
    expect(result).toContain('SELECT bad_col FROM users');
    expect(result).toContain('column "bad_col" does not exist');
  });

  it('includes attempt number in retry prompt', () => {
    const result = buildRetryPrompt({
      question: 'Show top customers',
      schemaContext: 'Table: users\n  - name (varchar)',
      failedSql: 'SELECT x FROM users',
      errorMessage: 'column "x" does not exist',
      attempt: 2,
    });

    expect(result).toContain('Attempt 2');
  });
});
