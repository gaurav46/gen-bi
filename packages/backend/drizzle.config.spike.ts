import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/infrastructure/drizzle/spike/spike-schema.ts',
  out: './src/infrastructure/drizzle/spike/migrations',
  dialect: 'postgresql',
});
