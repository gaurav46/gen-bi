import type { LlmQueryResponse } from './query.types';

export interface LlmPort {
  generateQuery(prompt: string, dbType: 'postgresql' | 'sqlserver'): Promise<LlmQueryResponse>;
}

export const LLM_PORT = 'LLM_PORT';
