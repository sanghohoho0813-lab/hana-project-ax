/**
 * 작업상태 이벤트 · 기대상태 모델 · 상태편차 분석
 *
 * 흐름: 실제 상태이벤트 → (정규화) → 기대상태와 비교한 단계별 편차 → 예상 종료에 영향을 주는 편차만 일정에 반영
 *      → 연쇄위험 엔진(risk-engine) → 관리자 대응 우선순위(priority-engine)
 *
 * - 확인·작업개시·작업종료·결과보고 편차를 서로 합산하지 않는다. 각 편차의 의미와 위험판단 영향을 따로 남긴다.
 * - 예상 종료는 엔진의 resolveOwnEnd() 를 그대로 써서 엔진과 결과가 갈라지지 않는다.
 * - 이벤트에 없는 발생시각을 만들어 내지 않는다. 시각이 없거나 틀린 이벤트는 쓰지 않고 문제로 알린다.
 * - 기준시각(asOf)은 인자로만 받는다 (데모는 고정 기준시각을 넘겨 결과를 재현한다).
 */
import {
  evaluateChainRisk,
  fmtHHMM,
  isValidDate,
  parseAsOf,
  parseHHMM,
  resolveOwnEnd,
  type EndSource,
  type RiskResult,
  type SiteInput,
} from "./risk-engine";
import { rankResponses, type PriorityConfig, type PriorityResult } from "./priority-engine";

export const STATE_MODEL_VERSION = "state-deviation/1.0.0";

/** 기대상태 모델 설정 — 초기 운영 가정값 */
export const EXPECTATION = {
  /** 업무 전달 후 확인까지 기대하는 시간 (분) — 기존 '미확인 업무' 알림 규칙(2시간)과 같은 값 */
  ackWindowMin: 120,
} as const;

export const STATE_RULES = [
  { id: "S1", name: "이벤트 정규화", desc: "발생시각이 없거나 형식이 틀린 이벤트, 연결 대상이 없는 이벤트는 쓰지 않는다. 같은 단계 이벤트가 여러 번이면 가장 이른 기록을 쓰고(예상 종료 보고는 가장 늦은 보고), 나머지는 중복으로 표시한다." },
  { id: "S2", name: "기대상태 모델", desc: "확인 기준 = 업무 전달 + 120분 (업무 연결이 없으면 예정 시작), 작업개시 기준 = 예정 시작, 작업종료 기준 = 예정 종료, 결과보고 기준 = 업무 완료기한(결과보고가 필요한 업무만)." },
  { id: "S3", name: "단계별 편차", desc: "편차 = 실제 발생시각 − 기준시각 (분). 아직 발생하지 않았고 기준시각이 지났으면 '미발생 · 기한 경과'와 경과 분을 표시한다. 단계별 편차는 합산하지 않는다." },
  { id: "S4", name: "엔진 반영 범위", desc: "예상 종료에 영향을 주는 이벤트(작업개시·작업종료·예상 종료 보고)만 일정에 반영해 연쇄위험 엔진에 넘긴다. 업무 확인·결과보고 편차는 넘기지 않는다." },
] as const;

export type EventKind = "업무 확인" | "작업개시" | "작업종료" | "완료보고" | "예상 종료 보고";
export type EventOrigin = "데모 데이터" | "데모 세션 입력" | "검증 시나리오";

export interface StateEvent {
  id: string;
  kind: EventKind;
  siteId: string;
  /** 이벤트 발생시각 YYYY-MM-DDTHH:MM (예상 종료 보고는 없을 수 있음) */
  at?: string;
  /** 예상 종료 보고값 HH:MM */
  value?: string;
  /** 기록 경로 — 예: 업무 확인 버튼, 작업 시작 버튼, 현장 보고, 관리자 입력, 완료보고 제출 */
  source: string;
  origin: EventOrigin;
}

