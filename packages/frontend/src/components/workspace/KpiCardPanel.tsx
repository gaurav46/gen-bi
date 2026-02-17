import type { KpiData } from '../../domain/chart-transforms';
import { Card } from '../ui/card';

export function KpiCardPanel({ label, value }: KpiData) {
  return (
    <div data-testid="kpi-card" className="h-80 w-full flex items-center justify-center">
      <Card className="p-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-4xl font-semibold">{value.toLocaleString()}</div>
      </Card>
    </div>
  );
}
