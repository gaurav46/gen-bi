import type { QueryRequest, QueryResponse } from '../domain/query-types';

export interface QueryPort {
  submitQuery(request: QueryRequest): Promise<QueryResponse>;
}
