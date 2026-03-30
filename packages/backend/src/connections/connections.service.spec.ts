import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionsService } from './connections.service';
import { DRIZZLE_CLIENT } from '../infrastructure/drizzle/client';

const insertReturningMock = vi.fn();
const selectFromWhereMock = vi.fn();

const mockDb = {
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: insertReturningMock,
    }),
  }),
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: selectFromWhereMock,
    }),
  }),
};

describe('ConnectionsService', () => {
  let service: ConnectionsService;

  beforeEach(async () => {
    vi.stubEnv('ENCRYPTION_KEY', 'a'.repeat(64));
    vi.clearAllMocks();

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: insertReturningMock,
      }),
    });

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: selectFromWhereMock,
      }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectionsService,
        { provide: DRIZZLE_CLIENT, useValue: mockDb },
      ],
    }).compile();

    service = module.get<ConnectionsService>(ConnectionsService);
  });

  it('saves connection config and encrypts password', async () => {
    insertReturningMock.mockResolvedValue([{
      id: 'test-id',
      host: 'localhost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      encryptedPassword: 'encrypted-value',
      dbType: 'postgresql',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const result = await service.create({
      host: 'localhost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      password: 'secret',
    });

    expect(mockDb.insert).toHaveBeenCalled();
    const valuesCall = mockDb.insert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'localhost',
        port: 5432,
        databaseName: 'mydb',
        username: 'admin',
        encryptedPassword: expect.not.stringContaining('secret'),
      }),
    );
    expect(result).toHaveProperty('id');
    expect(result).not.toHaveProperty('password');
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('password is never returned as plain text from POST response', async () => {
    insertReturningMock.mockResolvedValue([{
      id: 'test-id',
      host: 'localhost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      encryptedPassword: 'encrypted-value',
      dbType: 'postgresql',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

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
    selectFromWhereMock.mockResolvedValue([]);

    await expect(service.findOne('non-existent-id')).rejects.toThrow('not found');
  });

  it('findOne throws NotFoundException (not a generic Error) when row is absent', async () => {
    selectFromWhereMock.mockResolvedValue([]);

    await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('handles very long host names', async () => {
    const longHost = 'a'.repeat(253);
    insertReturningMock.mockResolvedValue([{
      id: 'test-id',
      host: longHost,
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      encryptedPassword: 'encrypted',
      dbType: 'postgresql',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const result = await service.create({
      host: longHost,
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      password: 'secret',
    });

    expect(result.host).toBe(longHost);
  });

  it('getTenantConnectionConfig maps databaseName to database', async () => {
    const { encrypt } = await import('./encryption');
    const encryptedPassword = encrypt('secret');

    selectFromWhereMock.mockResolvedValue([{
      id: 'test-id',
      host: 'localhost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      encryptedPassword,
      dbType: 'postgresql',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const result = await service.getTenantConnectionConfig('test-id');

    expect(result).toEqual({
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      username: 'admin',
      password: 'secret',
      dbType: 'postgresql',
      encrypt: false,
    });
  });

  it('loads connection config and decrypts password', async () => {
    const { encrypt } = await import('./encryption');
    const encryptedPassword = encrypt('secret');

    selectFromWhereMock.mockResolvedValue([{
      id: 'test-id',
      host: 'localhost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      encryptedPassword,
      dbType: 'postgresql',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

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

  // --- Slice 1: dbType field ---

  it('create stores sqlserver dbType when provided', async () => {
    insertReturningMock.mockResolvedValue([{
      id: 'test-id',
      host: 'sqlhost',
      port: 1433,
      databaseName: 'mydb',
      username: 'sa',
      encryptedPassword: 'encrypted',
      dbType: 'sqlserver',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const result = await service.create({
      host: 'sqlhost',
      port: 1433,
      databaseName: 'mydb',
      username: 'sa',
      password: 'secret',
      dbType: 'sqlserver',
    });

    const valuesCall = mockDb.insert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({ dbType: 'sqlserver' }),
    );
    expect(result.dbType).toBe('sqlserver');
  });

  it('create defaults dbType to postgresql when omitted', async () => {
    insertReturningMock.mockResolvedValue([{
      id: 'test-id',
      host: 'pghost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      encryptedPassword: 'encrypted',
      dbType: 'postgresql',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const result = await service.create({
      host: 'pghost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      password: 'secret',
    });

    const valuesCall = mockDb.insert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({ dbType: 'postgresql' }),
    );
    expect(result.dbType).toBe('postgresql');
  });

  it('findOne returns dbType from stored value', async () => {
    const { encrypt } = await import('./encryption');
    const encryptedPassword = encrypt('secret');

    selectFromWhereMock.mockResolvedValue([{
      id: 'test-id',
      host: 'sqlhost',
      port: 1433,
      databaseName: 'mydb',
      username: 'sa',
      encryptedPassword,
      dbType: 'sqlserver',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const result = await service.findOne('test-id');

    expect(result.dbType).toBe('sqlserver');
  });

  it('findOne coerces null dbType (pre-migration row) to postgresql', async () => {
    const { encrypt } = await import('./encryption');
    const encryptedPassword = encrypt('secret');

    selectFromWhereMock.mockResolvedValue([{
      id: 'test-id',
      host: 'localhost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      encryptedPassword,
      dbType: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const result = await service.findOne('test-id');

    expect(result.dbType).toBe('postgresql');
  });

  it('getTenantConnectionConfig returns sqlserver dbType when stored as sqlserver', async () => {
    const { encrypt } = await import('./encryption');
    const encryptedPassword = encrypt('secret');

    selectFromWhereMock.mockResolvedValue([{
      id: 'test-id',
      host: 'sqlhost',
      port: 1433,
      databaseName: 'mydb',
      username: 'sa',
      encryptedPassword,
      dbType: 'sqlserver',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const result = await service.getTenantConnectionConfig('test-id');

    expect(result.dbType).toBe('sqlserver');
  });

  it('getTenantConnectionConfig coerces null dbType (pre-migration row) to postgresql', async () => {
    const { encrypt } = await import('./encryption');
    const encryptedPassword = encrypt('secret');

    selectFromWhereMock.mockResolvedValue([{
      id: 'test-id',
      host: 'localhost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      encryptedPassword,
      dbType: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const result = await service.getTenantConnectionConfig('test-id');

    expect(result.dbType).toBe('postgresql');
  });

  it('getTenantConnectionConfig includes dbType in the full TenantConnectionConfig shape', async () => {
    const { encrypt } = await import('./encryption');
    const encryptedPassword = encrypt('secret');

    selectFromWhereMock.mockResolvedValue([{
      id: 'test-id',
      host: 'localhost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      encryptedPassword,
      dbType: 'postgresql',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const result = await service.getTenantConnectionConfig('test-id');

    expect(result).toMatchObject({
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      username: 'admin',
      dbType: 'postgresql',
    });
    expect(result).toHaveProperty('password');
  });

  // --- Slice 5: encrypt field ---

  it('getTenantConnectionConfig returns encrypt: true when the persisted value is true', async () => {
    const { encrypt } = await import('./encryption');
    const encryptedPassword = encrypt('secret');

    selectFromWhereMock.mockResolvedValue([{
      id: 'test-id',
      host: 'sqlhost',
      port: 1433,
      databaseName: 'mydb',
      username: 'sa',
      encryptedPassword,
      dbType: 'sqlserver',
      encrypt: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const result = await service.getTenantConnectionConfig('test-id');

    expect(result.encrypt).toBe(true);
  });

  it('getTenantConnectionConfig returns encrypt: false when the persisted value is null', async () => {
    const { encrypt } = await import('./encryption');
    const encryptedPassword = encrypt('secret');

    selectFromWhereMock.mockResolvedValue([{
      id: 'test-id',
      host: 'sqlhost',
      port: 1433,
      databaseName: 'mydb',
      username: 'sa',
      encryptedPassword,
      dbType: 'sqlserver',
      encrypt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    const result = await service.getTenantConnectionConfig('test-id');

    expect(result.encrypt).toBe(false);
  });

  it('create persists encrypt: true when provided in the DTO', async () => {
    insertReturningMock.mockResolvedValue([{
      id: 'test-id',
      host: 'sqlhost',
      port: 1433,
      databaseName: 'mydb',
      username: 'sa',
      encryptedPassword: 'encrypted',
      dbType: 'sqlserver',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    await service.create({
      host: 'sqlhost',
      port: 1433,
      databaseName: 'mydb',
      username: 'sa',
      password: 'secret',
      dbType: 'sqlserver',
      encrypt: true,
    });

    const valuesCall = mockDb.insert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({ encrypt: true }),
    );
  });

  it('create persists encrypt as null when not provided in the DTO', async () => {
    insertReturningMock.mockResolvedValue([{
      id: 'test-id',
      host: 'pghost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      encryptedPassword: 'encrypted',
      dbType: 'postgresql',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);

    await service.create({
      host: 'pghost',
      port: 5432,
      databaseName: 'mydb',
      username: 'admin',
      password: 'secret',
    });

    const valuesCall = mockDb.insert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({ encrypt: null }),
    );
  });
});
