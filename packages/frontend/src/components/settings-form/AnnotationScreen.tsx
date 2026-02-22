import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type AnnotationColumn = {
  columnId: string;
  tableName: string;
  schemaName: string;
  columnName: string;
  dataType: string;
  suggestedDescription: string | null;
};

type AnnotationScreenProps = {
  columns: AnnotationColumn[];
  onContinue: (annotations: { columnId: string; description: string }[]) => void;
  onSkip: () => void;
  loading?: boolean;
};

export function AnnotationScreen({ columns, onContinue, onSkip, loading }: AnnotationScreenProps) {
  const [descriptions, setDescriptions] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const col of columns) {
      initial[col.columnId] = col.suggestedDescription ?? '';
    }
    return initial;
  });

  const handleContinue = () => {
    const annotations = columns.map((col) => ({
      columnId: col.columnId,
      description: descriptions[col.columnId] ?? '',
    }));
    onContinue(annotations);
  };

  const groupedByTable = columns.reduce<Record<string, AnnotationColumn[]>>((acc, col) => {
    const key = col.tableName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(col);
    return acc;
  }, {});

  return (
    <div className="max-w-lg mx-auto space-y-3" data-testid="annotation-screen">
      <p className="text-sm font-semibold">Review Column Descriptions</p>
      <p className="text-xs text-muted-foreground">
        These columns have ambiguous names. Add descriptions to improve query accuracy.
      </p>
      {Object.entries(groupedByTable).map(([tableName, cols]) => (
        <div key={tableName} className="space-y-2">
          <p className="text-sm font-medium">{tableName}</p>
          {cols.map((col) => (
            <div key={col.columnId} className="flex items-center gap-2">
              <span className="text-xs font-mono w-24 shrink-0">{col.columnName}</span>
              <span className="text-xs text-muted-foreground w-16 shrink-0">{col.dataType}</span>
              <Input
                className="text-sm h-8"
                value={descriptions[col.columnId] ?? ''}
                onChange={(e) =>
                  setDescriptions((prev) => ({ ...prev, [col.columnId]: e.target.value }))
                }
                aria-label={`Description for ${col.columnName}`}
              />
            </div>
          ))}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Button onClick={handleContinue} disabled={loading}>
          Continue
        </Button>
        <Button variant="outline" onClick={onSkip} disabled={loading}>
          Skip
        </Button>
      </div>
    </div>
  );
}
