import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import OpenAI from "openai";
import { requireApiKeyAuth } from "$lib/server/api-auth";

const openai = new OpenAI({
  baseURL: "https://ai.hackclub.com",
  apiKey: "",
});

export type QuestionAnswerPair = {
  question: string;
  answer: string;
  citations: number[];
};

const formatThread = (thread: any[]) => {
  return thread
    .map(
      (msg, i) =>
        `[#${i + 1} ${msg.user || "Unknown"}] ${msg.text || "No content"}`
    )
    .join("\n\n");
};

export const POST: RequestHandler = async ({ request }) => {
  const authResult = await requireApiKeyAuth(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const { thread } = await request.json();

    if (!thread || !Array.isArray(thread)) {
      return json({ error: "Thread array is required" }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "",
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

Return format (WITH NO OTHER TEXT):
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

    const response = JSON.parse(
      completion.choices[0]?.message?.content ?? '{"qa_pairs": []}'
    );
    const pairs = response.qa_pairs as QuestionAnswerPair[];

    const stripId = (text: string) => {
      const idRegex = /\[#\d+\]/g;
      return text.replace(idRegex, "").trim();
    };

    const processedPairs = pairs.map((pair) => ({
      ...pair,
      question: stripId(pair.question),
      answer: stripId(pair.answer),
    }));

    return json({ qa_pairs: processedPairs });
  } catch (error) {
    console.error("Error parsing Q&As:", error);
    return json({ error: "Failed to parse Q&As" }, { status: 500 });
  }
};
