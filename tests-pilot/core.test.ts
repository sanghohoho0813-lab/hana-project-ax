/**
 * 실증 연결부 단위 시험 — DB 없이 순수 함수만
 * 핵심: 실증 기록을 거쳐도 기존 판단 파이프라인과 같은 위험·우선순위가 나오는가
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OPS_ASSUMPTIONS } from "@/lib/ops-calc";
import { FLOW_CONTEXTS, FLOW_STATES, runFlow, EVENTS_STEP2 } from "@/lib/state-scenarios";
import type { StateEvent } from "@/lib/state-events";
import {
  PILOT_ASSUMPTIONS,
  activeEvents,
  buildPipelineInput,
  computeJudgment,
  evaluate,
  progressOf,
  schedulesAt,
  sourceLabel,
  type EventRow,
  type RevisionRow,
  type ScheduleRow,
} from "@/lib/pilot/core";
import { kst } from "@/lib/pilot/time";
import { cell, toCsv } from "@/lib/pilot/csv";
import { friendlyError } from "@/lib/pilot/errors";

/** KST "YYYY-MM-DDTHH:MM" → UTC ISO (DB 에 저장되는 형식) */
const utc = (kstMinute: string) => new Date(`${kstMinute}:00+09:00`).toISOString();

const PREV: Record<string, string | null> = { A: null, B: "A", C: "B", D: null, E: "D" };

function flowSchedules(id: keyof typeof FLOW_STATES): ScheduleRow[] {
  return FLOW_STATES[id].planned.map((s) => ({
    id: s.id,
    data_kind: "검증 시나리오",
    work_date: s.date,
    assignee_id: s.workerId,
    site_name: s.title,
    region: s.region ?? "",
    planned_start: `${s.plannedStart}:00`,
    planned_end: `${s.plannedEnd}:00`,
    travel_minutes: PREV[s.id] ? (s.travelMinutes ?? null) : null,
    travel_from_id: PREV[s.id],
    priority: FLOW_CONTEXTS.find((c) => c.siteId === s.id)?.priority ?? "보통",
    status: "예정",
    version: 1,
  }));
}

function flowEvents(events: StateEvent[]): EventRow[] {
  return events.map((e, i) => ({
    seq: i + 1,
    id: e.id,
    schedule_id: e.siteId,
    data_kind: "검증 시나리오",
    work_date: "2026-07-28",
    kind: e.kind as EventRow["kind"],
    occurred_at: utc(e.at!),
    entered_time: null,
    expected_end: e.value ? `${e.value}:00` : null,
    entry_mode: "즉시 기록",
    recorded_at: utc(e.at!),
    source: "현장 직원",
    actor_id: "W",
    voids_event_id: null,
  }));
}

const linkView = (r: ReturnType<typeof evaluate>) =>
  r.risk.links.map((l) => ({ key: l.key, status: l.status, grade: l.grade, slack: l.slack, shortfall: l.shortfall, cause: l.cause }));
const prioView = (r: ReturnType<typeof evaluate>) => r.priority.items.map((i) => ({ rank: i.rank, key: i.key, score: i.score, sites: i.sites.map((s) => s.id) }));

describe("실증 기록 → 기존 판단 파이프라인 (같은 결과)", () => {
  it("통합일정 화면과 같은 가정(작업시간 유지)을 쓴다", () => {
    expect(PILOT_ASSUMPTIONS.assumeDurationKept).toBe(OPS_ASSUMPTIONS.assumeDurationKept);
  });

  for (const id of ["S0", "S1", "S2", "S3"] as const) {
    it(`검증 흐름 ${id}: 연쇄위험·우선순위가 기존 파이프라인과 같다`, () => {
      const st = FLOW_STATES[id];
      const input = buildPipelineInput(flowSchedules(id), flowEvents(st.events), utc(st.asOf));
      const mine = evaluate(input);
      const ref = runFlow(id);
      expect(linkView(mine)).toEqual(linkView(ref));
      expect(prioView(mine)).toEqual(prioView(ref));
    });
  }

  it("S1 수치 확인: B 75점 1순위, E 25점 2순위 (검증 화면과 같은 값)", () => {
    const st = FLOW_STATES.S1;
    const r = evaluate(buildPipelineInput(flowSchedules("S1"), flowEvents(st.events), utc(st.asOf)));
    expect(prioView(r).map((p) => [p.rank, p.score])).toEqual([
      [1, 75],
      [2, 25],
    ]);
  });

  it("실증 기록은 출처를 '실증 기록'으로, 검증 시나리오는 '검증 시나리오'로 남긴다", () => {
    const ev = flowEvents(EVENTS_STEP2);
    const real = buildPipelineInput(
      flowSchedules("S1").map((s) => ({ ...s, data_kind: "실제 업무" as const })),
      ev.map((e) => ({ ...e, data_kind: "실제 업무" as const })),
      utc("2026-07-28T09:30"),
    );
    expect(new Set(real.events.map((e) => e.origin))).toEqual(new Set(["실증 기록"]));
    const scen = buildPipelineInput(flowSchedules("S1"), ev, utc("2026-07-28T09:30"));
    expect(new Set(scen.events.map((e) => e.origin))).toEqual(new Set(["검증 시나리오"]));
  });

  it("실제 업무와 검증 시나리오를 한 판단에 섞으면 거부한다", () => {
    const s = flowSchedules("S1");
    s[0] = { ...s[0], data_kind: "실제 업무" };
    expect(() => buildPipelineInput(s, [], utc("2026-07-28T09:30"))).toThrow(/섞을 수 없습니다/);
  });
});

