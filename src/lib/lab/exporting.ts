/**
 * 로컬 실증 기록 내보내기·불러오기 — JSON 백업(전체) · CSV(주요 기록) · 백업 검사
 * 순수 함수 (지문 계산은 Web Crypto — 브라우저·Node 모두 있음)
 */
import { canonical } from "@/lib/pilot/core";
import { toCsv } from "@/lib/pilot/csv";
import { kst } from "@/lib/pilot/time";
import { issueMetrics, issueRiskChange, issueStatus, maxShortfall } from "./issues";
import { issueScenarioOf } from "./issueScenarios";
import {
  activeLabEvents,
  normalizeState,
  currentSchedules,
  isProxy,
  judgmentsMatch,
  personName,
  recomputeJudgments,
  replacedBy,
  repeatNo,
  sessionEvents,
  sessionRound,
  trialRound,
  type EventEntry,
  type LabState,
  type RevisionEntry,
} from "./model";

export const BACKUP_FORMAT = "hana-ax-lab-backup";

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  exportedBy: string;
  note: string;
  counts: Record<string, number>;
  /** data 의 SHA-256 (키 정렬 JSON) — 불러올 때 파일이 바뀌지 않았는지 확인 */
  sha256: string;
  data: LabState;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const counts = (s: LabState) => ({
  sessions: s.sessions.length,
  entries: s.entries.length,
  events: s.entries.filter((e) => e.type === "event").length,
  scheduleChanges: s.entries.filter((e) => e.type === "schedule").length,
  judgments: s.judgments.length,
  trials: s.trials.length,
  notes: s.notes.length,
  people: s.people.length,
  issues: (s.issues ?? []).length,
});

export async function makeBackup(s: LabState, exportedBy: string, now: Date): Promise<BackupFile> {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: now.toISOString(),
    exportedBy,
    note: "하나 프로젝트 AX 로컬 실증 기록 (이 브라우저에 저장된 전체). 실제 업무·사후 재현·가상 시나리오는 세트별 kind 로 구분. 중앙 DB 가 아님.",
    counts: counts(s),
    sha256: await sha256Hex(canonical(s)),
    data: s,
  };
}

export const backupFileName = (now: Date) => {
  const k = kst(now);
  return `hana-ax-lab-backup-${k.date}-${k.seconds.replace(/:/g, "")}.json`;
};

export interface ImportCheck {
  state: LabState;
  counts: Record<string, number>;
  exportedAt: string;
  exportedBy: string;
  /** 파일 지문이 맞는지 (false 면 백업 뒤 파일 내용이 바뀜) */
  checksumOk: boolean;
  /** 불러온 기록으로 다시 계산한 판단이 저장된 판단과 같은지 */
  recompute: { same: number; differ: number[] };
}

/** 백업 파일 검사 — 형식이 틀리면 오류, 지문·재계산 결과는 알려만 준다 */
export async function checkBackup(text: string, now: Date): Promise<ImportCheck> {
  let f: BackupFile;
  try {
    f = JSON.parse(text);
  } catch {
    throw new Error("JSON 파일을 읽을 수 없습니다.");
  }
  if (f?.format !== BACKUP_FORMAT || f.version !== 1 || !f.data) throw new Error("하나 프로젝트 AX 로컬 실증 백업 파일이 아닙니다.");
  const d = f.data;
  if (d.format !== "hana-ax-lab" || d.version !== 1) throw new Error("백업 안의 기록 형식이 맞지 않습니다.");
  for (const k of ["people", "sessions", "entries", "judgments", "trials", "notes"] as const) if (!Array.isArray(d[k])) throw new Error(`백업에 ${k} 목록이 없습니다.`);
  const seqs = d.entries.map((e) => e.seq);
  if (seqs.some((x, i) => i > 0 && x <= seqs[i - 1])) throw new Error("기록 번호 순서가 맞지 않습니다.");
  if (d.entries.some((e) => !d.sessions.some((x) => x.id === e.sessionId))) throw new Error("세트가 없는 기록이 있습니다.");
  if (d.issues !== undefined && !Array.isArray(d.issues)) throw new Error("백업의 현장 문제 목록 형식이 맞지 않습니다.");
  // 지문은 파일에 담긴 그대로 확인한 뒤, 예전 형식이면 새 항목을 빈 값으로 채운다
  const checksumOk = (await sha256Hex(canonical(d))) === f.sha256;
  const state = normalizeState(d);
  return {
    state,
    counts: counts(state),
    exportedAt: f.exportedAt,
    exportedBy: f.exportedBy,
    checksumOk,
    recompute: judgmentsMatch(state.judgments, recomputeJudgments(state, now)),
  };
}

