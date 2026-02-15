import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConnectionsService } from '../connections/connections.service';
import type { LlmPort } from './llm.port';
import { LLM_PORT } from './llm.port';
import type { EmbeddingPort } from '../schema-discovery/embedding.port';
import { EMBEDDING_PORT } from '../schema-discovery/embedding.port';
import type { SchemaRetrievalPort } from './schema-retrieval.port';
import { SCHEMA_RETRIEVAL_PORT } from './schema-retrieval.port';
import type { TenantDatabasePort } from '../schema-discovery/tenant-database.port';
import { TENANT_DATABASE_PORT } from '../schema-discovery/schema-discovery.service';
import type { QueryRequest, QueryResponse } from './query.types';
import { buildSchemaContext } from './schema-context-builder';
import { buildRetryPrompt } from './retry-prompt-builder';
import { validateSelectOnly, validateTableReferences } from './sql-validator';

const QUERY_TIMEOUT_MS = 10_000;
const TOP_K = 20;
const MAX_ATTEMPTS = 3;

@Injectable()
export class QueryService {
  constructor(
    private readonly connectionsService: ConnectionsService,
    @Inject(LLM_PORT) private readonly llmPort: LlmPort,
    @Inject(EMBEDDING_PORT) private readonly embeddingPort: EmbeddingPort,
    @Inject(SCHEMA_RETRIEVAL_PORT) private readonly schemaRetrievalPort: SchemaRetrievalPort,
    @Inject(TENANT_DATABASE_PORT) private readonly tenantDatabasePort: TenantDatabasePort,
  ) {}

  async query(request: QueryRequest): Promise<QueryResponse> {
    const connection = await this.connectionsService.findOne(request.connectionId);

    const hasEmbeddings = await this.schemaRetrievalPort.hasEmbeddings(request.connectionId);
    if (!hasEmbeddings) {
      throw new BadRequestException('No embeddings found for this connection. Run schema discovery first.');
    }

    const [embedding] = await this.embeddingPort.generateEmbeddings([request.question]);
    const relevantColumns = await this.schemaRetrievalPort.findRelevantColumns(
      request.connectionId,
      embedding,
      TOP_K,
    );

    const schemaContext = buildSchemaContext(relevantColumns);
    const knownSchema = this.buildKnownSchema(relevantColumns);
    let currentPrompt = this.buildPrompt(request.question, schemaContext);
    let lastError: Error | null = null;

    await this.tenantDatabasePort.connect({
      host: connection.host,
      port: connection.port,
      database: connection.databaseName,
      username: connection.username,
      password: connection.password,
    });

    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const llmResponse = await this.llmPort.generateQuery(currentPrompt);

        const selectValidation = validateSelectOnly(llmResponse.sql);
        if (!selectValidation.valid) {
          lastError = new Error(`SQL validation failed: ${selectValidation.reason}`);
          currentPrompt = buildRetryPrompt({
            question: request.question,
            schemaContext,
            failedSql: llmResponse.sql,
            errorMessage: selectValidation.reason!,
            attempt: attempt + 1,
          });
          continue;
        }

        const tableValidation = validateTableReferences(llmResponse.sql, knownSchema);
        if (!tableValidation.valid) {
          lastError = new Error(`SQL validation failed: ${tableValidation.reason}`);
          currentPrompt = buildRetryPrompt({
            question: request.question,
            schemaContext,
            failedSql: llmResponse.sql,
            errorMessage: tableValidation.reason!,
            attempt: attempt + 1,
          });
          continue;
        }

        try {
          const queryResult = await Promise.race([
            this.tenantDatabasePort.query(llmResponse.sql),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Query timeout exceeded')), QUERY_TIMEOUT_MS),
            ),
          ]);

          return {
            intent: llmResponse.intent,
            title: llmResponse.title,
            sql: llmResponse.sql,
            columns: llmResponse.columns,
            rows: queryResult.rows,
            attempts: attempt,
          };
        } catch (error) {
          lastError = error as Error;
          currentPrompt = buildRetryPrompt({
            question: request.question,
            schemaContext,
            failedSql: llmResponse.sql,
            errorMessage: lastError.message,
            attempt: attempt + 1,
          });
        }
      }

      throw new BadRequestException(
        `Query failed after ${MAX_ATTEMPTS} attempts: ${lastError?.message}`,
      );
    } finally {
      await this.tenantDatabasePort.disconnect();
    }
  }

  private buildPrompt(question: string, schemaContext: string): string {
    return `You have access to the following database schema:\n\n${schemaContext}\n\nAnswer the following business question by generating a SQL query:\n\n${question}`;
  }

  private buildKnownSchema(columns: { tableName: string; columnName: string }[]) {
    const tableMap = new Map<string, string[]>();
    for (const col of columns) {
      const existing = tableMap.get(col.tableName) ?? [];
      existing.push(col.columnName);
      tableMap.set(col.tableName, existing);
    }
    return Array.from(tableMap.entries()).map(([tableName, cols]) => ({
      tableName,
      columns: cols,
    }));
  }
}
