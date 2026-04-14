export function formatMessageTime(date) {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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