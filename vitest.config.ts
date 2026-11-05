import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror the "@/*" path alias from tsconfig.json so tests can import "@/lib/parser" etc.
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // The core logic in lib/ is pure functions, so a plain Node environment is enough (no browser DOM).
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
