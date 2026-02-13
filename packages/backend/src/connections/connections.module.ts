import { Module } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService, PRISMA_CLIENT } from './connections.service';

@Module({
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
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
