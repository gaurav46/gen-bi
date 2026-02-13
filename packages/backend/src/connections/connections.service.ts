import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { encrypt, decrypt } from './encryption';

export const PRISMA_CLIENT = 'PRISMA_CLIENT';

interface CreateConnectionDto {
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password: string;
}

@Injectable()
export class ConnectionsService {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: any) {}

  async create(dto: CreateConnectionDto) {
    const encryptedPassword = encrypt(dto.password);

    const saved = await this.prisma.connectionConfig.create({
      data: {
        host: dto.host,
        port: dto.port,
        databaseName: dto.databaseName,
        username: dto.username,
        encryptedPassword,
      },
    });

    return {
      id: saved.id,
      host: saved.host,
      port: saved.port,
      databaseName: saved.databaseName,
      username: saved.username,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  async findOne(id: string) {
    const config = await this.prisma.connectionConfig.findUnique({
      where: { id },
    });

    if (!config) throw new NotFoundException(`Connection config ${id} not found`);

    return {
      id: config.id,
      host: config.host,
      port: config.port,
      databaseName: config.databaseName,
      username: config.username,
      password: decrypt(config.encryptedPassword),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}
