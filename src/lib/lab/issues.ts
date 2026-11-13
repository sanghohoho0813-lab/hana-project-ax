/**
 * 현장 문제 보고 · 지원 요청 — 2026-11-13 구본석 이사 인터뷰 근거
 *
 * 인터뷰에서 확인한 사실 (발생빈도·개선효과는 확인되지 않음 — 만들지 않는다)
 *  - 현장기사가 기술적 문제를 혼자 해결하려다 본사 지원 요청이 늦어지는 경우가 있다.
 *  - 분해·설치를 시작한 뒤 예상과 다른 상황이 확인되는 경우가 있다.
 *  - 추가 장비·숙련 기술자가 필요한 경우가 있다.
 *  - 일부 지연으로 다음 현장을 계획한 날 방문하지 못한 사례가 있었다.
 *
 * 원칙
 *  - 문제 보고 자체를 위험으로 판정하지 않는다. 기록만 남는다 (판단 기록 없음).
 *  - 변경된 예상 종료시간이 확인됐을 때만 기존 '예상 종료 보고' 기록으로 엔진에 전달한다.
 *    엔진(risk-engine · state-events · priority-engine)은 바꾸지 않는다.
 *  - 관리자 일정 조정은 기존 일정 조정 기록으로 남고, 그 기록의 판단 전후가 '재판단'이다.
 *  - 시각을 모르면 비워 둔다. 소요시간은 두 시각이 모두 있을 때만, 시각 근거에 따라 실측·원자료·진술·추정·가상으로 나눈다.
 */
import { kst } from "@/lib/pilot/time";
import type { RiskLink } from "@/lib/risk-engine";
import {
  activeLabEvents,
  currentSchedules,
  fail,
  gradeText,
  hhmmMin,
  ISSUE_PROGRESS,
  ISSUE_TYPES,
  judgeUpTo,
  momentOf,
  personName,
  recordEvent,
  RESOLUTIONS,
  saveSchedule,
  sessionEvents,
  sessionOf,
  setClock,
  SUPPORT_ACTIONS,
  SUPPORT_NEEDS,
  TIME_RE,
  touch,
  type Ctx,
  type EventEntry,
  type FieldIssue,
  type IssueStep,
  type IssueProgress,
  type IssueStepKind,
  type IssueType,
  type IssueValues,
  type JudgmentEntry,
  type LabKind,
  type LabState,
  type Moment,
  type MomentInput,
  type Provenance,
  type Resolution,
  type ScheduleInput,
  type Session,
  type SupportAction,
  type SupportNeed,
  type TimeBasis,
} from "./model";

/* ── 도우미 ────────────────────────────────────────── */

export const issueOf = (s: LabState, id: string) => s.issues.find((x) => x.id === id) ?? fail("[입력] 현장 문제 기록을 찾을 수 없습니다.");
export const sessionIssues = (s: LabState, sessionId: string) => s.issues.filter((x) => x.sessionId === sessionId);
export const momentText = (m: Moment | null | undefined) => (!m ? "-" : m.at ? `${kst(m.at).time} (${m.basis})` : "시각 모름");

function findStep(s: LabState, opId: string): { issue: FieldIssue; step: IssueStep } | null {
  for (const issue of s.issues) {
    const step = issue.steps.find((x) => x.opId === opId);
    if (step) return { issue, step };
  }
  return null;
}

/** 재현·가상 세트: 기록한 실제 시각이 판단 기준시각보다 늦으면 기준시각을 그 시각으로 옮긴다 (작업 기록과 같은 규칙) */
function advanceClock(s: LabState, session: Session, times: (string | null)[], by: string, ctx: Ctx): LabState {
  if (session.kind === "실제 업무" || !session.clock) return s;
  const latest = times.filter((t): t is string => !!t).sort().at(-1);
  return latest && hhmmMin(latest) > hhmmMin(session.clock) ? setClock(s, session.id, latest, by, ctx) : s;
}

const replaceIssue = (s: LabState, issue: FieldIssue): LabState => ({ ...s, issues: s.issues.map((x) => (x.id === issue.id ? issue : x)) });

