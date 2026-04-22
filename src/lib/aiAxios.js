import axios from "axios";

const rawBase = import.meta.env.VITE_AI_API_BASE_URL || "";
const aiBaseURL = String(rawBase).trim().replace(/\/+$/, "");

export const aiAxios = axios.create({
  baseURL: aiBaseURL,
  headers: { "Content-Type": "application/json" },
});

aiAxios.interceptors.request.use((config) => {
  const apiKey = import.meta.env.VITE_AI_API_KEY;
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (key) {
    config.headers = config.headers || {};
    config.headers["X-API-Key"] = key;
  }
  return config;
});

export function getAiConfig() {
  return {
    baseURL: aiBaseURL,
    hasKey: Boolean(String(import.meta.env.VITE_AI_API_KEY || "").trim()),
  };
}

