import { Module } from '@nestjs/common';
import { DRIZZLE_CLIENT, createDrizzleClient } from '../infrastructure/drizzle/client';

@Module({
  providers: [
    {
      provide: DRIZZLE_CLIENT,
      useFactory: () => createDrizzleClient(),
    },
  ],
  exports: [DRIZZLE_CLIENT],
})
export class AppDatabaseModule {}
