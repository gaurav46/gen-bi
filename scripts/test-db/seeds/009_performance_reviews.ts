import { Knex } from 'knex';

function randomDate(start: string, end: string): string {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return new Date(s + Math.random() * (e - s)).toISOString().split('T')[0];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const commentTemplates = [
  'Consistently delivers high-quality work on time.',
  'Shows strong leadership potential and initiative.',
  'Excellent collaboration skills across teams.',
  'Needs improvement in time management.',
  'Exceeds expectations in technical skills.',
  'Good problem-solving abilities, could improve communication.',
  'Strong contributor to team goals.',
  'Demonstrates expertise in their domain.',
  'Has grown significantly this review period.',
  'Reliable team member with consistent output.',
  'Proactive in identifying and resolving issues.',
  'Could benefit from more strategic thinking.',
  'Outstanding mentor to junior team members.',
  'Adapts well to changing priorities.',
  'Solid performer with room for growth in leadership.',
];

export async function seed(knex: Knex): Promise<void> {
  await knex('performance_reviews').del();

  const employees = await knex('employees')
    .select('id', 'manager_id')
    .where('status', 'active');

  const reviews: Array<{
    employee_id: number; reviewer_id: number;
    review_date: string; rating: number; comments: string;
  }> = [];

  const managersWithReports = employees.filter(e => e.manager_id !== null);

  for (let i = 0; i < 150; i++) {
    const emp = pickRandom(managersWithReports);
    reviews.push({
      employee_id: emp.id,
      reviewer_id: emp.manager_id!,
      review_date: randomDate('2023-06-01', '2025-06-30'),
      rating: pickRandom([3, 3, 4, 4, 4, 5, 5, 2, 1]),
      comments: pickRandom(commentTemplates),
    });
  }

  const batchSize = 50;
  for (let i = 0; i < reviews.length; i += batchSize) {
    await knex('performance_reviews').insert(reviews.slice(i, i + batchSize));
  }
}
