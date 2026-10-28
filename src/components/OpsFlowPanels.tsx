"use client";

import { useState } from "react";
import { ChevronDown, ClipboardCheck, ListOrdered, PlayCircle, Timer } from "lucide-react";
import { useApp } from "@/lib/store";
import { fullName } from "@/lib/team";
import { OPS_ASSUMPTIONS, chainRisk, opsPriority } from "@/lib/ops-calc";
import { fmtHHMM, gradeRank, parseHHMM, type RiskResult } from "@/lib/risk-engine";
import { PRIORITY_VERSION, type PriorityResult } from "@/lib/priority-engine";
import type { StageDeviation, WorkDeviation } from "@/lib/state-events";
import type { ScheduleItem } from "@/lib/ops-types";
import { Badge, GhostButton, Modal, PrimaryButton, Segment, inputClass, type Tone } from "@/components/ui";
import { gradeLabel, gradeTone } from "@/components/RiskPanel";

/* ── 단계 편차 표시 ─────────────────────────────────── */

/** 분 → 읽기 쉬운 길이 (90분 → 1시간 30분, 1500분 → 1일 1시간) */
export function dur(min: number): string {
  const m = Math.abs(min);
  if (m < 60) return `${m}분`;
  if (m < 1440) return `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ""}`;
  return `${Math.floor(m / 1440)}일${Math.floor((m % 1440) / 60) ? ` ${Math.floor((m % 1440) / 60)}시간` : ""}`;
}

export function stageText(s: StageDeviation): { text: string; tone: Tone } {
  switch (s.status) {
    case "지연":
      return { text: `${dur(s.minutes ?? 0)} 늦음`, tone: "danger" };
    case "이름":
      return { text: `${dur(s.minutes ?? 0)} 이름`, tone: "info" };
    case "정시":
      return { text: "정시", tone: "success" };
    case "기한 내":
      return { text: "기한 내", tone: "success" };
    case "미발생 · 기한 경과":
      return { text: `미발생 · 기준 후 ${dur(s.minutes ?? 0)}`, tone: "warning" };
    case "시각 기록 없음":
      return { text: "시각 기록 없음", tone: "neutral" };
    case "기한 전":
      return { text: "기준 전", tone: "neutral" };
    default:
      return { text: "해당 없음", tone: "neutral" };
  }
}

const when = (iso: string | null, date: string) => (!iso ? "-" : iso.slice(0, 10) === date ? iso.slice(11) : iso.slice(5).replace("T", " "));

/* ── 화면 A: 작업상태 편차 ─────────────────────────── */

