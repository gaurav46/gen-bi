type FormattedCell = {
  text: string;
  isNull: boolean;
};

export function formatCellValue(value: unknown): FormattedCell {
  if (value === null || value === undefined) {
    return { text: 'null', isNull: true };
  }
  return { text: String(value), isNull: false };
}

const NUMERIC_TYPES = new Set([
  'int2', 'int4', 'int8', 'integer', 'bigint', 'smallint',
  'numeric', 'decimal', 'real', 'float4', 'float8',
  'double precision', 'money',
]);

export function isNumericType(type: string): boolean {
  return NUMERIC_TYPES.has(type.toLowerCase());
}
