"use server";

import { redirect } from "next/navigation";
import { pilotClient } from "@/lib/pilot/supabase";
import { getPilotSession } from "@/lib/pilot/session";
import { friendlyError } from "@/lib/pilot/errors";

/** email: 실패 뒤에도 입력칸에 다시 채운다 (React 19 는 폼 제출 뒤 입력칸을 비운다) */
export type FormState = { error?: string; ok?: string; email?: string } | undefined;

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function signInAction(_: FormState, fd: FormData): Promise<FormState> {
  const sb = await pilotClient();
  if (!sb) return { error: "실증 DB가 설정되지 않았습니다." };
  const email = text(fd, "email");
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "이메일과 비밀번호를 넣어 주세요.", email };
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { error: friendlyError(error.message), email };
  redirect("/pilot");
}

export async function signOutAction() {
  const sb = await pilotClient();
  await sb?.auth.signOut();
  redirect("/pilot/login");
}

/** 비밀번호 재설정 메일 — 가입 여부를 알려주지 않도록 결과 문장은 항상 같다 */
export async function requestResetAction(_: FormState, fd: FormData): Promise<FormState> {
  const sb = await pilotClient();
  if (!sb) return { error: "실증 DB가 설정되지 않았습니다." };
  const email = text(fd, "email");
  if (!email) return { error: "이메일을 넣어 주세요." };
  await sb.auth.resetPasswordForEmail(email);
  return { ok: "등록된 주소라면 재설정 메일을 보냈습니다. 메일의 링크를 눌러 새 비밀번호를 정해 주세요." };
}

export async function setPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const s = await getPilotSession();
  if (!s || s === "unconfigured") return { error: "로그인이 필요합니다. 메일의 링크를 다시 눌러 주세요." };
  const pw = String(fd.get("password") ?? "");
  if (pw !== String(fd.get("confirm") ?? "")) return { error: "두 비밀번호가 같지 않습니다." };
  const { error } = await s.sb.auth.updateUser({ password: pw });
  if (error) return { error: friendlyError(error.message) };
  redirect("/pilot");
}

/** 관리자 2단계 인증 등록 — 확인하지 않은 이전 등록은 지우고 새로 만든다 */
export async function mfaEnrollAction(): Promise<{ factorId: string; qr: string; secret: string } | { error: string }> {
  const s = await getPilotSession();
  if (!s || s === "unconfigured") return { error: "로그인이 필요합니다." };
  const { data: list } = await s.sb.auth.mfa.listFactors();
  for (const f of list?.all ?? []) {
    if (f.factor_type === "totp" && f.status !== "verified") await s.sb.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await s.sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `하나 AX 실증 ${Date.now()}` });
  if (error || !data) return { error: friendlyError(error?.message) };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function mfaVerifyAction(_: FormState, fd: FormData): Promise<FormState> {
  const s = await getPilotSession();
  if (!s || s === "unconfigured") return { error: "로그인이 필요합니다." };
  let factorId = text(fd, "factorId");
  if (!factorId) {
    const { data } = await s.sb.auth.mfa.listFactors();
    factorId = data?.totp.find((f) => f.status === "verified")?.id ?? "";
  }
  const code = text(fd, "code").replace(/\s/g, "");
  if (!factorId || !/^\d{6}$/.test(code)) return { error: "인증 앱의 6자리 숫자를 넣어 주세요." };
  const { error } = await s.sb.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: friendlyError(error.message) };
  redirect("/pilot");
}
