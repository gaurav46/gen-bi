import { useState, useCallback, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const handleSubmit = async () => {
    setStatus('saving');
    try {
      const response = await fetch('/api/connections', {
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
      if (response.ok) {
        const saved = await response.json();
        localStorage.setItem('connectionId', saved.id);
        setStatus('saved');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="space-y-4">
        <div>
          <Label htmlFor="host">Host</Label>
          <Input id="host" value={host} onChange={handleFieldChange(setHost, 'host')} />
        </div>
        <div>
          <Label htmlFor="port">Port</Label>
          <Input id="port" value={port} onChange={handleFieldChange(setPort, 'port')} />
        </div>
        <div>
          <Label htmlFor="database">Database</Label>
          <Input id="database" value={database} onChange={handleFieldChange(setDatabase, 'database')} />
        </div>
        <div>
          <Label htmlFor="username">Username</Label>
          <Input id="username" value={username} onChange={handleFieldChange(setUsername, 'username')} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={handleFieldChange(setPassword, 'password')} />
        </div>
        <div>
          <Label htmlFor="connection-string">Connection String</Label>
          <Input
            id="connection-string"
            value={connectionString}
            onChange={handleConnectionStringChange}
            onBlur={handleConnectionStringBlur}
          />
        </div>
        <Button disabled={!allFieldsFilled || status === 'saving'} onClick={handleSubmit}>
          {status === 'saving' ? 'Connecting...' : status === 'saved' ? 'Connected' : 'Connect'}
        </Button>
        {status === 'error' && <p className="text-red-500 text-sm">Failed to save connection.</p>}
      </div>
    </div>
  );
}
