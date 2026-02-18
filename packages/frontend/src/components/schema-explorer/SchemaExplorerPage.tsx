import { useSchemaExplorer } from '../../hooks/useSchemaExplorer';
import { useTableRows } from '../../hooks/useTableRows';
import type { SchemaDataPort } from '../../ports/schema-data-port';
import { TableListPanel } from './TableListPanel';
import { ColumnDetailPanel } from './ColumnDetailPanel';
import { DataPreviewPanel } from './DataPreviewPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

type SchemaExplorerPageProps = {
  port: SchemaDataPort;
};

export function SchemaExplorerPage({ port }: SchemaExplorerPageProps) {
  const connectionId = localStorage.getItem('connectionId');
  const {
    filteredTables,
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
    selectedTable,
    setSelectedTable,
    refetch,
  } = useSchemaExplorer(port, connectionId);

  const tableRef = selectedTable
    ? { connectionId: selectedTable.connectionId, schemaName: selectedTable.schemaName, tableName: selectedTable.tableName }
    : null;
  const tableRows = useTableRows(port, tableRef);

  if (!connectionId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Connect a database first in Settings.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full">
        <div className="w-72 border-r border-border p-3 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-6 w-2/3" />
        </div>
        <div className="flex-1 p-3 space-y-2">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={refetch}>Retry</Button>
        </div>
      </div>
    );
  }

  if (filteredTables.length === 0 && !searchTerm) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">No tables discovered. Run analysis in Settings first.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <TableListPanel
        tables={filteredTables}
        selectedTableId={selectedTable?.id ?? null}
        onSelect={setSelectedTable}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />
      <div className="flex-1 overflow-auto">
        {selectedTable ? (
          <>
            <ColumnDetailPanel table={selectedTable} />
            <DataPreviewPanel
              rows={tableRows.rows}
              columns={selectedTable.columns.map((c) => c.columnName)}
              totalRows={tableRows.totalRows}
              page={tableRows.page}
              pageSize={tableRows.pageSize}
              isLoading={tableRows.isLoading}
              error={tableRows.error}
              onNextPage={tableRows.goToNextPage}
              onPreviousPage={tableRows.goToPreviousPage}
              onRetry={tableRows.retry}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Select a table to view its columns</p>
          </div>
        )}
      </div>
    </div>
  );
}
