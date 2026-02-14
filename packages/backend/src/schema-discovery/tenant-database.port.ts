export type TenantConnectionConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
};

export type QueryResult = {
  rows: Record<string, unknown>[];
};

export interface TenantDatabasePort {
  connect(config: TenantConnectionConfig): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  disconnect(): Promise<void>;
}
