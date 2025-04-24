import { type GenericMessageEvent } from "@slack/web-api";
import { answerQuestion, parseQAs } from "./ai";
import { generateEmbedding } from "./embedding";
import { db } from "./db";
import { questionsTable } from "./schema";
import { App } from "@slack/bolt";
import { extractPlaintextFromMessage } from "./utils";
import type { MessageElement } from "@slack/web-api/dist/types/response/ConversationsRepliesResponse";

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

const storeThread = async (thread: MessageElement[]) => {
  const qas = await parseQAs(thread);
  if (!qas || qas.length === 0) return;

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
            await app.client.chat.getPermalink({
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

    console.log("Stored question:", question);
  }
};
// for (const msg of previousMessages.messages ?? []) {
//   if (msg.reactions && msg.reactions.length > 0) {
//     if (msg.reactions.some((r) => r.name === "white_check_mark")) {
//       if (!msg.ts) continue;

//       const replies = await app.client.conversations.replies({
//         channel: "C08Q1CNLMQ8",
//         ts: msg.ts,
//       });

//       const thread = replies.messages;
//       if (!thread) continue;

//       await storeThread(thread);
//     }
//   }
// }

app.event("message", async ({ event, say, client }) => {
  if (event.channel !== "C08Q1CNLMQ8") return;
  if (event.type !== "message") return;
  if ("thread_ts" in event) return; // ignore thread replies

  event = event as GenericMessageEvent;

  // TODO: fix type
  const text = extractPlaintextFromMessage({ blocks: event.blocks ?? [] });
  if (!text || text.length === 0) return;

  const answer = await answerQuestion(text);
  console.log(answer);
  if (!answer.hasAnswer) return;

  await client.chat.postMessage({
    channel: event.channel,
    thread_ts: event.ts,
    text: answer.answer,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: answer.answer,
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Sources: ${answer.sources
            ?.map((s, i) => `<${s}|#${i + 1}>`)
            .join(" ")}`,
        },
      },
    ],
  });
});

app.event("reaction_added", async ({ event, client }) => {
  console.log(event);
  if (event.item.channel !== "C08Q1CNLMQ8") return;
  if (event.reaction !== "white_check_mark") return;

  const replies = await client.conversations.replies({
    channel: "C08Q1CNLMQ8",
    ts: event.item.ts,
  });

  const thread = replies.messages;
  if (!thread) return;

  await storeThread(thread);
});

await app.start();
app.logger.info("⚡️ Bolt app is running on port 3000");
