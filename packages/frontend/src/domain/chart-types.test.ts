import { describe, it, expect } from 'vitest';
import { CHART_TYPES } from './chart-types';

describe('CHART_TYPES', () => {
  it('includes all six visualization types with labels', () => {
    expect(CHART_TYPES).toHaveLength(6);

    const values = CHART_TYPES.map((t) => t.value);
    expect(values).toEqual(['bar', 'line', 'area', 'pie', 'kpi_card', 'table']);

    for (const type of CHART_TYPES) {
      expect(type).toHaveProperty('value');
      expect(type).toHaveProperty('label');
      expect(typeof type.label).toBe('string');
    }
  });
});
