import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from './encryption';
import type { TenantConnectionConfig } from '../schema-discovery/tenant-database.port';
import { DRIZZLE_CLIENT, type AppDatabase } from '../infrastructure/drizzle/client';
import * as tables from '../infrastructure/drizzle/schema';

interface CreateConnectionDto {
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password: string;
  dbType?: 'postgresql' | 'sqlserver';
  encrypt?: boolean;
}

@Injectable()
export class ConnectionsService {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: AppDatabase) {}

  async create(dto: CreateConnectionDto) {
    const encryptedPassword = encrypt(dto.password);
    const dbType = dto.dbType ?? 'postgresql';

    const rows = await this.db
      .insert(tables.connectionConfigs)
      .values({
        id: crypto.randomUUID(),
        host: dto.host,
        port: dto.port,
        databaseName: dto.databaseName,
        username: dto.username,
        encryptedPassword,
        dbType,
        encrypt: dto.encrypt ?? null,
        updatedAt: new Date(),
      })
      .returning();

    const saved = rows[0];

    return {
      id: saved.id,
      host: saved.host,
      port: saved.port,
      databaseName: saved.databaseName,
      username: saved.username,
      dbType: saved.dbType as 'postgresql' | 'sqlserver',
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  async getTenantConnectionConfig(connectionId: string): Promise<TenantConnectionConfig> {
    const conn = await this.findOne(connectionId);
    return {
      host: conn.host,
      port: conn.port,
      database: conn.databaseName,
      username: conn.username,
      password: conn.password,
      dbType: conn.dbType,
      encrypt: conn.encrypt ?? false,
    };
  }

  async findOne(id: string) {
    const rows = await this.db
      .select()
      .from(tables.connectionConfigs)
      .where(eq(tables.connectionConfigs.id, id));

    const config = rows[0];

    if (!config) throw new NotFoundException(`Connection config ${id} not found`);

    return {
      id: config.id,
      host: config.host,
      port: config.port,
      databaseName: config.databaseName,
      username: config.username,
      password: decrypt(config.encryptedPassword),
      dbType: (config.dbType ?? 'postgresql') as 'postgresql' | 'sqlserver',
      encrypt: config.encrypt ?? false,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}
