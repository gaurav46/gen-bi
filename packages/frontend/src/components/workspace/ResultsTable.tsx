import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '../ui/table';
import { formatCellValue, isNumericType } from '../../domain/query-transforms';

type Column = {
  name: string;
  type: string;
  role: 'dimension' | 'measure';
};

type ResultsTableProps = {
  columns: Column[];
  rows: Record<string, unknown>[];
};

export function ResultsTable({ columns, rows }: ResultsTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm italic py-8 text-center">
        No results
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((col) => (
            <TableHead
              key={col.name}
              className={`bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide px-3 py-2 ${
                isNumericType(col.type) ? 'text-right' : ''
              }`}
            >
              {col.name}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, rowIdx) => (
          <TableRow key={rowIdx} className="border-b border-border hover:bg-muted/50">
            {columns.map((col) => {
              const formatted = formatCellValue(row[col.name]);
              return (
                <TableCell
                  key={col.name}
                  className={`text-sm px-3 py-1.5 ${
                    isNumericType(col.type) ? 'text-right' : ''
                  }`}
                >
                  {formatted.isNull ? (
                    <span className="text-muted-foreground italic">{formatted.text}</span>
                  ) : (
                    formatted.text
                  )}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
