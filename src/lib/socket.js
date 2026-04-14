import { io } from "socket.io-client";

const userId = localStorage.getItem("userId");

export const socket = io("http://localhost:3000", {
  query: { userId },
  transports: ["websocket"],
});

window.socket = socket;