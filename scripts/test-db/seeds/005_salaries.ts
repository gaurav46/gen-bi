import { Knex } from 'knex';

const baseSalaries: Record<string, [number, number]> = {
  'C-Suite': [250000, 350000],
  'VP': [180000, 250000],
  'Manager': [120000, 170000],
  'Senior': [100000, 140000],
  'Mid': [70000, 100000],
  'Junior': [50000, 70000],
};

function randomInRange(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) / 1000) * 1000;
}

function addMonths(date: string, months: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

export async function seed(knex: Knex): Promise<void> {
  await knex('salaries').del();

  const employees = await knex('employees')
    .join('positions', 'employees.position_id', 'positions.id')
    .select('employees.id', 'employees.hire_date', 'positions.level');

  const salaries: Array<{
    employee_id: number; amount: number; currency: string;
    effective_date: string; end_date: string | null;
  }> = [];

  for (const emp of employees) {
    const [min, max] = baseSalaries[emp.level] || [60000, 90000];
    const initialAmount = randomInRange(min, max);

    const hireDate = typeof emp.hire_date === 'string'
      ? emp.hire_date
      : new Date(emp.hire_date).toISOString().split('T')[0];

    // Everyone gets initial salary
    const hasRaise = Math.random() < 0.5;
    if (hasRaise) {
      const raiseDate = addMonths(hireDate, 12 + Math.floor(Math.random() * 12));
      salaries.push({
        employee_id: emp.id, amount: initialAmount, currency: 'USD',
        effective_date: hireDate, end_date: raiseDate,
      });
      salaries.push({
        employee_id: emp.id, amount: Math.round(initialAmount * 1.08 / 1000) * 1000,
        currency: 'USD', effective_date: raiseDate, end_date: null,
      });
    } else {
      salaries.push({
        employee_id: emp.id, amount: initialAmount, currency: 'USD',
        effective_date: hireDate, end_date: null,
      });
    }
  }

  const batchSize = 50;
  for (let i = 0; i < salaries.length; i += batchSize) {
    await knex('salaries').insert(salaries.slice(i, i + batchSize));
  }
}
