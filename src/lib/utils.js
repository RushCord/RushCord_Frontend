export function isVoiceFileName(fileName) {
  return /^voice-\d+\./i.test(String(fileName || "").trim());
}

export function formatMessageTime(date) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Inbox API trả `lastMessage` là item Dynamo (mediaItems, recallScope) — chưa map
 * sang shape chat (image / file / images). Chuẩn hóa giống messageToLegacy (BE).
 */
function normalizeConversationLastMessage(last) {
  if (!last || typeof last !== "object") return last;
  if (last.image || last.file || (Array.isArray(last.images) && last.images.length > 0)) {
    return last;
  }
  const items = last.mediaItems;
  if (!Array.isArray(items) || items.length === 0) return last;

  const urls = items
    .map((m) => m?.publicUrl)
    .filter((u) => typeof u === "string" && u.length > 0);
  if (urls.length === 0) return last;

  const msgType = String(last.type || "");
  if (msgType === "IMAGES" || urls.length > 1) {
    return { ...last, images: urls };
  }

  const first = items[0];
  const ct = String(first?.contentType || "").toLowerCase();
  if (msgType === "IMAGE" || ct.startsWith("image/")) {
    return { ...last, image: urls[0] };
  }
  return {
    ...last,
    file: urls[0],
    fileName:
      typeof first?.fileName === "string" && first.fileName.length > 0
        ? first.fileName
        : last.fileName,
    contentType: ct || last.contentType,
  };
}

/**
 * Nội dung rút gọn cho dòng preview cuộc trò chuyện (ảnh / video / file / ghi âm).
 */
export function getLastMessagePreviewBody(last) {
  if (!last || typeof last !== "object") return "";
  if (last.isRecalled || last.recallScope === "ALL") return "Tin nhắn đã bị thu hồi";
  if (last.isDeletedForMe) return "Đã ẩn tin nhắn";

  const m = normalizeConversationLastMessage(last);

  if (typeof m.text === "string" && m.text.trim().length > 0) {
    return m.text.trim();
  }
  if (m.image || (Array.isArray(m.images) && m.images.length > 0)) {
    return "Đã gửi ảnh";
  }
  if (m.file) {
    const ct = String(m.contentType || "").toLowerCase();
    if (ct.startsWith("video/")) return "Đã gửi video";
    if (ct.startsWith("audio/")) return "Đã gửi ghi âm";
    if (ct.startsWith("image/")) return "Đã gửi ảnh";
    const name = String(m.fileName || "").toLowerCase();
    const url = String(m.file || "").toLowerCase();
    const hay = `${name} ${url}`;
    if (/\.(mp4|webm|mov|mkv|avi)(\?|$)/i.test(hay)) return "Đã gửi video";
    if (/\.(m4a|mp3|wav|ogg|aac|opus|webm)(\?|$)/i.test(hay)) return "Đã gửi ghi âm";
    if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(hay)) return "Đã gửi ảnh";
    return "Đã gửi file";
  }
  return "";
}

export const getFileIcon = (url) => {
  if (!url) return "📎";

  const lower = url.toLowerCase();

  if (lower.includes(".pdf")) return "📄";
  if (lower.includes(".doc") || lower.includes(".docx")) return "📝";
  if (lower.includes(".xls") || lower.includes(".xlsx")) return "📊";
  if (lower.includes(".zip") || lower.includes(".rar")) return "🗜️";
  if (lower.includes(".png") || lower.includes(".jpg") || lower.includes(".jpeg"))
    return "🖼️";

  return "📎";
};