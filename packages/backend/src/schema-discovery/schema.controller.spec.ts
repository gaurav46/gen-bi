import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SchemaController } from './schema.controller';
import { SchemaDiscoveryService } from './schema-discovery.service';

const mockService = {
  analyzeSchemas: vi.fn(),
  getDiscoveredTables: vi.fn(),
  getDiscoveryStatus: vi.fn(),
};

describe('SchemaController', () => {
  let controller: SchemaController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchemaController],
      providers: [{ provide: SchemaDiscoveryService, useValue: mockService }],
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

  it('GET /schema/discover/status returns current analysis progress', () => {
    const progress = { status: 'analyzing', current: 3, total: 12, message: 'Analyzing table 3 of 12' };
    mockService.getDiscoveryStatus.mockReturnValue(progress);

    const result = controller.getDiscoveryStatus();

    expect(mockService.getDiscoveryStatus).toHaveBeenCalled();
    expect(result).toEqual(progress);
  });
});