/** 일정에 연결된 업무 정보 (있을 때만) */
export interface WorkContext {
  siteId: string;
  taskId?: string;
  /** 업무 전달 시각 */
  assignedAt?: string;
  /** 업무 완료기한 */
  dueAt?: string;
  needsReport?: boolean;
  priority?: "긴급" | "보통" | "낮음";
}

export type EventIssueKind = "이벤트 시각 누락" | "이벤트 시각 형식 오류" | "연결 대상 없음" | "중복 이벤트" | "보고값 오류" | "날짜 불일치" | "시간 역행";

export interface EventIssue {
  eventId: string;
  siteId: string;
  kind: EventIssueKind;
  detail: string;
}

/* ── 시간 ─────────────────────────────────────────── */

/** ISO(YYYY-MM-DDTHH:MM) → 비교용 분 (날짜 포함). 틀리면 null */
export function isoMinutes(v?: string): number | null {
  if (!v) return null;
  const [d, t] = v.split("T");
  const m = parseHHMM(t);
  if (!isValidDate(d) || m === null) return null;
  const [y, mo, dd] = d.split("-").map(Number);
  return Math.round(Date.UTC(y, mo - 1, dd) / 60000) + m;
}

function isoAdd(v: string, min: number): string {
  const base = isoMinutes(v)!;
  const t = base + min;
  const day = Math.floor(t / 1440);
  const date = new Date(day * 86400000).toISOString().slice(0, 10);
  return `${date}T${fmtHHMM(t - day * 1440)}`;
}

/* ── S1 이벤트 정규화 ─────────────────────────────── */

const EARLIEST: EventKind[] = ["업무 확인", "작업개시", "작업종료", "완료보고"];

