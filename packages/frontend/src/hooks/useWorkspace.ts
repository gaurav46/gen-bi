import { useState, useCallback } from 'react';
import type { QueryPort } from '../ports/query-port';
import type { QueryResponse } from '../domain/query-types';

export function useWorkspace(port: QueryPort) {
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (connectionId: string, question: string) => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await port.submitQuery({ connectionId, question });
      setResponse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [port]);

  return { response, isLoading, error, submit };
}
