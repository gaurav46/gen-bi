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

