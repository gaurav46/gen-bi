import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { ConnectionsModule } from './connections/connections.module';
import { SchemaDiscoveryModule } from './schema-discovery/schema-discovery.module';
import { QueryModule } from './query/query.module';
import { DashboardsModule } from './dashboards/dashboards.module';

@Module({
  imports: [ConnectionsModule, SchemaDiscoveryModule, QueryModule, DashboardsModule],
  controllers: [HealthController],
})
export class AppModule {}
