import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { pilotConfig } from "./config";

/**
 * 로그인한 사용자의 세션으로만 DB 에 접근한다 (공개 키 + 사용자 토큰 → RLS 적용).
 * Supabase 관리자 키(service_role)는 쓰지 않는다.
 */
export async function pilotClient() {
  const cfg = pilotConfig();
  if (!cfg) return null;
  const store = await cookies();
  return createServerClient(cfg.url, cfg.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // 서버 컴포넌트 렌더 중에는 쿠키를 쓸 수 없다 — 세션 갱신은 proxy 가 맡는다
        }
      },
    },
  });
}

export type PilotClient = NonNullable<Awaited<ReturnType<typeof pilotClient>>>;
