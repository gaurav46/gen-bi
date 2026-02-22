import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { DescriptionSuggestionPort } from './description-suggestion.port';

@Injectable()
export class ClaudeDescriptionAdapter implements DescriptionSuggestionPort {
  private readonly logger = new Logger(ClaudeDescriptionAdapter.name);
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async suggestDescriptions(
    columns: { tableName: string; columnName: string; dataType: string; neighborColumns: string[] }[],
  ): Promise<{ columnName: string; tableName: string; description: string }[]> {
    const prompt = columns
      .map(
        (c) =>
          `Table "${c.tableName}", column "${c.columnName}" (${c.dataType}), neighboring columns: ${c.neighborColumns.join(', ')}`,
      )
      .join('\n');

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      system:
        'You are a database documentation expert. Given ambiguous column names, suggest short business-friendly descriptions. Return a JSON array of { tableName, columnName, description }. Only return the JSON array, no markdown.',
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Unexpected response format from Claude API');
    }

    return JSON.parse(textBlock.text);
  }
}
