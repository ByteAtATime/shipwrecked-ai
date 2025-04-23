import {
  WebClient,
  type AllMessageEvents,
  type GenericMessageEvent,
} from "@slack/web-api";
import { answerQuestion, formatThread, parseQAs } from "./ai";
import { generateEmbedding } from "./embedding";
import { db } from "./db";
import { questionsTable } from "./schema";
import { App } from "@slack/bolt";
import { extractPlaintextFromMessage } from "./utils";

const token = Bun.env["SLACK_TOKEN"];

if (!token) {
  throw new Error("SLACK_TOKEN is not set");
}

const app = new App({
  token,
  signingSecret: Bun.env["SLACK_SIGNING_SECRET"],
  socketMode: true,
  appToken: Bun.env["SLACK_APP_TOKEN"],
});

const previousMessages = await app.client.conversations.history({
  channel: "C08Q1CNLMQ8",
});

for (const msg of previousMessages.messages ?? []) {
  if (msg.reactions && msg.reactions.length > 0) {
    if (msg.reactions.some((r) => r.name === "white_check_mark")) {
      if (!msg.ts) continue;

      const replies = await app.client.conversations.replies({
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

app.event("message", async ({ event, client }) => {
  if (event.channel !== "C08Q1CNLMQ8") return;
  if (event.type !== "message") return;

  event = event as GenericMessageEvent;

  // TODO: fix type
  const text = extractPlaintextFromMessage({ blocks: event.blocks ?? [] });
  if (!text || text.length === 0) return;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: text }],
  });
});

await app.start();
app.logger.info("⚡️ Bolt app is running on port 3000");
