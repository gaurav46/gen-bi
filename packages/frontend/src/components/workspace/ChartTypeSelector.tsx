import { CHART_TYPES, type ChartTypeValue } from '../../domain/chart-types';
import { cn } from '../../lib/utils';

type ChartTypeSelectorProps = {
  selected: ChartTypeValue;
  onSelect: (type: ChartTypeValue) => void;
};

export function ChartTypeSelector({ selected, onSelect }: ChartTypeSelectorProps) {
  return (
    <div data-testid="chart-type-selector" className="flex gap-1.5">
      {CHART_TYPES.map((type) => (
        <button
          key={type.value}
          type="button"
          aria-pressed={type.value === selected}
          onClick={() => onSelect(type.value)}
          className={cn(
            'rounded-md px-2 py-1.5 text-sm',
            type.value === selected
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground',
          )}
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}
