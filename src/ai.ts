import type { MessageElement } from "@slack/web-api/dist/types/response/ConversationsHistoryResponse"; // TODO: ???
import OpenAI from "openai";
import { formatThread } from "./utils";
import { generateEmbedding } from "./embedding";
import { db } from "./db";
import { questionsTable } from "./schema";
import { sql, cosineDistance, desc } from "drizzle-orm";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption,
} from "openai/resources.mjs";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: Bun.env["OPENROUTER_API_KEY"],
  defaultHeaders: {
    "X-Title": "Shipwrecked AI",
  },
});

export type QuestionAnswerPair = {
  question: string;
  answer: string;
  citations: number[];
};

export const parseQAs = async (thread: MessageElement[]) => {
  const completion = await openai.chat.completions.create({
    model: "google/gemini-2.0-flash-exp:free",
    messages: [
      {
        role: "system",
        content:
          "You are a Slack thread parser for a help desk. Given a Slack thread, extract question/answer pairs. You must paraphrase the questions and answers, but give citations to the answers in the form of the provided message indexes. In the question or answer, you must not reference any other messages (you have to paraphrase them).",
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

interface Tool {
  name: string;
  description: string;
  execute: (args: any) => Promise<any>;
}

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
        citations: questionsTable.citations,
        similarity,
      })
      .from(questionsTable)
      .where(sql`${similarity} > 0.5`)
      .orderBy((t) => desc(t.similarity))
      .limit(limit);

    console.log(results);

    return { results };
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
  const tools: Tool[] = [
    {
      name: "search_similar_questions",
      description:
        "Search for similar questions in the database using vector embeddings",
      execute: async (args: { query: string; limit?: number }) => {
        return await searchSimilarQuestions(args.query, args.limit);
      },
    },
  ];

  const toolDefinitions: ChatCompletionTool[] = tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The question to search for",
          },
          limit: {
            type: "number",
            description: "Maximum number of similar questions to return",
          },
        },
        required: ["query"],
      },
    },
  }));

  try {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are an AI assistant that can answer questions based on a knowledge base. You have access to a vector database of question-answer pairs. Use the search_similar_questions tool to find relevant information before answering. Always cite your sources. All of your answers must be directly from the search results; if you are even a little unsure, return <no-answer></no-answer>. Take note of the questions that the vector database provides, along with the confidence scores.

Context: this is an event called Shipwrecked, which is run by Hack Club.

When you are finished, YOU MUST respond in the following format. Answers may be in markdown:

<answer>{answer}</answer>

<sources>https://hackclub.slack.com/...,https://hackclub.slack.com/...</sources>

If you cannot find an answer, respond with:
<no-answer>{what was wrong with the embedding search results}</no-answer>`,
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
        tools: toolDefinitions,
        tool_choice: currentAttempt === 0 ? "required" : "auto",
      });

      const responseMessage = response.choices[0]?.message;

      if (!responseMessage) {
        return {
          answer: "I couldn't process your question. Please try again.",
          hasAnswer: false,
        };
      }

      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        for (const toolCall of responseMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          const tool = tools.find((t) => t.name === functionName);
          if (tool) {
            const toolResult = await tool.execute(functionArgs);

            if (toolResult.results && toolResult.results.length > 0) {
              messages.push(responseMessage);

              messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult),
              } as ChatCompletionMessageParam);
            }
          }
        }
      } else if (responseMessage.content?.trim()) {
        if (responseMessage.content.trim().includes("<no-answer>")) {
          const noAnswerRegex = /<no-answer>(.*?)<\/no-answer>/;
          const match = responseMessage.content.trim().match(noAnswerRegex);

          const noAnswerReason = match?.[1]?.trim() ?? "";

          return {
            answer: `I don't know\n\n${noAnswerReason}`,
            hasAnswer: false,
          };
        } else {
          const responseFormatRegex =
            /<answer>((.|\s)*?)<\/answer>\s*<sources>((.|\s)*?)<\/sources>/;
          const match = responseMessage.content
            .trim()
            .match(responseFormatRegex);

          if (match) {
            const answer = match[1]?.trim() ?? "";
            console.log(match);
            const sources = (match[3]?.trim() ?? "").split(",");

            return {
              answer,
              hasAnswer: true,
              sources,
            };
          } else {
            messages.push(responseMessage);
            messages.push({
              role: "user",
              content:
                "You didn't respond in the correct format. Please try again.",
            });
          }
        }
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
