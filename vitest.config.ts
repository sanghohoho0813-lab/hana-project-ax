import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 위험판단 엔진 자동 테스트 — 순수 TypeScript 함수만 시험한다 (브라우저·서버 불필요)
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
