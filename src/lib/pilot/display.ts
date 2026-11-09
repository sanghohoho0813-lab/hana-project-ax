import type { PipelineResult } from "@/lib/state-events";

const UUID_G = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * 화면 표시용으로만 엔진 문장 속 일정 번호를 현장 이름으로 바꾼다 (기록된 판단 원문은 그대로 둔다).
 * 예: "사이 일정(3f2a… 취소)" → "사이 일정(B2현장 취소)"
 */
export function readable(result: PipelineResult, titles: Record<string, string>): PipelineResult {
  const t = (x: string) => x.replace(UUID_G, (id) => titles[id.toLowerCase()] ?? id);
  return {
    ...result,
    eventIssues: result.eventIssues.map((e) => ({ ...e, detail: t(e.detail) })),
    risk: {
      ...result.risk,
      links: result.risk.links.map((l) => ({ ...l, reason: t(l.reason), actions: l.actions.map(t) })),
      issues: result.risk.issues.map((i) => ({ ...i, detail: t(i.detail) })),
    },
    priority: { ...result.priority, held: result.priority.held.map((h) => ({ ...h, reason: t(h.reason) })) },
  };
}
