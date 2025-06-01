import type { MessageElement } from "@slack/web-api/dist/types/response/ConversationsHistoryResponse";
import { formatThread } from "./utils";
import { generateEmbedding } from "./embedding";
import { apiClient } from "./api-client";

export type QuestionAnswerPair = {
  question: string;
  answer: string;
  citations: number[];
};

export const parseQAs = async (thread: MessageElement[]) => {
  return apiClient.parseQAs(thread);
};

export async function answerQuestion(question: string): Promise<{
  answer: string;
  hasAnswer: boolean;
  sources?: string[];
}> {
  try {
    const result = await apiClient.answerQuestion(question);

    return {
      answer: result.answer || "",
      hasAnswer: result.hasAnswer || false,
      sources: result.sources || [],
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
