export type TenantConnectionConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  dbType: 'postgresql' | 'sqlserver';
  encrypt?: boolean;
};

export type QueryResult = {
  rows: Record<string, unknown>[];
};

export interface TenantDatabasePort {
  readonly systemSchemaNames: ReadonlySet<string>;
  connect(config: TenantConnectionConfig): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  /**
   * Returns index metadata for the given schemas.
   * Result rows: { schemaname, tablename, indexname, columnname, is_unique }
   * Each adapter uses its own dialect-appropriate catalog SQL.
   */
  queryIndexes(schemas: string[]): Promise<QueryResult>;
  disconnect(): Promise<void>;
}
