import { Module, forwardRef } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { SchemaDiscoveryService, TENANT_DATABASE_PORT } from './schema-discovery.service';
import { TenantDatabaseAdapter } from './tenant-database.adapter';
import { OpenAIEmbeddingAdapter } from './openai-embedding.adapter';
import { EMBEDDING_PORT } from './embedding.port';
import { SchemaController } from './schema.controller';
import { TableRowsService } from './table-rows.service';

@Module({
  imports: [forwardRef(() => ConnectionsModule)],
  controllers: [SchemaController],
  providers: [
    SchemaDiscoveryService,
    TableRowsService,
    TenantDatabaseAdapter,
    {
      provide: TENANT_DATABASE_PORT,
      useExisting: TenantDatabaseAdapter,
    },
    OpenAIEmbeddingAdapter,
    {
      provide: EMBEDDING_PORT,
      useExisting: OpenAIEmbeddingAdapter,
    },
  ],
  exports: [SchemaDiscoveryService, EMBEDDING_PORT, TENANT_DATABASE_PORT],
})
export class SchemaDiscoveryModule {}
