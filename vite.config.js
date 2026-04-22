import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";


// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Prevent duplicate React copies when running behind tunnels/proxies or linked deps
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: true,
    allowedHosts: ["fe.oeb20412.com"],
    headers: {
      // Avoid proxy/CDN caching Vite dev assets across rebuilds
      "Cache-Control": "no-store",
      // Quick sanity-check header to ensure you're hitting the correct Vite instance
      "X-RushCord-Dev": "vite-dev",
    },
    hmr: {
      // Helps when accessing dev server via https tunnel/domain
      host: "fe.oeb20412.com",
      protocol: "wss",
      clientPort: 443,
    },
  },
});
