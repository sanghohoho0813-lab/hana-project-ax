import "server-only";
import type { PilotClient } from "./supabase";
import { judgeAt, type DataKind } from "./core";
import { loadDay } from "./board";
import { loadInbox } from "./case-data";
import { impactOf, isOpen, rankCases, type Impact } from "./cases";
import { hhmm } from "./time";

/**
 * 관리자 수신함 + 우선 확인 순서 — '문제·지원' 화면과 대시보드가 같이 쓴다.
 * 사건 날짜별 하루치 기록으로 지금 시각 기준 기존 엔진 판단(judgeAt)을 돌려 후속 현장 영향(impactOf)을 구하고,
 * 기존 순서 규칙(rankCases)으로 정렬한다. 계산 방법은 0.3과 같다 (화면 개편으로 바꾸지 않음).
 */
export async function loadRankedInbox(sb: PilotClient, date: string, kind: DataKind, now: Date) {
  const [inbox, today] = await Promise.all([loadInbox(sb, date, kind), loadDay(sb, date, kind)]);
  const dates = [...new Set([date, ...inbox.cases.map((c) => c.work_date)])];
  const days = new Map<string, Awaited<ReturnType<typeof loadDay>>>([[date, today]]);
  await Promise.all(dates.filter((d) => d !== date).map(async (d) => days.set(d, await loadDay(sb, d, kind))));
  const results = new Map(dates.map((d) => [d, judgeAt(days.get(d)!.schedules, days.get(d)!.events, now.toISOString())]));
  const impacts = new Map<string, Impact | null>();
  for (const c of inbox.cases) {
    const d = days.get(c.work_date)!;
    const start = (id: string) => hhmm(d.schedules.find((x) => x.id === id)?.planned_start);
    impacts.set(c.id, isOpen(c) ? impactOf(results.get(c.work_date)!, c.schedule_id, c.worker_id, start) : null);
  }
  const ranked = rankCases(inbox.cases.filter(isOpen), impacts, now);
  const closed = inbox.cases.filter((c) => !isOpen(c));
  const titleOf = new Map<string, string>();
  for (const d of days.values()) for (const x of d.schedules) titleOf.set(x.id, x.site_name);
  return { inbox, today, days, results, ranked, closed, titleOf };
}
