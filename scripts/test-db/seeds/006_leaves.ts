import { Knex } from 'knex';

const leaveTypes = ['vacation', 'sick', 'personal', 'parental', 'bereavement'];
const leaveStatuses = ['approved', 'approved', 'approved', 'pending', 'rejected'];

function randomDate(start: string, end: string): string {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return new Date(s + Math.random() * (e - s)).toISOString().split('T')[0];
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function seed(knex: Knex): Promise<void> {
  await knex('leaves').del();

  const employeeIds = (await knex('employees').select('id')).map(e => e.id);
  const leaves: Array<{
    employee_id: number; leave_type: string;
    start_date: string; end_date: string; status: string;
  }> = [];

  for (let i = 0; i < 400; i++) {
    const startDate = randomDate('2023-01-01', '2025-12-31');
    const duration = pickRandom([1, 1, 2, 3, 5, 5, 10]);
    leaves.push({
      employee_id: pickRandom(employeeIds),
      leave_type: pickRandom(leaveTypes),
      start_date: startDate,
      end_date: addDays(startDate, duration),
      status: pickRandom(leaveStatuses),
    });
  }

  const batchSize = 50;
  for (let i = 0; i < leaves.length; i += batchSize) {
    await knex('leaves').insert(leaves.slice(i, i + batchSize));
  }
}
