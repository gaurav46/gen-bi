import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { SchemaAnalysisStatus } from './useSchemaAnalysis';

type SchemaSelectionScreenProps = {
  discoveredSchemas: string[];
  selectedSchemas: string[];
  toggleSchema: (schema: string, checked: boolean | 'indeterminate') => void;
  analyze: () => void;
  status: SchemaAnalysisStatus;
  errorMessage: string;
  onChangeConnection: () => void;
};

export function SchemaSelectionScreen({
  discoveredSchemas,
  selectedSchemas,
  toggleSchema,
  analyze,
  status,
  errorMessage,
  onChangeConnection,
}: SchemaSelectionScreenProps) {
  return (
    <div className="max-w-lg mx-auto space-y-3">
      <p className="text-sm font-semibold">Discovered Schemas</p>
      <div className="space-y-1.5">
        {discoveredSchemas.map((schema) => (
          <div key={schema} className="flex items-center gap-1.5">
            <Checkbox
              id={`schema-${schema}`}
              aria-label={schema}
              checked={selectedSchemas.includes(schema)}
              onCheckedChange={(checked) => toggleSchema(schema, checked)}
            />
            <Label htmlFor={`schema-${schema}`}>{schema}</Label>
          </div>
        ))}
      </div>
      {errorMessage && (
        <p className="text-destructive text-sm">{errorMessage}</p>
      )}
      <div className="flex items-center gap-2">
        <Button
          disabled={selectedSchemas.length === 0 || status === 'analyzing'}
          onClick={analyze}
        >
          Analyze
        </Button>
        <Button variant="link" className="text-sm" onClick={onChangeConnection}>
          Change connection
        </Button>
      </div>
    </div>
  );
}
