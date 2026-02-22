import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SchemaController } from './schema.controller';
import { SchemaDiscoveryService } from './schema-discovery.service';
import { TableRowsService } from './table-rows.service';

const mockService = {
  analyzeSchemas: vi.fn(),
  getDiscoveredTables: vi.fn(),
  getDiscoveryStatus: vi.fn(),
  getAnnotations: vi.fn(),
  saveAnnotations: vi.fn(),
  embedColumns: vi.fn(),
};

const mockTableRowsService = {
  fetchRows: vi.fn(),
};

describe('SchemaController', () => {
  let controller: SchemaController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchemaController],
      providers: [
        { provide: SchemaDiscoveryService, useValue: mockService },
        { provide: TableRowsService, useValue: mockTableRowsService },
      ],
    }).compile();

    controller = module.get<SchemaController>(SchemaController);
  });

  it('POST /schema/discover delegates to SchemaDiscoveryService.analyzeSchemas', async () => {
    mockService.analyzeSchemas.mockResolvedValue({ tablesDiscovered: 5 });

    const result = await controller.discover({ connectionId: 'conn-id', schemas: ['public', 'sales'] });

    expect(mockService.analyzeSchemas).toHaveBeenCalledWith('conn-id', ['public', 'sales']);
    expect(result).toEqual({ tablesDiscovered: 5 });
  });

  it('GET /schema/:connectionId/tables returns discovered metadata', async () => {
    const metadata = [{ schemaName: 'public', tableName: 'users', columns: [] }];
    mockService.getDiscoveredTables.mockResolvedValue(metadata);

    const result = await controller.getDiscoveredTables('conn-id');

    expect(mockService.getDiscoveredTables).toHaveBeenCalledWith('conn-id');
    expect(result).toEqual(metadata);
  });

  it('GET rows delegates to TableRowsService and returns result', async () => {
    const cannedResult = {
      rows: [{ id: 1, name: 'Alice' }],
      totalRows: 42,
      page: 2,
      pageSize: 25,
      primaryKeyColumns: ['id'],
    };
    mockTableRowsService.fetchRows.mockResolvedValue(cannedResult);

    const result = await controller.getTableRows('conn-id', 'public', 'users', '2');

    expect(mockTableRowsService.fetchRows).toHaveBeenCalledWith('conn-id', 'public', 'users', 2);
    expect(result).toEqual(cannedResult);
  });

  it('GET rows defaults to page 1 when query param is omitted', async () => {
    mockTableRowsService.fetchRows.mockResolvedValue({ rows: [], totalRows: 0, page: 1, pageSize: 25, primaryKeyColumns: [] });

    await controller.getTableRows('conn-id', 'public', 'users', undefined as unknown as string);

    expect(mockTableRowsService.fetchRows).toHaveBeenCalledWith('conn-id', 'public', 'users', 1);
  });

  it('GET rows returns 400 when page is less than 1', async () => {
    mockTableRowsService.fetchRows.mockRejectedValue(new BadRequestException('Page must be >= 1'));

    await expect(controller.getTableRows('conn-id', 'public', 'users', '0')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('GET rows returns 404 when connection does not exist', async () => {
    mockTableRowsService.fetchRows.mockRejectedValue(new NotFoundException('Connection not found'));

    await expect(controller.getTableRows('conn-id', 'public', 'users', '1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('GET /schema/:connectionId/annotations delegates to service', async () => {
    const cannedAnnotations = {
      columns: [{ columnId: 'col-1', tableName: 'orders', columnName: 'amt_1', suggestedDescription: 'Amount' }],
    };
    mockService.getAnnotations.mockResolvedValue(cannedAnnotations);

    const result = await controller.getAnnotations('conn-id');

    expect(mockService.getAnnotations).toHaveBeenCalledWith('conn-id');
    expect(result).toEqual(cannedAnnotations);
  });

  it('GET /schema/discover/status returns current analysis progress', () => {
    const progress = { status: 'analyzing', current: 3, total: 12, message: 'Analyzing table 3 of 12' };
    mockService.getDiscoveryStatus.mockReturnValue(progress);

    const result = controller.getDiscoveryStatus();

    expect(mockService.getDiscoveryStatus).toHaveBeenCalled();
    expect(result).toEqual(progress);
  });

  it('PATCH /schema/:connectionId/annotations delegates to service', async () => {
    mockService.saveAnnotations.mockResolvedValue({ updated: 1 });

    const result = await controller.saveAnnotations('conn-id', {
      annotations: [{ columnId: 'col-1', description: 'Order subtotal' }],
    });

    expect(mockService.saveAnnotations).toHaveBeenCalledWith('conn-id', [
      { columnId: 'col-1', description: 'Order subtotal' },
    ]);
    expect(result).toEqual({ updated: 1 });
  });

  it('POST /schema/:connectionId/embed delegates to service', async () => {
    mockService.embedColumns.mockResolvedValue(undefined);

    const result = await controller.embed('conn-id');

    expect(mockService.embedColumns).toHaveBeenCalledWith('conn-id');
    expect(result).toEqual({ status: 'started' });
  });
});
