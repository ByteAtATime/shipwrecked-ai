const GEMINI_API_KEY = Bun.env["GEMINI_API_KEY"];

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set");
}

export const generateEmbedding = async (text: string) => {
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

  const data = (await response.json()) as { embedding: { values: number[] } };

  return data.embedding.values;
};
