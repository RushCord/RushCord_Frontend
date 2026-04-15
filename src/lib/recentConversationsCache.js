const STORAGE_KEY = "rushcord_recent_conversations_v1";
const MAX_ITEMS = 10;

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeMessagePreview(message) {
  if (!message || typeof message !== "object") return null;
  return {
    messageId: message._id ?? message.messageId ?? "",
    senderId: message.senderId ?? "",
    receiverId: message.receiverId ?? "",
    type: message.type ?? "",
    text: typeof message.text === "string" ? message.text : "",
    createdAt: message.createdAt ?? "",
    // Common attachment fields in this codebase
    image: message.image,
    images: message.images,
    file: message.file,
    fileName: message.fileName,
    contentType: message.contentType,
    isRecalled: !!message.isRecalled,
    isDeletedForMe: !!message.isDeletedForMe,
  };
}

export function loadRecentConversations() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { version: 1, updatedAt: "", items: [] };
  const parsed = safeParse(raw);
  if (!parsed || typeof parsed !== "object") {
    return { version: 1, updatedAt: "", items: [] };
  }
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  return {
    version: 1,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    items,
  };
}

export function saveRecentConversations(cache) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota / storage errors
  }
}

/**
 * Upsert a "conversation" for DM in this app:
 * conversationId is effectively the otherUserId (since FE is DM-by-user list).
 */
export function upsertRecentDmConversation({
  myUserId,
  otherUser,
  message,
}) {
  if (!myUserId || !otherUser?._id || !message) return loadRecentConversations();

  const otherUserId = String(otherUser._id);
  const cache = loadRecentConversations();
  const idx = cache.items.findIndex((x) => x.otherUserId === otherUserId);

  const msgCreatedAt = String(message.createdAt || "");
  const nextEntry = idx >= 0 ? { ...cache.items[idx] } : {};

  const prevTs = typeof nextEntry.lastMessageAt === "string" ? nextEntry.lastMessageAt : "";
  if (prevTs && msgCreatedAt && msgCreatedAt <= prevTs) {
    return cache; // out-of-order, ignore
  }

  nextEntry.type = "DM";
  nextEntry.otherUserId = otherUserId;
  nextEntry.otherUserFullName = otherUser.fullName || otherUser.name || "";
  nextEntry.otherUserProfilePic = otherUser.profilePic || "";
  nextEntry.lastMessageAt = msgCreatedAt;
  nextEntry.lastMessage = normalizeMessagePreview(message);

  const filtered = cache.items.filter((_, i) => i !== idx);
  const items = [nextEntry, ...filtered].slice(0, MAX_ITEMS);
  const nextCache = { version: 1, updatedAt: nowIso(), items };
  saveRecentConversations(nextCache);
  return nextCache;
}

export function clearRecentConversations() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

