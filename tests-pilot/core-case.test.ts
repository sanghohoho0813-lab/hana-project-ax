// 벤처확인 핵심 사례 1개 — 문서(docs/VENTURE_CORE_CASE.md)의 입력값 · 계산값을 이 시험으로 고정한다.
// 가상 시나리오(시험용 가정값)이며 실제 현장 기록이 아니다. 계산은 기존 연쇄위험 판단엔진(chain-risk/1.1.0)과 조기 확인 규칙을 그대로 쓴다.
import { describe, expect, it } from "vitest";
import { judgeAt, type EventRow, type ScheduleRow } from "@/lib/pilot/core";
import { impactOf } from "@/lib/pilot/cases";
import { watchInputOf, watchOf, safetyTiming } from "@/lib/pilot/watch";
import { progressOf } from "@/lib/pilot/core";
import { RISK_RULE_VERSION } from "@/lib/risk-engine";

const D = "2026-11-18";
const at = (hm: string) => new Date(`${D}T${hm}:00+09:00`).toISOString();
const S = (id: string, site: string, start: string, end: string, travel: number | null, from: string | null, over: Partial<ScheduleRow> = {}): ScheduleRow => ({
  id,
  data_kind: "검증 시나리오",
  work_date: D,
  assignee_id: "w1",
  site_name: site,
  region: "",
  planned_start: `${start}:00`,
  planned_end: `${end}:00`,
  travel_minutes: travel,
  travel_from_id: from,
  priority: "보통",
  status: "예정",
  version: 1,
  ...over,
});
let seq = 0;
const E = (schedule_id: string, kind: EventRow["kind"], hm: string, expected_end: string | null = null): EventRow => ({
  seq: ++seq,
  id: `e${seq}`,
  schedule_id,
  data_kind: "검증 시나리오",
  work_date: D,
  kind,
  occurred_at: at(hm),
  entered_time: null,
  expected_end: expected_end ? `${expected_end}:00` : null,
  entry_mode: "즉시 기록",
  recorded_at: at(hm),
  source: "현장 직원",
  actor_id: "w1",
  voids_event_id: null,
});

// 일정: 보령 지사 → 홍성 물류센터(이동 20분) → 예산 매장(이동 25분)
const A = S("A", "보령 지사", "09:00", "10:00", null, null);
const B = S("B", "홍성 물류센터", "10:30", "11:30", 20, "A");
const C = S("C", "예산 매장", "12:00", "12:50", 25, "B");
const start = E("A", "작업개시", "09:00");
const report = E("A", "예상 종료 보고", "09:20", "11:00"); // 문제 보고에 넣은 바뀐 예상 종료
const startOf = (id: string) => ({ A: "09:00", B: "10:30", C: "12:00" })[id];
const link = (r: ReturnType<typeof judgeAt>, key: string) => r.risk.links.find((l) => l.key === key)!;

