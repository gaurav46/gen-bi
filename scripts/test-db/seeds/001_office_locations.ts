import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('office_locations').del();
  await knex('office_locations').insert([
    { id: 1, name: 'HQ - San Francisco', city: 'San Francisco', country: 'USA', address: '100 Market Street, Suite 400' },
    { id: 2, name: 'NYC Office', city: 'New York', country: 'USA', address: '250 Park Avenue, 15th Floor' },
    { id: 3, name: 'London Office', city: 'London', country: 'UK', address: '30 Finsbury Square, EC2A 1AG' },
  ]);
}
