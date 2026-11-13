"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, PhoneCall } from "lucide-react";
import { Badge, type Tone } from "@/components/ui";
import { newOpId } from "@/lib/pilot/op-id";
import { kst } from "@/lib/pilot/time";
import { ACTIONS, caseSpans, type CaseRow, type CaseStatus, type Impact, type PhotoRow, type StepRow } from "@/lib/pilot/cases";
import type { JudgmentBrief } from "@/lib/pilot/case-data";
import { caseAdjustAction, caseEndAction, caseStepAction, deletePhotoAction } from "../../cases/actions";
import { Basis, CaseReport } from "../../_ui/CaseReport";

export interface BoardCase {
  c: CaseRow;
  site: string;
  reasons: string[];
  impact: Impact | null;
  steps: StepRow[];
  photos: (PhotoRow & { url: string | null })[];
  reportJudgment: JudgmentBrief | null;
  stepJudgments: Record<string, JudgmentBrief | null>;
}
export interface DaySchedule {
  id: string;
  site: string;
  workerId: string;
  start: string;
  end: string;
  version: number;
  started: boolean;
}

const TONE: Record<CaseStatus, Tone> = { 보고됨: "danger", 접수됨: "warning", "조치 중": "info", "현장 해결 보고": "info", 미해결: "danger", 해결: "success", 무효: "neutral" };
const hm = (iso: string | null) => (iso ? kst(iso).time : "모름");
const btn = "min-h-[2.6rem] rounded-xl bg-[#f2f4f6] px-3 text-[15.5px] font-bold text-ink-2 hover:bg-[#e8ebee] disabled:opacity-40";
type Sheet = "접수" | "담당자 배정" | "지원 조치 결정" | "현장 전달" | "일정 조정" | "예상 종료 변경" | "해결 확인" | "미해결 유지" | "무효 처리";