function base(prov: Provenance, via: EventEntry["via"], opId: string, s: LabState, session: Session, ctx: Ctx) {
  if (!s.people.some((p) => p.id === prov.enteredBy)) fail("[입력] 입력자를 고르세요.");
  return {
    opId,
    enteredAt: ctx.now.toISOString(),
    enteredBy: prov.enteredBy,
    informantId: prov.informantId,
    source: prov.source || session.source,
    sourceRef: prov.sourceRef,
    via,
    appVersion: ctx.appVersion ?? null,
  };
}

function checkValues(v: Pick<IssueValues, "type" | "progress" | "needs">) {
  if (!ISSUE_TYPES.includes(v.type)) fail("[입력] 문제 유형을 고르세요.");
  if (!ISSUE_PROGRESS.includes(v.progress)) fail("[입력] 지금 작업 진행상황을 고르세요.");
  if (v.needs.some((n) => !SUPPORT_NEEDS.includes(n))) fail("[입력] 지원 요청 항목을 확인해 주세요.");
}

const notBefore = (m: Moment, ref: Moment, what: string) => {
  if (m.at && ref.at && Date.parse(m.at) < Date.parse(ref.at)) fail(`[입력] ${what}보다 이른 시각입니다 (${kst(ref.at).time}). 시각을 확인해 주세요.`);
};

/* ── 현장기사: 문제 보고 · 지원 요청 ───────────────── */

export interface ReportIssueInput {
  opId: string;
  sessionId: string;
  scheduleId: string;
  type: IssueType;
  typeNote?: string;
  progress: IssueProgress;
  needs: SupportNeed[];
  request: string;
  discovered: MomentInput;
  reported: MomentInput;
  /** 변경된 예상 종료 HH:MM — 모르면 null (엔진에 전달하지 않음) */
  expectedEnd: string | null;
  via: EventEntry["via"];
  prov: Provenance;
}

export interface IssueResult {
  state: LabState;
  id: string;
  /** 엔진에 전달한 기록 번호 (없으면 null) */
  seq: number | null;
  duplicated: boolean;
}

/**
 * 문제 보고 — 문제 기록을 남기고, 변경 예상 종료가 있으면 같은 저장 안에서 '예상 종료 보고' 기록 1건을 엔진에 전달한다.
 * 예상 종료가 없으면 엔진 입력·판단 기록은 생기지 않는다 (보고 자체를 위험으로 보지 않음).
 */
export function reportIssue(s: LabState, x: ReportIssueInput, ctx: Ctx): IssueResult {
  const dup = s.issues.find((o) => o.opId === x.opId);
  if (dup) return { state: s, id: dup.id, seq: dup.linkedSeq, duplicated: true };
  const session = sessionOf(s, x.sessionId);
  const sched = currentSchedules(s, session.id).find((o) => o.id === x.scheduleId) ?? fail("[입력] 일정을 찾을 수 없습니다.");
  if (sched.status === "취소") fail("[입력] 취소된 일정입니다.");
  checkValues(x);
  if (x.expectedEnd !== null && !TIME_RE.test(x.expectedEnd)) fail("[입력] 변경 예상 종료시간(HH:MM)을 확인하거나 '아직 모름'을 고르세요.");
  const discovered = momentOf(session, x.discovered, ctx.now);
  const reported = momentOf(session, x.reported, ctx.now);
  notBefore(reported, discovered, "문제 발견시각");
  const rec = base(x.prov, x.via, x.opId, s, session, ctx);

  let st = advanceClock(s, session, [discovered.entered, reported.entered], x.prov.enteredBy, ctx);
  const id = ctx.id();
  const issue: FieldIssue = {
    ...rec,
    id,
    no: s.issues.length + 1,
    sessionId: session.id,
    scheduleId: sched.id,
    workerId: sched.workerId,
    type: x.type,
    typeNote: (x.typeNote ?? "").trim(),
    progress: x.progress,
    needs: [...x.needs],
    request: x.request.trim(),
    discovered,
    reported,
    expectedEnd: x.expectedEnd,
    linkedSeq: null,
    steps: [],
    history: [],
    voided: null,
  };
  st = { ...st, issues: [...st.issues, issue] };
  let seq: number | null = null;
  if (x.expectedEnd) {
    // 엔진에는 '예상 종료 보고' 값만 — 보고 시각과 그 근거를 그대로 쓴다 (보고 시각을 모르면 엔진은 그 기록을 쓰지 않음)
    const r = recordEvent(
      st,
      {
        opId: `${x.opId}:end`,
        sessionId: session.id,
        scheduleId: sched.id,
        kind: "예상 종료 보고",
        timeMode: x.reported.mode,
        time: x.reported.time,
        timeBasis: x.reported.basis,
        expectedEnd: x.expectedEnd,
        via: x.via,
        note: `현장 문제 보고 #${issue.no}`,
        prov: x.prov,
        issueId: id,
      },
      ctx,
    );
    st = replaceIssue(r.state, { ...issue, linkedSeq: r.seq });
    seq = r.seq;
  }
  return { state: touch(st, ctx.now), id, seq, duplicated: false };
}

