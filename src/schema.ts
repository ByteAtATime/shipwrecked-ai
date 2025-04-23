import { index, pgTable, serial, text, uuid, vector } from 'drizzle-orm/pg-core';

export const questionsTable = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    embedding: vector('embedding', { dimensions: 1536 }),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    citations: text('citations').array().notNull(),
  },
  (table) => [
    index('embeddingIndex').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ]
);