describe("판단 전후 — 번호(seq) 직전까지 vs 그 번호까지", () => {
  const sch = flowSchedules("S0");
  const revisions: RevisionRow[] = sch.map((s, i) => ({ seq: i + 1, schedule_id: s.id, revision: 1, change_kind: "등록", snapshot: s }));
  const base = 100;
  const events: EventRow[] = flowEvents(EVENTS_STEP2).map((e, i) => ({ ...e, seq: base + i }));
  const job = (seq: number, asOf: string) => ({ id: `job-${seq}`, seq, trigger_kind: "작업 이벤트 · 작업개시", trigger_ref: "e4", data_kind: "검증 시나리오" as const, work_date: "2026-07-28", as_of: utc(asOf) });

  it("A현장 작업개시(09:25) 기록 직전에는 위험 1건(D>E), 직후에는 A>B·B>C 가 더해진다", () => {
    const p = computeJudgment(job(base, "2026-07-28T09:30"), revisions, events, { appVersion: "t", computedAt: "t" });
    const keys = (r: typeof p.result_after) => r.risk.links.filter((l) => l.status === "판정" && ["중간", "높음", "매우 높음"].includes(l.grade ?? "")).map((l) => l.key).sort();
    expect(keys(p.result_before)).toEqual(["D>E"]);
    expect(keys(p.result_after)).toEqual(["A>B", "B>C", "D>E"]);
    expect(p.summary.risky_before).toBe(1);
    expect(p.summary.risky_after).toBe(3);
    expect(p.changes.changes.filter((c) => c.kind === "신규 위험").map((c) => c.key).sort()).toEqual(["A>B", "B>C"]);
    expect(p.input_after.events.map((e) => e.id)).toEqual(["e4"]);
  });

  it("같은 입력으로 다시 계산하면 같은 결과 (늦게·여러 번 처리해도 같다)", () => {
    const a = computeJudgment(job(base, "2026-07-28T09:30"), revisions, events, { appVersion: "t", computedAt: "t" });
    const b = computeJudgment(job(base, "2026-07-28T09:30"), revisions, events.slice().reverse(), { appVersion: "t", computedAt: "t" });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(JSON.stringify(evaluate(a.input_after))).toBe(JSON.stringify(a.result_after));
  });

  it("일정 수정본은 번호까지의 최신본만 쓴다", () => {
    const moved: RevisionRow = { seq: 50, schedule_id: "B", revision: 2, change_kind: "수정", snapshot: { ...sch[1], planned_start: "12:10:00", planned_end: "13:00:00", version: 2 } };
    expect(schedulesAt([...revisions, moved], 49).find((s) => s.id === "B")!.planned_start).toBe("11:40:00");
    expect(schedulesAt([...revisions, moved], 50).find((s) => s.id === "B")!.planned_start).toBe("12:10:00");
  });

  it("정정된 기록은 쓰지 않고, 정정 기록을 쓴다 · '기록 무효'는 판단에 넣지 않는다", () => {
    const wrong: EventRow = { ...events[0], seq: 200, id: "w1", occurred_at: utc("2026-07-28T09:05") };
    const fix: EventRow = { ...events[0], seq: 201, id: "w2", occurred_at: utc("2026-07-28T09:25"), voids_event_id: "w1", entry_mode: "사후 입력" };
    const voidOther: EventRow = { ...events[2], seq: 202, id: "v1", kind: "기록 무효", voids_event_id: events[2].id };
    const act = activeEvents([wrong, fix, events[2], voidOther]).map((e) => e.id);
    expect(act).toEqual(["w2"]);
  });

  it("데이터 구분이 다른 기록이 섞이면 판단하지 않는다", () => {
    const mixed = events.map((e, i) => (i === 0 ? { ...e, data_kind: "실제 업무" as const } : e));
    expect(() => computeJudgment(job(base, "2026-07-28T09:30"), revisions, mixed, { appVersion: "t", computedAt: "t" })).toThrow(/섞였습니다/);
  });
});

