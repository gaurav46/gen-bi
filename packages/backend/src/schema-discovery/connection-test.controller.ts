import { Controller, Post, Param } from '@nestjs/common';
import { SchemaDiscoveryService } from './schema-discovery.service';

@Controller('connections')
export class ConnectionTestController {
  constructor(
    private readonly schemaDiscoveryService: SchemaDiscoveryService,
  ) {}

  @Post(':id/test')
  testConnection(@Param('id') id: string) {
    return this.schemaDiscoveryService.testConnection(id);
  }
}
