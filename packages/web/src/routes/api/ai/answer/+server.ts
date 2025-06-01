import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import OpenAI from "openai";
import { db } from "$lib/server/db";
import { questionsTable, citationsTable } from "$lib/server/db/schema";
import { sql, cosineDistance, desc } from "drizzle-orm";

const openai = new OpenAI({
  baseURL: "https://ai.hackclub.com",
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set");
}

const generateEmbedding = async (text: string) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-exp-03-07:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      body: JSON.stringify({
        model: "models/gemini-embedding-exp-03-07",
        content: { parts: [{ text }] },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to generate embedding: ${response.statusText}`);
  }

  const data = (await response.json()) as { embedding: { values: number[] } };
  return data.embedding.values;
};

const searchSimilarQuestions = async (query: string, limit = 3) => {
  try {
    const queryEmbedding = await generateEmbedding(query);

    if (!queryEmbedding) {
      return { error: "Failed to generate embedding for query" };
    }

    const similarity = sql<number>`1 - (${cosineDistance(
      questionsTable.embedding,
      queryEmbedding
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

    return { results: enhancedResults };
  } catch (error) {
    console.error("Error searching similar questions:", error);
    return { error: "Failed to search database" };
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { question } = await request.json();

    if (!question) {
      return json({ error: "Question is required" }, { status: 400 });
    }

    const messages = [
      {
        role: "system" as const,
        content: `You are an AI assistant that can answer questions based on a knowledge base. You have access to a vector database of question-answer pairs. All of your answers must be directly from the search results; if you are even a little unsure, return a response with type: "no_answer". 

IMPORTANT: First determine if the user's input is a question that requires information. If it's not a question (e.g., it's a greeting, statement, command, or other non-question), return a response with type: "not_question".

When responding, ALWAYS use the following JSON format:

For normal answers:
{
  "type": "answer",
  "content": "Your detailed answer in markdown format.",
  "sources": ["https://hackclub.slack.com/...", "https://hackclub.slack.com/..."]
}

For questions you can't answer:
{
  "type": "no_answer",
  "reason": "Explanation of why you can't answer"
}

For non-questions:
{
  "type": "not_question"
}

For searching similar questions (this initiates a search). You MUST search for similar questions before answering:
{
  "type": "search_similar_questions",
  "query": "The search query",
  "limit": 3
}

Your content for answers should include markdown formatting and MUST quote at least one source using a Markdown quote block. The search results will include citationDetails that contain permalinks, content, and the username of each citation's author. Use this content in your answer to provide more accurate information and more comprehensive quotes. ALWAYS include the username in your citation format.

Example answer format with citation content and username:
{
  "type": "answer",
  "content": "No, you cannot use this project for commercial purposes.\\n\\n> this is not for commercial use\\n> additional context from the message\\n- [(source)](https://hackclub.slack.com/archives/C08Q1CNLMQ8/p1719238400253229) by John Doe",
  "sources": ["https://hackclub.slack.com/archives/C08Q1CNLMQ8/p1719238400253229"]
}`,
      },
      {
        role: "user" as const,
        content: question,
      },
    ];

    let currentAttempt = 0;
    const maxAttempts = 3;

    while (currentAttempt < maxAttempts) {
      const response = await openai.chat.completions.create({
        model: "google/gemini-2.0-flash-exp:free",
        messages,
        response_format: { type: "json_object" },
      });

      const responseMessage = response.choices[0]?.message;

      if (!responseMessage || !responseMessage.content?.trim()) {
        return json({
          answer: "I couldn't process your question. Please try again.",
          hasAnswer: false,
        });
      }

      try {
        const parsedResponse = JSON.parse(responseMessage.content.trim());

        if (parsedResponse.type === "not_question") {
          return json({
            answer: "No question found",
            hasAnswer: false,
          });
        } else if (parsedResponse.type === "no_answer") {
          return json({
            answer: `I don't know\n\n${parsedResponse.reason || ""}`,
            hasAnswer: false,
          });
        } else if (parsedResponse.type === "answer") {
          return json({
            answer: parsedResponse.content || "",
            hasAnswer: true,
            sources: parsedResponse.sources || [],
          });
        } else if (parsedResponse.type === "search_similar_questions") {
          const searchQuery = parsedResponse.query || question;
          const searchLimit = parsedResponse.limit || 3;

          const searchResult = await searchSimilarQuestions(
            searchQuery,
            searchLimit
          );

          if (searchResult.results && searchResult.results.length > 0) {
            messages.push(responseMessage);
            messages.push({
              role: "user" as const,
              content: JSON.stringify(searchResult),
            });
          } else {
            return json({
              answer:
                "I couldn't find any relevant information for your question.",
              hasAnswer: false,
            });
          }
        } else {
          messages.push(responseMessage);
          messages.push({
            role: "user" as const,
            content:
              "You didn't respond in the correct JSON format. Please try again.",
          });
        }
      } catch (e) {
        messages.push(responseMessage);
        messages.push({
          role: "user" as const,
          content: "You didn't respond with valid JSON. Please try again.",
        });
      }

      currentAttempt++;
    }

    return json({
      answer:
        "I couldn't find a relevant answer to your question after multiple attempts.",
      hasAnswer: false,
    });
  } catch (error) {
    console.error("Error answering question:", error);
    return json({ error: "Failed to answer question" }, { status: 500 });
  }
};
