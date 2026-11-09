import { defineConfig } from "vitest/config";
import { shared } from "./vitest.config";

// DB·인증·권한 통합 시험 — 로컬 Supabase 가 떠 있어야 한다 (npx supabase@2.122.0 start)
export default defineConfig({
  ...shared,
  test: {
    include: ["tests-pilot/db*.test.ts"],
    environment: "node",
    env: { PILOT_DB_TEST: "1" },
    testTimeout: 30000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});
