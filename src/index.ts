import { WebClient } from "@slack/web-api";
import { formatThread, parseQAs } from "./ai";

const token = Bun.env["SLACK_TOKEN"];

if (!token) {
  throw new Error("SLACK_TOKEN is not set");
}

const web = new WebClient(token);

const previousMessages = await web.conversations.history({
    channel: "C08Q1CNLMQ8"
});

for (const msg of previousMessages.messages ?? []) {
  if (msg.reactions && msg.reactions.length > 0) {
    if (msg.reactions.some(r => r.name === "white_check_mark")) {
      if (!msg.ts) continue;

      const replies = await web.conversations.replies({
        channel: "C08Q1CNLMQ8",
        ts: msg.ts
      });

      const thread = replies.messages;
      if (!thread) continue;
      
      const qas = await parseQAs(thread);
      console.log(qas)
    }
  }
}
