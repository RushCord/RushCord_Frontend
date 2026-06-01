export function dmConversationId(a, b) {
  const [x, y] = [String(a || ""), String(b || "")].sort();
  return `DM#${x}#${y}`;
}
