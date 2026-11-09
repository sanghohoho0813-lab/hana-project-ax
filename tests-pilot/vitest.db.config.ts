import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config";

// DB·인증·권한 통합 시험 — 로컬 Supabase 가 떠 있어야 한다 (npx supabase@2.122.0 start)
export default mergeConfig(base, defineConfig({ test: { env: { PILOT_DB_TEST: "1" } } }));
