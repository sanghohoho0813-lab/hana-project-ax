import { NextResponse } from "next/server";
import { getPilotSession } from "@/lib/pilot/session";

/**
 * 변경 확인 — 이 사용자가 볼 수 있는 기록(RLS 적용)의 마지막 변경 시각들을 돌려준다.
 * 화면은 이 값이 바뀌었을 때만 서버에서 다시 읽는다 (주기적 자동 갱신의 가벼운 확인 단계).
 */
const WATCH: [string, string][] = [
  ["work_events", "recorded_at"],
  ["schedules", "updated_at"],
  ["field_cases", "updated_at"],
  ["case_steps", "recorded_at"],
  ["case_photos", "recorded_at"],
  ["case_photos", "deleted_at"],
  ["safety_checks", "updated_at"],
  ["safety_reviews", "recorded_at"],
  ["risk_judgments", "recorded_at"],
];

export async function GET() {
  const s = await getPilotSession();
  if (!s || s === "unconfigured") return NextResponse.json({ v: null }, { status: 401 });
  const parts = await Promise.all(
    WATCH.map(async ([table, col]) => {
      const { data } = await s.sb.from(table).select(col).not(col, "is", null).order(col, { ascending: false }).limit(1);
      const row = ((data ?? []) as unknown as Record<string, string>[])[0];
      return row?.[col] ?? "-";
    }),
  );
  return NextResponse.json({ v: parts.join("|") }, { headers: { "cache-control": "no-store" } });
}
