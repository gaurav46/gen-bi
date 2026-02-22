import { Controller, Post, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { SchemaDiscoveryService } from './schema-discovery.service';
import { TableRowsService } from './table-rows.service';

@Controller('schema')
export class SchemaController {
  constructor(
    private readonly schemaDiscoveryService: SchemaDiscoveryService,
    private readonly tableRowsService: TableRowsService,
  ) {}

  @Get('discover/status')
  getDiscoveryStatus() {
    return this.schemaDiscoveryService.getDiscoveryStatus();
  }

  @Post('discover')
  discover(@Body() body: { connectionId: string; schemas: string[] }) {
    return this.schemaDiscoveryService.analyzeSchemas(body.connectionId, body.schemas);
  }

  @Get(':connectionId/annotations')
  getAnnotations(@Param('connectionId') connectionId: string) {
    return this.schemaDiscoveryService.getAnnotations(connectionId);
  }

  @Patch(':connectionId/annotations')
  saveAnnotations(
    @Param('connectionId') connectionId: string,
    @Body() body: { annotations: { columnId: string; description: string }[] },
  ) {
    return this.schemaDiscoveryService.saveAnnotations(connectionId, body.annotations);
  }

  @Post(':connectionId/embed')
  async embed(@Param('connectionId') connectionId: string) {
    this.schemaDiscoveryService.embedColumns(connectionId);
    return { status: 'started' };
  }

  @Get(':connectionId/tables')
  getDiscoveredTables(@Param('connectionId') connectionId: string) {
    return this.schemaDiscoveryService.getDiscoveredTables(connectionId);
  }

  @Get(':connectionId/tables/:schemaName/:tableName/rows')
  getTableRows(
    @Param('connectionId') connectionId: string,
    @Param('schemaName') schemaName: string,
    @Param('tableName') tableName: string,
    @Query('page') page?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    return this.tableRowsService.fetchRows(connectionId, schemaName, tableName, pageNumber);
  }
}
