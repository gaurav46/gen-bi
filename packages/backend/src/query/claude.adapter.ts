import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { LlmPort } from './llm.port';
import type { LlmQueryResponse } from './query.types';

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string' },
    title: { type: 'string' },
    sql: { type: 'string' },
    visualization: {
      type: 'object',
      properties: { chartType: { type: 'string' } },
      required: ['chartType'],
      additionalProperties: false,
    },
    columns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string' },
          role: { type: 'string', enum: ['dimension', 'measure'] },
        },
        required: ['name', 'type', 'role'],
        additionalProperties: false,
      },
    },
  },
  required: ['intent', 'title', 'sql', 'visualization', 'columns'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT_BASE = `You are a SQL expert. Given a business question and a database schema, generate a structured JSON response with these fields:
- intent: a short snake_case identifier for the query type
- title: a human-readable title for the results
- sql: a valid SELECT query answering the question
- visualization: pick the best chartType (bar, line, pie, kpi_card, table)
- columns: array of { name, type, role } where role is "dimension" or "measure"

Always respond with valid JSON only. No markdown, no code fences, just the JSON object.

Use the schema context provided in the user message to determine the correct tables, columns, and joins. Follow foreign key relationships to join related tables. If sample data rows are provided, use them to understand what values look like in each column.
Only use functions and syntax available in the target SQL dialect. Avoid dialect-specific features not supported by the target engine.`;

const POSTGRESQL_DIALECT_SUFFIX = `sql: a valid SELECT query answering the question (PostgreSQL dialect)

Example 1:
Question: "What are the top 5 departments by headcount?"
Schema: departments(id, name), employees(id, first_name, last_name, department_id → departments.id)
SQL: SELECT d.name, COUNT(e.id) AS headcount FROM departments d JOIN employees e ON e.department_id = d.id GROUP BY d.name ORDER BY headcount DESC LIMIT 5
Response:
{"intent":"top_departments_by_headcount","title":"Top 5 Departments by Headcount","sql":"SELECT d.name, COUNT(e.id) AS headcount FROM departments d JOIN employees e ON e.department_id = d.id GROUP BY d.name ORDER BY headcount DESC LIMIT 5","visualization":{"chartType":"bar"},"columns":[{"name":"name","type":"varchar","role":"dimension"},{"name":"headcount","type":"int8","role":"measure"}]}

Example 2:
Question: "Show me monthly revenue for this year"
Schema: orders(id, total, created_at), customers(id, name)
SQL: SELECT DATE_TRUNC('month', created_at) AS month, SUM(total) AS revenue FROM orders WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE) GROUP BY month ORDER BY month
Response:
{"intent":"monthly_revenue","title":"Monthly Revenue This Year","sql":"SELECT DATE_TRUNC('month', created_at) AS month, SUM(total) AS revenue FROM orders WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE) GROUP BY month ORDER BY month","visualization":{"chartType":"line"},"columns":[{"name":"month","type":"timestamp","role":"dimension"},{"name":"revenue","type":"numeric","role":"measure"}]}`;

const SQLSERVER_DIALECT_SUFFIX = `sql: a valid SELECT query answering the question (T-SQL / SQL Server dialect)

Example 1:
Question: "What are the top 5 departments by headcount?"
Schema: departments(id, name), employees(id, first_name, last_name, department_id → departments.id)
SQL: SELECT TOP 5 d.name, COUNT(e.id) AS headcount FROM departments d JOIN employees e ON e.department_id = d.id GROUP BY d.name ORDER BY headcount DESC
Response:
{"intent":"top_departments_by_headcount","title":"Top 5 Departments by Headcount","sql":"SELECT TOP 5 d.name, COUNT(e.id) AS headcount FROM departments d JOIN employees e ON e.department_id = d.id GROUP BY d.name ORDER BY headcount DESC","visualization":{"chartType":"bar"},"columns":[{"name":"name","type":"varchar","role":"dimension"},{"name":"headcount","type":"int","role":"measure"}]}

Example 2:
Question: "Show me monthly revenue for this year"
Schema: orders(id, total, created_at), customers(id, name)
SQL: SELECT FORMAT(created_at, 'yyyy-MM') AS month, SUM(total) AS revenue FROM orders WHERE YEAR(created_at) = YEAR(GETDATE()) GROUP BY FORMAT(created_at, 'yyyy-MM') ORDER BY month
Response:
{"intent":"monthly_revenue","title":"Monthly Revenue This Year","sql":"SELECT FORMAT(created_at, 'yyyy-MM') AS month, SUM(total) AS revenue FROM orders WHERE YEAR(created_at) = YEAR(GETDATE()) GROUP BY FORMAT(created_at, 'yyyy-MM') ORDER BY month","visualization":{"chartType":"line"},"columns":[{"name":"month","type":"varchar","role":"dimension"},{"name":"revenue","type":"numeric","role":"measure"}]}`;


@Injectable()
export class ClaudeAdapter implements LlmPort {
  private readonly logger = new Logger(ClaudeAdapter.name);
  private readonly client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new BadRequestException('ANTHROPIC_API_KEY is not configured');
    }
    this.client = new Anthropic({ apiKey });
  }

  private buildSystemPrompt(dbType: 'postgresql' | 'sqlserver'): string {
    const dialectSuffix = dbType === 'sqlserver' ? SQLSERVER_DIALECT_SUFFIX : POSTGRESQL_DIALECT_SUFFIX;
    return `${SYSTEM_PROMPT_BASE}\n\n${dialectSuffix}`;
  }

  async generateQuery(prompt: string, dbType: 'postgresql' | 'sqlserver'): Promise<LlmQueryResponse> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16000,
      temperature: 1,
      thinking: { type: 'enabled', budget_tokens: 10000 },
      system: this.buildSystemPrompt(dbType),
      messages: [{ role: 'user', content: prompt }],
      output_config: {
        format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
      },
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Unexpected response format from Claude API');
    }

    return JSON.parse(textBlock.text) as LlmQueryResponse;
  }
}