/* ── 접수 · 지원 결정 · 해결 여부 ──────────────────── */

export interface StepInput {
  opId: string;
  issueId: string;
  kind: Extract<IssueStepKind, "지원 요청 접수" | "지원 조치 결정" | "해결 여부">;
  moment: MomentInput;
  action?: SupportAction | null;
  resolution?: Resolution | null;
  text?: string;
  via: EventEntry["via"];
  prov: Provenance;
}

function pushStep(s: LabState, issue: FieldIssue, step: Omit<IssueStep, "no">): LabState {
  return replaceIssue(s, { ...issue, steps: [...issue.steps, { ...step, no: issue.steps.length + 1 }] });
}

function openIssue(s: LabState, issueId: string): FieldIssue {
  const issue = issueOf(s, issueId);
  if (issue.voided) fail("[입력] 무효 처리된 문제 기록입니다.");
  return issue;
}

export function issueStep(s: LabState, x: StepInput, ctx: Ctx): { state: LabState; duplicated: boolean } {
  if (findStep(s, x.opId)) return { state: s, duplicated: true };
  const issue = openIssue(s, x.issueId);
  const session = sessionOf(s, issue.sessionId);
  if (x.kind === "지원 조치 결정" && !(x.action && SUPPORT_ACTIONS.includes(x.action))) fail("[입력] 지원 조치를 고르세요.");
  if (x.kind === "해결 여부") {
    if (!(x.resolution && RESOLUTIONS.includes(x.resolution))) fail("[입력] 해결 여부를 고르세요.");
    if (issue.steps.some((o) => o.kind === "해결 여부" && o.resolution === "해결")) fail("[중복] 이미 '해결'로 기록된 문제입니다.");
  }
  const moment = momentOf(session, x.moment, ctx.now, { anyDay: true });
  notBefore(moment, issue.reported, "문제 보고 시각");
  const rec = base(x.prov, x.via, x.opId, s, session, ctx);
  let st = advanceClock(s, session, [moment.entered], x.prov.enteredBy, ctx);
  st = pushStep(st, issueOf(st, issue.id), {
    ...rec,
    kind: x.kind,
    moment,
    action: x.kind === "지원 조치 결정" ? (x.action ?? null) : null,
    resolution: x.kind === "해결 여부" ? (x.resolution ?? null) : null,
    text: (x.text ?? "").trim(),
    linkedSeq: null,
  });
  return { state: touch(st, ctx.now), duplicated: false };
}

/** 예상 종료 다시 알림 (현장기사·관리자) — 엔진에 '예상 종료 보고' 기록으로 전달하고 문제 기록에 연결 */
export function issueEnd(
  s: LabState,
  x: { opId: string; issueId: string; expectedEnd: string; moment: MomentInput; text?: string; via: EventEntry["via"]; prov: Provenance },
  ctx: Ctx,
): IssueResult {
  const found = findStep(s, x.opId);
  if (found) return { state: s, id: found.issue.id, seq: found.step.linkedSeq, duplicated: true };
  const issue = openIssue(s, x.issueId);
  const session = sessionOf(s, issue.sessionId);
  const moment = momentOf(session, x.moment, ctx.now);
  notBefore(moment, issue.reported, "문제 보고 시각");
  const rec = base(x.prov, x.via, x.opId, s, session, ctx);
  const r = recordEvent(
    s,
    {
      opId: `${x.opId}:end`,
      sessionId: session.id,
      scheduleId: issue.scheduleId,
      kind: "예상 종료 보고",
      timeMode: x.moment.mode,
      time: x.moment.time,
      timeBasis: x.moment.basis,
      expectedEnd: x.expectedEnd,
      via: x.via,
      note: `현장 문제 보고 #${issue.no} 예상 종료 변경`,
      prov: x.prov,
      issueId: issue.id,
    },
    ctx,
  );
  const st = pushStep(r.state, issueOf(r.state, issue.id), { ...rec, kind: "예상 종료 변경", moment, action: null, resolution: null, text: `${x.expectedEnd}${x.text ? ` · ${x.text.trim()}` : ""}`, linkedSeq: r.seq });
  return { state: touch(st, ctx.now), id: issue.id, seq: r.seq, duplicated: false };
}