/* ── CSV ───────────────────────────────────────────── */

const t = (iso: string | null | undefined) => (iso ? `${kst(iso).date} ${kst(iso).seconds}` : "");

export function eventsCsv(s: LabState): string {
  const rows: Record<string, unknown>[] = [];
  for (const x of s.sessions) {
    const events = sessionEvents(s, x.id);
    const rep = replacedBy(events);
    const active = new Set(activeLabEvents(events).map((e) => e.seq));
    const sched = new Map(currentSchedules(s, x.id).map((o) => [o.id, o]));
    for (const e of events) {
      const o = sched.get(e.scheduleId);
      const r = rep.get(e.seq);
      rows.push({
        번호: e.seq,
        세트: x.no,
        세트이름: x.title,
        데이터구분: x.kind,
        현장업무날짜: x.workDate,
        현장: o?.siteName ?? "",
        현장기사: personName(s, o?.workerId),
        기록: e.kind,
        예상종료보고값: e.expectedEnd ?? "",
        실제발생시각: t(e.occurredAt),
        발생시각근거: e.timeBasis,
        사람이넣은시각: e.enteredTime ?? "",
        프로그램입력시각: t(e.enteredAt),
        입력자: personName(s, e.enteredBy),
        정보제공자: personName(s, e.informantId),
        대리입력: isProxy(e.enteredBy, o?.workerId ?? null) ? "대리 입력" : "본인 입력",
        자료출처: e.source,
        원자료: e.sourceRef,
        입력화면: e.via,
        정정대상번호: e.voidsSeq ?? "",
        현장문제번호: e.issueId ? (s.issues.find((o) => o.id === e.issueId)?.no ?? "") : "",
        상태: e.kind === "기록 무효" ? "무효 처리 기록" : r ? `${r.kind === "기록 무효" ? "무효" : "정정됨"}(번호 ${r.seq})` : active.has(e.seq) ? "유효" : "",
        판단기준시각: t(e.asOf),
        기준시각근거: e.asOfBasis,
        프로그램버전: e.appVersion ?? "",
        비고: e.note,
      });
    }
  }
  rows.sort((a, b) => Number(a.번호) - Number(b.번호));
  return toCsv(Object.keys(rows[0] ?? { 번호: "" }), rows);
}

export function schedulesCsv(s: LabState): string {
  const rows = s.entries
    .filter((e): e is RevisionEntry => e.type === "schedule")
    .map((e) => {
      const x = s.sessions.find((o) => o.id === e.sessionId)!;
      const from = e.snapshot.travelFromId ? s.entries.find((o): o is RevisionEntry => o.type === "schedule" && o.scheduleId === e.snapshot.travelFromId)?.snapshot.siteName : "";
      return {
        번호: e.seq,
        세트: x.no,
        데이터구분: x.kind,
        현장업무날짜: x.workDate,
        일정번호: e.scheduleId,
        변경: e.changeKind,
        수정본: e.revision,
        현장기사: personName(s, e.snapshot.workerId),
        현장: e.snapshot.siteName,
        지역: e.snapshot.region,
        예정시작: e.snapshot.plannedStart,
        예정종료: e.snapshot.plannedEnd,
        이동출발현장: from ?? "",
        이동시간분: e.snapshot.travelMinutes ?? "",
        업무중요도: e.snapshot.priority,
        상태: e.snapshot.status,
        사유: e.reason,
        입력자: personName(s, e.enteredBy),
        정보제공자: personName(s, e.informantId),
        자료출처: e.source,
        원자료: e.sourceRef,
        프로그램입력시각: t(e.enteredAt),
      };
    });
  return toCsv(Object.keys(rows[0] ?? { 번호: "" }), rows);
}

