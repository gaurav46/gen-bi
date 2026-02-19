import type { DiscoveredTable } from '../../domain/schema-types';
import { enrichColumnsForDisplay } from '../../domain/schema-transforms';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function ColumnDetailPanel({ table }: { table: DiscoveredTable }) {
  const columns = enrichColumnsForDisplay(table.columns, table.foreignKeys, table.indexes);

  return (
    <div className="p-3">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-3 py-2">Column</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-3 py-2">Type</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-3 py-2">Nullable</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-3 py-2">FK</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-3 py-2">Idx</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {columns.map((col) => (
            <TableRow key={col.columnName} className="hover:bg-muted/50">
              <TableCell className="text-sm font-mono px-3 py-1.5">{col.columnName}</TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground px-3 py-1.5">{col.dataType}</TableCell>
              <TableCell className="text-xs text-muted-foreground px-3 py-1.5">
                {col.isNullable ? 'YES' : ''}
              </TableCell>
              <TableCell className="text-xs px-3 py-1.5">
                {col.foreignKey && (
                  <span className="text-primary">{col.foreignKey.tableName}.{col.foreignKey.columnName}</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-1.5">
                {col.indexType && (
                  <Badge variant="secondary" className="text-xs">{col.indexType}</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
