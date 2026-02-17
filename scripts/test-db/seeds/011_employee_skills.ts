import { Knex } from 'knex';

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

const proficiencies = ['beginner', 'intermediate', 'intermediate', 'advanced', 'advanced', 'expert'];

// Department-weighted skill pools
const deptSkillPools: Record<number, number[]> = {
  1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 22, 23, 24, 25],
  2: [18, 19, 20, 26],
  3: [5, 16, 17, 26],
  4: [27, 28, 19, 26],
  5: [20, 28, 26],
  6: [19, 30, 26],
  7: [20, 29, 26],
  8: [19, 26, 27, 28],
};

export async function seed(knex: Knex): Promise<void> {
  await knex('employee_skills').del();

  const employees = await knex('employees').select('id', 'department_id');
  const mappings: Array<{ employee_id: number; skill_id: number; proficiency: string }> = [];
  const seen = new Set<string>();

  for (const emp of employees) {
    const pool = deptSkillPools[emp.department_id] || [18, 19, 26];
    const skillCount = 2 + Math.floor(Math.random() * 4); // 2-5 skills each
    const skills = pickN(pool, Math.min(skillCount, pool.length));

    for (const skillId of skills) {
      const key = `${emp.id}-${skillId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      mappings.push({
        employee_id: emp.id,
        skill_id: skillId,
        proficiency: pickRandom(proficiencies),
      });
    }
  }

  const batchSize = 50;
  for (let i = 0; i < mappings.length; i += batchSize) {
    await knex('employee_skills').insert(mappings.slice(i, i + batchSize));
  }
}