export function normalizeEvents(events: StateEvent[], siteIds: string[]): { accepted: StateEvent[]; issues: EventIssue[] } {
  const issues: EventIssue[] = [];
  const ids = new Set(siteIds);
  const seenId = new Set<string>();
  const pool: StateEvent[] = [];

  for (const e of events) {
    if (seenId.has(e.id)) {
      issues.push({ eventId: e.id, siteId: e.siteId, kind: "중복 이벤트", detail: "같은 이벤트가 두 번 들어와 한 번만 썼습니다." });
      continue;
    }
    seenId.add(e.id);
    if (!ids.has(e.siteId)) {
      issues.push({ eventId: e.id, siteId: e.siteId, kind: "연결 대상 없음", detail: `일정 '${e.siteId}'를 찾을 수 없어 쓰지 않았습니다.` });
      continue;
    }
    if (e.kind === "예상 종료 보고") {
      if (parseHHMM(e.value) === null) {
        issues.push({ eventId: e.id, siteId: e.siteId, kind: "보고값 오류", detail: `예상 종료 보고값 '${e.value ?? ""}'를 읽을 수 없습니다.` });
        continue;
      }
      if (e.at !== undefined && isoMinutes(e.at) === null) {
        issues.push({ eventId: e.id, siteId: e.siteId, kind: "이벤트 시각 형식 오류", detail: `보고 시각 '${e.at}'를 읽을 수 없어 보고 순서는 입력 순서로 봅니다.` });
        pool.push({ ...e, at: undefined });
        continue;
      }
      pool.push(e);
      continue;
    }
    if (e.at === undefined || e.at === "") {
      issues.push({ eventId: e.id, siteId: e.siteId, kind: "이벤트 시각 누락", detail: `${e.kind} 이벤트에 발생시각이 없어 쓰지 않았습니다 (시각을 만들어 넣지 않음).` });
      continue;
    }
    if (isoMinutes(e.at) === null) {
      issues.push({ eventId: e.id, siteId: e.siteId, kind: "이벤트 시각 형식 오류", detail: `${e.kind} 발생시각 '${e.at}'를 읽을 수 없어 쓰지 않았습니다.` });
      continue;
    }
    pool.push(e);
  }

  // 같은 일정·같은 단계 — 가장 이른 기록 (예상 종료 보고는 가장 늦은 보고)
  const accepted: StateEvent[] = [];
  const bySiteKind = new Map<string, StateEvent[]>();
  pool.forEach((e) => bySiteKind.set(`${e.siteId}|${e.kind}`, [...(bySiteKind.get(`${e.siteId}|${e.kind}`) ?? []), e]));
  for (const [, list] of [...bySiteKind.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const kind = list[0].kind;
    let keep: StateEvent;
    if (EARLIEST.includes(kind)) {
      keep = list.slice().sort((a, b) => isoMinutes(a.at)! - isoMinutes(b.at)! || (a.id < b.id ? -1 : 1))[0];
    } else {
      const withAt = list.filter((e) => e.at);
      keep = withAt.length === list.length ? withAt.slice().sort((a, b) => isoMinutes(b.at)! - isoMinutes(a.at)! || (a.id < b.id ? 1 : -1))[0] : list[list.length - 1];
    }
    list
      .filter((e) => e !== keep)
      .forEach((e) =>
        issues.push({
          eventId: e.id,
          siteId: e.siteId,
          kind: "중복 이벤트",
          detail: EARLIEST.includes(kind)
            ? `${kind} 기록이 여러 번이라 가장 이른 기록(${keep.at})만 썼습니다.`
            : `예상 종료 보고가 여러 번이라 가장 늦은 보고(${keep.value})만 썼습니다.`,
        }),
      );
    accepted.push(keep);
  }
  return { accepted, issues };
}

/* ── S4 예상 종료에 영향을 주는 이벤트만 일정에 반영 ─────── */

export function applyEvents(planned: SiteInput[], accepted: StateEvent[]): { sites: SiteInput[]; issues: EventIssue[]; applied: Record<string, string[]> } {
  const issues: EventIssue[] = [];
  const applied: Record<string, string[]> = {};
  const sites = planned.map((p) => {
    const s: SiteInput = { ...p };
    const mine = accepted.filter((e) => e.siteId === p.id);
    const note = (t: string) => (applied[p.id] = [...(applied[p.id] ?? []), t]);
    const sameDay = (e: StateEvent) => {
      if (e.at && e.at.slice(0, 10) === p.date) return true;
      issues.push({ eventId: e.id, siteId: p.id, kind: "날짜 불일치", detail: `${e.kind} 시각 ${e.at}가 일정 날짜 ${p.date}와 달라 쓰지 않았습니다.` });
      return false;
    };
    const start = mine.find((e) => e.kind === "작업개시");
    if (start && sameDay(start)) {
      s.actualStart = start.at!.slice(11);
      s.actualStartSource = start.source;
      if (s.status === "예정") s.status = "진행 중";
      note(`실제 시작 ${s.actualStart} (${start.source})`);
    }
    const end = mine.find((e) => e.kind === "작업종료");
    if (end && sameDay(end)) {
      if (start && isoMinutes(end.at)! <= isoMinutes(start.at)!) {
        issues.push({ eventId: end.id, siteId: p.id, kind: "시간 역행", detail: `작업종료 ${end.at}가 작업개시 ${start.at}보다 빨라 쓰지 않았습니다.` });
      } else {
        s.actualEnd = end.at!.slice(11);
        s.status = "완료";
        note(`실제 종료 ${s.actualEnd} (${end.source})`);
      }
    }
    const rep = mine.find((e) => e.kind === "예상 종료 보고");
    if (rep) {
      s.expectedEnd = rep.value;
      s.expectedEndSource = rep.source === "현장 보고" ? "현장 보고" : "관리자 입력";
      note(`예상 종료 ${rep.value} (${s.expectedEndSource})`);
    }
    return s;
  });
  return { sites, issues, applied };
}

/* ── S2·S3 기대상태 모델과 단계별 편차 ──────────────── */

export type StageName = "업무 확인" | "작업개시" | "작업종료" | "결과보고";
export type StageStatus = "정시" | "지연" | "이름" | "기한 내" | "기한 전" | "미발생 · 기한 경과" | "시각 기록 없음" | "해당 없음";

export interface StageDeviation {
  stage: StageName;
  /** 기준시각 ISO */
  due: string | null;
  dueBasis: string;
  /** 실제 발생시각 ISO */
  actual: string | null;
  source?: string;
  origin?: EventOrigin;
  /** 실제 − 기준 (분). 미발생 · 기한 경과면 기준시각부터 기준시각(asOf)까지 경과분 */
  minutes: number | null;
  status: StageStatus;
  /** 예상 종료 계산에 쓰였는지 */
  affectsEnd: boolean;
  /** 이 편차의 의미와 위험판단 영향 */
  meaning: string;
}

export interface WorkDeviation {
  siteId: string;
  title: string;
  workerId: string;
  date: string;
  plannedStart: string;
  plannedEnd: string;
  status: SiteInput["status"];
  /** 기준시각에 기대되는 단계 / 실제 단계 */
  expectedPhase: string;
  actualPhase: string;
  stages: StageDeviation[];
  /** 연쇄 전파 전 자기 예상 종료 — 엔진과 같은 함수로 계산 */
  end: { time: string; source: EndSource; basis: string; determined: boolean; delay: number };
  /** 엔진에 넘긴 값 */
  passedToEngine: string[];
}

function stageStatus(minutes: number): StageStatus {
  return minutes > 0 ? "지연" : minutes < 0 ? "이름" : "정시";
}
/** 확인·보고처럼 '기한까지' 하면 되는 단계 */
function deadlineStatus(minutes: number): StageStatus {
  return minutes > 0 ? "지연" : "기한 내";
}

export function analyzeDeviations(
  sites: SiteInput[],
  accepted: StateEvent[],
  contexts: WorkContext[],
  opts: { asOf?: string; assumeDurationKept?: boolean; applied?: Record<string, string[]> } = {},
): WorkDeviation[] {
  const asOf = parseAsOf(opts.asOf);
  const nowIso = opts.asOf && asOf ? opts.asOf : null;
  const nowMin = isoMinutes(nowIso ?? undefined);
  const ctx = new Map(contexts.map((c) => [c.siteId, c]));

  return sites
    .filter((s) => s.status !== "취소" && isValidDate(s.date) && parseHHMM(s.plannedStart) !== null && parseHHMM(s.plannedEnd) !== null)
    .slice()
    .sort((a, b) => (a.workerId + a.date + a.plannedStart + a.id < b.workerId + b.date + b.plannedStart + b.id ? -1 : 1))
    .map((s) => {
      const c = ctx.get(s.id);
      const ps = parseHHMM(s.plannedStart)!;
      const pe = parseHHMM(s.plannedEnd)!;
      const startIso = `${s.date}T${s.plannedStart}`;
      const endIso = `${s.date}T${s.plannedEnd}`;
      const ev = (k: EventKind) => accepted.find((e) => e.siteId === s.id && e.kind === k);
      const pending = (due: string | null): { minutes: number | null; status: StageStatus } => {
        const d = isoMinutes(due ?? undefined);
        if (d === null || nowMin === null) return { minutes: null, status: "기한 전" };
        return nowMin > d ? { minutes: nowMin - d, status: "미발생 · 기한 경과" } : { minutes: null, status: "기한 전" };
      };
      const stages: StageDeviation[] = [];

      // 업무 확인
      const ackDue = c?.assignedAt && isoMinutes(c.assignedAt) !== null ? isoAdd(c.assignedAt, EXPECTATION.ackWindowMin) : startIso;
      const ackBasis =
        c?.assignedAt && isoMinutes(c.assignedAt) !== null
          ? `업무 전달 ${c.assignedAt.replace("T", " ")} + ${EXPECTATION.ackWindowMin}분`
          : "연결 업무가 없어 예정 시작 기준";
      const ack = ev("업무 확인");
      stages.push({
        stage: "업무 확인",
        due: ackDue,
        dueBasis: ackBasis,
        actual: ack?.at ?? null,
        source: ack?.source,
        origin: ack?.origin,
        ...(ack ? { minutes: isoMinutes(ack.at)! - isoMinutes(ackDue)!, status: deadlineStatus(isoMinutes(ack.at)! - isoMinutes(ackDue)!) } : pending(ackDue)),
        affectsEnd: false,
        meaning: "확인 단계의 편차입니다. 실제 작업 시작과는 별개라 예상 종료에 반영하지 않습니다.",
      });

      // 작업개시
      const as = parseHHMM(s.actualStart);
      const startEv = ev("작업개시");
      if (as !== null) {
        const m = as - ps;
        stages.push({
          stage: "작업개시",
          due: startIso,
          dueBasis: "예정 시작",
          actual: `${s.date}T${fmtHHMM(as)}`,
          source: s.actualStartSource ?? startEv?.source,
          origin: startEv?.origin,
          minutes: m,
          status: stageStatus(m),
          affectsEnd: m > 0 && opts.assumeDurationKept === true,
          meaning:
            m > 0
              ? opts.assumeDurationKept
                ? "실제 작업 시작이 늦었습니다. '작업시간 유지' 가정으로 예상 종료에 반영합니다 (R2-2)."
                : "실제 작업 시작이 늦었지만 작업시간 가정이 없어 종료 영향을 단정하지 않습니다 (예상 종료 미확정, R2-3)."
              : "예정 시작 이전 또는 정시에 시작했습니다. 예상 종료를 앞당기지 않습니다.",
        });
      } else if (s.status === "진행 중" || s.status === "완료") {
        stages.push({
          stage: "작업개시",
          due: startIso,
          dueBasis: "예정 시작",
          actual: null,
          minutes: null,
          status: "시각 기록 없음",
          affectsEnd: false,
          meaning: "작업은 시작된 상태지만 시작 시각 기록이 없어 편차를 계산하지 않습니다.",
        });
      } else {
        const p = pending(startIso);
        stages.push({
          stage: "작업개시",
          due: startIso,
          dueBasis: "예정 시작",
          actual: null,
          ...p,
          affectsEnd: false,
          meaning:
            p.status === "미발생 · 기한 경과"
              ? "예정 시작이 지났는데 시작 기록이 없습니다. 실제로 늦었는지 확인되지 않아 예상 종료를 확정하지 않습니다 (R2-3)."
              : "아직 예정 시작 전입니다.",
        });
      }

      // 작업종료
      const ae = parseHHMM(s.actualEnd);
      if (s.status === "완료" && ae !== null) {
        stages.push({
          stage: "작업종료",
          due: endIso,
          dueBasis: "예정 종료",
          actual: `${s.date}T${fmtHHMM(ae)}`,
          source: ev("작업종료")?.source,
          origin: ev("작업종료")?.origin,
          minutes: ae - pe,
          status: stageStatus(ae - pe),
          affectsEnd: true,
          meaning: "실제 종료 시각을 예상 종료 대신 씁니다.",
        });
      } else {
        const p = s.status === "완료" ? { minutes: null, status: "시각 기록 없음" as StageStatus } : pending(endIso);
        stages.push({
          stage: "작업종료",
          due: endIso,
          dueBasis: "예정 종료",
          actual: null,
          ...p,
          affectsEnd: s.status === "진행 중" && p.status === "미발생 · 기한 경과",
          meaning:
            s.status === "진행 중" && p.status === "미발생 · 기한 경과"
              ? "진행 중인데 예정 종료가 지났습니다. 종료를 최소 기준시각으로 봅니다 (R2-1)."
              : p.status === "시각 기록 없음"
                ? "완료 상태지만 종료 시각 기록이 없습니다."
                : "아직 종료 기준 전입니다.",
        });
      }

      // 결과보고
      if (c?.needsReport && c.dueAt && isoMinutes(c.dueAt) !== null) {
        const rep = ev("완료보고");
        stages.push({
          stage: "결과보고",
          due: c.dueAt,
          dueBasis: "업무 완료기한",
          actual: rep?.at ?? null,
          source: rep?.source,
          origin: rep?.origin,
          ...(rep ? { minutes: isoMinutes(rep.at)! - isoMinutes(c.dueAt)!, status: deadlineStatus(isoMinutes(rep.at)! - isoMinutes(c.dueAt)!) } : pending(c.dueAt)),
          affectsEnd: false,
          meaning: "보고 단계의 편차입니다. 예상 종료에 반영하지 않습니다.",
        });
      } else {
        stages.push({
          stage: "결과보고",
          due: null,
          dueBasis: c ? "결과보고가 필요 없는 업무" : "연결 업무 없음",
          actual: null,
          minutes: null,
          status: "해당 없음",
          affectsEnd: false,
          meaning: "결과보고 기준이 없습니다.",
        });
      }

      // 예상 종료 — 엔진과 같은 함수
      const own = resolveOwnEnd(s, ps, pe, asOf, opts.assumeDurationKept === true);

      const tnow = asOf && asOf.date === s.date ? asOf.min : null;
      const ackDone = !!ack;
      const expectedPhase =
        nowMin === null
          ? "기준시각 없음"
          : tnow === null
            ? s.date < (opts.asOf ?? "").slice(0, 10)
              ? "작업 종료"
              : "작업 전"
            : tnow < ps
              ? nowMin >= isoMinutes(ackDue)!
                ? "확인 완료 · 작업 전"
                : "확인 대기"
              : tnow < pe
                ? "작업 중"
                : "작업 종료";
      const actualPhase =
        s.status === "완료" ? "작업 종료" : s.status === "진행 중" ? "작업 중" : ackDone ? "확인 완료 · 작업 전" : "미확인 · 작업 전";

      return {
        siteId: s.id,
        title: s.title,
        workerId: s.workerId,
        date: s.date,
        plannedStart: s.plannedStart,
        plannedEnd: s.plannedEnd,
        status: s.status,
        expectedPhase,
        actualPhase,
        stages,
        end: { time: fmtHHMM(own.end), source: own.source, basis: own.basis, determined: own.determined, delay: own.end - pe },
        passedToEngine: opts.applied?.[s.id] ?? [],
      };
    });
}

/* ── 전체 흐름 ─────────────────────────────────────── */

export interface PipelineInput {
  /** 예정 일정 (실제 이벤트 반영 전) */
  planned: SiteInput[];
  events: StateEvent[];
  contexts?: WorkContext[];
  asOf?: string;
  assumeDurationKept?: boolean;
  priorityConfig?: PriorityConfig;
}

export interface PipelineResult {
  stateVersion: string;
  accepted: StateEvent[];
  eventIssues: EventIssue[];
  /** 이벤트를 반영한 일정 — 연쇄위험 엔진 입력 */
  sites: SiteInput[];
  deviations: WorkDeviation[];
  risk: RiskResult;
  priority: PriorityResult;
}

/** 실제 상태이벤트 → 편차 → 예상 종료 → 연쇄위험 → 대응 우선순위 */
export function runStatePipeline(input: PipelineInput): PipelineResult {
  const contexts = input.contexts ?? [];
  const n = normalizeEvents(input.events, input.planned.map((p) => p.id));
  const ap = applyEvents(input.planned, n.accepted);
  const deviations = analyzeDeviations(ap.sites, n.accepted, contexts, {
    asOf: input.asOf,
    assumeDurationKept: input.assumeDurationKept,
    applied: ap.applied,
  });
  const risk = evaluateChainRisk(ap.sites, { asOf: input.asOf, assumeDurationKept: input.assumeDurationKept });
  const priority = rankResponses(risk, {
    asOf: input.asOf,
    meta: contexts.map((c) => ({ siteId: c.siteId, priority: c.priority })),
    config: input.priorityConfig,
  });
  return { stateVersion: STATE_MODEL_VERSION, accepted: n.accepted, eventIssues: [...n.issues, ...ap.issues], sites: ap.sites, deviations, risk, priority };
}
