import { pgTable, text, customType } from 'drizzle-orm/pg-core';

const float1536 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'FLOAT[1536]';
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

export const columnEmbeddingsSpike = pgTable('column_embeddings_spike', {
  id: text('id').primaryKey(),
  embedding: float1536('embedding').notNull(),
});
