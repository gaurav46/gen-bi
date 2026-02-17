import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('positions').del();
  await knex('positions').insert([
    { id: 1, title: 'CEO', department_id: null, level: 'C-Suite' },
    { id: 2, title: 'CTO', department_id: 1, level: 'C-Suite' },
    { id: 3, title: 'VP of Engineering', department_id: 1, level: 'VP' },
    { id: 4, title: 'VP of Product', department_id: 2, level: 'VP' },
    { id: 5, title: 'VP of Sales', department_id: 4, level: 'VP' },
    { id: 6, title: 'Engineering Manager', department_id: 1, level: 'Manager' },
    { id: 7, title: 'Senior Software Engineer', department_id: 1, level: 'Senior' },
    { id: 8, title: 'Software Engineer', department_id: 1, level: 'Mid' },
    { id: 9, title: 'Junior Software Engineer', department_id: 1, level: 'Junior' },
    { id: 10, title: 'Product Manager', department_id: 2, level: 'Mid' },
    { id: 11, title: 'Senior Product Manager', department_id: 2, level: 'Senior' },
    { id: 12, title: 'UX Designer', department_id: 3, level: 'Mid' },
    { id: 13, title: 'Senior UX Designer', department_id: 3, level: 'Senior' },
    { id: 14, title: 'Design Manager', department_id: 3, level: 'Manager' },
    { id: 15, title: 'Sales Representative', department_id: 4, level: 'Mid' },
    { id: 16, title: 'Senior Sales Representative', department_id: 4, level: 'Senior' },
    { id: 17, title: 'Sales Manager', department_id: 4, level: 'Manager' },
    { id: 18, title: 'Marketing Specialist', department_id: 5, level: 'Mid' },
    { id: 19, title: 'Marketing Manager', department_id: 5, level: 'Manager' },
    { id: 20, title: 'HR Specialist', department_id: 6, level: 'Mid' },
    { id: 21, title: 'HR Manager', department_id: 6, level: 'Manager' },
    { id: 22, title: 'Financial Analyst', department_id: 7, level: 'Mid' },
    { id: 23, title: 'Finance Manager', department_id: 7, level: 'Manager' },
    { id: 24, title: 'Customer Success Manager', department_id: 8, level: 'Manager' },
    { id: 25, title: 'Customer Success Specialist', department_id: 8, level: 'Mid' },
  ]);
}
