export type QueryRequest = {
  connectionId: string;
  question: string;
};

export type QueryResponse = {
  intent: string;
  title: string;
  sql: string;
  visualization: { chartType: string };
  columns: { name: string; type: string; role: 'dimension' | 'measure' }[];
  rows: Record<string, unknown>[];
  attempts: number;
};