/** 관리자 일정 조정 — 기존 일정 조정 기록(판단 전후 포함)을 남기고, 문제 기록에 '일정 조정' 단계로 연결 */
export function adjustForIssue(
  s: LabState,
  x: { opId: string; issueId: string; moment: MomentInput; schedule: Omit<ScheduleInput, "opId" | "sessionId" | "prov">; prov: Provenance },
  ctx: Ctx,
): IssueResult {
  const found = findStep(s, x.opId);
  if (found) return { state: s, id: found.issue.id, seq: found.step.linkedSeq, duplicated: true };
  const issue = openIssue(s, x.issueId);
  const session = sessionOf(s, issue.sessionId);
  if (!x.schedule.scheduleId) fail("[입력] 조정할 일정을 고르세요.");
  if (!x.schedule.reason.trim()) fail("[입력] 조정 사유를 적어 주세요.");
  const moment = momentOf(session, x.moment, ctx.now, { anyDay: true });
  notBefore(moment, issue.reported, "문제 보고 시각");
  const rec = base(x.prov, "관리자 화면", x.opId, s, session, ctx);
  // 재판단 기준시각 = 조치한 시각 (재현·가상)
  let st = advanceClock(s, session, [moment.entered], x.prov.enteredBy, ctx);
  const r = saveSchedule(st, { ...x.schedule, opId: `${x.opId}:schedule`, sessionId: session.id, prov: x.prov }, ctx);
  st = pushStep(r.state, issueOf(r.state, issue.id), { ...rec, kind: "일정 조정", moment, action: null, resolution: null, text: x.schedule.reason.trim(), linkedSeq: r.seq });
  return { state: touch(st, ctx.now), id: issue.id, seq: r.seq, duplicated: false };
}

/* ── 고치기 · 무효 ─────────────────────────────────── */

/** 엔진과 무관한 항목(유형·진행상황·요청 내용·발견시각)만 고친다 — 이전 값은 이력으로 남는다 */
export function editIssue(
  s: LabState,
  id: string,
  v: Omit<IssueValues, "discovered"> & { discovered: MomentInput },
  by: string,
  ctx: Ctx,
): LabState {
  const issue = openIssue(s, id);
  const session = sessionOf(s, issue.sessionId);
  checkValues(v);
  const discovered = momentOf(session, v.discovered, ctx.now);
  notBefore(issue.reported, discovered, "문제 발견시각");
  const old: IssueValues = { type: issue.type, typeNote: issue.typeNote, progress: issue.progress, needs: issue.needs, request: issue.request, discovered: issue.discovered };
  const next: FieldIssue = { ...issue, type: v.type, typeNote: v.typeNote.trim(), progress: v.progress, needs: [...v.needs], request: v.request.trim(), discovered, history: [...issue.history, { at: ctx.now.toISOString(), by, values: old }] };
  return touch(replaceIssue(s, next), ctx.now);
}

/**
 * 잘못 입력한 문제 기록 무효 — 기록은 남는다. 이 문제에서 엔진에 넘긴 예상 종료 기록도 '기록 무효'로 처리한다.
 * 관리자가 이미 바꾼 일정은 되돌리지 않는다 (실제로 한 조치이므로 필요하면 다시 조정).
 */
