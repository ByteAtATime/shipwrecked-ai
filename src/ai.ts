import type { MessageElement } from "@slack/web-api/dist/types/response/ConversationsHistoryResponse"; // TODO: ???
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: Bun.env["OPENROUTER_API_KEY"],
  defaultHeaders: {
    "X-Title": "Shipwrecked AI",
  },
});

const extractPlaintextFromMessage = (message: MessageElement) =>
  message.blocks
    ?.flatMap((b) => b.elements ?? [])
    .flatMap((s) => s.elements ?? [])
    .map((e) => e.text ?? "")
    .join("");

export const formatThread = (thread: MessageElement[]) => {
  return thread
    .map((msg, i) => {
      const timestamp = msg.ts?.split(".")?.[0];
      if (!timestamp) return "";
      const date = new Date(Number(timestamp) * 1000);
      const text = extractPlaintextFromMessage(msg);

      return `
[#${i + 1} ${msg.user} ${date.toLocaleString()}]
${text}
`;
    })
    .join("\n---\n");
};

export type QuestionAnswerPair = {
  question: string;
  answer: string;
  citations: number[];
}

export const parseQAs = async (thread: MessageElement[]) => {
  const completion = await openai.chat.completions.create({
    model: "google/gemini-2.0-flash-exp:free",
    messages: [
      {
        role: "system",
        content:
          "You are a Slack thread parser for a help desk. Given a Slack thread, extract question/answer pairs. You must paraphrase the questions and answers, but give citations to the answers in the form of the provided message indexes.",
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
                    description:
                      "The paraphrased text of the question",
                  },
                  answer: {
                    type: "string",
                    description:
                      "The paraphrased text of the answer",
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
  }

  const processedPairs = pairs.map((pair) => ({
    ...pair,
    question: stripId(pair.question),
    answer: stripId(pair.answer),
  }));

  return processedPairs;
};
