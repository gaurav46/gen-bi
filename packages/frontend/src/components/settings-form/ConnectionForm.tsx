import { useState, useCallback, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { buildConnectionString, parseConnectionString } from './useConnectionString';

type ConnectionFormProps = {
  onConnected?: (connectionId: string) => void;
};

export function ConnectionForm({ onConnected }: ConnectionFormProps) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5432');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connectionString, setConnectionString] = useState('');
  const [isEditingConnectionString, setIsEditingConnectionString] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

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

  const handleSubmit = async () => {
    setStatus('connecting');
    setErrorMessage('');

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
      setStatus('connected');
      onConnected?.(saved.id);
    } catch {
      setStatus('error');
      setErrorMessage('Connection failed');
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-3 space-y-1.5">
          <Label htmlFor="host" className="text-sm font-medium">Host</Label>
          <Input id="host" value={host} onChange={handleFieldChange(setHost, 'host')} />
        </div>
        <div className="col-span-1 space-y-1.5">
          <Label htmlFor="port" className="text-sm font-medium">Port</Label>
          <Input id="port" value={port} onChange={handleFieldChange(setPort, 'port')} />
        </div>
        <div className="col-span-4 space-y-1.5">
          <Label htmlFor="database" className="text-sm font-medium">Database</Label>
          <Input id="database" value={database} onChange={handleFieldChange(setDatabase, 'database')} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="username" className="text-sm font-medium">Username</Label>
          <Input id="username" value={username} onChange={handleFieldChange(setUsername, 'username')} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium">Password</Label>
          <Input id="password" type="password" value={password} onChange={handleFieldChange(setPassword, 'password')} />
        </div>
        <div className="col-span-4 space-y-1.5">
          <Label htmlFor="connection-string" className="text-sm font-medium">Connection String</Label>
          <Input
            id="connection-string"
            value={connectionString}
            onChange={handleConnectionStringChange}
            onBlur={handleConnectionStringBlur}
          />
        </div>
        <div className="col-span-4">
          <Button className="w-full" disabled={!allFieldsFilled || status === 'connecting'} onClick={handleSubmit}>
            {status === 'connecting' ? 'Connecting...' : status === 'connected' ? 'Connected' : 'Connect'}
          </Button>
        </div>
      </div>
      {status === 'error' && <p className="text-destructive text-sm mt-2">{errorMessage || 'Connection failed'}</p>}
    </div>
  );
}
