import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { questionsTable, citationsTable } from "$lib/server/db/schema";
import { sql, desc, count, or, ilike } from "drizzle-orm";

export const GET: RequestHandler = async ({ url }) => {
  try {
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const search = url.searchParams.get("search") || "";

    const offset = (page - 1) * limit;

    let whereClause = undefined;
    if (search) {
      whereClause = or(
        ilike(questionsTable.question, `%${search}%`),
        ilike(questionsTable.answer, `%${search}%`)
      );
    }

    const [totalResult] = await db
      .select({ count: count() })
      .from(questionsTable)
      .where(whereClause);

    const total = totalResult.count;
    const totalPages = Math.ceil(total / limit);

    const questions = await db
      .select({
        id: questionsTable.id,
        question: questionsTable.question,
        answer: questionsTable.answer,
        citationIds: questionsTable.citationIds,
      })
      .from(questionsTable)
      .where(whereClause)
      .orderBy(desc(questionsTable.id))
      .limit(limit)
      .offset(offset);

    const enhancedQuestions = await Promise.all(
      questions.map(async (question) => {
        const citationDetails = [];

        if (question.citationIds && question.citationIds.length > 0) {
          const citationRecords = await db
            .select({
              id: citationsTable.id,
              permalink: citationsTable.permalink,
              content: citationsTable.content,
              timestamp: citationsTable.timestamp,
              username: citationsTable.username,
            })
            .from(citationsTable)
            .where(sql`${citationsTable.id} IN ${question.citationIds}`);

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
          ...question,
          citationDetails,
        };
      })
    );

    return json({
      questions: enhancedQuestions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error browsing questions:", error);
    return json({ error: "Failed to browse questions" }, { status: 500 });
  }
};
