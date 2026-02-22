import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConnectionsService } from '../connections/connections.service';
import type { TenantDatabasePort } from './tenant-database.port';
import { TENANT_DATABASE_PORT } from './schema-discovery.service';
import { calculateOffset, buildRowsQuery, buildCountQuery, buildPrimaryKeyQuery } from './pagination';

const PAGE_SIZE = 25;

export type TableRowsResult = {
  rows: Record<string, unknown>[];
  totalRows: number;
  page: number;
  pageSize: number;
  primaryKeyColumns: string[];
};

@Injectable()
export class TableRowsService {
  constructor(
    private readonly connectionsService: ConnectionsService,
    @Inject(TENANT_DATABASE_PORT) private readonly tenantDatabasePort: TenantDatabasePort,
  ) {}

  async fetchRows(
    connectionId: string,
    schemaName: string,
    tableName: string,
    page: number,
  ): Promise<TableRowsResult> {
    if (page < 1) {
      throw new BadRequestException('Page must be >= 1');
    }

    const config = await this.connectionsService.getTenantConnectionConfig(connectionId);
    await this.tenantDatabasePort.connect(config);

    try {
      const offset = calculateOffset(page, PAGE_SIZE);

      const countResult = await this.tenantDatabasePort.query(buildCountQuery(schemaName, tableName));
      const totalRows = parseInt(String(countResult.rows[0]?.count ?? '0'), 10);

      const rowsResult = await this.tenantDatabasePort.query(
        buildRowsQuery(schemaName, tableName),
        [PAGE_SIZE, offset],
      );

      const pkResult = await this.tenantDatabasePort.query(
        buildPrimaryKeyQuery(),
        [schemaName, tableName],
      );

      const primaryKeyColumns = pkResult.rows.map(
        (row) => row.column_name as string,
      );

      return {
        rows: rowsResult.rows,
        totalRows,
        page,
        pageSize: PAGE_SIZE,
        primaryKeyColumns,
      };
    } catch (error) {
      if ((error as any)?.code === '42P01') {
        throw new NotFoundException(`Table "${schemaName}"."${tableName}" not found`);
      }
      throw error;
    } finally {
      await this.tenantDatabasePort.disconnect();
    }
  }
}
