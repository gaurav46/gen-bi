import { useState, useEffect, useRef } from 'react';

export type SchemaAnalysisStatus = 'idle' | 'discovering' | 'ready' | 'analyzing' | 'introspected' | 'embedding' | 'done' | 'error';

export function useSchemaAnalysis() {
  const [connectionId, setConnectionId] = useState<string | null>(
    localStorage.getItem('connectionId'),
  );
  const [status, _setStatus] = useState<SchemaAnalysisStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [discoveredSchemas, setDiscoveredSchemas] = useState<string[]>([]);
  const [selectedSchemas, setSelectedSchemas] = useState<string[]>([]);
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef<SchemaAnalysisStatus>('idle');

  const setStatus = (next: SchemaAnalysisStatus | ((prev: SchemaAnalysisStatus) => SchemaAnalysisStatus)) => {
    if (typeof next === 'function') {
      _setStatus((prev) => {
        const resolved = next(prev);
        statusRef.current = resolved;
        return resolved;
      });
    } else {
      statusRef.current = next;
      _setStatus(next);
    }
  };

  const clearPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return clearPolling;
  }, []);

  useEffect(() => {
    const savedId = localStorage.getItem('connectionId');
    if (!savedId) return;

    fetch('/api/schema/discover/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.status === 'analyzing') {
          setStatus('analyzing');
          setAnalysisMessage(data.message || '');
          setCurrent(data.current ?? 0);
          setTotal(data.total ?? 0);
          startPolling();
        } else if (data.status === 'done') {
          setStatus('done');
          setAnalysisMessage('Analysis complete');
          setCurrent(data.current ?? 0);
          setTotal(data.total ?? 0);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (status !== 'introspected' || !connectionId) return;

    fetch(`/api/schema/${connectionId}/annotations`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.columns) {
          setAnnotations(data.columns);
        }
      })
      .catch(() => {
        setStatus('error');
        setErrorMessage('Failed to fetch annotations');
      });
  }, [status, connectionId]);

  const discoverSchemas = async (id: string) => {
    setConnectionId(id);
    setStatus('discovering');
    setErrorMessage('');
    setDiscoveredSchemas([]);
    setSelectedSchemas([]);

    try {
      const testResponse = await fetch(`/api/connections/${id}/test`, {
        method: 'POST',
      });

      if (!testResponse.ok) {
        const errorBody = await testResponse.json().catch(() => ({}));
        setStatus('error');
        setErrorMessage(
          typeof errorBody.message === 'string' && errorBody.message.length > 0
            ? errorBody.message
            : 'Schema discovery failed',
        );
        return;
      }

      const testResult = await testResponse.json();
      setDiscoveredSchemas(Array.isArray(testResult.schemas) ? testResult.schemas : []);
      setStatus('ready');
    } catch {
      setStatus('error');
      setErrorMessage('Schema discovery failed');
    }
  };

  const toggleSchema = (schema: string, checked: boolean | 'indeterminate') => {
    if (!checked) {
      setSelectedSchemas((previous) => previous.filter((item) => item !== schema));
      return;
    }
    setSelectedSchemas((previous) => (previous.includes(schema) ? previous : [...previous, schema]));
  };

  const pollStatus = async (): Promise<boolean> => {
    try {
      const statusResponse = await fetch('/api/schema/discover/status');
      if (!statusResponse.ok) return false;
      const statusData = await statusResponse.json();
      setAnalysisMessage(statusData.message || '');
      setCurrent(statusData.current ?? 0);
      setTotal(statusData.total ?? 0);
      if (statusData.status === 'done') {
        setStatus('done');
        setAnalysisMessage('Analysis complete');
        return true;
      }
      if (statusData.status === 'error') {
        setStatus('error');
        setErrorMessage(statusData.message || 'Analysis failed');
        return true;
      }
      if (statusData.status === 'introspected') {
        if (statusRef.current === 'embedding') return false;
        setStatus('introspected');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const startPolling = () => {
    clearPolling();
    pollIntervalRef.current = setInterval(async () => {
      const done = await pollStatus();
      if (done) clearPolling();
    }, 500);
  };

  const resetConnection = () => {
    clearPolling();
    setConnectionId(null);
    setStatus('idle');
    setErrorMessage('');
    setDiscoveredSchemas([]);
    setSelectedSchemas([]);
    setAnalysisMessage('');
    setCurrent(0);
    setTotal(0);
    localStorage.removeItem('connectionId');
  };

  const triggerEmbed = async () => {
    if (!connectionId) return;
    setStatus('embedding');
    setAnalysisMessage('Generating embeddings...');
    await fetch(`/api/schema/${connectionId}/embed`, { method: 'POST' });
    startPolling();
  };

  const saveAndEmbed = async (annotationUpdates: { columnId: string; description: string }[]) => {
    if (!connectionId) return;
    await fetch(`/api/schema/${connectionId}/annotations`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annotations: annotationUpdates }),
    });
    await triggerEmbed();
  };

  const skipAnnotations = async () => {
    await triggerEmbed();
  };

  const analyze = async () => {
    if (!connectionId || selectedSchemas.length === 0) return;

    setStatus('analyzing');
    setErrorMessage('');
    setAnalysisMessage('');

    const analyzePromise = fetch('/api/schema/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, schemas: selectedSchemas }),
    });

    startPolling();

    try {
      const response = await analyzePromise;
      clearPolling();

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        setStatus('error');
        setErrorMessage(
          typeof errorBody.message === 'string' && errorBody.message.length > 0
            ? errorBody.message
            : 'Analysis failed',
        );
        return;
      }

      await pollStatus();
    } catch {
      clearPolling();
      setStatus('error');
      setErrorMessage('Analysis failed');
    }
  };

  return {
    status,
    errorMessage,
    discoveredSchemas,
    selectedSchemas,
    analysisMessage,
    current,
    total,
    annotations,
    discoverSchemas,
    toggleSchema,
    analyze,
    saveAndEmbed,
    skipAnnotations,
    resetConnection,
  };
}
