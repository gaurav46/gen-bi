type RetryPromptInput = {
  question: string;
  schemaContext: string;
  failedSql: string;
  errorMessage: string;
  attempt: number;
};

export function buildRetryPrompt(input: RetryPromptInput): string {
  return [
    `Attempt ${input.attempt} — the previous SQL query failed. Please generate a corrected query.`,
    '',
    `Database schema:`,
    input.schemaContext,
    '',
    `Original question: ${input.question}`,
    '',
    `Failed SQL:`,
    input.failedSql,
    '',
    `Error: ${input.errorMessage}`,
    '',
    `Generate a corrected SELECT query that avoids this error.`,
  ].join('\n');
}
