export const AI_BOT_SENDER_ID = "RushCordAI";

export const RUSHCORD_AI_AVATAR_URL =
  "https://rushcord-media-448772857696-ap-southeast-1.s3.ap-southeast-1.amazonaws.com/AI/RushCordAI.png";

export const RUSHCORD_AI_DISPLAY_NAME = "RushCord AI";

export const SUMMARIZE_PROMPT_LABEL = "Tóm tắt cuộc trò chuyện";

export const BOT_PROMPT_SUGGESTIONS = [
  {
    id: "summary",
    label: SUMMARIZE_PROMPT_LABEL,
    subtitle: "Rút gọn nội dung chính trong đoạn chat",
  },
  {
    id: "joke",
    label: "Kể 1 câu chuyện cười ngắn",
    subtitle: "Một câu vui nhanh, gọn và nhẹ nhàng",
  },
  {
    id: "motivation",
    label: "Câu nói truyền động lực",
    subtitle: "Một câu ngắn để tiếp thêm năng lượng",
  },
];

const RUSHCORD_MENTION_RE = /^@RushCord\b/i;

export function isRushCordMention(text) {
  return RUSHCORD_MENTION_RE.test(String(text || "").trim());
}

export function stripRushCordMention(text) {
  return String(text || "")
    .trim()
    .replace(/^@RushCord\b/i, "")
    .trim();
}

export function isAiBotMessage(senderId) {
  return String(senderId || "") === AI_BOT_SENDER_ID;
}

export function isSummarizePrompt(prompt) {
  const p = String(prompt || "").trim().toLowerCase();
  return p === SUMMARIZE_PROMPT_LABEL.toLowerCase() || p.startsWith("tóm tắt");
}

/** Real chat messages eligible for summarize (excludes AI-local bubbles). */
export function isSummarizableMessage(message) {
  if (!message || message.isSystem || message.isDeletedForMe || message.isRecalled) {
    return false;
  }
  if (message.isAiLocalOnly || isAiBotMessage(message.senderId)) {
    return false;
  }
  return Boolean(String(message.text || "").trim());
}

/** Map UI messages to AI roles (bot = assistant, you = user, others = labeled user). */
export function toAiHistoryTurn(message, currentUserId, users = []) {
  if (!message || message.isSystem || message.isDeletedForMe || message.isRecalled) {
    return null;
  }

  const raw = String(message.text || "").trim();
  if (!raw) return null;

  const senderId = String(message.senderId || "");
  if (isAiBotMessage(senderId)) {
    return { role: "assistant", content: raw };
  }
  if (senderId === String(currentUserId || "")) {
    return { role: "user", content: raw };
  }
  const name =
    users.find((u) => String(u._id) === senderId)?.fullName || senderId || "Người dùng";
  return { role: "user", content: `[Thành viên khác] ${name}: ${raw}` };
}

export function buildAiHistoryPayload(messages, currentUserId, users, limit = 20) {
  const turns = (Array.isArray(messages) ? messages : [])
    .map((m) => toAiHistoryTurn(m, currentUserId, users))
    .filter(Boolean);
  if (limit == null || !Number.isFinite(limit) || limit <= 0) {
    return turns;
  }
  return turns.slice(-limit);
}

/** All summarizable messages currently loaded in the FE conversation. */
export function buildSummarizeHistoryPayload(messages, currentUserId, users) {
  return (Array.isArray(messages) ? messages : [])
    .filter(isSummarizableMessage)
    .map((m) => {
      const senderId = String(m.senderId || "");
      const raw = String(m.text || "").trim();
      if (senderId === String(currentUserId || "")) {
        return { role: "user", content: raw };
      }
      const name =
        users.find((u) => String(u._id) === senderId)?.fullName || senderId || "Người dùng";
      return { role: "user", content: `${name}: ${raw}` };
    })
    .filter(Boolean);
}

/** Detect `@` mention at caret (single-line input: query is suffix after last `@`). */
export function getMentionRange(value, caret) {
  const beforeCaret = String(value || "").slice(0, caret);
  const match = beforeCaret.match(/(^|[\s(])@([^\s@]*)$/);
  if (!match) return null;
  const query = match[2] || "";
  return {
    query,
    start: caret - query.length - 1,
    end: caret,
  };
}

export function isBotPromptMode(text, mentionRange) {
  if (mentionRange) return false;
  return /(^|[\s(])@RushCord(?:\s*)$/i.test(String(text || "").trimEnd());
}