export function judgmentsCsv(s: LabState): string {
  const rows = s.judgments.map((j) => {
    const x = s.sessions.find((o) => o.id === j.sessionId)!;
    return {
      번호: j.seq,
      세트: x.no,
      데이터구분: x.kind,
      현장업무날짜: x.workDate,
      계기: j.trigger,
      판단기준시각: t(j.asOf),
      기준시각근거: j.asOfBasis,
      위험연결_전: j.summary.risky_before,
      위험연결_후: j.summary.risky_after,
      판단보류_전: j.summary.held_before,
      판단보류_후: j.summary.held_after,
      바뀐연결수: j.summary.changed_links,
      예상시각바뀐현장수: j.summary.affected_sites,
      우선순위1_전: j.summary.priority_before[0] ?? "",
      우선순위1_후: j.summary.priority_after[0] ?? "",
      계산흐름: j.story.join(" / "),
      연쇄위험규칙: j.ruleVersion,
      상태편차모델: j.stateVersion,
      우선순위규칙: j.priorityVersion,
      계산시각: t(j.computedAt),
    };
  });
  return toCsv(Object.keys(rows[0] ?? { 번호: "" }), rows);
}

export function trialsCsv(s: LabState): string {
  const rows = s.trials.map((r) => ({
    측정번호: r.no,
    시험날짜: r.date,
    회차_참가자당일: trialRound(s, r),
    참가자: personName(s, r.participantId),
    참가자코드: s.people.find((p) => p.id === r.participantId)?.code ?? "",
    실제입력자: personName(s, r.operatorId),
    시험유형: r.method,
    시험방식: r.testMode ?? "미지정",
    시나리오구분: r.scenarioType,
    시나리오: r.scenario,
    대응묶음: r.pairKey,
    연결세트: r.sessionId ? (s.sessions.find((x) => x.id === r.sessionId)?.no ?? "") : "",
    소요시간근거: r.valueBasis ?? "미지정",
    위험발견소요초: r.t1Sec ?? "",
    위험발견시간초과: r.t1Timeout ? "예" : "",
    정답위험수: r.expected ?? "",
    정확히발견: r.correct ?? "",
    놓친위험: r.missed ?? "",
    놓친위험내용: r.missedNote,
    잘못판단: r.wrong ?? "",
    잘못판단내용: r.wrongNote,
    후속현장영향파악: r.followUp ?? "",
    후속현장영향내용: r.followUpNote,
    재판단소요초: r.t2Sec ?? "",
    재판단시간초과: r.t2Timeout ? "예" : "",
    측정방법: r.measureMethod,
    원자료: r.rawRef,
    시험중오류수정: r.issues,
    참여자확인: r.confirmedByParticipant ? "참여자 확인" : "미확인",
    정정횟수: r.history.length,
    무효: r.voided ? `무효(${r.voided.reason})` : "",
    기록시각: t(r.createdAt),
    기록자: personName(s, r.createdBy),
    비고: r.note,
  }));
  return toCsv(Object.keys(rows[0] ?? { 측정번호: "" }), rows);
}

export function notesCsv(s: LabState): string {
  const rows = s.notes.map((n) => ({
    번호: n.no,
    기록시각: t(n.at),
    종류: n.type,
    내용: n.text,
    말한사람_출처: personName(s, n.speakerId),
    확인: n.confirmation,
    처리: n.status,
    기록자: personName(s, n.recordedBy),
    세트: n.sessionId ? (s.sessions.find((x) => x.id === n.sessionId)?.no ?? "") : "",
    측정번호: n.trialId ? (s.trials.find((x) => x.id === n.trialId)?.no ?? "") : "",
    고친횟수: n.history.length,
    요구사항_프로그램변경: (n.devLinks ?? []).map((d) => `${d.date} ${d.kind}: ${d.text}${d.version ? ` (${d.version})` : ""}`).join(" / "),
  }));
  return toCsv(Object.keys(rows[0] ?? { 번호: "" }), rows);
}

