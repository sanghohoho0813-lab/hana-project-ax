import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 실증용 테스트 — 기존 자동 테스트(npm test, tests/ 113개)와 분리해 따로 돌린다.
//   npm run test:pilot       단위 시험 (DB 불필요)
//   npm run test:pilot:db    DB·인증·권한 통합 시험 (로컬 Supabase 필요: npx supabase@2.122.0 start)
export default defineConfig({
  root: fileURLToPath(new URL("..", import.meta.url)),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url)),
      // Next.js 가 처리하는 server-only 표시는 시험 환경에서는 빈 모듈로 본다
      "server-only": fileURLToPath(new URL("./helpers/empty.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests-pilot/**/*.test.ts"],
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});