export function voidIssue(s: LabState, id: string, reason: string, prov: Provenance, ctx: Ctx): LabState {
  const issue = issueOf(s, id);
  if (issue.voided) return s;
  if (!reason.trim()) fail("[입력] 무효 사유를 넣어 주세요.");
  let st = s;
  const linked = [issue.linkedSeq, ...issue.steps.filter((o) => o.kind === "예상 종료 변경").map((o) => o.linkedSeq)].filter((n): n is number => n !== null);
  const active = new Set(activeLabEvents(sessionEvents(s, issue.sessionId)).map((e) => e.seq));
  for (const seq of linked) {
    if (!active.has(seq)) continue;
    st = recordEvent(
      st,
      { opId: `void:${issue.id}:${seq}`, sessionId: issue.sessionId, scheduleId: issue.scheduleId, kind: "기록 무효", timeMode: "모름", voidsSeq: seq, via: "관리자 화면", note: `현장 문제 보고 #${issue.no} 무효: ${reason.trim()}`, prov },
      ctx,
    ).state;
  }
  return touch(replaceIssue(st, { ...issueOf(st, id), voided: { at: ctx.now.toISOString(), by: prov.enteredBy, reason: reason.trim() } }), ctx.now);
}

/* ── 상태 · 소요시간 ───────────────────────────────── */

export type IssueStatus = "보고됨" | "접수됨" | "지원 결정" | "해결" | "임시 조치" | "해결 못 함" | "무효";

export function issueStatus(issue: FieldIssue): IssueStatus {
  if (issue.voided) return "무효";
  const res = issue.steps.filter((o) => o.kind === "해결 여부").at(-1)?.resolution;
  if (res === "해결") return "해결";
  if (res === "임시 조치") return "임시 조치";
  if (res === "해결 못 함 (재방문 필요)") return "해결 못 함";
  if (issue.steps.some((o) => o.kind === "지원 조치 결정" || o.kind === "일정 조정")) return "지원 결정";
  if (issue.steps.some((o) => o.kind === "지원 요청 접수")) return "접수됨";
  return "보고됨";
}

/** 소요시간 값의 품질 — 시각 근거 중 약한 쪽을 따른다 */
export type Quality = "실측" | "원자료" | "진술" | "추정" | "가상";
const Q_RANK: Record<Quality, number> = { 실측: 4, 원자료: 3, 진술: 2, 추정: 1, 가상: 0 };
const BASIS_Q: Partial<Record<TimeBasis, Quality>> = {
  "버튼 누른 시각(실시간)": "실측",
  "원자료 기록": "원자료",
  "정보 제공자 진술": "진술",
  "기억에 의한 추정": "추정",
  "가상 시각": "가상",
};
export const QUALITY_DESC: Record<Quality, string> = {
  실측: "두 시각 모두 버튼을 누른 실제 시각 (실제 업무)",
  원자료: "업무일지·메신저 등 원자료에 적힌 시각",
  진술: "정보 제공자가 말한 시각",
  추정: "기억에 의한 추정 — 비교 통계에서 뺌",
  가상: "가상 시나리오의 가정 시각 — 실제 효과 아님",
};

export function qualityOf(kind: LabKind, ...moments: Moment[]): Quality | null {
  if (moments.some((m) => !m.at)) return null;
  if (kind === "가상 시나리오") return "가상";
  const qs = moments.map((m) => BASIS_Q[m.basis] ?? "진술");
  return qs.reduce((a, b) => (Q_RANK[b] < Q_RANK[a] ? b : a));
}

export interface Span {
  key: "발견→보고" | "보고→접수" | "보고→지원 결정" | "지원 요청→해결";
  label: string;
  minutes: number | null;
  quality: Quality | null;
  /** 값이 없는 이유 */
  missing: string | null;
}

const firstStep = (issue: FieldIssue, f: (o: IssueStep) => boolean) => issue.steps.find(f) ?? null;

function span(kind: LabKind, key: Span["key"], label: string, a: Moment | null, b: Moment | null, noStep: string): Span {
  if (!a || !b) return { key, label, minutes: null, quality: null, missing: noStep };
  if (!a.at || !b.at) return { key, label, minutes: null, quality: null, missing: "시각 모름 (추정하지 않음)" };
  return { key, label, minutes: Math.round((Date.parse(b.at) - Date.parse(a.at)) / 60000), quality: qualityOf(kind, a, b), missing: null };
}

