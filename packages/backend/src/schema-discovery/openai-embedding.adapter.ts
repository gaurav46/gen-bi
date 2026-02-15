import { Injectable, Logger } from '@nestjs/common';
import type { EmbeddingPort } from './embedding.port';

@Injectable()
export class OpenAIEmbeddingAdapter implements EmbeddingPort {
  private readonly logger = new Logger(OpenAIEmbeddingAdapter.name);
  private readonly apiKey: string;

  constructor() {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    this.apiKey = key;
  }

  async generateEmbeddings(inputs: string[]): Promise<number[][]> {
    this.logger.log(`Generating embeddings for ${inputs.length} inputs`);
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: inputs,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => 'unable to read body');
      this.logger.error(`OpenAI API error: ${response.status} ${response.statusText} — ${body}`);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.map((item: { embedding: number[] }) => item.embedding);
  }
}
