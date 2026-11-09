/**
 * 현장 기록 전송 대기열 · 취소 재확인 안내 · 저장된 판단 재계산 확인 — DB 없이 순수 함수만
 */
import { describe, expect, it } from "vitest";
import {
  applyOutcome,
  enqueue,
  flushQueue,
  loadQueue,
  nextToSend,
  queueKey,
  saveQueue,
  type KeyValueStore,
  type QueuedEvent,
  type SendOutcome,
} from "@/lib/pilot/queue";
import { canonical, cancelledBetween, computeJudgment, followingOf, recheckJudgment, type ScheduleRow } from "@/lib/pilot/core";

const mem = (): KeyValueStore & { m: Map<string, string> } => {
  const m = new Map<string, string>();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};
const item = (opId: string, kind: QueuedEvent["kind"] = "작업개시"): Omit<QueuedEvent, "tries"> => ({
  opId,
  scheduleId: "s1",
  siteName: "A현장",
  kind,
  mode: "즉시",
  pressedAt: "2026-11-09T01:00:00.000Z",
});

describe("전송 대기열", () => {
  it("같은 요청 번호는 한 번만 들어가고, 저장소에 보관했다가 다시 읽는다 (사용자별로 따로)", () => {
    const st = mem();
    let q = enqueue([], item("a"));
    q = enqueue(q, item("a"));
    expect(q).toHaveLength(1);
    expect(saveQueue(st, "u1", q)).toBe(true);
    expect(loadQueue(st, "u1")).toEqual(q);
    expect(loadQueue(st, "u2")).toEqual([]);
    expect(st.m.has(queueKey("u1"))).toBe(true);
  });

  it("깨진 저장값·형식이 틀린 항목은 버린다", () => {
    const st = mem();
    st.setItem(queueKey("u1"), "{not json");
    expect(loadQueue(st, "u1")).toEqual([]);
    st.setItem(queueKey("u1"), JSON.stringify([{ opId: "x" }, { ...item("ok"), tries: 0 }]));
    expect(loadQueue(st, "u1").map((x) => x.opId)).toEqual(["ok"]);
    expect(saveQueue(null, "u1", [])).toBe(false);
  });

  it("성공하면 빼고, 연결 오류는 남기고(재시도), 다시 보내도 같은 오류는 멈춘다", () => {
    let q = enqueue(enqueue([], item("a")), item("b"));
    q = applyOutcome(q, "a", { ok: false, error: "끊김", retry: true }, "t1");
    expect(q[0]).toMatchObject({ opId: "a", tries: 1, lastError: "끊김", stopped: false });
    q = applyOutcome(q, "a", { ok: false, error: "[입력] x", retry: false }, "t2");
    expect(q[0].stopped).toBe(true);
    expect(nextToSend(q)?.opId).toBe("b");
    q = applyOutcome(q, "b", { ok: true }, "t3");
    expect(q.map((x) => x.opId)).toEqual(["a"]);
  });

  it("순서대로 보내고, 연결 오류가 나면 그 자리에서 멈춘다 (뒤 기록이 앞 기록을 앞지르지 않음)", async () => {
    let q = [item("a"), item("b", "작업종료"), item("c", "예상 종료 보고")].reduce<QueuedEvent[]>((l, x) => enqueue(l, x), []);
    const sent: string[] = [];
    const outcomes: Record<string, SendOutcome> = { a: { ok: true }, b: { ok: false, error: "끊김", retry: true }, c: { ok: true } };
    await flushQueue(
      () => q,
      (x) => (q = x),
      async (it) => {
        sent.push(it.opId);
        return outcomes[it.opId];
      },
    );
    expect(sent).toEqual(["a", "b"]);
    expect(q.map((x) => x.opId)).toEqual(["b", "c"]);
  });

  it("다시 보내도 같은 오류는 건너뛰고 다음 기록을 보낸다", async () => {
    let q = [item("a"), item("b")].reduce<QueuedEvent[]>((l, x) => enqueue(l, x), []);
    await flushQueue(
      () => q,
      (x) => (q = x),
      async (it) => (it.opId === "a" ? { ok: false, error: "[중복] 이미 기록", retry: false } : { ok: true }),
    );
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ opId: "a", stopped: true });
  });

  it("보내는 동안 새로 누른 기록도 잃지 않고 이어서 보낸다", async () => {
    let q = enqueue([], item("a"));
    const sent: string[] = [];
    await flushQueue(
      () => q,
      (x) => (q = x),
      async (it) => {
        sent.push(it.opId);
        if (it.opId === "a") q = enqueue(q, item("b", "작업종료")); // 'a' 를 보내는 사이 누름
        return { ok: true };
      },
    );
    expect(sent).toEqual(["a", "b"]);
    expect(q).toEqual([]);
  });

  it("보내는 중 예외(오프라인 등)는 연결 오류로 보고 남긴다 · 보낸 시각은 보내는 순간의 기기 시각", async () => {
    let q = enqueue([], item("a"));
    let sentAt = "";
    await flushQueue(
      () => q,
      (x) => (q = x),
      async (_, at) => {
        sentAt = at;
        throw new TypeError("Failed to fetch");
      },
      () => new Date("2026-11-09T01:05:00.000Z"),
    );
    expect(sentAt).toBe("2026-11-09T01:05:00.000Z");
    expect(q[0]).toMatchObject({ tries: 1, stopped: false });
  });
});

