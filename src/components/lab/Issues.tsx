"use client";

/**
 * 현장 문제 보고 · 지원 요청 화면 (2026-11-13 구본석 이사 인터뷰 근거)
 * - 현장기사: 버튼 몇 번으로 문제 유형·진행상황·지원 요청·변경 예상 종료·발견시각을 보낸다.
 * - 관리자: 문제 현장 확인 → 접수 · 지원 결정 · 일정 조정 · 해결 여부 기록 → 흐름(입력값/계산값) 확인.
 * - 문제 보고 자체는 위험 판단을 만들지 않는다. 변경 예상 종료가 있을 때만 기존 '예상 종료 보고'로 엔진에 전달된다.
 */
import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { Badge, type Tone } from "@/components/ui";
import { newOpId } from "@/lib/pilot/op-id";
import { kst } from "@/lib/pilot/time";
import {
  activeLabEvents,
  currentSchedules,
  hhmmMin,
  sessionEvents,
  ISSUE_PROGRESS,
  ISSUE_TYPES,
  personName,
  RESOLUTIONS,
  SUPPORT_ACTIONS,
  SUPPORT_NEEDS,
  type IssueProgress,
  type IssueType,
  type LabState,
  type MomentInput,
  type Session,
  type Snap,
  type SupportAction,
  type SupportNeed,
  type Resolution,
  type TimeBasis,
  type FieldIssue,
} from "@/lib/lab/model";
import {
  adjustForIssue,
  issueEnd,
  issueFlow,
  issueMetrics,
  issueStatus,
  issueStep,
  momentText,
  reportIssue,
  sessionIssues,
  voidIssue,
  type FlowRow,
  type IssueStatus,
} from "@/lib/lab/issues";
import { useProvenance } from "./Provenance";
import { MsgBox, btnGhost, btnPrimary, inputSm, labelSm, useAct } from "./common";

/* ── 공통: 실제 시각 고르기 ─────────────────────────── */

export type MomentState = { mode: "지금" | "입력" | "모름"; time: string; basis: TimeBasis };
const toInput = (m: MomentState): MomentInput => (m.mode === "입력" ? { mode: "입력", time: m.time, basis: m.basis } : { mode: m.mode });
const ready = (m: MomentState) => m.mode !== "입력" || /^\d{2}:\d{2}$/.test(m.time);
const startMoment = (session: Session): MomentState => ({ mode: session.kind === "실제 업무" ? "지금" : "입력", time: "", basis: session.kind === "가상 시나리오" ? "가상 시각" : "정보 제공자 진술" });
const BASES: TimeBasis[] = ["정보 제공자 진술", "원자료 기록", "기억에 의한 추정"];
const chip = (on: boolean) => `min-h-[2.75rem] rounded-xl px-3 text-[16px] font-bold ${on ? "bg-ink text-white" : "bg-[#f2f4f6] text-ink-2"}`;
const addMin = (hhmm: string, m: number) => {
  const t = hhmmMin(hhmm) + m;
  return t >= 24 * 60 ? null : `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/** 지금부터 n분 전 HH:MM — 버튼을 누를 때만 부른다 */
function minutesAgo(n: number): string {
  return kst(new Date(Date.now() - n * 60_000)).time;
}

function MomentPicker({ label, session, value, onChange, relative = false }: { label: string; session: Session; value: MomentState; onChange: (m: MomentState) => void; relative?: boolean }) {
  const live = session.kind === "실제 업무";
  const virtual = session.kind === "가상 시나리오";
  const ago = (n: number) => onChange({ mode: "입력", time: minutesAgo(n), basis: "정보 제공자 진술" });
  return (
    <div className="space-y-1.5" role="group" aria-label={label}>
      <span className="block text-[15px] font-semibold text-ink-2">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {live && (
          <button type="button" className={chip(value.mode === "지금")} onClick={() => onChange({ ...value, mode: "지금" })}>
            지금
          </button>
        )}
        {live && relative && [10, 30, 60].map((n) => (
          <button type="button" key={n} className={chip(false)} onClick={() => ago(n)}>
            {n === 60 ? "1시간 전" : `${n}분 전`}
          </button>
        ))}
        <input
          type="time"
          aria-label={`${label} 직접 입력`}
          value={value.mode === "입력" ? value.time : ""}
          onChange={(e) => onChange({ ...value, mode: "입력", time: e.target.value })}
          className={`min-h-[2.75rem] rounded-xl border px-2 text-[18px] ${value.mode === "입력" ? "border-ink" : "border-line"}`}
        />
        <button type="button" className={chip(value.mode === "모름")} onClick={() => onChange({ ...value, mode: "모름", time: "" })}>
          모름
        </button>
      </div>
      {value.mode === "입력" && !virtual && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${label} 근거`}>
          {BASES.map((b) => (
            <button type="button" key={b} aria-pressed={value.basis === b} className={`rounded-lg px-2.5 py-1 text-[14.5px] font-bold ${value.basis === b ? "bg-primary text-white" : "bg-[#f2f4f6] text-ink-2"}`} onClick={() => onChange({ ...value, basis: b })}>
              {b}
            </button>
          ))}
        </div>
      )}
      {value.mode === "모름" && <p className="text-[13.5px] text-ink-3">시각을 비워 둡니다 (추정해 채우지 않음) — 이 시각이 필요한 소요시간은 계산하지 않습니다.</p>}
    </div>
  );
}

