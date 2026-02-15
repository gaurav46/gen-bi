import { useState } from 'react';
import { useWorkspace } from '../../hooks/useWorkspace';
import type { QueryPort } from '../../ports/query-port';
import { ResultsTable } from './ResultsTable';
import { SqlDisplay } from './SqlDisplay';

type WorkspacePageProps = {
  port: QueryPort;
};

export function WorkspacePage({ port }: WorkspacePageProps) {
  const [question, setQuestion] = useState('');
  const { response, isLoading, error, submit } = useWorkspace(port);
  const connectionId = localStorage.getItem('connectionId');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !connectionId) return;
    submit(connectionId, question.trim());
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 rounded-md border px-3 py-2 text-sm"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !question.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          {isLoading ? 'Thinking...' : 'Ask'}
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {response && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">{response.title}</h2>
            {response.attempts > 1 && (
              <p className="text-xs text-muted-foreground">
                Answer found after {response.attempts} attempts
              </p>
            )}
          </div>
          <ResultsTable columns={response.columns} rows={response.rows} />
          <SqlDisplay sql={response.sql} />
        </div>
      )}
    </div>
  );
}