export function sessionsCsv(s: LabState): string {
  const rows = s.sessions.map((x) => ({
    세트: x.no,
    이름: x.title,
    데이터구분: x.kind,
    현장업무날짜: x.workDate,
    핵심참여자: personName(s, x.participantId),
    회차_참여자당일: sessionRound(s, x),
    반복회차: repeatNo(s, x),
    원본세트: x.basedOn ? (s.sessions.find((o) => o.id === x.basedOn)?.no ?? "") : "",
    기본정보제공자: personName(s, x.informantId),
    기본자료출처: x.source,
    원자료: x.sourceRef,
    시험방식: x.testMode ?? "미지정",
    시험시나리오: x.scenarioId ? `${x.scenarioId} ${issueScenarioOf(x.scenarioId)?.name ?? ""}` : "",
    예상대비결과: (x.outcomes ?? []).map((o) => `${o.match}${o.text ? `: ${o.text}` : ""}`).join(" / "),
    프로그램버전: x.appVersion ?? "",
    재현기준시각_가정값: x.clock ?? "실제 현재 시각",
    작업기록수: sessionEvents(s, x.id).length,
    일정수: currentSchedules(s, x.id).length,
    만든시각: t(x.createdAt),
    만든사람: personName(s, x.createdBy),
    메모: x.note,
    현장문제수: (s.issues ?? []).filter((o) => o.sessionId === x.id).length,
  }));
  return toCsv(Object.keys(rows[0] ?? { 세트: "" }), rows);
}

const hm = (iso: string | null) => (iso ? kst(iso).time : "모름");

/** 현장 문제 보고 1건 = 1행 — 시각·근거·소요시간(품질)·관리자 조치 전후 위험 */
export function issuesCsv(s: LabState): string {
  const rows = (s.issues ?? []).map((i) => {
    const x = s.sessions.find((o) => o.id === i.sessionId)!;
    const site = currentSchedules(s, x.id).find((o) => o.id === i.scheduleId);
    const m = issueMetrics(s, i);
    const span = (k: string) => m.find((o) => o.key === k)!;
    const receipt = i.steps.find((o) => o.kind === "지원 요청 접수");
    const decision = i.steps.find((o) => o.kind === "지원 조치 결정");
    const adjusts = i.steps.filter((o) => o.kind === "일정 조정");
    const res = i.steps.filter((o) => o.kind === "해결 여부").at(-1);
    const risk = issueRiskChange(s, i);
    const qs = [...new Set(m.map((o) => o.quality).filter(Boolean))];
    return {
      문제번호: i.no,
      세트: x.no,
      세트이름: x.title,
      데이터구분: x.kind,
      시험방식: x.testMode ?? "미지정",
      현장업무날짜: x.workDate,
      현장: site?.siteName ?? "",
      현장기사: personName(s, i.workerId),
      문제유형: i.type,
      유형메모: i.typeNote,
      진행상황: i.progress,
      지원요청: i.needs.join(" / "),
      요청내용: i.request,
      발견시각: hm(i.discovered.at),
      발견시각근거: i.discovered.basis,
      보고시각: hm(i.reported.at),
      보고시각근거: i.reported.basis,
      변경예상종료: i.expectedEnd ?? "미확인(엔진 전달 안 함)",
      엔진전달기록번호: i.linkedSeq ?? "",
      접수시각: receipt ? hm(receipt.moment.at) : "",
      지원결정시각: decision ? hm(decision.moment.at) : "",
      지원조치: decision?.action ?? "",
      일정조정기록번호: adjusts.map((o) => o.linkedSeq).join(" / "),
      해결여부: res?.resolution ?? "",
      해결시각: res ? hm(res.moment.at) : "",
      "발견→보고_분": span("발견→보고").minutes ?? "",
      "발견→보고_품질": span("발견→보고").quality ?? span("발견→보고").missing ?? "",
      "보고→접수_분": span("보고→접수").minutes ?? "",
      "보고→지원결정_분": span("보고→지원 결정").minutes ?? "",
      "보고→지원결정_품질": span("보고→지원 결정").quality ?? span("보고→지원 결정").missing ?? "",
      "지원요청→해결_분": span("지원 요청→해결").minutes ?? "",
      "지원요청→해결_품질": span("지원 요청→해결").quality ?? span("지원 요청→해결").missing ?? "",
      소요시간품질: qs.join("/"),
      위험연결_보고전: risk.before?.risky ?? "",
      위험연결_보고후: risk.reported?.risky ?? "",
      위험연결_조치후: risk.afterActions?.risky ?? "",
      최대지연분_보고후: maxShortfall(risk.reported) ?? "",
      최대지연분_조치후: maxShortfall(risk.afterActions) ?? "",
      상태: issueStatus(i),
      입력자: personName(s, i.enteredBy),
      정보제공자: personName(s, i.informantId),
      대리입력: isProxy(i.enteredBy, i.workerId) ? "대리 입력" : "본인 입력",
      자료출처: i.source,
      원자료: i.sourceRef,
      입력화면: i.via,
      프로그램입력시각: t(i.enteredAt),
      프로그램버전: i.appVersion ?? "",
      고친횟수: i.history.length,
      무효사유: i.voided?.reason ?? "",
    };
  });
  return toCsv(Object.keys(rows[0] ?? { 문제번호: "" }), rows);
}

