import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('departments').del();
  await knex('departments').insert([
    { id: 1, name: 'Engineering', location_id: 1 },
    { id: 2, name: 'Product', location_id: 1 },
    { id: 3, name: 'Design', location_id: 1 },
    { id: 4, name: 'Sales', location_id: 2 },
    { id: 5, name: 'Marketing', location_id: 2 },
    { id: 6, name: 'Human Resources', location_id: 1 },
    { id: 7, name: 'Finance', location_id: 2 },
    { id: 8, name: 'Customer Success', location_id: 3 },
  ]);
}