describe("시각 — 한국 시각 기준", () => {
  it("UTC 저장값을 한국 날짜·분으로 바꾼다 (자정 경계 포함)", () => {
    expect(kst("2026-11-09T01:40:35Z")).toEqual({ date: "2026-11-09", time: "10:40", seconds: "10:40:35", minute: "2026-11-09T10:40" });
    expect(kst("2026-11-08T15:30:00Z").minute).toBe("2026-11-09T00:30");
    expect(kst("2026-11-08T14:59:59Z").minute).toBe("2026-11-08T23:59");
  });
});

describe("기록 경로 표시 · 현장 진행 상태", () => {
  it("입력 방식에 따라 근거 문장의 출처가 달라진다", () => {
    expect(sourceLabel({ kind: "작업개시", source: "현장 직원", entry_mode: "즉시 기록" })).toBe("작업 시작 버튼");
    expect(sourceLabel({ kind: "작업개시", source: "현장 직원", entry_mode: "지연 전송" })).toBe("작업 시작 버튼(지연 전송)");
    expect(sourceLabel({ kind: "작업종료", source: "현장 직원", entry_mode: "사후 입력" })).toBe("현장 보고(사후 입력)");
    expect(sourceLabel({ kind: "예상 종료 보고", source: "현장 직원", entry_mode: "즉시 기록" })).toBe("현장 보고");
    expect(sourceLabel({ kind: "예상 종료 보고", source: "관리자", entry_mode: "즉시 기록" })).toBe("관리자 입력");
  });

  it("진행 상태는 유효한 기록에서 계산한다", () => {
    const ev = flowEvents(EVENTS_STEP2);
    expect(progressOf({ id: "A", status: "예정" }, ev).phase).toBe("작업 중");
    expect(progressOf({ id: "B", status: "예정" }, ev).phase).toBe("확인함");
    expect(progressOf({ id: "C", status: "예정" }, ev).phase).toBe("예정");
    expect(progressOf({ id: "C", status: "취소" }, ev).phase).toBe("취소");
  });
});

describe("내보내기 CSV · 오류 문장", () => {
  it("엑셀용 BOM, 따옴표·쉼표 처리, 수식 주입 차단, 숫자는 그대로", () => {
    expect(cell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(cell("@SUM")).toBe("'@SUM");
    expect(cell("-15")).toBe("-15");
    expect(cell(-15)).toBe("-15");
    expect(cell('a,"b"')).toBe('"a,""b"""');
    const csv = toCsv(["a", "b"], [{ a: 1, b: "x" }]);
    expect(csv.startsWith("﻿a,b\r\n1,x")).toBe(true);
  });

  it("DB 함수의 [태그] 오류는 그대로, 그 밖의 원문은 숨긴다", () => {
    expect(friendlyError("ERROR: [중복] 이미 기록된 단계입니다.")).toBe("[중복] 이미 기록된 단계입니다.");
    expect(friendlyError('relation "x" does not exist')).toMatch(/처리하지 못했습니다/);
  });
});

describe("데모와 실증 분리", () => {
  it("실증 코드는 데모 데이터·데모 기준시각 모듈을 가져오지 않는다", () => {
    const FORBIDDEN = /@\/lib\/(store|ops-data|data|company|team|ops-calc|risk-log|demo-tour|risk-scenarios|state-scenarios|videos)["']/;
    const root = path.resolve(__dirname, "..");
    const files: string[] = [];
    const walk = (d: string) =>
      readdirSync(d).forEach((f) => {
        const p = path.join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(p)) files.push(p);
      });
    ["src/lib/pilot", "src/app/pilot"].forEach((d) => {
      try {
        walk(path.join(root, d));
      } catch {
        // 아직 없는 폴더
      }
    });
    files.push(path.join(root, "src/proxy.ts"));
    const bad = files.filter((f) => {
      try {
        return FORBIDDEN.test(readFileSync(f, "utf8"));
      } catch {
        return false;
      }
    });
    expect(files.length).toBeGreaterThan(3);
    expect(bad).toEqual([]);
  });
});