/** 현장 문제의 관리자 조치·해결 단계 1건 = 1행 */
export function issueStepsCsv(s: LabState): string {
  const rows = (s.issues ?? []).flatMap((i) =>
    i.steps.map((o) => ({
      문제번호: i.no,
      세트: s.sessions.find((x) => x.id === i.sessionId)?.no ?? "",
      단계번호: o.no,
      단계: o.kind,
      실제시각: hm(o.moment.at),
      시각근거: o.moment.basis,
      지원조치: o.action ?? "",
      해결여부: o.resolution ?? "",
      내용: o.text,
      연결기록번호: o.linkedSeq ?? "",
      입력자: personName(s, o.enteredBy),
      정보제공자: personName(s, o.informantId),
      자료출처: o.source,
      입력화면: o.via,
      프로그램입력시각: t(o.enteredAt),
      프로그램버전: o.appVersion ?? "",
    })),
  );
  return toCsv(Object.keys(rows[0] ?? { 문제번호: "" }), rows);
}

export const CSV_SETS = [
  { key: "events", label: "작업 기록", file: "작업기록", make: eventsCsv },
  { key: "schedules", label: "일정 등록·조정", file: "일정변경", make: schedulesCsv },
  { key: "judgments", label: "위험 판단 전후", file: "위험판단", make: judgmentsCsv },
  { key: "trials", label: "비교시험 측정", file: "비교시험", make: trialsCsv },
  { key: "notes", label: "문제·피드백", file: "문제피드백", make: notesCsv },
  { key: "sessions", label: "실증 세트·회차", file: "실증세트", make: sessionsCsv },
  { key: "issues", label: "현장 문제·지원 요청", file: "현장문제", make: issuesCsv },
  { key: "issueSteps", label: "현장 문제 조치 단계", file: "현장문제조치", make: issueStepsCsv },
] as const;

export type CsvKey = (typeof CSV_SETS)[number]["key"];

/** 시험·검산용 — CSV 를 다시 읽는다 (따옴표 안 쉼표·줄바꿈 포함) */
export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n") {
      row.push(cur.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cur = "";
    } else cur += c;
  }
  if (cur || row.length) rows.push([...row, cur]);
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

export type { EventEntry };
