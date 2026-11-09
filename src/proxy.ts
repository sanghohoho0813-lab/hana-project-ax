/**
 * 실증(/pilot) 전용 — 로그인 세션 갱신과 비로그인 차단. 데모 화면에는 적용하지 않는다(matcher).
 * 최종 권한 판단은 각 화면·서버 함수·DB(RLS)가 다시 한다 — 여기서는 빠른 차단과 보안 헤더만.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC = ["/pilot/login", "/pilot/auth/confirm"];

function harden(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "same-origin");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return harden(response); // 설정 전: 화면이 '설정 안 됨'을 보여준다

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // 인증 서버로 확인 (쿠키 내용만 믿지 않는다) — 만료된 토큰은 여기서 갱신된다
  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (!data.user && path !== "/pilot" && !PUBLIC.some((p) => path.startsWith(p))) {
    const to = request.nextUrl.clone();
    to.pathname = "/pilot/login";
    to.search = "";
    const redirect = NextResponse.redirect(to);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return harden(redirect);
  }
  return harden(response);
}

export const config = {
  matcher: ["/pilot", "/pilot/:path*"],
};
