// 실증 홈 '예시 기록 2건' — 같은 모델 · 같은 엔진으로 입력되고, 결과가 둘러보기 이야기와 같은지 · 지우면 예시만 빠지는지
import { describe, expect, it } from "vitest";
import { createSession, emptyState, type Ctx } from "@/lib/lab/model";
import { EXAMPLE_TAG, hasExamples, loadExamples, removeExamples } from "@/lib/lab/examples";
import { sessionIssues, issueStatus } from "@/lib/lab/issues";

let n = 0;
const ctx: Ctx = { now: new Date("2026-11-16T03:00:00Z"), id: () => `id-${++n}` };
const ME = "p-consultant";

describe("예시 기록 2건", () => {
  const { state, sessionIds } = loadExamples(emptyState(ctx.now), ME, ctx);
  const risky = (sid: string) => state.judgments.filter((j) => j.sessionId === sid).map((j) => [j.trigger, j.summary.risky_after] as const);

  it("오늘 날짜의 가상 시나리오 세트 2개 · 출처에 예시 표시", () => {
    expect(sessionIds).toHaveLength(2);
    for (const id of sessionIds) {
      const x = state.sessions.find((s) => s.id === id)!;
      expect(x.kind).toBe("가상 시나리오");
      expect(x.workDate).toBe("2026-11-16");
      expect(x.sourceRef.startsWith(EXAMPLE_TAG)).toBe(true);
    }
    expect(hasExamples(state)).toBe(true);
  });

  it("예시 1: 보고 직후 위험 2건 → 일정 조정 뒤 1건 남음 → 해결", () => {
    const r = risky(sessionIds[0]);
    const report = r.findIndex(([t]) => t.includes("예상 종료 보고"));
    expect(r[report][1]).toBe(2);
    const adjust = r.findIndex(([t], i) => i > report && t.includes("일정 수정"));
    expect(r[adjust][1]).toBe(1);
    const issue = sessionIssues(state, sessionIds[0])[0];
    expect(issue.steps.map((s) => s.kind)).toEqual(["지원 요청 접수", "지원 조치 결정", "일정 조정", "해결 여부"]);
    expect(issueStatus(issue)).toContain("해결");
  });

  it("예시 2: 보고 직후 위험 1건 → 예상 종료 다시 입력으로 해소 → 임시 조치", () => {
    const r = risky(sessionIds[1]);
    const reports = r.map(([t, v], i) => ({ t, v, i })).filter((x) => x.t.includes("예상 종료 보고"));
    expect(reports[0].v).toBe(1);
    expect(reports[1].v).toBe(0);
    const issue = sessionIssues(state, sessionIds[1])[0];
    expect(issue.steps.map((s) => s.kind)).toEqual(["지원 요청 접수", "지원 조치 결정", "예상 종료 변경", "해결 여부"]);
    expect(issue.steps.at(-1)!.resolution).toBe("임시 조치");
  });

  it("두 번 눌러도 한 번만 만들어진다", () => {
    expect(loadExamples(state, ME, ctx).state).toBe(state);
  });

  it("지우기: 예시 세트 · 입력 · 판단 · 현장 문제 · 예시 기사만 빠지고 다른 기록은 남는다", () => {
    const mine = createSession(state, { title: "내 세트", kind: "가상 시나리오", workDate: "2026-11-16", participantId: ME, informantId: null, source: "가상 시나리오", sourceRef: "", clock: "09:00", note: "", createdBy: ME }, ctx);
    const cleaned = removeExamples(mine.state, ctx);
    expect(hasExamples(cleaned)).toBe(false);
    expect(cleaned.sessions.map((x) => x.id)).toEqual([mine.id]);
    expect(cleaned.entries.some((e) => sessionIds.includes(e.sessionId))).toBe(false);
    expect(cleaned.judgments.some((j) => sessionIds.includes(j.sessionId))).toBe(false);
    expect(cleaned.issues).toHaveLength(0);
    expect(cleaned.people.some((p) => p.name.includes("(예시)"))).toBe(false);
    expect(cleaned.people.map((p) => p.id)).toEqual(["p-koo", "p-consultant"]);
  });
});
