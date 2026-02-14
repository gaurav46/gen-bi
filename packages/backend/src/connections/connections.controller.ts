import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { SchemaDiscoveryService } from '../schema-discovery/schema-discovery.service';

@Controller('connections')
export class ConnectionsController {
  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly schemaDiscoveryService: SchemaDiscoveryService
  ) {}

  @Post()
  async create(@Body() body: { host: string; port: number; databaseName: string; username: string; password: string }) {
    return this.connectionsService.create(body);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.connectionsService.findOne(id);
  }

  @Post(':id/test')
  async testConnection(@Param('id') id: string) {
    return this.schemaDiscoveryService.testConnection(id);
  }
}