export function issueMetrics(s: LabState, issue: FieldIssue): Span[] {
  const kind = sessionOf(s, issue.sessionId).kind;
  const receipt = firstStep(issue, (o) => o.kind === "지원 요청 접수");
  const decision = firstStep(issue, (o) => o.kind === "지원 조치 결정" || o.kind === "일정 조정");
  const solved = firstStep(issue, (o) => o.kind === "해결 여부" && o.resolution === "해결");
  return [
    span(kind, "발견→보고", "문제 발견 → 첫 보고", issue.discovered, issue.reported, ""),
    span(kind, "보고→접수", "보고 → 본사 접수", issue.reported, receipt?.moment ?? null, "접수 기록 없음"),
    span(kind, "보고→지원 결정", "보고 → 관리자 지원 결정", issue.reported, decision?.moment ?? null, "지원 결정 기록 없음"),
    span(kind, "지원 요청→해결", "지원 요청 → 해결", issue.reported, solved?.moment ?? null, "'해결' 기록 없음"),
  ];
}

/* ── 위험 변화 · 흐름 ──────────────────────────────── */

export interface LinkView {
  key: string;
  title: string;
  grade: string;
  /** 늦는 시간(분, 계산값) — 늦지 않으면 0 */
  shortfall: number;
  /** 여유(분, 계산값) */
  slack: number | null;
  arrival: string | null;
  plannedStart: string;
}

export interface RiskStage {
  seq: number;
  asOf: string;
  risky: number;
  links: LinkView[];
}

const RISKY = new Set(["중간", "높음", "매우 높음"]);

function linkViews(links: RiskLink[], workerId: string): LinkView[] {
  return links
    .filter((l) => l.workerId === workerId)
    .map((l) => ({
      key: l.key,
      title: `${l.prev.title} → ${l.next.title}`,
      grade: gradeText(l),
      shortfall: l.status === "판정" ? Math.max(0, l.shortfall) : 0,
      slack: l.slack,
      arrival: l.arrival ?? null,
      plannedStart: l.next.plannedStart,
    }));
}

/** 기록 1건의 판단 전·후를 그 기사의 연결별로 (저장된 판단과 같은 조건으로 다시 계산) */
export function stageAround(s: LabState, j: JudgmentEntry, workerId: string): { before: RiskStage; after: RiskStage } {
  const at = (seq: number): RiskStage => {
    const r = judgeUpTo(s, j.sessionId, seq, j.asOf);
    const links = r.risk.links.filter((l) => l.workerId === workerId);
    return { seq, asOf: j.asOf, risky: links.filter((l) => l.status === "판정" && RISKY.has(l.grade ?? "")).length, links: linkViews(r.risk.links, workerId) };
  };
  return { before: at(j.seq - 1), after: at(j.seq) };
}

export interface FlowRow {
  step: "현장 문제 발견" | "문제 보고 · 지원 요청" | "예상 종료시간 변경" | "후속 현장 위험 계산" | "관리자 조치" | "재판단" | "해결 여부";
  /** 입력값 = 사람이 넣은 값 · 계산값 = 엔진이 계산한 값 */
  value: "입력값" | "계산값";
  time: string;
  text: string;
  seq: number | null;
  stage?: { before: RiskStage; after: RiskStage };
}