describe("취소 일정 재확인 안내 (R7 유지)", () => {
  const s = (id: string, start: string, p: Partial<ScheduleRow> = {}): ScheduleRow => ({
    id,
    data_kind: "실제 업무",
    work_date: "2026-11-09",
    assignee_id: "w1",
    site_name: `${id}현장`,
    region: "",
    planned_start: `${start}:00`,
    planned_end: `${start.slice(0, 2)}:50:00`,
    travel_minutes: null,
    travel_from_id: null,
    priority: "보통",
    status: "예정",
    version: 1,
    ...p,
  });

  it("직전 유효 일정과의 사이에 취소 일정이 있으면 알린다 · 다른 직원·첫 일정은 해당 없음", () => {
    const a = s("a", "08:00");
    const x = s("x", "10:00", { status: "취소" });
    const c = s("c", "12:00", { travel_minutes: 20, travel_from_id: "a" });
    const other = s("o", "11:00", { assignee_id: "w2", status: "취소" });
    expect(cancelledBetween(c, [a, x, c, other]).map((o) => o.id)).toEqual(["x"]);
    expect(cancelledBetween(a, [s("y", "07:00", { status: "취소" }), a])).toEqual([]);
  });

  it("이동 출발 현장이 취소된 일정이면 알린다", () => {
    const a = s("a", "08:00");
    const x = s("x", "07:00", { status: "취소" });
    const c = s("c", "12:00", { travel_minutes: 20, travel_from_id: "x" });
    expect(cancelledBetween(c, [a, x, c]).map((o) => o.id)).toEqual(["x"]);
  });

  it("취소한 일정 바로 뒤의 같은 직원 예정 일정을 찾는다", () => {
    const list = [s("a", "08:00"), s("x", "10:00", { status: "취소" }), s("c", "12:00"), s("d", "14:00"), s("o", "11:00", { assignee_id: "w2" })];
    expect(followingOf(list[1], list)?.id).toBe("c");
    expect(followingOf(list[3], list)).toBeUndefined();
  });
});

describe("저장된 판단 재계산 확인", () => {
  const rev = (seq: number, id: string, start: string, end: string, travel: number | null, from: string | null) => ({
    seq,
    schedule_id: id,
    revision: 1,
    change_kind: "등록" as const,
    snapshot: {
      id,
      data_kind: "검증 시나리오" as const,
      work_date: "2026-11-09",
      assignee_id: "w1",
      site_name: `${id}현장`,
      region: "",
      planned_start: start,
      planned_end: end,
      travel_minutes: travel,
      travel_from_id: from,
      priority: "보통" as const,
      status: "예정" as const,
      version: 1,
    },
  });
  const revisions = [rev(1, "b", "09:00:00", "11:00:00", null, null), rev(2, "c", "11:30:00", "13:00:00", 20, "b")];
  const events = [
    {
      seq: 3,
      id: "e1",
      schedule_id: "b",
      data_kind: "검증 시나리오" as const,
      work_date: "2026-11-09",
      kind: "예상 종료 보고" as const,
      occurred_at: "2026-11-09T01:30:00Z",
      entered_time: null,
      expected_end: "11:40:00",
      entry_mode: "즉시 기록" as const,
      recorded_at: "2026-11-09T01:30:00Z",
      source: "현장 직원" as const,
      actor_id: "w1",
      voids_event_id: null,
    },
  ];
  const job = { id: "j3", seq: 3, trigger_kind: "작업 이벤트 · 예상 종료 보고", trigger_ref: "e1", data_kind: "검증 시나리오" as const, work_date: "2026-11-09", as_of: "2026-11-09T01:30:00Z" };
  const p = computeJudgment(job, revisions, events, { appVersion: "test", computedAt: "2026-11-09T01:30:01Z" });
  /** DB(jsonb)를 거친 것처럼 키 순서를 뒤집는다 */
  const shuffle = (x: unknown): unknown =>
    Array.isArray(x) ? x.map(shuffle) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).reverse().map(([k, v]) => [k, shuffle(v)])) : x;
  const stored = JSON.parse(JSON.stringify(shuffle(p)));

  it("예상 종료 보고 11:40 → 후속 C현장 연결이 위험으로 바뀐다 (판단 전 0 → 후 1)", () => {
    expect(p.summary.risky_before).toBe(0);
    expect(p.summary.risky_after).toBe(1);
  });

  it("키 순서가 바뀐 저장 결과도 같은 결과로 확인된다", () => {
    expect(canonical(stored.result_after)).toBe(canonical(p.result_after));
    expect(recheckJudgment(stored)).toMatchObject({ checked: true, before: true, after: true });
  });

  it("저장된 결과를 고치면 불일치로 드러난다", () => {
    const bad = JSON.parse(JSON.stringify(stored));
    bad.result_after.risk.links[0].grade = "없음";
    expect(recheckJudgment(bad)).toMatchObject({ checked: true, after: false });
  });

  it("규칙 버전이 다르면 비교하지 않고 그 사실을 밝힌다", () => {
    expect(recheckJudgment({ ...stored, rule_version: "chain-risk/0.9.0" })).toMatchObject({ checked: false });
  });
});
