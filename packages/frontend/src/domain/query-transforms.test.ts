import { describe, it, expect } from 'vitest';
import { formatCellValue, isNumericType } from './query-transforms';

describe('formatCellValue', () => {
  it('passes string values through unchanged', () => {
    expect(formatCellValue('Alice')).toEqual({ text: 'Alice', isNull: false });
  });

  it('converts number values to string', () => {
    expect(formatCellValue(12500)).toEqual({ text: '12500', isNull: false });
  });

  it('returns null representation for null', () => {
    expect(formatCellValue(null)).toEqual({ text: 'null', isNull: true });
  });

  it('returns null representation for undefined', () => {
    expect(formatCellValue(undefined)).toEqual({ text: 'null', isNull: true });
  });

  it('renders boolean values as true/false', () => {
    expect(formatCellValue(true)).toEqual({ text: 'true', isNull: false });
    expect(formatCellValue(false)).toEqual({ text: 'false', isNull: false });
  });
});

describe('isNumericType', () => {
  it.each(['int4', 'int8', 'numeric', 'decimal', 'float4', 'float8', 'bigint', 'integer'])(
    'returns true for %s',
    (type) => {
      expect(isNumericType(type)).toBe(true);
    },
  );

  it.each(['varchar', 'text', 'timestamp', 'boolean'])(
    'returns false for %s',
    (type) => {
      expect(isNumericType(type)).toBe(false);
    },
  );
});