/** 현장 문제 발견 → 예상 종료시간 변경 → 후속 현장 위험 계산 → 관리자 조치 → 재판단 */
export function issueFlow(s: LabState, issue: FieldIssue): FlowRow[] {
  const rows: FlowRow[] = [];
  const site = currentSchedules(s, issue.sessionId).find((o) => o.id === issue.scheduleId)?.siteName ?? "현장";
  const judged = (seq: number | null) => (seq === null ? undefined : s.judgments.find((j) => j.seq === seq));
  const calc = (seq: number | null, step: "후속 현장 위험 계산" | "재판단") => {
    const j = judged(seq);
    if (!j) return;
    const st = stageAround(s, j, issue.workerId);
    const changed = st.after.links.filter((l) => st.before.links.find((b) => b.key === l.key)?.grade !== l.grade);
    rows.push({
      step,
      value: "계산값",
      time: kst(j.asOf).time,
      text: `위험 연결 ${st.before.risky} → ${st.after.risky}건${changed.length ? ` · ${changed.map((l) => `${l.title} ${st.before.links.find((b) => b.key === l.key)?.grade ?? "연결 없음"} → ${l.grade}${l.shortfall > 0 ? ` (${l.shortfall}분 늦음)` : ""}`).join(" · ")}` : " · 등급 변화 없음"}`,
      seq: j.seq,
      stage: st,
    });
  };
  rows.push({ step: "현장 문제 발견", value: "입력값", time: momentText(issue.discovered), text: `${site} · ${issue.type}${issue.typeNote ? ` (${issue.typeNote})` : ""} · ${issue.progress}`, seq: null });
  rows.push({
    step: "문제 보고 · 지원 요청",
    value: "입력값",
    time: momentText(issue.reported),
    text: `요청: ${issue.needs.join(", ") || "선택 없음"}${issue.request ? ` · "${issue.request}"` : ""} · 입력 ${personName(s, issue.enteredBy)} · 정보 제공 ${personName(s, issue.informantId)} · ${issue.source}`,
    seq: null,
  });
  rows.push({
    step: "예상 종료시간 변경",
    value: "입력값",
    time: momentText(issue.reported),
    text: issue.expectedEnd ? `변경 예상 종료 ${issue.expectedEnd} → 기존 '예상 종료 보고' 기록 #${issue.linkedSeq}로 엔진에 전달` : "보고 때 예상 종료 미확인 — 엔진에 전달하지 않음 (위험 판단 변화 없음)",
    seq: issue.linkedSeq,
  });
  calc(issue.linkedSeq, "후속 현장 위험 계산");
  for (const o of issue.steps) {
    if (o.kind === "해결 여부") {
      rows.push({ step: "해결 여부", value: "입력값", time: momentText(o.moment), text: `${o.resolution}${o.text ? ` · ${o.text}` : ""} · 입력 ${personName(s, o.enteredBy)}`, seq: null });
      continue;
    }
    const what =
      o.kind === "지원 조치 결정"
        ? `지원 조치 결정: ${o.action}`
        : o.kind === "일정 조정"
          ? `일정 조정 (기록 #${o.linkedSeq})`
          : o.kind === "예상 종료 변경"
            ? `예상 종료 변경 ${o.text} (기록 #${o.linkedSeq})`
            : "지원 요청 접수";
    rows.push({ step: o.kind === "예상 종료 변경" ? "예상 종료시간 변경" : "관리자 조치", value: "입력값", time: momentText(o.moment), text: `${what}${o.text && o.kind !== "예상 종료 변경" ? ` · ${o.text}` : ""} · 입력 ${personName(s, o.enteredBy)}`, seq: o.linkedSeq });
    if (o.linkedSeq !== null) calc(o.linkedSeq, o.kind === "예상 종료 변경" ? "후속 현장 위험 계산" : "재판단");
  }
  return rows;
}

/** 관리자 조치 전·후 — 첫 엔진 반영(보고) 직후와 마지막 조치 뒤의 위험 등급·늦는 시간 */
export function issueRiskChange(s: LabState, issue: FieldIssue): { reported: RiskStage | null; afterActions: RiskStage | null; before: RiskStage | null } {
  const j0 = issue.linkedSeq !== null ? s.judgments.find((j) => j.seq === issue.linkedSeq) : undefined;
  const last = [...issue.steps].reverse().find((o) => o.linkedSeq !== null && o.kind === "일정 조정");
  const j1 = last ? s.judgments.find((j) => j.seq === last.linkedSeq) : undefined;
  const a = j0 ? stageAround(s, j0, issue.workerId) : null;
  return { before: a?.before ?? null, reported: a?.after ?? null, afterActions: j1 ? stageAround(s, j1, issue.workerId).after : null };
}

export const maxShortfall = (st: RiskStage | null) => (st ? Math.max(0, ...st.links.map((l) => l.shortfall)) : null);

export type { FieldIssue, IssueStep, Moment, MomentInput, Resolution, SupportAction, SupportNeed };
