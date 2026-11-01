import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 비교시험 교차확인 전용 — 기존 자동 테스트(npm test, tests/ 113개)와 섞이지 않게 따로 돌린다.
//   npx vitest run --config trial/vitest.config.ts
export default defineConfig({
  root: fileURLToPath(new URL("..", import.meta.url)),
  resolve: {
    alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
  },
  test: {
    include: ["trial/check/**/*.check.ts"],
    environment: "node",
  },
});
