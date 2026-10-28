/**
 * 판단 이력 — 일정이 바뀔 때마다 위험판단 전후 결과를 남긴다.
 *
 * 현재 MVP는 브라우저 메모리 기반 데모라서 이 기록은 '데모 세션 내 기록'이다.
 * 서버 감사로그가 아니며, 새로고침하면 사라진다. 시각은 데모 기준시각(NOW)이다.
 */
import { NOW } from "./company";
import { chainRiskAll } from "./ops-calc";
import { diffRisk, type LinkChange, type RiskDiff } from "./risk-engine";
import type { ScheduleItem } from "./ops-types";

export type RiskEventKind = "예상 종료 입력" | "예상 종료 삭제" | "일정 시간 변경" | "담당자 변경" | "일정 상태 변경" | "일정 추가";

export interface RiskEvent {
  kind: RiskEventKind;
  scheduleId: string;
  title: string;
  /** 바뀐 입력값 */
  field: string;
  before: string;
  after: string;
  /** 예상 종료의 출처 등 */
  source?: string;
  actorId: string;
}

export interface RiskLinkSnapshot {
  key: string;
  label: string;
  status: string;
  grade: string | null;
  slack: number | null;
  arrival: string | null;
  cause: string;
}

export interface RiskLogEntry {
  seq: number;
  /** 데모 기준시각 — 실제 시각이 아니다 */
  demoAt: string;
  scope: "데모 세션";
  event: RiskEvent;
  ruleVersion: string;
  changes: LinkChange[];
  /** 바뀐 연결의 변경 전후 판단 */
  before: RiskLinkSnapshot[];
  after: RiskLinkSnapshot[];
  /** 예상 시작·종료가 바뀐 일정 (영향을 받은 후속 일정 포함) */
  affectedSites: RiskDiff["affectedSites"];
}

export const RISK_FIELDS: (keyof ScheduleItem)[] = [
  "start",
  "end",
  "date",
  "assigneeId",
  "status",
  "expectedEnd",
  "expectedEndSource",
  "actualEnd",
  "travelMinutes",
];

/** 변경 전후 일정 목록으로 판단 이력 한 건을 만든다 (순수 함수) */
export function buildRiskLogEntry(seq: number, event: RiskEvent, before: ScheduleItem[], after: ScheduleItem[]): RiskLogEntry {
  const rb = chainRiskAll(before);
  const ra = chainRiskAll(after);
  const diff = diffRisk(rb, ra);
  const keys = new Set(diff.changes.map((c) => c.key));
  const snap = (r: typeof rb) =>
    r.links
      .filter((l) => keys.has(l.key))
      .map((l) => ({
        key: l.key,
        label: `${l.prev.title} → ${l.next.title}`,
        status: l.status,
        grade: l.grade,
        slack: l.slack,
        arrival: l.arrival,
        cause: l.cause,
      }));
  return {
    seq,
    demoAt: NOW,
    scope: "데모 세션",
    event,
    ruleVersion: ra.ruleVersion,
    changes: diff.changes,
    before: snap(rb),
    after: snap(ra),
    affectedSites: diff.affectedSites,
  };
}
