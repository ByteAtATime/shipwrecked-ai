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
You are a Slack help desk QA extractor. You are given a thread of messages from a Slack channel. You must extract the question-answer pairs from the thread.

# CORE RULES
1. FORMATTING:
   - Output ONLY valid JSON using this structure:
     { "qa_pairs": [ { "question": "...", "answer": "...", "citations": [...] } ] }
   - When no pairs found: { "qa_pairs": [] }

2. CONTENT PARAPHRASING:
   - Strip ALL message metadata (user names, [#N] refs, timestamps)
   - Convert relative → absolute time:
     • Current: ${new Date().toISOString()}
     • Example: "yesterday" → "2023-11-05"
   - Generalize personal/circumstantial queries:
     • "Can I use React for my dating app?" → "Can React be used for dating apps?"
     • Omit if not generalizable

3. QUALITY FILTERING:
   - MUST OMIT:
     › Unanswered/unclear questions
     › Personal logistics ("When's my meeting?")
     › Duplicates
   - MUST KEEP:
     › Policy clarifications
     › Technical solutions
     › Reusable knowledge

# OUTPUT EXAMPLE
Input message: 
  [#3 Alice] Is the API down right now?
  [#4 Bob] Yes, until 2023-11-06T12:00Z

Output: 
{
  "qa_pairs": [{
    "question": "Is the API currently unavailable?",
    "answer": "The API is down until 2023-11-06 12:00 UTC",
    "citations": [3,4]
  }]
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
