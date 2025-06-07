import {
  index,
  pgTable,
  serial,
  text,
  uuid,
  vector,
  timestamp,
  foreignKey,
  halfvec,
} from "drizzle-orm/pg-core";

export const citationsTable = pgTable("citations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull(),
  permalink: text("permalink").notNull(),
  content: text("content").notNull(),
  timestamp: text("timestamp").notNull(),
  username: text("username"),
});

export const questionsTable = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    embedding: halfvec("embedding", { dimensions: 3072 }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    citationIds: uuid("citation_ids").array(),
  },
  (table) => [
    index("embeddingIndex").using(
      "hnsw",
      table.embedding.op("halfvec_cosine_ops")
    ),
  ]
);
