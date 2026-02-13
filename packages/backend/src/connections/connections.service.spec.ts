import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionsService, PRISMA_CLIENT } from './connections.service';

const mockPrisma = {
  connectionConfig: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
};

describe('ConnectionsService', () => {
  let service: ConnectionsService;

  beforeEach(async () => {
    vi.stubEnv('ENCRYPTION_KEY', 'a'.repeat(64));
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectionsService,
        { provide: PRISMA_CLIENT, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ConnectionsService>(ConnectionsService);
  });

  it('saves connection config and encrypts password', async () => {
    mockPrisma.connectionConfig.create.mockResolvedValue({
      id: 'test-id',
      host: 'localhost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      encryptedPassword: 'encrypted-value',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create({
      host: 'localhost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      password: 'secret',
    });

    expect(mockPrisma.connectionConfig.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        host: 'localhost',
        port: 5432,
        databaseName: 'mydb',
        username: 'admin',
        encryptedPassword: expect.not.stringContaining('secret'),
      }),
    });
    expect(result).toHaveProperty('id');
    expect(result).not.toHaveProperty('password');
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('password is never returned as plain text from POST response', async () => {
    mockPrisma.connectionConfig.create.mockResolvedValue({
      id: 'test-id',
      host: 'localhost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      encryptedPassword: 'encrypted-value',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create({
      host: 'localhost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      password: 'my-super-secret-password',
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('my-super-secret-password');
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('encryptedPassword');
  });

  it('encrypted password differs from plain text password', async () => {
    const { encrypt } = await import('./encryption');
    const encrypted = encrypt('secret');
    expect(encrypted).not.toBe('secret');
    expect(encrypted.length).toBeGreaterThan(0);
  });

  it('returns 404 when config not found', async () => {
    mockPrisma.connectionConfig.findUnique.mockResolvedValue(null);

    await expect(service.findOne('non-existent-id')).rejects.toThrow('not found');
  });

  it('handles very long host names', async () => {
    const longHost = 'a'.repeat(253);
    mockPrisma.connectionConfig.create.mockResolvedValue({
      id: 'test-id',
      host: longHost,
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      encryptedPassword: 'encrypted',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create({
      host: longHost,
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      password: 'secret',
    });

    expect(result.host).toBe(longHost);
  });

  it('loads connection config and decrypts password', async () => {
    const { encrypt } = await import('./encryption');
    const encryptedPassword = encrypt('secret');

    mockPrisma.connectionConfig.findUnique.mockResolvedValue({
      id: 'test-id',
      host: 'localhost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      encryptedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.findOne('test-id');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'test-id',
        host: 'localhost',
        port: 5432,
        databaseName: 'mydb',
        username: 'admin',
        password: 'secret',
      }),
    );
  });
});
