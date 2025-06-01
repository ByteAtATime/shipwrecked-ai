import type { MessageElement } from "@slack/web-api/dist/types/response/ConversationsRepliesResponse";

export const extractPlaintextFromMessage = (message: MessageElement) =>
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
