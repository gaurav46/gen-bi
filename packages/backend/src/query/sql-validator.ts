type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'TRUNCATE',
  'CREATE',
] as const;

export function validateSelectOnly(sql: string): ValidationResult {
  const normalized = sql.replace(/--.*$/gm, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');

  if (normalized.includes(';')) {
    return { valid: false, reason: 'Multiple statements detected (semicolon not allowed)' };
  }

  const upper = normalized.toUpperCase();

  for (const keyword of FORBIDDEN_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`);
    if (pattern.test(upper)) {
      return { valid: false, reason: `Forbidden keyword detected: ${keyword}` };
    }
  }

  if (!/^\s*SELECT\b/i.test(normalized.trim())) {
    return { valid: false, reason: 'Query must start with SELECT' };
  }

  return { valid: true };
}

export type TableSchema = { tableName: string; columns: string[] };

export function validateTableReferences(
  sql: string,
  knownSchema: TableSchema[],
): ValidationResult {
  const knownTables = new Map(
    knownSchema.map((t) => [t.tableName.toLowerCase(), t.columns.map((c) => c.toLowerCase())]),
  );

  const allKnownColumns = new Set(
    knownSchema.flatMap((t) => t.columns.map((c) => c.toLowerCase())),
  );

  const fromJoinPattern = /\b(?:FROM|JOIN)\s+(?:(\w+)\.)?(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi;
  const aliases = new Map<string, string>();
  const referencedTables = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = fromJoinPattern.exec(sql)) !== null) {
    const tableName = match[2].toLowerCase();
    const alias = match[3]?.toLowerCase();

    if (['on', 'where', 'set', 'and', 'or', 'group', 'order', 'limit', 'having', 'union', 'inner', 'left', 'right', 'outer', 'cross', 'natural', 'full'].includes(tableName)) {
      continue;
    }

    referencedTables.add(tableName);
    if (alias) {
      aliases.set(alias, tableName);
    }
  }

  for (const table of referencedTables) {
    if (!knownTables.has(table)) {
      return { valid: false, reason: `Unknown table referenced: ${table}` };
    }
  }

  const selectColumnsPattern = /\bSELECT\b\s+([\s\S]*?)\bFROM\b/gi;
  const selectMatch = selectColumnsPattern.exec(sql);
  if (selectMatch) {
    const columnsPart = selectMatch[1];
    if (columnsPart.trim() === '*') return { valid: true };

    const columnRefs = columnsPart.split(',').map((c) => c.trim());
    for (const ref of columnRefs) {
      const parts = ref.split(/\s+as\s+/i)[0].trim();
      const dotParts = parts.split('.');
      const colName = dotParts[dotParts.length - 1].toLowerCase();

      if (colName === '*' || /\(/.test(colName)) continue;

      if (!allKnownColumns.has(colName)) {
        return { valid: false, reason: `Unknown column referenced: ${colName}` };
      }
    }
  }

  return { valid: true };
}
