// 조기 확인 규칙 (0.5.0) — 연락 없이 예정 넘김 · 중간 확인 · 지원 중 · 안전점검 단계 빠짐
import { describe, expect, it } from "vitest";
import { MIN_CHECK_MINUTES, safetyGaps, watchInputOf, watchOf, type WatchInput } from "@/lib/pilot/watch";
import type { EventRow } from "@/lib/pilot/core";

const base: WatchInput = { plannedStart: "09:00", plannedEnd: "10:00", startedAt: "09:00", ended: false, lastReport: null, openCase: false };

describe("watchOf — 한 현장의 조기 확인 상태", () => {
  it("시작 전 · 종료 · 취소는 해당 없음", () => {
    expect(watchOf({ ...base, startedAt: null }, "09:40").level).toBe("해당 없음");
    expect(watchOf({ ...base, ended: true }, "11:00").level).toBe("해당 없음");
    expect(watchOf({ ...base, cancelled: true }, "11:00").level).toBe("해당 없음");
  });

  it("예정 소요의 절반 전에는 정상, 절반이 지나고 진행 보고가 없으면 중간 확인", () => {
    expect(watchOf(base, "09:29").level).toBe("정상");
    const w = watchOf(base, "09:30");
    expect(w.level).toBe("중간 확인");
    expect(w.checkAt).toBe("09:30");
    expect(w.reason).toBe("작업 시작 30분째 · 진행 보고 없음");
  });

  it(`짧은 작업은 최소 ${MIN_CHECK_MINUTES}분이 지나야 묻는다`, () => {
    const short = { ...base, plannedEnd: "09:30" };
    expect(watchOf(short, "09:19").level).toBe("정상");
    expect(watchOf(short, "09:20").level).toBe("중간 확인");
  });

  it("예상 종료를 넘기고 보고가 없으면 예정 넘김 (넘긴 분 표시)", () => {
    const w = watchOf(base, "10:12");
    expect(w.level).toBe("예정 넘김");
    expect(w.overBy).toBe(12);
    expect(w.expectedEnd).toBe("10:00");
    expect(w.reason).toBe("예상 종료 10:00를 12분 넘김 · 진행 보고 없음");
    expect(watchOf(base, "10:00").level).toBe("중간 확인"); // 같은 분은 아직 넘기지 않음
  });

  it("늦게 시작했으면 예정 소요시간 유지 가정으로 예상 종료를 뒤로 민다 (엔진 가정과 같음)", () => {
    const late = { ...base, startedAt: "09:20" };
    expect(watchOf(late, "10:10").expectedEnd).toBe("10:20");
    expect(watchOf(late, "10:10").level).toBe("중간 확인");
    expect(watchOf(late, "10:21").level).toBe("예정 넘김");
  });

  it("작업 시작 뒤 예상 종료 보고가 있으면 그 시각까지 정상, 넘기면 '보고한 예상 종료' 넘김", () => {
    const rep = { ...base, lastReport: { at: "09:35", end: "10:30" } };
    expect(watchOf(rep, "10:10").level).toBe("정상");
    expect(watchOf(rep, "10:10").reason).toBe("09:35에 예상 종료 10:30 보고");
    const w = watchOf(rep, "10:41");
    expect(w.level).toBe("예정 넘김");
    expect(w.reason).toBe("보고한 예상 종료 10:30를 11분 넘김 · 새 보고 없음");
  });

  it("처리 중인 문제 보고가 있으면 넘겨도 '지원 중' (이미 본사가 앎)", () => {
    expect(watchOf({ ...base, openCase: true }, "10:30").level).toBe("지원 중");
  });
});

