import { Knex } from 'knex';

function randomDate(start: string, end: string): string {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return new Date(s + Math.random() * (e - s)).toISOString().split('T')[0];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const roles = ['Lead', 'Developer', 'Developer', 'Developer', 'QA', 'Designer', 'Analyst', 'Contributor'];

export async function seed(knex: Knex): Promise<void> {
  await knex('project_assignments').del();

  const employees = await knex('employees').select('id', 'department_id').where('status', 'active');
  const projects = await knex('projects').select('id', 'department_id', 'start_date');

  const assignments: Array<{
    project_id: number; employee_id: number; role: string; assigned_date: string;
  }> = [];
  const assignedPairs = new Set<string>();

  for (const project of projects) {
    // Assign 8-18 people per project, preferring same department
    const targetCount = 8 + Math.floor(Math.random() * 11);
    const sameDept = employees.filter(e => e.department_id === project.department_id);
    const otherDept = employees.filter(e => e.department_id !== project.department_id);

    const pool = [...sameDept, ...pickN(otherDept, Math.min(5, otherDept.length))];

    let count = 0;
    for (const emp of shuffled(pool)) {
      if (count >= targetCount) break;
      const key = `${project.id}-${emp.id}`;
      if (assignedPairs.has(key)) continue;
      assignedPairs.add(key);

      assignments.push({
        project_id: project.id,
        employee_id: emp.id,
        role: count === 0 ? 'Lead' : pickRandom(roles),
        assigned_date: randomDate(project.start_date, '2025-01-31'),
      });
      count++;
    }
  }

  const batchSize = 50;
  for (let i = 0; i < assignments.length; i += batchSize) {
    await knex('project_assignments').insert(assignments.slice(i, i + batchSize));
  }
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickN<T>(arr: T[], n: number): T[] {
  return shuffled(arr).slice(0, n);
}
