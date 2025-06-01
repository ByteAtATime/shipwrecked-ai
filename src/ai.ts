import type { MessageElement } from "@slack/web-api/dist/types/response/ConversationsHistoryResponse"; // TODO: ???
import OpenAI from "openai";
import { formatThread } from "./utils";
import { generateEmbedding } from "./embedding";
import { db } from "./db";
import { questionsTable, citationsTable } from "./schema";
import { sql, cosineDistance, desc } from "drizzle-orm";
import type { ChatCompletionMessageParam } from "openai/resources.mjs";

const openai = new OpenAI({
  baseURL: "https://ai.hackclub.com",
});

export type QuestionAnswerPair = {
  question: string;
  answer: string;
  citations: number[];
};

export const parseQAs = async (thread: MessageElement[]) => {
  const completion = await openai.chat.completions.create({
    model: "", // not used
    messages: [
      {
        role: "system",
        content: `
You are a Slack thread parser for a help desk. Given a Slack thread, extract question/answer pairs.

Guidelines:
- Paraphrase questions and answers
- Cite message index for each answer
- Omit personal/circumstantial questions
  - "My project is about ..., is this allowed?" can be either omitted, or paraphrased to "Are ... projects allowed?"
- Focus on core information
- Skip unclear questions
- Keep responses concise
- Omit questions when in doubt

Return format:
{
  "qa_pairs": [
    {
      "question": "The paraphrased question",
      "answer": "The paraphrased answer",
      "citations": [1, 2, 3]
    }
  ]
}

If you do not find any question/answer pairs, return:
{
  "qa_pairs": []
}
`.trim(),
      },
      {
        role: "user",
        content: formatThread(thread),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "question-answer-pairs",
        strict: true,
        schema: {
          type: "object",
          properties: {
            qa_pairs: {
              type: "array",
              description:
                "A list of question-answer pairs extracted from the Slack thread.",
              items: {
                type: "object",
                properties: {
                  question: {
                    type: "string",
                    description: "The paraphrased text of the question",
                  },
                  answer: {
                    type: "string",
                    description: "The paraphrased text of the answer",
                  },
                  citations: {
                    type: "array",
                    description:
                      "An array of message indexes (starting from 1) that contain the answer",
                    items: {
                      type: "integer",
                      minimum: 1,
                      description:
                        "A message index number corresponding to the input format (e.g., 1 for [#1 ...]).",
                    },
                  },
                },
                required: ["question", "answer", "citations"],
              },
            },
          },
          required: ["qa_pairs"],
        },
      },
    },
  });

  const response = JSON.parse(completion.choices[0]?.message?.content ?? "[]");

  const pairs = response.qa_pairs as QuestionAnswerPair[];

  // for some reason, the AI sometimes returns questions/answers with the ID ("How do I ...? [#1]")
  const stripId = (text: string) => {
    const idRegex = /\[#\d+\]/g;
    return text.replace(idRegex, "").trim();
  };

  const processedPairs = pairs.map((pair) => ({
    ...pair,
    question: stripId(pair.question),
    answer: stripId(pair.answer),
  }));

  return processedPairs;
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

    // First get the similar questions
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

    // Enhance results with citation content where available
    const enhancedResults = await Promise.all(
      results.map(async (result) => {
        const citationDetails = [];

        // Get citation content for each citation ID
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

          // Add citation details from records
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

    console.log(enhancedResults);

    return { results: enhancedResults };
  } catch (error) {
    console.error("Error searching similar questions:", error);
    return { error: "Failed to search database" };
  }
};

export async function answerQuestion(question: string): Promise<{
  answer: string;
  hasAnswer: boolean;
  sources?: string[];
}> {
  try {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
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
        role: "user",
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
        return {
          answer: "I couldn't process your question. Please try again.",
          hasAnswer: false,
        };
      }

      try {
        const parsedResponse = JSON.parse(responseMessage.content.trim());

        if (parsedResponse.type === "not_question") {
          console.log("No question found");
          return {
            answer: "No question found",
            hasAnswer: false,
          };
        } else if (parsedResponse.type === "no_answer") {
          return {
            answer: `I don't know\n\n${parsedResponse.reason || ""}`,
            hasAnswer: false,
          };
        } else if (parsedResponse.type === "answer") {
          return {
            answer: parsedResponse.content || "",
            hasAnswer: true,
            sources: parsedResponse.sources || [],
          };
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
              role: "user",
              content: JSON.stringify(searchResult),
            });
          } else {
            // No results found
            return {
              answer:
                "I couldn't find any relevant information for your question.",
              hasAnswer: false,
            };
          }
        } else {
          // Unrecognized response type
          messages.push(responseMessage);
          messages.push({
            role: "user",
            content:
              "You didn't respond in the correct JSON format. Please try again.",
          });
        }
      } catch (e) {
        // Failed to parse JSON
        messages.push(responseMessage);
        messages.push({
          role: "user",
          content: "You didn't respond with valid JSON. Please try again.",
        });
      }

      currentAttempt++;
    }

    // the ai hasn't found an answer after 3 attempts
    console.log(messages);

    return {
      answer:
        "I couldn't find a relevant answer to your question after multiple attempts.",
      hasAnswer: false,
    };
  } catch (error) {
    console.error("Error answering question:", error);
    return {
      answer:
        "I encountered an error while trying to answer your question. Please try again later.",
      hasAnswer: false,
    };
  }
}
