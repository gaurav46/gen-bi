import { Module } from '@nestjs/common';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { AppDatabaseModule } from '../database/app-database.module';

@Module({
  imports: [AppDatabaseModule],
  controllers: [ConnectionsController],
  providers: [
    ConnectionsService,
    { provide: 'ConnectionsService', useExisting: ConnectionsService },
  ],
  exports: [ConnectionsService, 'ConnectionsService', AppDatabaseModule],
})
export class ConnectionsModule {}
