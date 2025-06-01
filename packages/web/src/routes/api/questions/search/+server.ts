import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { questionsTable, citationsTable } from "$lib/server/db/schema";
import { sql, cosineDistance, desc } from "drizzle-orm";

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { embedding, limit = 3 } = await request.json();

    if (!embedding) {
      return json({ error: "embedding is required" }, { status: 400 });
    }

    const similarity = sql<number>`1 - (${cosineDistance(
      questionsTable.embedding,
      embedding
    )})`;

    const results = await db
      .select({
        id: questionsTable.id,
        question: questionsTable.question,
        answer: questionsTable.answer,
        citationIds: questionsTable.citationIds,
        similarity,
      })
      .from(questionsTable)
      .where(sql`${similarity} > 0.5`)
      .orderBy((t) => desc(t.similarity))
      .limit(limit);

    const enhancedResults = await Promise.all(
      results.map(async (result) => {
        const citationDetails = [];

        if (result.citationIds && result.citationIds.length > 0) {
          const citationRecords = await db
            .select({
              id: citationsTable.id,
              permalink: citationsTable.permalink,
              content: citationsTable.content,
              timestamp: citationsTable.timestamp,
              username: citationsTable.username,
            })
            .from(citationsTable)
            .where(sql`${citationsTable.id} IN ${result.citationIds}`);

          for (const citation of citationRecords) {
            citationDetails.push({
              permalink: citation.permalink,
              content: citation.content || "No content available",
              timestamp: citation.timestamp || "",
              username: citation.username || "Unknown User",
            });
          }
        }

        return {
          ...result,
          citationDetails,
        };
      })
    );

    return json({ results: enhancedResults });
  } catch (error) {
    console.error("Error searching questions:", error);
    return json({ error: "Failed to search questions" }, { status: 500 });
  }
};
