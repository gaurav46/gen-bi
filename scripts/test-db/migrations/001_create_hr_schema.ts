import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('office_locations', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.string('city').notNullable();
    t.string('country').notNullable();
    t.string('address').notNullable();
  });

  await knex.schema.createTable('departments', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.integer('location_id').unsigned().references('id').inTable('office_locations');
  });

  await knex.schema.createTable('positions', (t) => {
    t.increments('id').primary();
    t.string('title').notNullable();
    t.integer('department_id').unsigned().references('id').inTable('departments');
    t.string('level').notNullable();
  });

  await knex.schema.createTable('employees', (t) => {
    t.increments('id').primary();
    t.string('first_name').notNullable();
    t.string('last_name').notNullable();
    t.string('email').notNullable().unique();
    t.string('phone');
    t.date('hire_date').notNullable();
    t.integer('department_id').unsigned().references('id').inTable('departments');
    t.integer('position_id').unsigned().references('id').inTable('positions');
    t.integer('manager_id').unsigned().references('id').inTable('employees');
    t.integer('office_location_id').unsigned().references('id').inTable('office_locations');
    t.string('status').notNullable().defaultTo('active');
  });

  await knex.schema.createTable('salaries', (t) => {
    t.increments('id').primary();
    t.integer('employee_id').unsigned().notNullable().references('id').inTable('employees');
    t.decimal('amount', 12, 2).notNullable();
    t.string('currency', 3).notNullable().defaultTo('USD');
    t.date('effective_date').notNullable();
    t.date('end_date');
  });

  await knex.schema.createTable('leaves', (t) => {
    t.increments('id').primary();
    t.integer('employee_id').unsigned().notNullable().references('id').inTable('employees');
    t.string('leave_type').notNullable();
    t.date('start_date').notNullable();
    t.date('end_date').notNullable();
    t.string('status').notNullable().defaultTo('pending');
  });

  await knex.schema.createTable('projects', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.text('description');
    t.integer('department_id').unsigned().references('id').inTable('departments');
    t.date('start_date').notNullable();
    t.date('end_date');
    t.string('status').notNullable().defaultTo('active');
  });

  await knex.schema.createTable('project_assignments', (t) => {
    t.increments('id').primary();
    t.integer('project_id').unsigned().notNullable().references('id').inTable('projects');
    t.integer('employee_id').unsigned().notNullable().references('id').inTable('employees');
    t.string('role').notNullable();
    t.date('assigned_date').notNullable();
  });

  await knex.schema.createTable('performance_reviews', (t) => {
    t.increments('id').primary();
    t.integer('employee_id').unsigned().notNullable().references('id').inTable('employees');
    t.integer('reviewer_id').unsigned().notNullable().references('id').inTable('employees');
    t.date('review_date').notNullable();
    t.integer('rating').notNullable();
    t.text('comments');
  });

  await knex.schema.createTable('skills', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable().unique();
    t.string('category').notNullable();
  });

  await knex.schema.createTable('employee_skills', (t) => {
    t.integer('employee_id').unsigned().notNullable().references('id').inTable('employees');
    t.integer('skill_id').unsigned().notNullable().references('id').inTable('skills');
    t.string('proficiency').notNullable();
    t.primary(['employee_id', 'skill_id']);
  });

  await knex.schema.createTable('benefits', (t) => {
    t.increments('id').primary();
    t.integer('employee_id').unsigned().notNullable().references('id').inTable('employees');
    t.string('benefit_type').notNullable();
    t.date('enrollment_date').notNullable();
    t.string('plan_name').notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  const tables = [
    'benefits', 'employee_skills', 'skills', 'performance_reviews',
    'project_assignments', 'projects', 'leaves', 'salaries',
    'employees', 'positions', 'departments', 'office_locations',
  ];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
}
