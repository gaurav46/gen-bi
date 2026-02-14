import { useState, useCallback, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { buildConnectionString, parseConnectionString } from './useConnectionString';

export function SettingsForm() {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5432');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connectionString, setConnectionString] = useState('');
  const [isEditingConnectionString, setIsEditingConnectionString] = useState(false);

  useEffect(() => {
    const savedId = localStorage.getItem('connectionId');
    if (!savedId) return;

    fetch(`/api/connections/${savedId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setHost(data.host);
        setPort(String(data.port));
        setDatabase(data.databaseName);
        setUsername(data.username);
        setPassword(data.password);
        setConnectionString(
          buildConnectionString({
            host: data.host,
            port: String(data.port),
            database: data.databaseName,
            username: data.username,
            password: data.password,
          }),
        );
      });
  }, []);

  const updateConnectionString = useCallback(
    (h: string, p: string, d: string, u: string, pw: string) => {
      if (!isEditingConnectionString) {
        setConnectionString(buildConnectionString({ host: h, port: p, database: d, username: u, password: pw }));
      }
    },
    [isEditingConnectionString],
  );

  const handleFieldChange = (setter: (v: string) => void, field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setter(value);
    const fields = { host, port, database, username, password, [field]: value };
    updateConnectionString(fields.host, fields.port, fields.database, fields.username, fields.password);
  };

  const handleConnectionStringChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConnectionString(value);
    setIsEditingConnectionString(true);
    const parsed = parseConnectionString(value);
    setHost(parsed.host);
    setPort(parsed.port);
    setDatabase(parsed.database);
    setUsername(parsed.username);
    setPassword(parsed.password);
  };

  const handleConnectionStringBlur = () => {
    setIsEditingConnectionString(false);
  };

  const allFieldsFilled = host && port && database && username && password;

  const [status, setStatus] = useState<'idle' | 'connecting' | 'discovering' | 'ready' | 'analyzing' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [discoveredSchemas, setDiscoveredSchemas] = useState<string[]>([]);
  const [selectedSchemas, setSelectedSchemas] = useState<string[]>([]);
  const [analysisMessage, setAnalysisMessage] = useState('');

  const handleSchemaToggle = (schema: string, checked: boolean | 'indeterminate') => {
    if (!checked) {
      setSelectedSchemas((previous) => previous.filter((item) => item !== schema));
      return;
    }
    setSelectedSchemas((previous) => (previous.includes(schema) ? previous : [...previous, schema]));
  };

  const handleAnalyze = async () => {
    const connectionId = localStorage.getItem('connectionId');
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

  const handleSubmit = async () => {
    setStatus('connecting');
    setErrorMessage('');
    setDiscoveredSchemas([]);
    setSelectedSchemas([]);

    try {
      const saveResponse = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host,
          port: Number(port),
          databaseName: database,
          username,
          password,
        }),
      });

      if (!saveResponse.ok) {
        setStatus('error');
        setErrorMessage('Failed to save connection.');
        return;
      }

      const saved = await saveResponse.json();
      localStorage.setItem('connectionId', saved.id);

      const testResponse = await fetch(`/api/connections/${saved.id}/test`, {
        method: 'POST',
      });

      if (!testResponse.ok) {
        const errorBody = await testResponse.json().catch(() => ({}));
        setStatus('error');
        setErrorMessage(
          typeof errorBody.message === 'string' && errorBody.message.length > 0
            ? errorBody.message
            : 'Connection failed'
        );
        return;
      }

      const testResult = await testResponse.json();
      setStatus('discovering');
      await new Promise((resolve) => setTimeout(resolve, 25));
      setDiscoveredSchemas(Array.isArray(testResult.schemas) ? testResult.schemas : []);
      setStatus('ready');
    } catch {
      setStatus('error');
      setErrorMessage('Connection failed');
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-lg font-semibold mb-4">Settings</h1>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="host" className="text-sm font-medium">Host</Label>
          <Input id="host" value={host} onChange={handleFieldChange(setHost, 'host')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="port" className="text-sm font-medium">Port</Label>
          <Input id="port" value={port} onChange={handleFieldChange(setPort, 'port')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="database" className="text-sm font-medium">Database</Label>
          <Input id="database" value={database} onChange={handleFieldChange(setDatabase, 'database')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username" className="text-sm font-medium">Username</Label>
          <Input id="username" value={username} onChange={handleFieldChange(setUsername, 'username')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium">Password</Label>
          <Input id="password" type="password" value={password} onChange={handleFieldChange(setPassword, 'password')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="connection-string" className="text-sm font-medium">Connection String</Label>
          <Input
            id="connection-string"
            value={connectionString}
            onChange={handleConnectionStringChange}
            onBlur={handleConnectionStringBlur}
          />
        </div>
        <Button disabled={!allFieldsFilled || status === 'connecting' || status === 'discovering'} onClick={handleSubmit}>
          {status === 'connecting'
            ? 'Connecting...'
            : status === 'discovering'
              ? 'Discovering schemas...'
              : status === 'ready'
                ? 'Connected'
                : 'Connect'}
        </Button>
        {status === 'discovering' && <p className="text-sm">Discovering schemas...</p>}
        {status === 'error' && <p className="text-destructive text-sm">{errorMessage || 'Connection failed'}</p>}
        {status === 'analyzing' && analysisMessage && <p className="text-sm text-muted-foreground">{analysisMessage}</p>}
        {status === 'done' && <p className="text-success text-sm">{analysisMessage}</p>}
        {(status === 'ready' || status === 'analyzing' || status === 'done') && discoveredSchemas.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Discovering schemas...</p>
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
    </div>
  );
}
