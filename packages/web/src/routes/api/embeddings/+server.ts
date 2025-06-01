import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set");
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { text } = await request.json();

    if (!text) {
      return json({ error: "Text is required" }, { status: 400 });
    }

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

    return json({ embedding: data.embedding.values });
  } catch (error) {
    console.error("Error generating embedding:", error);
    return json({ error: "Failed to generate embedding" }, { status: 500 });
  }
};
