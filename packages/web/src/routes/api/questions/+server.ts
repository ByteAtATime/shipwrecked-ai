import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireApiKeyAuth } from "$lib/server/api-auth";
import { db } from "$lib/server/db";
import { questionsTable, citationsTable } from "$lib/server/db/schema";
import { sql, cosineDistance, desc } from "drizzle-orm";

export const POST: RequestHandler = async ({ request }) => {
  const authResult = await requireApiKeyAuth(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { question, answer, citationIds, embedding } = await request.json();

    if (!question || !answer || !embedding) {
      return json(
        { error: "question, answer, and embedding are required" },
        { status: 400 }
      );
    }

    const result = await db
      .insert(questionsTable)
      .values({
        question,
        answer,
        citationIds: citationIds || [],
        embedding,
      })
      .returning({ id: questionsTable.id });

    return json({ question: result[0] });
  } catch (error) {
    console.error("Error creating question:", error);
    return json({ error: "Failed to create question" }, { status: 500 });
  }
};

export const GET: RequestHandler = async ({ request, url }) => {
  const authResult = await requireApiKeyAuth(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const queryText = url.searchParams.get("q");
    const queryEmbedding = url.searchParams.get("embedding");
    const limit = parseInt(url.searchParams.get("limit") || "3");

    if (!queryEmbedding) {
      return json(
        { error: "embedding parameter is required" },
        { status: 400 }
      );
    }

    const embeddingArray = JSON.parse(queryEmbedding);

    const similarity = sql<number>`1 - (${cosineDistance(
      questionsTable.embedding,
      embeddingArray
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
