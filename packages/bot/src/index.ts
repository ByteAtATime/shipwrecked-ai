import { type GenericMessageEvent } from "@slack/web-api";
import { answerQuestion, parseQAs } from "./ai";
import { generateEmbedding } from "./embedding";
import { apiClient } from "./api-client";
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

const channelId = "C08Q1CNLMQ8";

const previousMessages = await app.client.conversations.history({
  channel: channelId,
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

    // Store citation content and get citation IDs
    const citationIds = [];

    for (const c of citations) {
      const messageIndex = c - 1;
      if (!thread[messageIndex] || !thread[messageIndex].ts) continue;

      const message = thread[messageIndex];
      const messageTs = message.ts!;
      const content = extractPlaintextFromMessage(message as any);

      // Get username from either the real_name, name, or user_id
      let username = "Unknown User";
      if (message.user) {
        try {
          // Try to get user info
          const userInfo = await app.client.users.info({
            user: message.user,
          });

          if (userInfo.user) {
            username =
              userInfo.user.real_name || userInfo.user.name || message.user;
          } else {
            username = message.user;
          }
        } catch (error) {
          console.error("Error fetching user info:", error);
          username = message.user;
        }
      }

      const permalinkRes = await app.client.chat.getPermalink({
        channel: channelId,
        message_ts: messageTs,
      });

      const permalink = permalinkRes.permalink!;

      // Insert citation using API
      const citationRecord = await apiClient.createCitation({
        permalink,
        content: content || "No content available",
        timestamp: messageTs,
        username,
      });

      if (citationRecord) {
        citationIds.push(citationRecord.id);
      }
    }

    // Insert question using API
    await apiClient.createQuestion({
      question,
      answer,
      citationIds,
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
//         channel: channelId,
//         ts: msg.ts,
//       });

//       const thread = replies.messages;
//       if (!thread) continue;

//       await storeThread(thread);
//     }
//   }
// }

app.event("message", async ({ event, say, client }) => {
  if (event.channel !== channelId) return;
  if (event.type !== "message") return;
  if ("thread_ts" in event) return; // ignore thread replies

  event = event as GenericMessageEvent;

  // TODO: fix type
  const text = extractPlaintextFromMessage({
    blocks: event.blocks ?? [],
  } as any);
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
        type: "markdown",
        text: answer.answer,
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
  if (event.item.channel !== channelId) return;
  if (event.reaction !== "white_check_mark") return;

  const replies = await client.conversations.replies({
    channel: channelId,
    ts: event.item.ts,
  });

  const thread = replies.messages;
  if (!thread) return;

  await storeThread(thread);
});

await app.start();
app.logger.info("⚡️ Bolt app is running on port 3000");
