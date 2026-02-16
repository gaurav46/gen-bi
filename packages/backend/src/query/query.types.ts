export type SampleRows = Map<string, Record<string, unknown>[]>;

export type QueryRequest = {
  connectionId: string;
  question: string;
};

export type LlmQueryResponse = {
  intent: string;
  title: string;
  sql: string;
  visualization: { chartType: string };
  columns: { name: string; type: string; role: 'dimension' | 'measure' }[];
};

export type QueryResponse = {
  intent: string;
  title: string;
  sql: string;
  columns: { name: string; type: string; role: 'dimension' | 'measure' }[];
  rows: Record<string, unknown>[];
  attempts: number;
};