export function CaseBoard({
  kindParam,
  date,
  scenario,
  userId,
  open,
  closed,
  staff,
  names,
  schedules,
  nowLabel,
}: {
  kindParam: string;
  date: string;
  scenario: boolean;
  userId: string;
  open: BoardCase[];
  closed: BoardCase[];
  staff: { id: string; name: string; role: string }[];
  names: Record<string, string>;
  schedules: Record<string, DaySchedule[]>;
  nowLabel: string;
}) {
  const [proxy, setProxy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const daySchedules = schedules[date] ?? [];
  const fresh = open.filter((x) => x.c.status === "보고됨").length;
  return (
    <div className="space-y-4">
      <section className={`card space-y-3 p-4 ${open.length ? "border-2 border-danger/40" : ""}`} aria-label="처리 중 지원 요청">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex items-center gap-1.5 text-[21px] font-extrabold">
            <AlertTriangle size={21} className={open.length ? "text-danger" : "text-ink-3"} /> 처리 중 {open.length}건
          </h2>
          {fresh > 0 && (
            <span className="rounded-full bg-danger px-2.5 py-0.5 text-[15px] font-bold text-white" data-new-cases={fresh}>
              새 보고 {fresh}건 (미접수)
            </span>
          )}
          <span className="text-[14.5px] text-ink-3">우선 확인 순서: 안전 위험·긴급 → 엔진이 계산한 후속 현장 위험 → 미접수 → 오래 기다린 순 · 기준 {nowLabel}</span>
        </div>
        {notice && (
          <p role="status" className="rounded-xl bg-success-bg px-3 py-2 text-[16px] font-semibold text-success">
            {notice}
          </p>
        )}
        {open.length === 0 && <p className="text-[16px] text-ink-3">처리 중인 지원 요청이 없습니다. 현장기사 휴대폰에서 보고하면 자동 갱신으로 여기에 나타납니다.</p>}
        <ol className="space-y-3">
          {open.map((x, i) => (
            <AdminCase key={x.c.id} rank={i + 1} x={x} staff={staff} names={names} schedules={schedules[x.c.work_date] ?? []} kindParam={kindParam} onNotice={setNotice} />
          ))}
        </ol>
      </section>

      <section className="card space-y-2 p-4" aria-label="대리 보고">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-[19px] font-extrabold">대리 보고 — 전화·메신저·업무일지로 받은 문제 (사후 입력)</h2>
          <select value={proxy ?? ""} onChange={(e) => setProxy(e.target.value || null)} aria-label="대리 보고할 일정" className="rounded-xl border border-line px-2 py-2 text-[16px]">
            <option value="">일정 고르기 ({date})</option>
            {daySchedules.map((x) => (
              <option key={x.id} value={x.id}>
                {names[x.workerId] ?? "?"} · {x.site} {x.start}~{x.end}
              </option>
            ))}
          </select>
        </div>
        {proxy &&
          (() => {
            const t = daySchedules.find((x) => x.id === proxy)!;
            return (
              <CaseReport
                key={proxy}
                userId={userId}
                proxy
                scenario={scenario}
                target={{ scheduleId: t.id, siteName: t.site, plannedEnd: t.end, currentEnd: t.end, started: t.started }}
                onCancel={() => setProxy(null)}
                onDone={(text) => {
                  setProxy(null);
                  setNotice(`대리 보고 — ${text}`);
                }}
              />
            );
          })()}
      </section>

      {closed.length > 0 && (
        <section className="card space-y-1.5 p-4" aria-label="끝난 사건">
          <h2 className="text-[19px] font-extrabold">
            {date} 끝난 사건 {closed.length}건
          </h2>
          <ul className="divide-y divide-line text-[16px]">
            {closed.map((x) => (
              <li key={x.c.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <b className="tabular-nums">{x.c.case_no}</b> {x.site} · {names[x.c.worker_id]} · {x.c.issue_type}
                <Badge tone={TONE[x.c.status]} className="!py-0 !text-[14px]">
                  {x.c.status}
                </Badge>
                <Link href={`/pilot/admin/cases/${x.c.id}`} className="ml-auto font-bold text-primary-dark underline">
                  사건 증빙
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function changeText(j: JudgmentBrief, titles: Map<string, string>) {
  const t = (key: string) =>
    key
      .split(">")
      .map((id) => titles.get(id) ?? "?")
      .join(" → ");
  const ch = j.changes?.changes ?? [];
  return `${ch.length ? ch.map((c) => `${t(c.key)} ${c.kind}(${c.before?.grade ?? c.before?.status ?? "없음"}→${c.after?.grade ?? c.after?.status ?? "없음"})`).join(" · ") : "연결 변화 없음"} (그날 전체 위험 연결 ${j.summary.risky_before} → ${j.summary.risky_after}건)`;
}

function AdminCase({
  rank,
  x,
  staff,
  names,
  schedules,
  kindParam,
  onNotice,
}: {
  rank: number;
  x: BoardCase;
  staff: { id: string; name: string; role: string }[];
  names: Record<string, string>;
  schedules: DaySchedule[];
  kindParam: string;
  onNotice: (t: string) => void;
}) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const c = x.c;
  const titles = new Map(schedules.map((s) => [s.id, s.site]));
  const spans = caseSpans(c, x.steps);
  const accepted = c.status !== "보고됨";
  const router = useRouter();
  return (
    <li className={`space-y-2 rounded-2xl border px-3.5 py-3 ${c.issue_type === "안전 위험" || c.urgency === "긴급" ? "border-danger bg-danger-bg/30" : "border-line bg-white"}`} aria-label={`사건 ${c.case_no}`}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[17px]">
        <span className="rounded-lg bg-ink px-2 py-0.5 text-[14px] font-bold text-white">{rank}순위</span>
        <b className="tabular-nums">{c.case_no}</b>
        <b>{x.site}</b>
        <span>{names[c.worker_id]}</span>
        <span className={`rounded-full px-2 py-0.5 text-[14px] font-bold ${c.issue_type === "안전 위험" ? "bg-danger text-white" : "bg-danger-bg text-danger"}`}>{c.issue_type}</span>
        {c.urgency === "긴급" && <Badge tone="danger" className="!py-0 !text-[14px]">긴급</Badge>}
        <Badge tone={TONE[c.status]} className="!py-0 !text-[14px]">
          {c.status}
        </Badge>
        <span className="text-[14px] text-ink-3">{c.evidence_class}</span>
      </p>
      {x.reasons.length > 0 && <p className="text-[15px] font-semibold text-danger">우선 확인 이유: {x.reasons.join(" · ")}</p>}
      {c.issue_type === "안전 위험" && (
        <p className="flex items-center gap-1.5 text-[15px] font-bold text-danger">
          <PhoneCall size={16} /> 안전 위험 — 화면 확인만 하지 말고 현장기사에게 직접 전화해 작업 중지 여부를 확인하세요.
        </p>
      )}
      <p className="text-[15px] text-ink-2">
        발견 {hm(c.discovered_at)} ({c.discovered_basis}) · 보고 {hm(c.reported_at)} ({c.report_mode} · {c.report_basis}) · 서버 기록 {kst(c.recorded_at).seconds} · {c.progress} · 요청 {c.needs.join(", ") || "없음"}
        {c.request && ` · "${c.request}"`}
      </p>
      <p className="text-[14px] text-ink-3">
        입력 {names[c.reporter_id]} ({c.source}) · 출처 {c.info_source} · 프로그램 {c.app_version}
      </p>
      <p className={`text-[15.5px] font-semibold ${c.expected_end ? "text-ink" : "text-ink-3"}`}>
        {c.expected_end ? `변경 예상 종료 ${c.expected_end.slice(0, 5)} → 엔진 판단: ${x.reportJudgment ? changeText(x.reportJudgment, titles) : "판단 대기 (기록·판단 이력에서 다시 처리)"}` : "예상 종료 미확인 — 엔진에 전달하지 않음 (위험 판단 변화 없음)"}
      </p>
      {x.impact && (
        <p className="text-[15px] text-ink-2">
          지금 기준 후속 현장 영향(계산값): 위험 {x.impact.risky}곳{x.impact.sites.length ? ` (${x.impact.sites.join(", ")})` : ""} · 최대 {x.impact.maxShortfall}분 늦음 · 판단 보류 {x.impact.held}건
        </p>
      )}
      {x.photos.length > 0 && <Photos photos={x.photos} onNotice={onNotice} />}
      {x.steps.length > 0 && (
        <ol className="space-y-0.5 rounded-xl bg-[#f7f8fa] px-3 py-2 text-[15px]" aria-label="조치 이력">
          {x.steps.map((s) => (
            <li key={s.id}>
              <b>{s.kind}</b>
              {s.action && ` — ${s.action}`}
              {s.resolution && ` — ${s.resolution}`}
              {s.assignee_id && ` — ${names[s.assignee_id] ?? ""}`}
              {s.assignee_name && ` — ${s.assignee_name}`}
              {s.message && `: ${s.message}`}{" "}
              <span className="text-ink-3">
                ({hm(s.occurred_at)} · {s.occurred_basis} · {names[s.actor_id]})
              </span>
              {x.stepJudgments[s.id] && <span className="block pl-3 font-semibold text-primary-dark">재판단: {changeText(x.stepJudgments[s.id]!, titles)}</span>}
            </li>
          ))}
        </ol>
      )}
      <p className="text-[14px] text-ink-3">{spans.map((p) => `${p.label} ${p.minutes === null ? "-" : `${p.minutes}분(${p.quality})`}`).join(" · ")}</p>

      {!sheet && (
        <div className="flex flex-wrap gap-1.5">
          <button className={`${btn} ${!accepted ? "!bg-danger !text-white" : ""}`} disabled={accepted} onClick={() => setSheet("접수")}>
            접수
          </button>
          {(["담당자 배정", "지원 조치 결정", "현장 전달", "일정 조정", "예상 종료 변경", "해결 확인", "미해결 유지"] as Sheet[]).map((k) => (
            <button key={k} className={btn} disabled={!accepted && k !== "예상 종료 변경"} onClick={() => setSheet(k)}>
              {k === "지원 조치 결정" ? "지원 결정" : k}
            </button>
          ))}
          <button className={`${btn} text-danger`} onClick={() => setSheet("무효 처리")}>
            무효
          </button>
          <Link href={`/pilot/admin/cases/${c.id}?kind=${kindParam}`} className={`${btn} inline-flex items-center gap-1`}>
            <FileText size={15} /> 사건 증빙
          </Link>
        </div>
      )}
      {sheet && (
        <StepSheet
          kind={sheet}
          x={x}
          staff={staff}
          schedules={schedules.filter((s) => s.workerId === c.worker_id || true)}
          onCancel={() => setSheet(null)}
          onDone={(t) => {
            setSheet(null);
            onNotice(`${c.case_no} ${t}`);
            router.refresh();
          }}
        />
      )}
    </li>
  );
}

function Photos({ photos, onNotice }: { photos: (PhotoRow & { url: string | null })[]; onNotice: (t: string) => void }) {
  const router = useRouter();
  return (
    <ul className="flex flex-wrap gap-2" aria-label="현장 사진">
      {photos.map((p) => (
        <li key={p.id} className="w-28 text-[12.5px] text-ink-3">
          {p.deleted_at || !p.url ? (
            <span className="block rounded-lg bg-[#f2f4f6] p-2">삭제됨 · {p.delete_reason}</span>
          ) : (
            <>
              <a href={p.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- 비공개 저장소의 서명 주소(10분) */}
                <img src={p.url} alt={p.caption ?? "현장 사진"} className="h-28 w-28 rounded-lg border border-line object-cover" />
              </a>
              <span className="block">
                {kst(p.recorded_at).time} · {Math.round(p.size_bytes / 1024)}KB · {p.exif_removed ? "촬영정보 제거" : "원본(촬영정보 남음)"}
              </span>
              <button
                className="font-bold text-danger underline"
                onClick={async () => {
                  const reason = window.prompt("삭제 사유 (보관 기한 경과 · 개인정보 노출 등) — 기록은 남고 파일만 지웁니다");
                  if (!reason) return;
                  const r = await deletePhotoAction(p.id, reason);
                  onNotice(r.ok ? "사진 파일을 지웠습니다 (삭제 기록은 남음)." : r.error);
                  router.refresh();
                }}
              >
                삭제
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function StepSheet({
  kind,
  x,
  staff,
  schedules,
  onCancel,
  onDone,
}: {
  kind: Sheet;
  x: BoardCase;
  staff: { id: string; name: string; role: string }[];
  schedules: DaySchedule[];
  onCancel: () => void;
  onDone: (t: string) => void;
}) {
  const [opId] = useState(newOpId);
  const [mode, setMode] = useState<"즉시" | "사후">("즉시");
  const [time, setTime] = useState("");
  const [basis, setBasis] = useState("원자료 기록");
  const [msg, setMsg] = useState("");
  const [action, setAction] = useState<string | null>(null);
  const [assignee, setAssignee] = useState("");
  const [assigneeName, setAssigneeName] = useState("");
  const later = schedules.filter((s) => s.id !== x.c.schedule_id);
  const nextOfWorker = later.find((s) => s.workerId === x.c.worker_id && s.start > (schedules.find((y) => y.id === x.c.schedule_id)?.start ?? "")) ?? later[0];
  const [sid, setSid] = useState(nextOfWorker?.id ?? "");
  const target = schedules.find((s) => s.id === sid);
  const [start, setStart] = useState(target?.start ?? "");
  const [end, setEnd] = useState(kind === "예상 종료 변경" ? "" : (target?.end ?? ""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const moment = () => {
    const now = new Date().toISOString();
    return mode === "즉시" ? { mode: "즉시" as const, pressedAt: now, sentAt: now } : { mode: "사후" as const, time, basis, pressedAt: now, sentAt: now };
  };
  const needMsg = kind === "현장 전달" || kind === "미해결 유지" || kind === "무효 처리" || kind === "일정 조정";
  const ok =
    (mode === "즉시" || /^\d{2}:\d{2}$/.test(time)) &&
    (!needMsg || msg.trim()) &&
    (kind !== "지원 조치 결정" || action) &&
    (kind !== "담당자 배정" || assignee || assigneeName.trim()) &&
    (kind !== "일정 조정" || (target && /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end))) &&
    (kind !== "예상 종료 변경" || /^\d{2}:\d{2}$/.test(end));

  async function send() {
    setBusy(true);
    setErr(null);
    try {
      if (kind === "일정 조정") {
        const r = await caseAdjustAction({ opId, caseId: x.c.id, scheduleId: target!.id, expectedVersion: target!.version, plannedStart: start, plannedEnd: end, message: msg });
        if (!r.ok) return setErr(r.error);
        return onDone(`일정 조정 (${target!.site} ${start}~${end}) — 재판단: 위험 연결 ${r.before ?? "?"} → ${r.after ?? "?"}건`);
      }
      if (kind === "예상 종료 변경") {
        const r = await caseEndAction({ opId, caseId: x.c.id, expectedEnd: end, moment: moment() });
        if (!r.ok) return setErr(r.error);
        return onDone(`예상 종료 ${end} 전달 — 엔진 판단을 다시 기록했습니다.`);
      }
      const r = await caseStepAction({ opId, caseId: x.c.id, kind, action, assigneeId: assignee || null, assigneeName: assigneeName || null, message: msg, moment: moment() });
      if (!r.ok) return setErr(r.error);
      onDone(`${kind} 기록됨 (상태: ${r.status})`);
    } catch {
      setErr("서버에 연결하지 못했습니다. 다시 누르면 같은 요청으로 한 번만 저장됩니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-line bg-white p-3" aria-label={`${kind} 입력`}>
      <p className="text-[17px] font-extrabold">{kind}</p>
      {kind === "담당자 배정" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="담당자 (계정)" className="rounded-xl border border-line px-2 py-2 text-[16px]">
            <option value="">계정에서 고르기</option>
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.role === "admin" ? "본사" : "현장"})
              </option>
            ))}
          </select>
          <input value={assigneeName} onChange={(e) => setAssigneeName(e.target.value)} placeholder="또는 이름 (계정 없는 기술자)" aria-label="담당자 이름" className="rounded-xl border border-line px-3 py-2 text-[16px]" />
        </div>
      )}
      {kind === "지원 조치 결정" && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="지원 조치">
          {ACTIONS.map((a) => (
            <button key={a} role="radio" aria-checked={action === a} onClick={() => setAction(a)} className={`rounded-xl px-3 py-2 text-[15.5px] font-bold ${action === a ? "bg-ink text-white" : "bg-[#f2f4f6] text-ink-2"}`}>
              {a}
            </button>
          ))}
        </div>
      )}
      {kind === "일정 조정" && (
        <div className="grid gap-2 sm:grid-cols-4">
          <select
            value={sid}
            onChange={(e) => {
              const t = schedules.find((s) => s.id === e.target.value);
              setSid(e.target.value);
              setStart(t?.start ?? "");
              setEnd(t?.end ?? "");
            }}
            aria-label="조정할 일정"
            className="rounded-xl border border-line px-2 py-2 text-[16px] sm:col-span-2"
          >
            {later.map((s) => (
              <option key={s.id} value={s.id}>
                {s.site} {s.start}~{s.end}
              </option>
            ))}
          </select>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} aria-label="새 예정 시작" className="rounded-xl border border-line px-2 py-2 text-[16px]" />
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="새 예정 종료" className="rounded-xl border border-line px-2 py-2 text-[16px]" />
        </div>
      )}
      {kind === "예상 종료 변경" && <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="변경 예상 종료" className="rounded-xl border border-line px-2 py-2 text-[16px]" />}
      {kind !== "일정 조정" && (
        <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="실제 시각">
          <button role="radio" aria-checked={mode === "즉시"} onClick={() => setMode("즉시")} className={`rounded-lg px-2.5 py-1.5 text-[15px] font-bold ${mode === "즉시" ? "bg-ink text-white" : "bg-[#f2f4f6]"}`}>
            지금 (버튼 누른 시각)
          </button>
          <button role="radio" aria-checked={mode === "사후"} onClick={() => setMode("사후")} className={`rounded-lg px-2.5 py-1.5 text-[15px] font-bold ${mode === "사후" ? "bg-ink text-white" : "bg-[#f2f4f6]"}`}>
            실제 시각 입력 (사후)
          </button>
          {mode === "사후" && (
            <>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="실제 시각 입력" className="rounded-lg border border-line px-2 py-1 text-[16px]" />
              <Basis value={basis} onChange={setBasis} />
            </>
          )}
        </div>
      )}
      <input
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        maxLength={500}
        aria-label="내용"
        placeholder={kind === "현장 전달" ? "현장기사에게 보낼 내용 (예: 숙련 기술자 10:00 도착)" : kind === "일정 조정" ? "조정 사유 (고객 연락 등)" : needMsg ? "사유 (필수)" : "내용 (선택)"}
        className="w-full rounded-xl border border-line px-3 py-2 text-[16px]"
      />
      {kind === "일정 조정" && <p className="text-[13.5px] text-ink-3">시스템이 일정을 정하지 않습니다 — 관리자가 넣은 시작·종료만 저장하고, 기존 엔진으로 판단 전후를 기록합니다.</p>}
      {err && (
        <p role="alert" className="rounded-xl bg-danger-bg px-3 py-2 text-[15.5px] font-bold text-danger">
          {err}
        </p>
      )}
      <div className="flex gap-2">
        <button disabled={!ok || busy} onClick={() => void send()} className="min-h-[2.8rem] rounded-xl bg-primary px-4 text-[16.5px] font-bold text-white disabled:opacity-40">
          {busy ? "저장 중…" : "기록"}
        </button>
        <button onClick={onCancel} className="min-h-[2.8rem] rounded-xl bg-[#f2f4f6] px-4 text-[16.5px] font-bold text-ink-2">
          닫기
        </button>
      </div>
    </div>
  );
}
