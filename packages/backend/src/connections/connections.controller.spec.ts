import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';

const mockService = {
  create: vi.fn(),
  findOne: vi.fn(),
};

describe('ConnectionsController', () => {
  let controller: ConnectionsController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConnectionsController],
      providers: [{ provide: ConnectionsService, useValue: mockService }],
    }).compile();

    controller = module.get<ConnectionsController>(ConnectionsController);
  });

  it('POST /api/connections saves and returns config', async () => {
    const savedConfig = {
      id: 'test-id',
      host: 'localhost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockService.create.mockResolvedValue(savedConfig);

    const result = await controller.create({
      host: 'localhost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      password: 'secret',
    });

    expect(result).toEqual(savedConfig);
    expect(mockService.create).toHaveBeenCalledWith({
      host: 'localhost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      password: 'secret',
    });
  });

  it('GET /api/connections/:id returns saved config', async () => {
    const config = {
      id: 'test-id',
      host: 'localhost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      password: 'secret',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockService.findOne.mockResolvedValue(config);

    const result = await controller.findOne('test-id');

    expect(result).toEqual(config);
    expect(mockService.findOne).toHaveBeenCalledWith('test-id');
  });
});
