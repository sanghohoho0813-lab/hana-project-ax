/**
 * 실증 설정 — 환경변수가 없으면 실증 화면만 '설정 안 됨'으로 보이고, 데모 화면은 그대로 동작한다.
 *
 * NEXT_PUBLIC_SUPABASE_URL              Supabase 프로젝트 주소 (공개)
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  Supabase 공개 키 (RLS 로 보호 — 브라우저에 보여도 됨)
 * NEXT_PUBLIC_PILOT_DB_LABEL            화면 띠에 표시할 DB 이름 (예: 개발 DB · 실증 DB)
 * PILOT_JUDGE_SECRET                    판단 기록 서명키 (서버 전용 · DB pilot_private.settings 와 같은 값)
 * VERCEL_GIT_COMMIT_SHA / PILOT_APP_COMMIT  프로그램 버전 기록용 커밋
 * Supabase 관리자 키(service_role)는 쓰지 않는다.
 */
import pkg from "../../../package.json";

export interface PilotPublicConfig {
  url: string;
  key: string;
  dbLabel: string;
}

export function pilotConfig(): PilotPublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key, dbLabel: process.env.NEXT_PUBLIC_PILOT_DB_LABEL || "DB 이름 미설정" };
}

/** 프로그램 버전 — 판단 기록·내보내기에 남긴다 */
export function appVersion(): string {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.PILOT_APP_COMMIT || "커밋 미상";
  return `${pkg.name}@${pkg.version}+${commit.slice(0, 12)}`;
}
