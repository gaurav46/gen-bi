import { Module } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { AppDatabaseModule } from '../database/app-database.module';
import { SchemaDiscoveryService, TENANT_DATABASE_PORT } from './schema-discovery.service';
import { TenantDatabaseAdapter } from './tenant-database.adapter';
import { SqlServerTenantDatabaseAdapter } from './sqlserver-tenant-database.adapter';
import { TenantDatabaseDispatcher } from './tenant-database.dispatcher';
import { OpenAIEmbeddingAdapter } from './openai-embedding.adapter';
import { EMBEDDING_PORT } from './embedding.port';
import { DESCRIPTION_SUGGESTION_PORT } from './description-suggestion.port';
import { ClaudeDescriptionAdapter } from './claude-description.adapter';
import { SchemaController } from './schema.controller';
import { ConnectionTestController } from './connection-test.controller';
import { TableRowsService } from './table-rows.service';

@Module({
  imports: [AppDatabaseModule, ConnectionsModule],
  controllers: [SchemaController, ConnectionTestController],
  providers: [
    SchemaDiscoveryService,
    TableRowsService,
    TenantDatabaseAdapter,
    SqlServerTenantDatabaseAdapter,
    TenantDatabaseDispatcher,
    {
      provide: TENANT_DATABASE_PORT,
      useExisting: TenantDatabaseDispatcher,
    },
    OpenAIEmbeddingAdapter,
    {
      provide: EMBEDDING_PORT,
      useExisting: OpenAIEmbeddingAdapter,
    },
    ClaudeDescriptionAdapter,
    {
      provide: DESCRIPTION_SUGGESTION_PORT,
      useExisting: ClaudeDescriptionAdapter,
    },
  ],
  exports: [SchemaDiscoveryService, EMBEDDING_PORT, TENANT_DATABASE_PORT],
})
export class SchemaDiscoveryModule {}
