import { Module, forwardRef } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService, PRISMA_CLIENT } from './connections.service';
import { SchemaDiscoveryModule } from '../schema-discovery/schema-discovery.module';

@Module({
  imports: [forwardRef(() => SchemaDiscoveryModule)],
  controllers: [ConnectionsController],
  providers: [
    ConnectionsService,
    {
      provide: PRISMA_CLIENT,
      useFactory: () => {
        const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
        return new PrismaClient({ adapter });
      },
    },
  ],
  exports: [ConnectionsService, PRISMA_CLIENT],
})
export class ConnectionsModule {}