/** 지금 이 현장의 예상 종료 (마지막 예상 종료 보고, 없으면 예정 종료) */
export function currentEnd(s: LabState, session: Session, x: Snap): string {
  const alive = activeLabEvents(sessionEvents(s, session.id).filter((e) => e.scheduleId === x.id));
  return alive.filter((e) => e.kind === "예상 종료 보고" && e.expectedEnd).at(-1)?.expectedEnd ?? x.plannedEnd;
}

function EndChips({ base, planned, value, onChange }: { base: string; planned: string; value: string | null; onChange: (v: string | null) => void }) {
  const [typing, setTyping] = useState(false);
  const opts = [30, 60, 120].map((m) => ({ m, t: addMin(base, m) }));
  const late = value ? hhmmMin(value) - hhmmMin(planned) : 0;
  return (
    <div className="space-y-1.5" role="group" aria-label="변경 예상 종료">
      <span className="block text-[15px] font-semibold text-ink-2">변경된 예상 작업 종료 (지금 예상 {base})</span>
      <div className="flex flex-wrap gap-1.5">
        {opts.map((o) => (
          <button type="button" key={o.m} disabled={!o.t} className={chip(value === o.t && !typing)} onClick={() => (setTyping(false), onChange(o.t))}>
            +{o.m >= 60 ? `${o.m / 60}시간` : `${o.m}분`}
          </button>
        ))}
        <button type="button" className={chip(typing)} onClick={() => setTyping(true)}>
          직접 입력
        </button>
        <button type="button" className={chip(value === null && !typing)} onClick={() => (setTyping(false), onChange(null))}>
          아직 모름
        </button>
      </div>
      {typing && <input type="time" aria-label="변경 예상 종료 직접 입력" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="min-h-[2.9rem] w-full rounded-xl border border-line px-3 text-[20px]" />}
      <p className={`text-[15px] font-bold ${value ? "text-danger" : "text-ink-3"}`}>
        {value ? `→ ${value} (예정 종료 ${planned}${late > 0 ? `보다 ${late}분 늦음` : ""}) · 이 값만 위험 판단에 전달됩니다` : "예상 종료를 모르면 보고만 남고 위험 판단은 바뀌지 않습니다"}
      </p>
    </div>
  );
}

/* ── 현장기사: 문제 보고 · 지원 요청 ───────────────── */

