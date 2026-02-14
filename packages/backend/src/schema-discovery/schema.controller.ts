import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { SchemaDiscoveryService } from './schema-discovery.service';

@Controller('schema')
export class SchemaController {
  constructor(private readonly schemaDiscoveryService: SchemaDiscoveryService) {}

  @Get('discover/status')
  getDiscoveryStatus() {
    return this.schemaDiscoveryService.getDiscoveryStatus();
  }

  @Post('discover')
  discover(@Body() body: { connectionId: string; schemas: string[] }) {
    return this.schemaDiscoveryService.analyzeSchemas(body.connectionId, body.schemas);
  }

  @Get(':connectionId/tables')
  getDiscoveredTables(@Param('connectionId') connectionId: string) {
    return this.schemaDiscoveryService.getDiscoveredTables(connectionId);
  }
}
