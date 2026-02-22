import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { SchemaAnalysisStatus } from './useSchemaAnalysis';

type EmbeddingProgressScreenProps = {
  status: SchemaAnalysisStatus;
  analysisMessage: string;
  current: number;
  total: number;
  errorMessage: string;
  analyze: () => void;
  onChangeConnection: () => void;
};

export function EmbeddingProgressScreen({
  status,
  analysisMessage,
  current,
  total,
  errorMessage,
  analyze,
  onChangeConnection,
}: EmbeddingProgressScreenProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const isDone = status === 'done';
  const isError = status === 'error';

  return (
    <div className="max-w-lg mx-auto space-y-3">
      {isError ? (
        <>
          <p className="text-destructive text-sm">{errorMessage}</p>
          <Button onClick={analyze}>Retry</Button>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold">
            {isDone ? 'Analysis complete' : 'Analyzing schemas...'}
          </p>
          <Progress value={isDone ? 100 : percentage} />
          <p className="text-xs text-muted-foreground">
            {current} of {total} tables
          </p>
          {!isDone && analysisMessage && (
            <p className="text-sm text-muted-foreground">
              {analysisMessage}
            </p>
          )}
        </>
      )}
      <Button variant="link" className="text-sm" onClick={onChangeConnection}>
        Change connection
      </Button>
    </div>
  );
}
