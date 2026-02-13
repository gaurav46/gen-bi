import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { ConnectionsModule } from './connections/connections.module';

@Module({
  imports: [ConnectionsModule],
  controllers: [HealthController],
})
export class AppModule {}