export function IssueReportSheet({ s, session, x, started, onDone, onCancel }: { s: LabState; session: Session; x: Snap; started: boolean; onDone: (text: string) => void; onCancel: () => void }) {
  const [prov] = useProvenance(session);
  const { msg, act } = useAct();
  const [opId] = useState(newOpId);
  const [type, setType] = useState<IssueType | null>(null);
  const [progress, setProgress] = useState<IssueProgress>(started ? "작업 진행 중" : "작업 시작 전");
  const [needs, setNeeds] = useState<SupportNeed[]>([]);
  const [request, setRequest] = useState("");
  const [end, setEnd] = useState<string | null>(null);
  const [found, setFound] = useState<MomentState>(() => startMoment(session));
  const [told, setTold] = useState<MomentState>(() => startMoment(session));
  const live = session.kind === "실제 업무";
  const base = currentEnd(s, session, x);
  const ok = type !== null && ready(found) && ready(told) && (end === null || /^\d{2}:\d{2}$/.test(end));
  const toggle = (n: SupportNeed) => setNeeds((v) => (v.includes(n) ? v.filter((o) => o !== n) : [...v, n]));
  return (
    <div className="space-y-3 rounded-2xl border-2 border-danger/40 bg-white p-3" aria-label="현장 문제 보고">
      <p className="flex items-center gap-1.5 text-[19px] font-extrabold text-danger">
        <AlertTriangle size={22} /> 현장 문제 보고 · 지원 요청 — {x.siteName}
      </p>
      <div className="space-y-1.5" role="radiogroup" aria-label="문제 유형">
        <span className="block text-[15px] font-semibold text-ink-2">문제 유형</span>
        <div className="flex flex-wrap gap-1.5">
          {ISSUE_TYPES.map((t) => (
            <button type="button" role="radio" aria-checked={type === t} key={t} className={chip(type === t)} onClick={() => setType(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5" role="radiogroup" aria-label="작업 진행상황">
        <span className="block text-[15px] font-semibold text-ink-2">지금 작업 진행상황</span>
        <div className="flex flex-wrap gap-1.5">
          {ISSUE_PROGRESS.map((t) => (
            <button type="button" role="radio" aria-checked={progress === t} key={t} className={chip(progress === t)} onClick={() => setProgress(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5" role="group" aria-label="지원 요청">
        <span className="block text-[15px] font-semibold text-ink-2">지원 요청 (여러 개 가능)</span>
        <div className="flex flex-wrap gap-1.5">
          {SUPPORT_NEEDS.map((t) => (
            <button type="button" aria-pressed={needs.includes(t)} key={t} className={chip(needs.includes(t))} onClick={() => toggle(t)}>
              {t}
            </button>
          ))}
        </div>
        <input value={request} onChange={(e) => setRequest(e.target.value)} placeholder="지원 요청 내용 (말한 그대로 · 선택)" aria-label="지원 요청 내용" className={inputSm} />
      </div>
      <EndChips base={base} planned={x.plannedEnd} value={end} onChange={setEnd} />
      <MomentPicker label="문제 발견시각" session={session} value={found} onChange={setFound} relative />
      {live ? <p className="text-[14.5px] text-ink-3">보고 시각: 보내는 지금 (버튼 누른 시각)</p> : <MomentPicker label="본사에 보고한 시각" session={session} value={told} onChange={setTold} />}
      <p className="text-[13.5px] text-ink-3">자료 출처·입력자는 위 &lsquo;입력 출처&rsquo; 표시대로 함께 저장됩니다. 보고 자체는 위험으로 판정하지 않습니다.</p>
      <MsgBox msg={msg} />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button
          disabled={!ok}
          className="min-h-[3.4rem] rounded-2xl bg-danger text-[19px] font-extrabold text-white disabled:opacity-40"
          onClick={() => {
            const r = act(
              (st, c) => {
                const out = reportIssue(
                  st,
                  { opId, sessionId: session.id, scheduleId: x.id, type: type!, progress, needs, request, discovered: toInput(found), reported: live ? { mode: "지금" } : toInput(told), expectedEnd: end, via: "현장기사 화면", prov },
                  c,
                );
                return { state: out.state, value: { no: out.state.issues.find((o) => o.id === out.id)!.no, seq: out.seq, dup: out.duplicated } };
              },
              "",
            );
            if (r) onDone(r.dup ? "이미 보낸 보고입니다 (한 번만 저장)." : `현장 문제 #${r.no} 보고됨 · ${r.seq ? `예상 종료 ${end} 전달 → 후속 현장 위험 다시 계산` : "예상 종료 미확인 — 위험 판단 변화 없음"}`);
          }}
        >
          보고 보내기
        </button>
        <button className="rounded-2xl bg-[#f2f4f6] px-4 text-[16px] font-bold text-ink-2" onClick={onCancel}>
          닫기
        </button>
      </div>
    </div>
  );
}

/* ── 단계 기록 (현장기사·관리자 공통) ─────────────── */

type StepKind = "지원 요청 접수" | "지원 조치 결정" | "해결 여부" | "예상 종료 변경";

function StepSheet({ s, session, issue, kind, via, onDone, onCancel }: { s: LabState; session: Session; issue: FieldIssue; kind: StepKind; via: "현장기사 화면" | "관리자 화면"; onDone: (t: string) => void; onCancel: () => void }) {
  const [prov] = useProvenance(session);
  const { msg, act } = useAct();
  const [opId] = useState(newOpId);
  const [m, setM] = useState<MomentState>(() => startMoment(session));
  const [action, setAction] = useState<SupportAction | null>(null);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [text, setText] = useState("");
  const site = currentSchedules(s, session.id).find((o) => o.id === issue.scheduleId);
  const [end, setEnd] = useState<string | null>(null);
  const ok = ready(m) && (kind !== "지원 조치 결정" || action) && (kind !== "해결 여부" || resolution) && (kind !== "예상 종료 변경" || end);
  return (
    <div className="space-y-2.5 rounded-2xl border border-line bg-white p-3" aria-label={`${kind} 기록`}>
      <p className="text-[17px] font-extrabold">
        #{issue.no} {kind}
      </p>
      {kind === "지원 조치 결정" && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="지원 조치">
          {SUPPORT_ACTIONS.map((a) => (
            <button type="button" role="radio" aria-checked={action === a} key={a} className={chip(action === a)} onClick={() => setAction(a)}>
              {a}
            </button>
          ))}
        </div>
      )}
      {kind === "해결 여부" && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="해결 여부">
          {RESOLUTIONS.map((a) => (
            <button type="button" role="radio" aria-checked={resolution === a} key={a} className={chip(resolution === a)} onClick={() => setResolution(a)}>
              {a}
            </button>
          ))}
        </div>
      )}
      {kind === "예상 종료 변경" && site && <EndChips base={currentEnd(s, session, site)} planned={site.plannedEnd} value={end} onChange={setEnd} />}
      <MomentPicker label={kind === "해결 여부" ? "해결 여부를 확인한 시각" : kind === "예상 종료 변경" ? "알린 시각" : "실제로 한 시각"} session={session} value={m} onChange={setM} />
      {kind !== "예상 종료 변경" && <input value={text} onChange={(e) => setText(e.target.value)} placeholder="내용 (선택)" aria-label="내용" className={inputSm} />}
      <MsgBox msg={msg} />
      <div className="flex gap-2">
        <button
          disabled={!ok}
          className={btnPrimary}
          onClick={() => {
            const done = act(
              (st, c) => {
                if (kind === "예상 종료 변경") {
                  const r = issueEnd(st, { opId, issueId: issue.id, expectedEnd: end!, moment: toInput(m), via, prov }, c);
                  return { state: r.state, value: r.duplicated };
                }
                const r = issueStep(st, { opId, issueId: issue.id, kind, moment: toInput(m), action, resolution, text, via, prov }, c);
                return { state: r.state, value: r.duplicated };
              },
              (dup) => (dup ? "이미 저장된 요청입니다." : `${kind} 기록됨`),
            );
            if (done !== null) onDone(done ? "이미 저장된 요청입니다 (한 번만 저장)." : kind === "예상 종료 변경" ? `#${issue.no} 예상 종료 ${end} 전달 — 위험을 다시 계산했습니다.` : `#${issue.no} ${kind} 기록됨.`);
          }}
        >
          기록
        </button>
        <button className={btnGhost} onClick={onCancel}>
          닫기
        </button>
      </div>
    </div>
  );
}

/** 관리자 일정 조정 — 기존 일정 조정 기록으로 저장되고 판단 전후(재판단)가 남는다 */
function AdjustSheet({ s, session, issue, onDone, onCancel }: { s: LabState; session: Session; issue: FieldIssue; onDone: (t: string) => void; onCancel: () => void }) {
  const [prov] = useProvenance(session);
  const { msg, act } = useAct();
  const [opId] = useState(newOpId);
  const plans = currentSchedules(s, session.id).filter((o) => o.status === "예정" && o.id !== issue.scheduleId);
  const site = currentSchedules(s, session.id).find((o) => o.id === issue.scheduleId);
  const next = plans.find((o) => o.workerId === issue.workerId && site && o.plannedStart > site.plannedStart) ?? plans[0];
  const [sid, setSid] = useState(next?.id ?? "");
  const target = plans.find((o) => o.id === sid);
  const [start, setStart] = useState(target?.plannedStart ?? "");
  const [end, setEnd] = useState(target?.plannedEnd ?? "");
  const [reason, setReason] = useState(`현장 문제 #${issue.no} 대응`);
  const [m, setM] = useState<MomentState>(() => startMoment(session));
  if (!target) return <p className="text-[15px] text-ink-3">조정할 다른 일정이 없습니다.</p>;
  return (
    <div className="space-y-2.5 rounded-2xl border border-line bg-white p-3" aria-label="일정 조정 기록">
      <p className="text-[17px] font-extrabold">#{issue.no} 일정 조정 → 다시 판단</p>
      <div className="grid gap-2 sm:grid-cols-4">
        <label className="sm:col-span-2">
          <span className={labelSm}>조정할 일정</span>
          <select
            value={sid}
            onChange={(e) => {
              const t = plans.find((o) => o.id === e.target.value);
              setSid(e.target.value);
              setStart(t?.plannedStart ?? "");
              setEnd(t?.plannedEnd ?? "");
            }}
            className={inputSm}
            aria-label="조정할 일정"
          >
            {plans.map((o) => (
              <option key={o.id} value={o.id}>
                {o.siteName} ({personName(s, o.workerId)} · {o.plannedStart}~{o.plannedEnd})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelSm}>새 예정 시작</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputSm} aria-label="새 예정 시작" />
        </label>
        <label>
          <span className={labelSm}>새 예정 종료</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputSm} aria-label="새 예정 종료" />
        </label>
        <label className="sm:col-span-4">
          <span className={labelSm}>조정 사유</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputSm} aria-label="조정 사유" />
        </label>
      </div>
      <MomentPicker label="조치한 시각" session={session} value={m} onChange={setM} />
      <MsgBox msg={msg} />
      <div className="flex gap-2">
        <button
          disabled={!ready(m)}
          className={btnPrimary}
          onClick={() => {
            const r = act(
              (st, c) => {
                const out = adjustForIssue(
                  st,
                  {
                    opId,
                    issueId: issue.id,
                    moment: toInput(m),
                    schedule: { scheduleId: target.id, expectedVersion: target.version, workerId: target.workerId, siteName: target.siteName, region: target.region, plannedStart: start, plannedEnd: end, travelMinutes: target.travelMinutes, priority: target.priority, note: target.note, reason },
                    prov,
                  },
                  c,
                );
                const j = out.state.judgments.find((o) => o.seq === out.seq);
                return { state: out.state, value: j ? `${j.summary.risky_before} → ${j.summary.risky_after}` : "" };
              },
              (v) => `일정을 조정했습니다 — 재판단: 위험 연결 ${v}건`,
            );
            if (r !== null) onDone(`${target.siteName} 일정을 ${start}~${end}로 조정 — 재판단: 위험 연결 ${r}건`);
          }}
        >
          조정하고 다시 판단
        </button>
        <button className={btnGhost} onClick={onCancel}>
          닫기
        </button>
      </div>
      <p className="text-[13.5px] text-ink-3">시스템이 일정을 바꾸지 않습니다 — 관리자가 정한 값만 저장되고, 저장하면 기존 엔진으로 판단 전후가 기록됩니다.</p>
    </div>
  );
}

/* ── 현장기사 카드 안: 이 현장의 문제 ───────────────── */

const STATUS_TONE: Record<IssueStatus, Tone> = { 보고됨: "danger", 접수됨: "warning", "지원 결정": "info", 해결: "success", "임시 조치": "warning", "해결 못 함": "danger", 무효: "neutral" };

export function WorkerIssues({ s, session, x, onMsg }: { s: LabState; session: Session; x: Snap; onMsg: (t: string) => void }) {
  const [open, setOpen] = useState<{ id: string; kind: StepKind } | null>(null);
  const mine = sessionIssues(s, session.id).filter((o) => o.scheduleId === x.id && !o.voided);
  if (mine.length === 0) return null;
  return (
    <ul className="space-y-2" aria-label="이 현장의 문제 보고">
      {mine.map((i) => {
        const st = issueStatus(i);
        const lastAdmin = [...i.steps].reverse().find((o) => o.via === "관리자 화면");
        return (
          <li key={i.id} className="space-y-1.5 rounded-2xl border border-danger/30 bg-danger-bg/30 px-3 py-2">
            <p className="flex flex-wrap items-center gap-1.5 text-[16px]">
              <b>현장 문제 #{i.no}</b> {i.type}
              <Badge tone={STATUS_TONE[st]} className="!py-0 !text-[14px]">
                {st}
              </Badge>
            </p>
            {i.expectedEnd && <p className="text-[14.5px] text-ink-2">보고한 예상 종료 {i.expectedEnd}</p>}
            {lastAdmin && (
              <p className="text-[15px] font-semibold text-primary-dark">
                본사: {lastAdmin.kind}
                {lastAdmin.action ? ` — ${lastAdmin.action}` : ""}
                {lastAdmin.text ? ` · ${lastAdmin.text}` : ""} ({momentText(lastAdmin.moment)})
              </p>
            )}
            {st !== "해결" && !open && (
              <div className="flex flex-wrap gap-1.5">
                <button className="rounded-xl bg-white px-3 py-2 text-[15.5px] font-bold text-primary-dark" onClick={() => setOpen({ id: i.id, kind: "예상 종료 변경" })}>
                  예상 종료 다시 알림
                </button>
                <button className="rounded-xl bg-white px-3 py-2 text-[15.5px] font-bold text-success" onClick={() => setOpen({ id: i.id, kind: "해결 여부" })}>
                  해결 여부 기록
                </button>
              </div>
            )}
            {open?.id === i.id && (
              <StepSheet
                s={s}
                session={session}
                issue={i}
                kind={open.kind}
                via="현장기사 화면"
                onCancel={() => setOpen(null)}
                onDone={(t) => {
                  setOpen(null);
                  onMsg(t);
                }}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ── 관리자: 문제 현장 · 지원 요청 처리 ────────────── */

export function AdminIssuePanel({ s, session }: { s: LabState; session: Session }) {
  const all = sessionIssues(s, session.id);
  const open = all.filter((i) => !["해결", "무효"].includes(issueStatus(i)));
  const [showDone, setShowDone] = useState(false);
  const shown = showDone ? [...all].reverse() : open.slice().reverse();
  return (
    <section className={`card space-y-2.5 p-4 ${open.length ? "border-2 border-danger/40" : ""}`} aria-label="현장 문제 · 지원 요청">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-1.5 text-[20px] font-extrabold">
          <AlertTriangle size={20} className={open.length ? "text-danger" : "text-ink-3"} /> 현장 문제 · 지원 요청
        </h2>
        <span className="text-[15.5px] font-semibold text-ink-3">
          처리 중 {open.length}건 · 전체 {all.length}건
        </span>
        {all.length > open.length && (
          <button className="ml-auto text-[15px] font-bold text-primary-dark underline" onClick={() => setShowDone((v) => !v)}>
            {showDone ? "처리 중만" : "해결·무효 포함 전체"}
          </button>
        )}
      </div>
      {all.length === 0 && <p className="text-[15.5px] text-ink-3">현장기사 화면에서 &lsquo;현장 문제 보고&rsquo;를 보내면 여기에 표시됩니다. 보고 자체는 위험으로 판정하지 않고, 변경 예상 종료가 있을 때만 위험 판단에 반영됩니다.</p>}
      {shown.length === 0 && all.length > 0 && <p className="text-[15.5px] text-ink-3">처리 중인 문제가 없습니다.</p>}
      <ul className="space-y-2.5">
        {shown.map((i) => (
          <AdminIssueCard key={i.id} s={s} session={session} issue={i} />
        ))}
      </ul>
    </section>
  );
}

function AdminIssueCard({ s, session, issue }: { s: LabState; session: Session; issue: FieldIssue }) {
  const [sheet, setSheet] = useState<StepKind | "조정" | null>(null);
  const [flow, setFlow] = useState(false);
  const [prov] = useProvenance(session);
  const { msg, setMsg, act } = useAct();
  const st = issueStatus(issue);
  const site = currentSchedules(s, session.id).find((o) => o.id === issue.scheduleId);
  const m = issueMetrics(s, issue);
  const done = (t: string) => {
    setSheet(null);
    setMsg({ ok: true, text: t });
  };
  const btn = "rounded-lg bg-[#f2f4f6] px-2.5 py-1.5 text-[15px] font-bold text-ink-2 disabled:opacity-40";
  const closed = st === "해결" || st === "무효";
  return (
    <li className={`space-y-2 rounded-2xl border px-3.5 py-3 ${closed ? "border-line bg-[#f7f8fa]" : "border-danger/30 bg-white"}`} aria-label={`현장 문제 ${issue.no}`}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[16.5px]">
        <b>#{issue.no}</b>
        <b>{site?.siteName ?? "현장"}</b>
        <span>{personName(s, issue.workerId)}</span>
        <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[14px] font-bold text-danger">{issue.type}</span>
        <span className="text-ink-3">{issue.progress}</span>
        <Badge tone={STATUS_TONE[st]} className="!py-0 !text-[14px]">
          {st}
        </Badge>
      </p>
      <p className="text-[15px] text-ink-2">
        발견 {momentText(issue.discovered)} · 보고 {momentText(issue.reported)} · 요청 {issue.needs.join(", ") || "선택 없음"}
        {issue.request && ` · "${issue.request}"`}
      </p>
      <p className={`text-[15px] font-semibold ${issue.expectedEnd ? "text-danger" : "text-ink-3"}`}>
        {issue.expectedEnd ? `변경 예상 종료 ${issue.expectedEnd} → 엔진 전달 (기록 #${issue.linkedSeq})` : "보고 때 예상 종료 미확인 — 엔진에 전달하지 않음"}
      </p>
      <p className="text-[14.5px] text-ink-3">
        {m.map((x) => `${x.label} ${x.minutes === null ? "-" : `${x.minutes}분(${x.quality})`}`).join(" · ")}
      </p>
      <p className="text-[13.5px] text-ink-3">
        입력 {personName(s, issue.enteredBy)} · 정보 제공 {personName(s, issue.informantId)} · {issue.source}
        {issue.sourceRef && ` (${issue.sourceRef})`} · {issue.via} · 프로그램 {issue.appVersion ?? "-"}
      </p>
      {issue.voided && <p className="text-[14.5px] font-bold text-ink-3">무효: {issue.voided.reason}</p>}
      <MsgBox msg={msg} />
      {!closed && !sheet && (
        <div className="flex flex-wrap gap-1.5">
          <button className={btn} disabled={issue.steps.some((o) => o.kind === "지원 요청 접수")} onClick={() => setSheet("지원 요청 접수")}>
            접수
          </button>
          <button className={btn} onClick={() => setSheet("지원 조치 결정")}>
            지원 결정
          </button>
          <button className={btn} onClick={() => setSheet("조정")}>
            일정 조정
          </button>
          <button className={btn} onClick={() => setSheet("예상 종료 변경")}>
            예상 종료 변경
          </button>
          <button className={btn} onClick={() => setSheet("해결 여부")}>
            해결 여부
          </button>
          <button
            className={`${btn} text-danger`}
            onClick={() => {
              const reason = window.prompt("무효 사유 (기록은 지우지 않고 무효로 남깁니다. 이 문제에서 엔진에 넘긴 예상 종료도 무효 처리됩니다)");
              if (reason !== null) act((st2, c) => ({ state: voidIssue(st2, issue.id, reason, prov, c), value: true }), `#${issue.no}을 무효 처리했습니다 (관리자가 바꾼 일정은 그대로 — 필요하면 다시 조정).`);
            }}
          >
            무효
          </button>
        </div>
      )}
      {sheet === "조정" && <AdjustSheet s={s} session={session} issue={issue} onDone={done} onCancel={() => setSheet(null)} />}
      {sheet && sheet !== "조정" && <StepSheet s={s} session={session} issue={issue} kind={sheet} via="관리자 화면" onDone={done} onCancel={() => setSheet(null)} />}
      <button onClick={() => setFlow((v) => !v)} aria-expanded={flow} className="inline-flex items-center gap-1 text-[15px] font-bold text-primary-dark">
        <ChevronDown size={16} className={flow ? "rotate-180" : ""} /> 처리 흐름 (발견 → 예상 종료 변경 → 후속 현장 위험 계산 → 관리자 조치 → 재판단)
      </button>
      {flow && <IssueFlowView s={s} issue={issue} />}
    </li>
  );
}

/** 처리 흐름 — 입력값(사람이 넣은 값)과 계산값(엔진이 계산한 값)을 나눠 보여 준다 */
export function IssueFlowView({ s, issue }: { s: LabState; issue: FieldIssue }) {
  const rows = issueFlow(s, issue);
  return (
    <ol className="space-y-1.5 border-l-2 border-line pl-3" aria-label={`현장 문제 ${issue.no} 처리 흐름`}>
      {rows.map((r, i) => (
        <FlowItem key={i} r={r} />
      ))}
    </ol>
  );
}

function FlowItem({ r }: { r: FlowRow }) {
  const calc = r.value === "계산값";
  return (
    <li className="text-[15px]">
      <span className={`mr-1.5 rounded-md px-1.5 py-0.5 text-[13px] font-bold ${calc ? "bg-[#e8f1fe] text-[#1b64da]" : "bg-[#f2f4f6] text-ink-2"}`}>{r.value}</span>
      <b>{r.step}</b> <span className="text-ink-3 tabular-nums">{r.time}</span>
      {r.seq !== null && <span className="text-[13px] text-ink-3"> · 기록 #{r.seq}</span>}
      <span className="block text-ink-2">{r.text}</span>
      {r.stage && (
        <span className="mt-0.5 block text-[14px] text-ink-3">
          {r.stage.after.links.map((l) => {
            const b = r.stage!.before.links.find((o) => o.key === l.key);
            return (
              <span key={l.key} className="block">
                {l.title}: {b ? b.grade : "연결 없음"} → <b className={l.shortfall > 0 ? "text-danger" : ""}>{l.grade}</b>
                {l.arrival && ` (도착 ${l.arrival} / 예정 시작 ${l.plannedStart}${l.shortfall > 0 ? ` · ${l.shortfall}분 늦음` : l.slack !== null ? ` · 여유 ${l.slack}분` : ""})`}
              </span>
            );
          })}
          판단 기준시각 {kst(r.stage.after.asOf).time} · 같은 기준시각으로 이 기록 전·후를 계산
        </span>
      )}
    </li>
  );
}

/** 일정판 표시용 — 처리 중인 문제가 있는 현장 */
export function openIssuesBySite(s: LabState, sessionId: string): Map<string, FieldIssue[]> {
  const m = new Map<string, FieldIssue[]>();
  for (const i of sessionIssues(s, sessionId)) {
    if (["해결", "무효"].includes(issueStatus(i))) continue;
    m.set(i.scheduleId, [...(m.get(i.scheduleId) ?? []), i]);
  }
  return m;
}
