/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { knowledgePlugin } from "./knowledgePlugin";

// Locally Atlas runs on its own "subdomain": http://atlas.localhost:8081
export default defineConfig({
  server: { host: "localhost", port: 8081, strictPort: true },
  plugins: [react(), knowledgePlugin(path.resolve(__dirname, "./spec"))],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/test/setup.ts"] },
});
