import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { ConnectionsModule } from './connections/connections.module';
import { SchemaDiscoveryModule } from './schema-discovery/schema-discovery.module';

@Module({
  imports: [ConnectionsModule, SchemaDiscoveryModule],
  controllers: [HealthController],
})
export class AppModule {}
