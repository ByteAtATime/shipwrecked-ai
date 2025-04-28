import {
  index,
  pgTable,
  serial,
  text,
  uuid,
  vector,
  timestamp,
  foreignKey,
} from "drizzle-orm/pg-core";

export const citationsTable = pgTable("citations", {
  id: uuid("id").primaryKey().defaultRandom(),
  permalink: text("permalink").notNull(),
  content: text("content").notNull(),
  timestamp: text("timestamp").notNull(),
  username: text("username"),
});

export const questionsTable = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    embedding: vector("embedding", { dimensions: 1536 }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    citationIds: uuid("citation_ids").array(),
  },
  (table) => [
    index("embeddingIndex").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
  ]
);
