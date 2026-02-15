import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { LlmPort } from './llm.port';
import type { LlmQueryResponse } from './query.types';

const SYSTEM_PROMPT = `You are a SQL expert. Given a business question, generate a structured JSON response.
- intent: a short snake_case identifier for the query type
- title: a human-readable title for the results
- sql: a valid SELECT query answering the question
- visualization: pick the best chartType (bar, line, pie, kpi_card, table)
- columns: array of { name, type, role } where role is "dimension" or "measure"`;

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

  async generateQuery(prompt: string): Promise<LlmQueryResponse> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
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
