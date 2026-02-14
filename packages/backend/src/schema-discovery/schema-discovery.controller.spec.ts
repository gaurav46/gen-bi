import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionsController } from '../connections/connections.controller';
import { ConnectionsService } from '../connections/connections.service';
import { SchemaDiscoveryService } from './schema-discovery.service';

const mockConnectionsService = {
  create: vi.fn(),
  findOne: vi.fn(),
};

const mockSchemaDiscoveryService = {
  testConnection: vi.fn(),
};

describe('Schema Discovery Controller Behavior', () => {
  let controller: ConnectionsController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConnectionsController],
      providers: [
        { provide: ConnectionsService, useValue: mockConnectionsService },
        { provide: SchemaDiscoveryService, useValue: mockSchemaDiscoveryService },
      ],
    }).compile();

    controller = module.get<ConnectionsController>(ConnectionsController);
  });

  it('POST /connections/:id/test delegates to SchemaDiscoveryService and returns schemas', async () => {
    mockSchemaDiscoveryService.testConnection.mockResolvedValue({
      schemas: ['public', 'sales'],
    });

    const result = await controller.testConnection('conn-id');

    expect(mockSchemaDiscoveryService.testConnection).toHaveBeenCalledWith('conn-id');
    expect(result).toEqual({ schemas: ['public', 'sales'] });
  });
});
