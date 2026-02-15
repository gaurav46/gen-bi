import type { LlmQueryResponse } from './query.types';

export interface LlmPort {
  generateQuery(prompt: string): Promise<LlmQueryResponse>;
}

export const LLM_PORT = 'LLM_PORT';
