import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type DataPreviewPanelProps = {
  rows: Record<string, unknown>[];
  columns: string[];
  totalRows: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  error: string | null;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onRetry: () => void;
};

function CellValue({ value }: { value: unknown }) {
  if (value === null) {
    return <span className="text-muted-foreground italic">null</span>;
  }
  return <span className="truncate block max-w-xs">{String(value)}</span>;
}

export function DataPreviewPanel({
  rows,
  columns,
  totalRows,
  page,
  pageSize,
  isLoading,
  error,
  onNextPage,
  onPreviousPage,
  onRetry,
}: DataPreviewPanelProps) {
  const totalPages = Math.ceil(totalRows / pageSize);

  if (isLoading) {
    return (
      <div className="border-t border-border mt-3">
        <div className="px-3 py-2">
          <h3 className="text-sm font-semibold">Data Preview</h3>
        </div>
        <div className="p-3 space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-t border-border mt-3">
        <div className="px-3 py-2">
          <h3 className="text-sm font-semibold">Data Preview</h3>
        </div>
        <div className="flex items-center justify-center p-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (rows.length === 0 && totalRows === 0) {
    return (
      <div className="border-t border-border mt-3">
        <div className="px-3 py-2">
          <h3 className="text-sm font-semibold">Data Preview</h3>
        </div>
        <div className="flex items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">No data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border mt-3">
      <div className="px-3 py-2">
        <h3 className="text-sm font-semibold">Data Preview</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {columns.map((col) => (
              <TableHead key={col} className="px-3 py-2 text-xs font-medium">
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i} className="hover:bg-muted/50">
              {columns.map((col) => (
                <TableCell key={col} className="px-3 py-1.5 text-xs font-mono">
                  <CellValue value={row[col]} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between px-3 py-2 border-t border-border">
        <span className="text-xs text-muted-foreground">{totalRows} rows</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPreviousPage}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-xs">Page {page} of {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={onNextPage}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
