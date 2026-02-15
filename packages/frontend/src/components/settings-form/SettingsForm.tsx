import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConnectionForm } from './ConnectionForm';

export function SettingsForm() {
  const [connectionId, setConnectionId] = useState<string | null>(
    localStorage.getItem('connectionId'),
  );
  const [status, setStatus] = useState<'idle' | 'discovering' | 'ready' | 'analyzing' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [discoveredSchemas, setDiscoveredSchemas] = useState<string[]>([]);
  const [selectedSchemas, setSelectedSchemas] = useState<string[]>([]);
  const [analysisMessage, setAnalysisMessage] = useState('');

  const handleConnected = async (id: string) => {
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
            : 'Schema discovery failed'
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

  const handleSchemaToggle = (schema: string, checked: boolean | 'indeterminate') => {
    if (!checked) {
      setSelectedSchemas((previous) => previous.filter((item) => item !== schema));
      return;
    }
    setSelectedSchemas((previous) => (previous.includes(schema) ? previous : [...previous, schema]));
  };

  const handleAnalyze = async () => {
    if (!connectionId || selectedSchemas.length === 0) return;

    setStatus('analyzing');
    setErrorMessage('');
    setAnalysisMessage('');

    const analyzePromise = fetch('/api/schema/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId, schemas: selectedSchemas }),
    });

    const pollOnce = async (): Promise<boolean> => {
      try {
        const statusResponse = await fetch('/api/schema/discover/status');
        if (!statusResponse.ok) return false;
        const statusData = await statusResponse.json();
        setAnalysisMessage(statusData.message || '');
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
        return false;
      } catch {
        return false;
      }
    };

    const pollInterval = setInterval(async () => {
      const done = await pollOnce();
      if (done) clearInterval(pollInterval);
    }, 500);

    try {
      const response = await analyzePromise;
      clearInterval(pollInterval);

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

      await pollOnce();
    } catch {
      clearInterval(pollInterval);
      setStatus('error');
      setErrorMessage('Analysis failed');
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold mb-4">Settings</h1>
      <ConnectionForm onConnected={handleConnected} />
      {status === 'discovering' && <p className="text-sm mt-3">Discovering schemas...</p>}
      {status === 'error' && <p className="text-destructive text-sm mt-3">{errorMessage}</p>}
      {status === 'analyzing' && analysisMessage && <p className="text-sm text-muted-foreground mt-3">{analysisMessage}</p>}
      {status === 'done' && <p className="text-success text-sm mt-3">{analysisMessage}</p>}
      {(status === 'ready' || status === 'analyzing' || status === 'done') && discoveredSchemas.length > 0 && (
        <div className="max-w-lg mx-auto mt-4 space-y-2">
          <p className="text-sm font-semibold">Discovered Schemas</p>
          <div className="space-y-1.5">
            {discoveredSchemas.map((schema) => (
              <div key={schema} className="flex items-center gap-1.5">
                <Checkbox
                  id={`schema-${schema}`}
                  aria-label={schema}
                  checked={selectedSchemas.includes(schema)}
                  onCheckedChange={(checked) => handleSchemaToggle(schema, checked)}
                />
                <Label htmlFor={`schema-${schema}`}>{schema}</Label>
              </div>
            ))}
          </div>
          <Button disabled={selectedSchemas.length === 0 || status === 'analyzing'} onClick={handleAnalyze}>
            {status === 'analyzing' ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>
      )}
    </div>
  );
}
