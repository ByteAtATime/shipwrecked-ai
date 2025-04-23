import { WebClient } from "@slack/web-api";
import { formatThread, parseQAs } from "./ai";
import { generateEmbedding } from "./embedding";
import { db } from "./db";
import { questionsTable } from "./schema";

const token = Bun.env["SLACK_TOKEN"];

if (!token) {
  throw new Error("SLACK_TOKEN is not set");
}

const web = new WebClient(token);

const previousMessages = await web.conversations.history({
  channel: "C08Q1CNLMQ8",
});

for (const msg of previousMessages.messages ?? []) {
  if (msg.reactions && msg.reactions.length > 0) {
    if (msg.reactions.some((r) => r.name === "white_check_mark")) {
      if (!msg.ts) continue;

      const replies = await web.conversations.replies({
        channel: "C08Q1CNLMQ8",
        ts: msg.ts,
      });

      const thread = replies.messages;
      if (!thread) continue;

      const qas = await parseQAs(thread);
      if (!qas || qas.length === 0) continue;

      for (const qa of qas) {
        const embedding = await generateEmbedding(qa.question);
        if (!embedding) continue;

        const question = qa.question;
        const answer = qa.answer;
        const citations = qa.citations;

        const citationIds = await Promise.all(
          citations.map(
            async (c) =>
              (
                await web.chat.getPermalink({
                  channel: "C08Q1CNLMQ8",
                  message_ts: thread[c - 1]!.ts!,
                })
              ).permalink!
          )
        );

        await db.insert(questionsTable).values({
          question,
          answer,
          citations: citationIds,
          embedding,
        });
      }
    }
  }
}
