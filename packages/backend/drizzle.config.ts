import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/infrastructure/drizzle/schema.ts',
  out: './src/infrastructure/drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
