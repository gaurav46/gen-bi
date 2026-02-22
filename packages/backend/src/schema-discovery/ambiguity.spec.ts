import { describe, it, expect } from 'vitest';
import { isAmbiguousColumnName } from './ambiguity';

describe('isAmbiguousColumnName', () => {
  it('returns false for clear column names', () => {
    expect(isAmbiguousColumnName('email')).toBe(false);
    expect(isAmbiguousColumnName('first_name')).toBe(false);
    expect(isAmbiguousColumnName('created_at')).toBe(false);
    expect(isAmbiguousColumnName('order_total')).toBe(false);
    expect(isAmbiguousColumnName('id')).toBe(false);
  });

  it('returns true for cryptic column names', () => {
    expect(isAmbiguousColumnName('amt_1')).toBe(true);
    expect(isAmbiguousColumnName('col_x')).toBe(true);
    expect(isAmbiguousColumnName('flg_yn')).toBe(true);
    expect(isAmbiguousColumnName('dt_cr')).toBe(true);
    expect(isAmbiguousColumnName('val')).toBe(true);
  });
});
