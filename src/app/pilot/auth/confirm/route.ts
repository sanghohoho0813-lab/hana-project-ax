import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { pilotClient } from "@/lib/pilot/supabase";

/** 초대·비밀번호 재설정 메일의 링크 — 서버에서 일회용 토큰을 확인한 뒤 비밀번호 설정 화면으로 보낸다 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const to = request.nextUrl.clone();
  to.search = "";
  const sb = await pilotClient();
  if (sb && tokenHash && (type === "invite" || type === "recovery")) {
    const { error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      to.pathname = "/pilot/account/password";
      return NextResponse.redirect(to);
    }
  }
  to.pathname = "/pilot/login";
  to.searchParams.set("error", "link");
  return NextResponse.redirect(to);
}
