import { Knex } from 'knex';

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const benefitTypes = [
  { type: 'health', plans: ['Basic Health', 'Premium Health', 'Family Health'] },
  { type: 'dental', plans: ['Basic Dental', 'Premium Dental'] },
  { type: 'vision', plans: ['Standard Vision', 'Premium Vision'] },
  { type: '401k', plans: ['Standard 401k', '401k Plus'] },
  { type: 'life_insurance', plans: ['Basic Life', 'Supplemental Life'] },
];

export async function seed(knex: Knex): Promise<void> {
  await knex('benefits').del();

  const employees = await knex('employees').select('id', 'hire_date').where('status', 'active');
  const benefits: Array<{
    employee_id: number; benefit_type: string;
    enrollment_date: string; plan_name: string;
  }> = [];

  for (const emp of employees) {
    // Each active employee gets 1-3 random benefits
    const count = 1 + Math.floor(Math.random() * 3);
    const selected = [...benefitTypes].sort(() => Math.random() - 0.5).slice(0, count);

    const hireDate = typeof emp.hire_date === 'string'
      ? emp.hire_date
      : new Date(emp.hire_date).toISOString().split('T')[0];

    for (const b of selected) {
      benefits.push({
        employee_id: emp.id,
        benefit_type: b.type,
        enrollment_date: hireDate,
        plan_name: pickRandom(b.plans),
      });
    }
  }

  const batchSize = 50;
  for (let i = 0; i < benefits.length; i += batchSize) {
    await knex('benefits').insert(benefits.slice(i, i + batchSize));
  }
}
