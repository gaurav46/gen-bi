export interface ConnectionFields {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

export function buildConnectionString(fields: ConnectionFields): string {
  const { host, port, database, username, password } = fields;
  if (!host && !username && !password && !database) return '';
  const encodedPassword = encodeURIComponent(password);
  return `postgresql://${username}:${encodedPassword}@${host}:${port}/${database}`;
}

export function parseConnectionString(str: string): ConnectionFields {
  const defaults: ConnectionFields = { host: '', port: '5432', database: '', username: '', password: '' };
  if (!str) return defaults;

  try {
    const url = new URL(str);
    return {
      host: url.hostname || '',
      port: url.port || '5432',
      database: url.pathname.replace(/^\//, '') || '',
      username: url.username || '',
      password: decodeURIComponent(url.password || ''),
    };
  } catch {
    return defaults;
  }
}