describe("핵심 사례 — 설치환경 문제 → 숙련 기술자 지원 → 다음 현장 일정 조정", () => {
  it("① 안전: 시작 전 점검(08:55 사진)이 작업 시작(09:00)보다 먼저 → '제때'", () => {
    expect(safetyTiming({ startedAt: at("09:00"), endedAt: null }, [{ stage: "작업 전", checked_at: at("08:55"), recorded_at: at("08:55") }]).pre).toBe("제때");
  });

  it("② 보고가 없을 때의 시스템 확인 요청: 09:30(예정 60분의 절반)에 '중간 확인'", () => {
    const w = watchOf(watchInputOf(A, progressOf(A, [start]), false), "09:30");
    expect(w.level).toBe("중간 확인");
    expect(w.reason).toBe("작업 시작 30분째 · 진행 보고 없음");
  });

  it("③ 보고 직전(09:19) — 예정대로면 '위험' 없음 (홍성→예산은 원래 여유 5분이라 '주의')", () => {
    const r = judgeAt([A, B, C], [start], at("09:19"));
    expect([link(r, "A>B").grade, link(r, "A>B").slack]).toEqual(["없음", 10]); // 10:00 종료 + 20분 = 10:20 도착 · 10:30 시작 → 여유 10분
    expect([link(r, "B>C").grade, link(r, "B>C").slack]).toEqual(["주의", 5]); // 11:30 종료 + 25분 = 11:55 도착 · 12:00 시작 → 여유 5분
    expect(impactOf(r, "A", "w1", startOf)).toMatchObject({ risky: 0 });
  });

  it("④ 보고 직후(09:20, 예상 종료 11:00) — 다음 현장 2곳 '매우 높음' (엔진 계산값)", () => {
    const r = judgeAt([A, B, C], [start, report], at("09:20"));
    const ab = link(r, "A>B");
    const bc = link(r, "B>C");
    expect([ab.grade, ab.slack]).toEqual(["매우 높음", -50]); // 11:00 + 20 = 11:20 도착 · 10:30 시작 → 50분 부족
    expect([bc.grade, bc.slack]).toEqual(["매우 높음", -45]); // 홍성 11:20 시작 · 60분 유지 → 12:20 종료 + 25 = 12:45 도착 · 12:00 → 45분 부족
    expect(impactOf(r, "A", "w1", startOf)).toMatchObject({ risky: 2, maxShortfall: 50 });
    expect(RISK_RULE_VERSION).toBe("chain-risk/1.1.0");
  });

  const B2 = { ...B, planned_start: "11:25:00", planned_end: "12:25:00", version: 2 }; // 1차 조치: 홍성 고객 연락 후 시간 조정
  const C2 = { ...C, planned_start: "13:00:00", planned_end: "13:50:00", version: 2 }; // 2차 조치: 예산 고객 연락 후 시간 조정

  it("⑤ 1차 조치(09:30 홍성 11:25~12:25로 조정) 뒤 재판단 — 보령→홍성은 해소, 홍성→예산은 오히려 50분 부족으로 남음", () => {
    const r = judgeAt([A, B2, C], [start, report], at("09:30"));
    expect([link(r, "A>B").grade, link(r, "A>B").slack]).toEqual(["주의", 5]); // 11:20 도착 · 11:25 시작 → 여유 5분 (위험 아님 · 주의)
    expect([link(r, "B>C").grade, link(r, "B>C").slack]).toEqual(["매우 높음", -50]); // 12:25 + 25 = 12:50 도착 · 12:00 → 50분 부족
    expect(impactOf(r, "A", "w1", startOf)).toMatchObject({ risky: 1, maxShortfall: 50, sites: ["예산 매장"] });
  });

  it("⑥ 2차 조치(09:35 예산 13:00~13:50로 조정) 뒤 재판단 — 남은 위험 0건", () => {
    const r = judgeAt([A, B2, C2], [start, report], at("09:35"));
    expect([link(r, "A>B").grade, link(r, "A>B").slack]).toEqual(["주의", 5]);
    expect([link(r, "B>C").grade, link(r, "B>C").slack]).toEqual(["없음", 10]); // 12:50 도착 · 13:00 시작 → 여유 10분
    expect(impactOf(r, "A", "w1", startOf)).toMatchObject({ risky: 0 });
  });

  it("⑦ 결과(10:55 실제 종료) — 홍성 도착 여유 10분 · 예산 여유 10분", () => {
    const r = judgeAt([A, B2, C2], [start, report, E("A", "작업종료", "10:55")], at("10:56"));
    expect([link(r, "A>B").grade, link(r, "A>B").slack]).toEqual(["없음", 10]); // 10:55 + 20 = 11:15 도착 · 11:25 → 여유 10분
    expect([link(r, "B>C").grade, link(r, "B>C").slack]).toEqual(["없음", 10]); // 홍성 예정 11:25~12:25 유지 가정
  });

  it("같은 입력이면 몇 번을 계산해도 같은 결과", () => {
    const a = judgeAt([A, B, C], [start, report], at("09:20"));
    const b = judgeAt([C, A, B], [report, start], at("09:20"));
    expect(JSON.stringify(b.risk.links.map((l) => [l.key, l.grade, l.slack]))).toBe(JSON.stringify(a.risk.links.map((l) => [l.key, l.grade, l.slack])));
  });
});
