import { Controller, Post, Get, Delete, Patch, Body, Param, Query, HttpCode, BadRequestException } from '@nestjs/common';
import { DashboardsService } from './dashboards.service';
import type { CreateDashboardDto, CreateWidgetDto, UpdateWidgetDto } from './dashboards.types';

@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Post()
  @HttpCode(201)
  create(@Body() body: CreateDashboardDto) {
    return this.dashboardsService.createDashboard(body);
  }

  @Get()
  list(@Query('connectionId') connectionId: string) {
    if (!connectionId) throw new BadRequestException('connectionId is required');
    return this.dashboardsService.listDashboards(connectionId);
  }

  @Get(':id')
  getDashboard(@Param('id') id: string) {
    return this.dashboardsService.getDashboard(id);
  }

  @Post(':id/widgets')
  @HttpCode(201)
  addWidget(@Param('id') id: string, @Body() body: CreateWidgetDto) {
    return this.dashboardsService.addWidget(id, body);
  }

  @Post(':dashboardId/widgets/:widgetId/execute')
  executeWidget(@Param('dashboardId') dashboardId: string, @Param('widgetId') widgetId: string) {
    return this.dashboardsService.executeWidgetSql(dashboardId, widgetId);
  }

  @Patch(':id/widgets/:widgetId')
  updateWidget(@Param('id') id: string, @Param('widgetId') widgetId: string, @Body() body: UpdateWidgetDto) {
    if (!body.title && !body.legendLabels) {
      throw new BadRequestException('At least one field must be provided');
    }
    return this.dashboardsService.updateWidget(id, widgetId, body);
  }

  @Delete(':id/widgets/:widgetId')
  @HttpCode(204)
  removeWidget(@Param('id') id: string, @Param('widgetId') widgetId: string) {
    return this.dashboardsService.removeWidget(id, widgetId);
  }

  @Delete(':id')
  @HttpCode(204)
  deleteDashboard(@Param('id') id: string) {
    return this.dashboardsService.deleteDashboard(id);
  }
}