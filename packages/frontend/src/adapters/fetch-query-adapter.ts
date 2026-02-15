import type { QueryPort } from '../ports/query-port';
import type { QueryRequest, QueryResponse } from '../domain/query-types';

export class FetchQueryAdapter implements QueryPort {
  async submitQuery(request: QueryRequest): Promise<QueryResponse> {
    const response = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Query failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}
