import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConnectionsService } from '../connections/connections.service';
import type { LlmPort } from './llm.port';
import { LLM_PORT } from './llm.port';
import type { EmbeddingPort } from '../schema-discovery/embedding.port';
import { EMBEDDING_PORT } from '../schema-discovery/embedding.port';
import type { SchemaRetrievalPort } from './schema-retrieval.port';
import { SCHEMA_RETRIEVAL_PORT } from './schema-retrieval.port';
import type { TenantDatabasePort } from '../schema-discovery/tenant-database.port';
import { TENANT_DATABASE_PORT } from '../schema-discovery/schema-discovery.service';
import type { QueryRequest, QueryResponse, SampleRows } from './query.types';
import { buildSchemaContext } from './schema-context-builder';
import { buildRetryPrompt } from './retry-prompt-builder';
import { validateSelectOnly } from './sql-validator';

const QUERY_TIMEOUT_MS = 10_000;
const TOP_K = 20;
const MAX_ATTEMPTS = 3;

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);

  constructor(
    private readonly connectionsService: ConnectionsService,
    @Inject(LLM_PORT) private readonly llmPort: LlmPort,
    @Inject(EMBEDDING_PORT) private readonly embeddingPort: EmbeddingPort,
    @Inject(SCHEMA_RETRIEVAL_PORT) private readonly schemaRetrievalPort: SchemaRetrievalPort,
    @Inject(TENANT_DATABASE_PORT) private readonly tenantDatabasePort: TenantDatabasePort,
  ) {}

  async query(request: QueryRequest): Promise<QueryResponse> {
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

    const config = await this.connectionsService.getTenantConnectionConfig(request.connectionId);
    await this.tenantDatabasePort.connect(config);

    const sampleRows = await this.fetchSampleRows(relevantColumns);
    const schemaContext = buildSchemaContext(relevantColumns, sampleRows);
    let currentPrompt = this.buildPrompt(request.question, schemaContext);
    let lastError: Error | null = null;

    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const llmResponse = await this.llmPort.generateQuery(currentPrompt, config.dbType);
        this.logger.log(`[Attempt ${attempt}/${MAX_ATTEMPTS}] Generated SQL: ${llmResponse.sql}`);

        const selectValidation = validateSelectOnly(llmResponse.sql);
        if (!selectValidation.valid) {
          this.logger.warn(`[Attempt ${attempt}/${MAX_ATTEMPTS}] SELECT-only validation failed: ${selectValidation.reason}`);
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

        this.logger.log(`[Attempt ${attempt}/${MAX_ATTEMPTS}] Validation passed, executing query`);

        try {
          const queryResult = await Promise.race([
            this.tenantDatabasePort.query(llmResponse.sql),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Query timeout exceeded')), QUERY_TIMEOUT_MS),
            ),
          ]);

          this.logger.log(`[Attempt ${attempt}/${MAX_ATTEMPTS}] Query succeeded, ${queryResult.rows.length} rows returned`);

          return {
            intent: llmResponse.intent,
            title: llmResponse.title,
            sql: llmResponse.sql,
            visualization: llmResponse.visualization,
            columns: llmResponse.columns,
            rows: queryResult.rows,
            attempts: attempt,
          };
        } catch (error) {
          lastError = error as Error;
          this.logger.warn(`[Attempt ${attempt}/${MAX_ATTEMPTS}] Query execution failed: ${lastError.message}`);
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

  private async fetchSampleRows(columns: { tableName: string }[]): Promise<SampleRows> {
    const tableNames = [...new Set(columns.map(c => c.tableName))];
    const sampleRows: SampleRows = new Map();

    for (const table of tableNames) {
      try {
        const result = await this.tenantDatabasePort.query(`SELECT * FROM "${table}" LIMIT 5`);
        sampleRows.set(table, result.rows);
      } catch (error) {
        this.logger.warn(`Failed to fetch sample rows for ${table}: ${(error as Error).message}`);
      }
    }

    return sampleRows;
  }

  private buildPrompt(question: string, schemaContext: string): string {
    return `You have access to the following database schema:\n\n${schemaContext}\n\nAnswer the following business question by generating a SQL query:\n\n${question}`;
  }


}