export function DeviationTable({
  deviations,
  nameOf = fullName,
  onRecordStart,
  highlight = [],
}: {
  deviations: WorkDeviation[];
  nameOf?: (id: string) => string;
  /** 실제 시작 기록 버튼 (관리자 화면에서만) */
  onRecordStart?: (siteId: string) => void;
  highlight?: string[];
}) {
  return (
    <div className="space-y-2.5">
      {deviations.map((d) => (
        <div key={d.siteId} className={`card p-4 ${highlight.includes(d.siteId) ? "border border-warning/40" : ""}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-[20px] font-bold">
              {d.title}
              <span className="ml-2 text-[16px] font-semibold text-ink-3">
                {nameOf(d.workerId)} · 예정 {d.plannedStart}~{d.plannedEnd}
              </span>
            </p>
            <p className="text-[16px] text-ink-3">
              기대상태 <b className="text-ink-2">{d.expectedPhase}</b> · 실제 <b className="text-ink-2">{d.actualPhase}</b>
            </p>
          </div>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {d.stages.map((st) => {
              const t = stageText(st);
              return (
                <div key={st.stage} className={`rounded-xl px-3 py-2.5 ${st.affectsEnd ? "bg-warning-bg/70" : "bg-[#f7f8fa]"}`}>
                  <p className="text-[16px] font-bold text-ink-2">{st.stage}</p>
                  <Badge tone={t.tone} className="mt-1 !text-[15.5px]">
                    {t.text}
                  </Badge>
                  <p className="mt-1 text-[14.5px] leading-snug text-ink-3 tabular-nums">
                    기준 {when(st.due, d.date)} ({st.dueBasis})
                    <br />
                    실제 {st.actual ? `${when(st.actual, d.date)}${st.source ? ` · ${st.source}` : ""}` : "기록 없음"}
                  </p>
                  <p className={`mt-0.5 text-[14px] font-semibold ${st.affectsEnd ? "text-warning" : "text-ink-3"}`}>{st.affectsEnd ? "예상 종료에 반영" : "예상 종료에 반영하지 않음"}</p>
                  {st.stage === "작업개시" && onRecordStart && (d.status === "예정" || d.status === "진행 중") && (
                    <button
                      onClick={() => onRecordStart(d.siteId)}
                      className="mt-1 inline-flex items-center gap-1 text-[15px] font-bold text-primary-dark hover:underline"
                    >
                      <PlayCircle size={15} /> {st.actual ? "시작 기록 수정" : "실제 시작 기록"}
                    </button>
                  )}
                </div>
              );
            })}
            <div className={`rounded-xl border px-3 py-2.5 ${d.end.determined ? "border-line" : "border-warning/50"}`}>
              <p className="text-[16px] font-bold text-ink-2">예상 종료</p>
              <p className="mt-0.5 text-[22px] font-extrabold tabular-nums">
                {d.end.time}
                {d.end.delay !== 0 && <span className="ml-1.5 text-[15px] font-bold text-danger">예정 대비 {d.end.delay > 0 ? "+" : ""}{d.end.delay}분</span>}
              </p>
              {!d.end.determined && <p className="text-[15px] font-bold text-warning">예상 종료 미확정</p>}
              <p className="mt-0.5 text-[14.5px] leading-snug text-ink-3">
                <b className="text-ink-2">{d.end.source}</b> · {d.end.basis}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── 화면 B: 관리자 대응 우선순위 ──────────────────────── */

export function PriorityList({
  result,
  onAdjust,
  onEstimate,
  compact = false,
}: {
  result: PriorityResult;
  /** 영향 현장 시작 조정 (관리자 화면에서만) */
  onAdjust?: (siteId: string) => void;
  /** 지연 출발 현장 예상 종료 입력 */
  onEstimate?: (siteId: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-2.5">
      {result.items.length === 0 ? (
        <p className="card px-5 py-4 text-[18.5px] text-ink-3">대응이 필요한 위험이 없습니다.</p>
      ) : (
        result.items.map((it) => (
          <div key={it.key} className={`card p-4 lg:p-5 ${it.rank === 1 ? "border border-danger/25" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-lg px-2.5 py-0.5 text-[17px] font-extrabold ${it.rank === 1 ? "bg-danger text-white" : "bg-[#f2f4f6] text-ink-2"}`}>
                {it.rank}순위
              </span>
              <span className="text-[21px] font-bold">{it.title}</span>
              <Badge tone={gradeTone({ status: "판정", grade: it.grade })}>{gradeLabel({ status: "판정", grade: it.grade })}</Badge>
              <span className="ml-auto text-[16.5px] font-semibold text-ink-3 tabular-nums">점수 {it.score}</span>
            </div>
            <p className="mt-1.5 text-[18px] text-ink-2 tabular-nums">
              예상 지연 <b className="text-ink">{it.maxShortfall}분</b> · 영향받는 후속 현장 <b className="text-ink">{it.sites.length}곳</b> ({it.sites.map((s) => s.title).join(", ")}) · 가장 이른 시작 {it.earliestStart}
              {it.minutesUntil !== null && ` (${it.minutesUntil}분 남음)`}
            </p>
            {!compact && <p className="mt-1 text-[18px] leading-relaxed">{it.basis}</p>}
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {it.actions.map((a) => (
                <li key={a} className="rounded-full bg-[#f2f4f6] px-2.5 py-0.5 text-[16px] font-semibold text-ink-2">
                  {a}
                </li>
              ))}
            </ul>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setOpen(open === it.key ? null : it.key)}
                aria-expanded={open === it.key}
                className="inline-flex items-center gap-1 text-[16.5px] font-bold text-primary-dark hover:underline"
              >
                점수 계산 근거 <ChevronDown size={17} className={open === it.key ? "rotate-180" : ""} />
              </button>
              {onAdjust && (
                <button
                  onClick={() => onAdjust(it.sites[0].id)}
                  className="ml-auto inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl bg-primary px-3.5 text-[17px] font-bold text-white hover:bg-primary-dark"
                >
                  <Timer size={17} /> {it.sites[0].title} 시작 조정
                </button>
              )}
              {onEstimate && it.root && (
                <button
                  onClick={() => onEstimate(it.root!.id)}
                  className="inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl bg-[#f2f4f6] px-3.5 text-[17px] font-bold text-ink-2 hover:bg-[#e8ebee]"
                >
                  {it.root.title} 예상 종료 입력
                </button>
              )}
            </div>
            {open === it.key && (
              <table className="mt-2 w-full text-left text-[16px]">
                <tbody>
                  {it.breakdown.map((b) => (
                    <tr key={b.factor} className="border-t border-line">
                      <td className="py-1.5 pr-3 font-semibold whitespace-nowrap">{b.factor}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">{b.value}</td>
                      <td className="py-1.5 pr-3 text-right font-bold whitespace-nowrap tabular-nums">+{b.points}</td>
                      <td className="py-1.5 text-ink-3">{b.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))
      )}
      {result.held.length > 0 && (
        <div className="card border border-warning/30 px-5 py-3.5">
          <p className="text-[18px] font-bold text-warning">데이터 확인 대상 {result.held.length}건 (판단 보류 — 위험 없음이 아님)</p>
          <ul className="mt-1 space-y-0.5 text-[16.5px] text-ink-2">
            {result.held.map((h) => (
              <li key={h.key}>
                · {h.title}: {h.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.watch.length > 0 && <p className="text-[16px] text-ink-3">여유 10분 미만(주의) 연결 {result.watch.length}건은 점수를 매기지 않고 관찰합니다.</p>}
    </div>
  );
}

/** 우선순위 산출 기준 한 줄 */
export function PriorityNote() {
  return (
    <p className="text-[15.5px] text-ink-3">
      점수는 관리자 판단을 돕는 규칙 기반 점수입니다 (사고 확률이 아님 · 가중치는 초기 운영 가정값) · {PRIORITY_VERSION}
    </p>
  );
}

/* ── 일정 조정 (관리자 조치) ───────────────────────── */

function previewLines(before: RiskResult, after: RiskResult, pb: PriorityResult, pa: PriorityResult) {
  const keys = [...new Set([...before.links, ...after.links].map((l) => l.key))].sort();
  const lines = keys
    .map((k) => {
      const b = before.links.find((l) => l.key === k);
      const a = after.links.find((l) => l.key === k);
      if (b && a && b.grade === a.grade && b.slack === a.slack && b.status === a.status) return null;
      const lab = (a ?? b)!;
      return `${lab.prev.title} → ${lab.next.title}: ${b ? gradeLabel(b) : "연결 없음"} → ${a ? gradeLabel(a) : "연결 없음"}`;
    })
    .filter(Boolean) as string[];
  const ranks = (p: PriorityResult) => p.items.map((i) => `${i.rank}. ${i.title}`).join(" · ") || "없음";
  return { lines, before: ranks(pb), after: ranks(pa) };
}

export function AdjustStartModal({ schedule: s, onClose }: { schedule: ScheduleItem; onClose: () => void }) {
  const { schedules, tasks, updateSchedule, showToast } = useApp();
  const ps = parseHHMM(s.start)!;
  const dur = parseHHMM(s.end)! - ps;
  const [time, setTime] = useState(s.start);
  const t = parseHHMM(time);
  const error = t === null ? "HH:MM 형식으로 입력해 주세요." : t + dur >= 24 * 60 ? "자정을 넘는 일정은 지원하지 않습니다." : null;
  const newEnd = t === null ? "" : fmtHHMM(t + dur);
  const next = error ? schedules : schedules.map((x) => (x.id === s.id ? { ...x, start: time, end: newEnd } : x));
  const p = previewLines(chainRisk(schedules, s.date), chainRisk(next, s.date), opsPriority(schedules, tasks, s.date), opsPriority(next, tasks, s.date));

  return (
    <Modal open onClose={onClose} title="일정 시작 조정" desc={`${s.title} · 지금 ${s.start}~${s.end} (작업시간 ${dur}분 유지)`}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[19.5px] font-semibold text-ink-2">새 시작 시각</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} aria-invalid={!!error} />
          {error ? (
            <span className="mt-1 block text-[17.5px] font-semibold text-danger">{error}</span>
          ) : (
            <span className="mt-1 block text-[17.5px] text-ink-3">조정 후 {time}~{newEnd}</span>
          )}
        </label>
        <div className="rounded-2xl bg-[#f7f8fa] px-4 py-3 text-[17.5px] leading-relaxed">
          <p className="font-bold text-ink-2">저장하면 위험과 우선순위를 다시 판단합니다</p>
          {p.lines.length === 0 ? <p className="text-ink-3">위험 판정 변화 없음</p> : p.lines.map((l) => <p key={l}>{l}</p>)}
          <p className="mt-1 text-ink-2">
            우선순위: {p.before} → <b>{p.after}</b>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrimaryButton
            disabled={!!error || time === s.start}
            onClick={() => {
              updateSchedule(s.id, { start: time, end: newEnd, acknowledgedAt: undefined });
              showToast(`${s.title} 시작을 ${time}로 조정하고 위험·우선순위를 다시 판단했습니다. 담당자 확인을 기다립니다`);
              onClose();
            }}
            className="flex-1"
          >
            조정하고 다시 판단
          </PrimaryButton>
          <GhostButton onClick={onClose}>취소</GhostButton>
        </div>
        <p className="text-[15.5px] text-ink-3">관리자가 직접 바꾸는 조치입니다. 시스템이 일정을 스스로 바꾸지 않습니다. 데모 세션에만 저장됩니다.</p>
      </div>
    </Modal>
  );
}

/* ── 실제 작업 시작 기록 ───────────────────────────── */

export function StartRecordModal({ schedule: s, onClose }: { schedule: ScheduleItem; onClose: () => void }) {
  const { schedules, tasks, recordActualStart, showToast } = useApp();
  const [time, setTime] = useState(s.actualStart ?? s.start);
  const [source, setSource] = useState<"현장 보고" | "관리자 입력">(s.actualStartSource === "현장 보고" ? "현장 보고" : "관리자 입력");
  const t = parseHHMM(time);
  const error = t === null ? "HH:MM 형식으로 입력해 주세요." : t >= parseHHMM(s.end)! ? `예정 종료 ${s.end}보다 빨라야 합니다.` : null;
  const next = error
    ? schedules
    : schedules.map((x) => (x.id === s.id ? { ...x, actualStart: time, actualStartSource: source, status: x.status === "예정" ? ("진행 중" as const) : x.status } : x));
  const p = previewLines(chainRisk(schedules, s.date), chainRisk(next, s.date), opsPriority(schedules, tasks, s.date), opsPriority(next, tasks, s.date));
  const dev = t === null ? null : t - parseHHMM(s.start)!;

  return (
    <Modal open onClose={onClose} title="실제 작업 시작 기록" desc={`${s.title} · 예정 ${s.start}~${s.end}`}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[19.5px] font-semibold text-ink-2">실제 시작 시각</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} aria-invalid={!!error} />
          {error ? (
            <span className="mt-1 block text-[17.5px] font-semibold text-danger">{error}</span>
          ) : (
            <span className="mt-1 block text-[17.5px] text-ink-3">
              작업개시 편차 {dev! > 0 ? `${dev}분 늦음` : dev! < 0 ? `${-dev!}분 이름` : "정시"}
              {dev! > 0 && ` → 예상 종료 ${fmtHHMM(parseHHMM(s.end)! + dev!)} (${OPS_ASSUMPTIONS.label})`}
            </span>
          )}
        </label>
        <div>
          <p className="mb-1.5 text-[19.5px] font-semibold text-ink-2">기록 출처</p>
          <Segment<"현장 보고" | "관리자 입력">
            value={source}
            onChange={setSource}
            options={[
              { value: "현장 보고", label: "현장 보고" },
              { value: "관리자 입력", label: "관리자 입력" },
            ]}
          />
        </div>
        <div className="rounded-2xl bg-[#f7f8fa] px-4 py-3 text-[17.5px] leading-relaxed">
          <p className="font-bold text-ink-2">저장하면 위험과 우선순위를 다시 판단합니다</p>
          {p.lines.length === 0 ? <p className="text-ink-3">위험 판정 변화 없음</p> : p.lines.map((l) => <p key={l}>{l}</p>)}
          <p className="mt-1 text-ink-2">
            우선순위: {p.before} → <b>{p.after}</b>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrimaryButton
            disabled={!!error}
            onClick={() => {
              recordActualStart(s.id, time, source);
              showToast(`${s.title} 실제 시작 ${time}를 기록하고 위험·우선순위를 다시 판단했습니다`);
              onClose();
            }}
            className="flex-1"
          >
            기록하고 다시 판단
          </PrimaryButton>
          {s.actualStart && (
            <GhostButton
              onClick={() => {
                recordActualStart(s.id, undefined);
                showToast("실제 시작 기록을 지웠습니다");
                onClose();
              }}
            >
              기록 지우기
            </GhostButton>
          )}
          <GhostButton onClick={onClose}>취소</GhostButton>
        </div>
        <p className="text-[15.5px] text-ink-3">데모 세션 입력입니다 (실제 운영 기록 아님). 시각은 입력한 값 그대로 쓰며 만들어 넣지 않습니다.</p>
      </div>
    </Modal>
  );
}

/* ── 일정 화면용 묶음: 화면 A·B ─────────────────────── */

export function PriorityAndDeviation({
  list,
  deviations,
  priority,
  onEstimate,
}: {
  list: ScheduleItem[];
  deviations: WorkDeviation[];
  priority: PriorityResult;
  onEstimate?: (siteId: string) => void;
}) {
  const { permission } = useApp();
  const [adjust, setAdjust] = useState<ScheduleItem | null>(null);
  const [start, setStart] = useState<ScheduleItem | null>(null);
  const [showAll, setShowAll] = useState(false);
  const pick = (id: string) => list.find((s) => s.id === id) ?? null;
  const notable = deviations.filter(
    (d) => d.stages.some((x) => x.status === "지연" || x.status === "미발생 · 기한 경과") || !d.end.determined || d.end.delay !== 0,
  );
  const rows = showAll ? deviations : notable;

  return (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <h4 className="flex flex-wrap items-center gap-2 text-[22px] font-bold">
          <ListOrdered size={23} className="text-primary" /> 관리자 대응 우선순위
          <span className="text-[17px] font-semibold text-ink-3">{priority.items.length}건</span>
        </h4>
        <PriorityNote />
        <PriorityList
          result={priority}
          onAdjust={permission.assignTask ? (id) => setAdjust(pick(id)) : undefined}
          onEstimate={onEstimate}
        />
      </div>

      <div className="space-y-2.5">
        <h4 className="flex flex-wrap items-center gap-2 text-[22px] font-bold">
          <ClipboardCheck size={23} className="text-primary" /> 작업상태 편차
          <span className="text-[17px] font-semibold text-ink-3">
            편차 있는 일정 {notable.length}건 / 오늘 {deviations.length}건
          </span>
        </h4>
        <p className="text-[16px] text-ink-3">
          예정(기대상태)과 실제 기록을 단계별로 비교합니다. 확인·작업개시·결과보고 편차는 합산하지 않으며, 예상 종료에는 작업개시·종료·예상 종료 보고만 반영합니다. {OPS_ASSUMPTIONS.label}
        </p>
        {rows.length > 0 ? (
          <DeviationTable deviations={rows} onRecordStart={permission.assignTask ? (id) => setStart(pick(id)) : undefined} />
        ) : (
          <p className="card px-5 py-4 text-[18px] text-ink-3">편차가 있는 일정이 없습니다.</p>
        )}
        {deviations.length > notable.length && (
          <button onClick={() => setShowAll((v) => !v)} className="text-[17px] font-bold text-primary-dark hover:underline">
            {showAll ? "편차 있는 일정만 보기" : `오늘 일정 전체 ${deviations.length}건 보기`}
          </button>
        )}
      </div>

      {adjust && <AdjustStartModal schedule={adjust} onClose={() => setAdjust(null)} />}
      {start && <StartRecordModal schedule={start} onClose={() => setStart(null)} />}
    </div>
  );
}

/** 위험 판정 요약 (검증 화면의 변경 전·후 비교용) */
export function RiskSummaryTable({ r }: { r: RiskResult }) {
  return (
    <table className="w-full min-w-[420px] text-left text-[16px]">
      <thead className="text-[14.5px] text-ink-3">
        <tr>
          <th className="py-1 pr-2 font-semibold">연결</th>
          <th className="py-1 pr-2 font-semibold">선행 예상 종료</th>
          <th className="py-1 pr-2 font-semibold">도착</th>
          <th className="py-1 pr-2 font-semibold">여유</th>
          <th className="py-1 font-semibold">판정</th>
        </tr>
      </thead>
      <tbody>
        {r.links.map((l) => (
          <tr key={l.key} className="border-t border-line tabular-nums">
            <td className="py-1.5 pr-2 font-semibold whitespace-nowrap">
              {l.prev.title}→{l.next.title}
            </td>
            <td className="py-1.5 pr-2 whitespace-nowrap">{l.prev.expectedEnd}</td>
            <td className="py-1.5 pr-2">{l.arrival ?? "-"}</td>
            <td className={`py-1.5 pr-2 ${l.slack !== null && l.slack < 0 ? "font-bold text-danger" : ""}`}>{l.slack === null ? "-" : `${l.slack}분`}</td>
            <td className="py-1.5">
              <Badge tone={gradeTone(l)} className="!text-[14.5px]">
                {gradeLabel(l)}
              </Badge>
              {gradeRank(l.grade) >= 2 && <span className="ml-1 text-[14px] text-ink-3">{l.cause}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
