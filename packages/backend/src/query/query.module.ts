import { Module, forwardRef } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { SchemaDiscoveryModule } from '../schema-discovery/schema-discovery.module';
import { QueryService } from './query.service';
import { QueryController } from './query.controller';
import { ClaudeAdapter } from './claude.adapter';
import { LLM_PORT } from './llm.port';
import { DrizzleSchemaRetrievalAdapter } from './drizzle-schema-retrieval.adapter';
import { SCHEMA_RETRIEVAL_PORT } from './schema-retrieval.port';

@Module({
  imports: [
    forwardRef(() => ConnectionsModule),
    forwardRef(() => SchemaDiscoveryModule),
  ],
  controllers: [QueryController],
  providers: [
    QueryService,
    ClaudeAdapter,
    {
      provide: LLM_PORT,
      useExisting: ClaudeAdapter,
    },
    DrizzleSchemaRetrievalAdapter,
    {
      provide: SCHEMA_RETRIEVAL_PORT,
      useExisting: DrizzleSchemaRetrievalAdapter,
    },
  ],
})
export class QueryModule {}
