export function getAppBaseUrl() {
  const fromEnv = import.meta.env.VITE_APP_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
    return fromEnv.trim().replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }
  return "http://localhost:5173";
}

export function buildInviteUrl(code) {
  const c = String(code || "").trim();
  if (!c) return "";
  return `${getAppBaseUrl()}/invite/${encodeURIComponent(c)}`;
}
