import { Module, forwardRef } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { SchemaDiscoveryService, TENANT_DATABASE_PORT } from './schema-discovery.service';
import { TenantDatabaseAdapter } from './tenant-database.adapter';

@Module({
  imports: [forwardRef(() => ConnectionsModule)],
  providers: [
    SchemaDiscoveryService,
    TenantDatabaseAdapter,
    {
      provide: TENANT_DATABASE_PORT,
      useExisting: TenantDatabaseAdapter,
    },
  ],
  exports: [SchemaDiscoveryService],
})
export class SchemaDiscoveryModule {}
