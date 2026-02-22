import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Widget, UpdateWidgetRequest } from '../../domain/dashboard-types';

type EditWidgetDialogProps = {
  widget: Widget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (dto: UpdateWidgetRequest) => void;
  error?: string | null;
};

export function EditWidgetDialog({ widget, open, onOpenChange, onSave, error }: EditWidgetDialogProps) {
  const [title, setTitle] = useState(widget.title);
  const [legendLabels, setLegendLabels] = useState<Record<string, string>>({});

  const measureColumns = widget.columns.filter((c) => c.role === 'measure');

  useEffect(() => {
    setTitle(widget.title);
    const initial: Record<string, string> = {};
    for (const col of measureColumns) {
      initial[col.name] = widget.legendLabels?.[col.name] ?? col.name;
    }
    setLegendLabels(initial);
  }, [widget, open]);

  function handleSave() {
    onSave({ title, legendLabels });
  }

  function handleCancel() {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Widget</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="widget-title">Title</Label>
            <Input
              id="widget-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          {measureColumns.map((col) => (
            <div key={col.name} className="grid gap-2">
              <Label htmlFor={`legend-${col.name}`}>{col.name} legend label</Label>
              <Input
                id={`legend-${col.name}`}
                value={legendLabels[col.name] ?? col.name}
                onChange={(e) =>
                  setLegendLabels((prev) => ({ ...prev, [col.name]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