describe("watchInputOf — DB 기록에서 입력 만들기", () => {
  const ev = (seq: number, kind: EventRow["kind"], at: string, expected_end: string | null = null) =>
    ({ seq, id: `e${seq}`, schedule_id: "s1", data_kind: "실제 업무", work_date: "2026-11-16", kind, occurred_at: at, entered_time: null, expected_end, entry_mode: "즉시 기록", recorded_at: at, source: "현장 직원", actor_id: "u", voids_event_id: null }) as EventRow;
  const s = { planned_start: "09:00:00", planned_end: "10:00:00", status: "예정" };

  it("한국 시각으로 바꾸고, 작업 시작 뒤의 예상 종료 보고만 진행 보고로 본다", () => {
    const started = ev(2, "작업개시", "2026-11-16T00:05:00Z");
    const before = ev(1, "예상 종료 보고", "2026-11-15T23:50:00Z", "10:20:00");
    const after = ev(3, "예상 종료 보고", "2026-11-16T00:40:00Z", "10:30:00");
    expect(watchInputOf(s, { started, expectedEnd: before }, false)).toMatchObject({ plannedStart: "09:00", startedAt: "09:05", lastReport: null });
    expect(watchInputOf(s, { started, expectedEnd: after }, true)).toMatchObject({ lastReport: { at: "09:40", end: "10:30" }, openCase: true });
  });
});

describe("safetyGaps — 안전점검 3단계 빠짐", () => {
  it("시작 전에는 작업 전 점검이 '지금 낼 차례', 시작 뒤 없으면 누락", () => {
    expect(safetyGaps({ started: false, ended: false, midDue: false }, [])).toEqual([{ stage: "작업 전", state: "지금 낼 차례" }]);
    expect(safetyGaps({ started: true, ended: false, midDue: false }, [])).toEqual([{ stage: "작업 전", state: "누락" }]);
  });
  it("작업 중 점검은 중간 확인 시각이 지나면 '지금 낼 차례', 종료 뒤 없으면 누락", () => {
    expect(safetyGaps({ started: true, ended: false, midDue: true }, ["작업 전"])).toEqual([{ stage: "작업 중", state: "지금 낼 차례" }]);
    expect(safetyGaps({ started: true, ended: true, midDue: true }, ["작업 전"])).toEqual([
      { stage: "작업 중", state: "누락" },
      { stage: "작업 종료", state: "누락" },
    ]);
    expect(safetyGaps({ started: true, ended: true, midDue: true }, ["작업 전", "작업 중", "작업 종료"])).toEqual([]);
    expect(safetyGaps({ started: true, ended: true, midDue: true, cancelled: true }, [])).toEqual([]);
  });
});

describe("safetyTiming — 시작 전 점검을 시작 전에 · 마무리 점검을 종료 전에 냈는가 (0.6.0)", () => {
  const T = (hm: string) => `2026-11-16T${hm}:00+09:00`;
  const chk = (stage: string, at: string, checked = true) => ({ stage, checked_at: checked ? T(at) : null, recorded_at: T(at) });
  it("시작 전 · 종료 전에 냈으면 제때 · 종료 전", async () => {
    const { safetyTiming } = await import("@/lib/pilot/watch");
    expect(safetyTiming({ startedAt: T("09:05"), endedAt: T("10:00") }, [chk("작업 전", "09:01"), chk("작업 종료", "09:58")])).toEqual({ pre: "제때", final: "종료 전" });
  });
  it("시작 뒤에 냈거나 없으면 표시 · 아직 시작 · 종료 전이면 해당 없음", async () => {
    const { safetyTiming } = await import("@/lib/pilot/watch");
    expect(safetyTiming({ startedAt: T("09:05"), endedAt: T("10:00") }, [chk("작업 전", "09:20", false), chk("작업 종료", "10:03")])).toEqual({ pre: "시작 뒤 제출", final: "종료 뒤 제출" });
    expect(safetyTiming({ startedAt: T("09:05"), endedAt: T("10:00") }, [])).toEqual({ pre: "없음", final: "없음" });
    expect(safetyTiming({ startedAt: null, endedAt: null }, [])).toEqual({ pre: "해당 없음", final: "해당 없음" });
  });
  it("같은 단계를 여러 번 냈으면 가장 이른 점검으로 본다", async () => {
    const { safetyTiming } = await import("@/lib/pilot/watch");
    expect(safetyTiming({ startedAt: T("09:05"), endedAt: null }, [chk("작업 전", "09:30"), chk("작업 전", "09:00")]).pre).toBe("제때");
  });
});
