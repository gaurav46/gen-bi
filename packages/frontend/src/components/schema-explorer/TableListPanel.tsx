import { useRef, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DiscoveredTable } from '../../domain/schema-types';

type TableListPanelProps = {
  tables: DiscoveredTable[];
  selectedTableId: string | null;
  onSelect: (table: DiscoveredTable) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
};

export function TableListPanel({ tables, selectedTableId, onSelect, searchTerm, onSearchChange }: TableListPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!listRef.current) return;
    const items = Array.from(listRef.current.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    const currentIndex = items.findIndex((el) => el === document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(currentIndex + 1, items.length - 1);
      items[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(currentIndex - 1, 0);
      items[prev]?.focus();
    } else if (e.key === 'Enter' && currentIndex >= 0) {
      items[currentIndex]?.click();
    }
  }, []);

  return (
    <div className="w-72 border-r border-border flex flex-col">
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search tables..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 text-sm"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div ref={listRef} role="listbox" onKeyDown={handleKeyDown} className="p-1">
          {tables.length === 0 && (
            <p className="text-sm text-muted-foreground p-2">No tables match your search</p>
          )}
          {tables.map((table) => (
            <button
              key={table.id}
              role="option"
              aria-selected={table.id === selectedTableId}
              onClick={() => onSelect(table)}
              className={`w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-1.5 cursor-pointer ${
                table.id === selectedTableId
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted/50'
              }`}
            >
              {table.tableName}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
