import { io } from "socket.io-client";

const userId = localStorage.getItem("userId");

const SOCKET_BASE = (() => {
  const fromEnv = import.meta.env.VITE_SOCKET_URL;
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
    return fromEnv.trim().replace(/\/+$/, "");
  }
  return import.meta.env.MODE === "development" ? "http://localhost:3000" : "/";
})();

export const socket = io(SOCKET_BASE, {
  query: { userId },
  transports: ["websocket"],
});

window.socket = socket;