import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ConnectionsService } from './connections.service';

@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  @Post()
  async create(@Body() body: { host: string; port: number; databaseName: string; username: string; password: string }) {
    return this.connectionsService.create(body);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.connectionsService.findOne(id);
  }
}
