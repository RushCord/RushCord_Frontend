/**
 * Chủ đề nhóm — `id` phải trùng backend `src/constants/groupTopics.js`.
 */
export const MAX_GROUP_DESCRIPTION_LENGTH = 280;

export const GROUP_TOPIC_OPTIONS = [
  { id: "gaming", label: "Gaming" },
  { id: "music", label: "Music" },
  { id: "entertainment", label: "Entertainment" },
  { id: "education", label: "Education" },
];

export function getTopicLabel(topicId) {
  const id = String(topicId || "").trim();
  return GROUP_TOPIC_OPTIONS.find((o) => o.id === id)?.label || id || "—";
}
