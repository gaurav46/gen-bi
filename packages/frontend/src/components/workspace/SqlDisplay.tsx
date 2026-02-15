import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '../ui/collapsible';

type SqlDisplayProps = {
  sql: string;
};

export function SqlDisplay({ sql }: SqlDisplayProps) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="text-sm text-muted-foreground cursor-pointer">
        View generated SQL
      </CollapsibleTrigger>
      <CollapsibleContent>
        <code className="font-mono text-xs bg-muted p-3 rounded-md block mt-2 whitespace-pre-wrap">
          {sql}
        </code>
      </CollapsibleContent>
    </Collapsible>
  );
}
