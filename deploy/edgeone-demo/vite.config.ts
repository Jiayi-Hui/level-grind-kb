import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const agentChatProxyTarget = process.env.VITE_AGENT_CHAT_PROXY_URL?.trim();

const unavailableAgentChatMiddleware = {
  name: "level-grind-local-agent-chat-diagnostic",
  configureServer(server: { middlewares: { use: (path: string, handler: (request: { method?: string }, response: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void }) => void) => void } }) {
    if (agentChatProxyTarget) return;
    const unavailable = (request: { method?: string }, response: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void }) => {
      response.statusCode = 503;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.end(JSON.stringify({
        ok: false,
        code: "LOCAL_AGENT_FUNCTION_NOT_CONNECTED",
        error: "本地 AskAI 未连接服务函数。请以 EdgeOne 预览验证，或设置 VITE_AGENT_CHAT_PROXY_URL 指向本地函数模拟器。",
        method: request.method || "GET",
      }));
    };
    server.middlewares.use("/api/agent-chat", unavailable);
    server.middlewares.use("/api/askai-history", unavailable);
  },
};

export default defineConfig({
  root: __dirname,
  publicDir: "../../public",
  plugins: [react(), unavailableAgentChatMiddleware],
  server: {
    proxy: {
      "/api/shared-notes/parse": {
        target: "http://127.0.0.1:8080",
        changeOrigin: false,
        rewrite: () => "/v1/documents/parse",
      },
      ...(agentChatProxyTarget ? {
        "/api/agent-chat": {
          target: agentChatProxyTarget,
          changeOrigin: true,
        },
        "/api/askai-history": {
          target: agentChatProxyTarget,
          changeOrigin: true,
        },
      } : {}),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
