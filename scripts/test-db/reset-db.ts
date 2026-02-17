import { Client } from 'pg';

const DB_NAME = 'hr_test_db';

async function resetDatabase() {
  if (!DB_NAME.includes('test')) {
    throw new Error('Refusing to run: database name must contain "test"');
  }

  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'postgres',
  });

  await client.connect();

  await client.query(`
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = '${DB_NAME}' AND pid <> pg_backend_pid()
  `);

  await client.query(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
  await client.query(`CREATE DATABASE "${DB_NAME}"`);

  await client.end();
  console.log(`Database "${DB_NAME}" recreated.`);
}

resetDatabase().catch((err) => {
  console.error('Failed to reset database:', err.message);
  process.exit(1);
});
