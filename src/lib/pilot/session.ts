import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { pilotClient, type PilotClient } from "./supabase";

export interface PilotProfile {
  id: string;
  display_name: string;
  role: "admin" | "field";
  active: boolean;
}

export interface PilotSession {
  sb: PilotClient;
  userId: string;
  email: string;
  profile: PilotProfile | null;
  aal: "aal1" | "aal2";
  /** 2단계 인증을 등록했는지 (관리자) */
  hasTotp: boolean;
}

/** 서버에서 인증 서버로 확인한 사용자만 믿는다 (쿠키의 세션 정보만으로 판단하지 않음) — 한 요청 안에서는 한 번만 확인 */
export const getPilotSession = cache(async (): Promise<PilotSession | null | "unconfigured"> => {
  const sb = await pilotClient();
  if (!sb) return "unconfigured";
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile } = await sb.from("profiles").select("id, display_name, role, active").eq("id", data.user.id).maybeSingle();
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  const factors = (data.user.factors ?? []).filter((f) => f.factor_type === "totp" && f.status === "verified");
  return {
    sb,
    userId: data.user.id,
    email: data.user.email ?? "",
    profile: (profile as PilotProfile | null) ?? null,
    aal: aal?.currentLevel === "aal2" ? "aal2" : "aal1",
    hasTotp: factors.length > 0,
  };
});

export async function requireSession(): Promise<PilotSession> {
  const s = await getPilotSession();
  if (s === "unconfigured") redirect("/pilot");
  if (!s) redirect("/pilot/login");
  return s;
}

/** 활성 관리자 + 2단계 인증 완료 (DB 정책도 같은 조건을 다시 검사한다) */
export async function requireAdmin(): Promise<PilotSession> {
  const s = await requireSession();
  if (!s.profile?.active || s.profile.role !== "admin") redirect("/pilot");
  if (s.aal !== "aal2") redirect("/pilot/account/mfa");
  return s;
}

export async function requireField(): Promise<PilotSession> {
  const s = await requireSession();
  if (!s.profile?.active || s.profile.role !== "field") redirect("/pilot");
  return s;
}
