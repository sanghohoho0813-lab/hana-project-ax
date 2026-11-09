"use client";

import { useRef, useState } from "react";
import { CalendarPlus, Pencil, RotateCw, XCircle } from "lucide-react";
import { Badge, Field, GhostButton, PrimaryButton, inputClass, type Tone } from "@/components/ui";
import type { DataKind, ScheduleProgress } from "@/lib/pilot/core";
import type { ScheduleView } from "@/lib/pilot/board";
import { cancelScheduleAction, reprocessAction, saveScheduleAction, type OpResult } from "./actions";
import { useOp } from "../_ui/useOp";
import { Feedback } from "../_ui/Feedback";

export interface BoardRow {
  s: ScheduleView;
  phase: ScheduleProgress["phase"];
  travelFromTitle: string | null;
  /** 이동시간을 넣은 뒤 순서가 바뀌어 출발 현장이 지금 직전 일정과 다름 */
  stale: boolean;
  /** 이동 기준을 흔드는 취소 일정(현장 이름) — 엔진 R7 판단 보류 원인 */
  cancelledBefore: string[];
  events: number;
}

interface Props {
  date: string;
  kind: DataKind;
  staff: { id: string; name: string }[];
  names: Record<string, string>;
  rows: BoardRow[];
  pending: number;
}

const PHASE_TONE: Record<ScheduleProgress["phase"], Tone> = {
  예정: "neutral",
  확인함: "info",
  "작업 중": "warning",
  "작업 종료": "success",
  취소: "neutral",
};
const PRIORITY_TONE: Record<string, Tone> = { 긴급: "danger", 보통: "neutral", 낮음: "neutral" };

function ScheduleForm({ date, kind, staff, initial, onDone }: Omit<Props, "rows" | "names" | "pending"> & { initial?: ScheduleView; onDone?: (r?: OpResult) => void }) {
  const form = useRef<HTMLFormElement>(null);
  const { run, busy, result } = useOp();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("data_kind", kind);
    fd.set("work_date", date);
    if (initial) {
      fd.set("schedule_id", initial.id);
      fd.set("expected_version", String(initial.version));
    }
    const r = await run((opId) => {
      fd.set("op_id", opId);
      return saveScheduleAction(fd);
    });
    if (r.ok && !initial) form.current?.reset();
    if (r.ok && initial) onDone?.(r);
  };
  const t = (v?: string) => v?.slice(0, 5);
  return (
    <form ref={form} onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="담당 현장 직원" required>
          <select name="assignee_id" required defaultValue={initial?.assignee_id ?? ""} className={inputClass}>
            <option value="" disabled>
              고르세요
            </option>
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="현장 이름" required>
          <input name="site_name" required maxLength={60} defaultValue={initial?.site_name} className={inputClass} />
        </Field>
        <Field label="지역">
          <input name="region" maxLength={40} defaultValue={initial?.region} className={inputClass} />
        </Field>
        <Field label="업무 중요도">
          <select name="priority" defaultValue={initial?.priority ?? "보통"} className={inputClass}>
            <option>긴급</option>
            <option>보통</option>
            <option>낮음</option>
          </select>
        </Field>
        <Field label="예정 시작" required>
          <input name="planned_start" type="time" required defaultValue={t(initial?.planned_start)} className={inputClass} />
        </Field>
        <Field label="예정 종료" required>
          <input name="planned_end" type="time" required defaultValue={t(initial?.planned_end)} className={inputClass} />
        </Field>
        <Field label="직전 현장에서 이동시간(분)" hint="그날 첫 일정이면 비움">
          <input name="travel_minutes" type="number" min={0} max={600} inputMode="numeric" defaultValue={initial?.travel_minutes ?? ""} className={inputClass} />
        </Field>
        <Field label="메모">
          <input name="note" maxLength={200} defaultValue={initial?.note ?? ""} className={inputClass} />
        </Field>
      </div>
      <p className="text-[15.5px] text-ink-3">
        이동시간은 관리자가 넣는 값입니다 (실시간 교통정보 아님) · 저장하면 지금 이 직원의 직전 일정에서 출발하는 값으로 기록됩니다 · 저장할 때마다 위험 판단 전후가 기록됩니다.
      </p>
      <Feedback result={result} />
      <div className="flex flex-wrap gap-2">
        <PrimaryButton disabled={busy}>{busy ? "저장 중…" : initial ? "고친 내용 저장" : "일정 등록"}</PrimaryButton>
        {onDone && (
          <GhostButton type="button" onClick={() => onDone()}>
            닫기
          </GhostButton>
        )}
      </div>
    </form>
  );
}

function CancelForm({ s, onDone }: { s: ScheduleView; onDone: (r?: OpResult) => void }) {
  const { run, busy, result } = useOp();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("schedule_id", s.id);
    fd.set("expected_version", String(s.version));
    const r = await run((opId) => {
      fd.set("op_id", opId);
      return cancelScheduleAction(fd);
    });
    if (r.ok) onDone(r);
  };
  return (
    <form onSubmit={submit} className="space-y-2 rounded-2xl bg-danger-bg/40 p-4">
      <p className="text-[17.5px] font-bold text-danger">{s.site_name} 일정을 취소합니다 — 기록은 지워지지 않고 &lsquo;취소&rsquo;로 남습니다.</p>
      <Field label="취소 사유">
        <input name="reason" maxLength={200} className={inputClass} />
      </Field>
      <Feedback result={result} />
      <div className="flex gap-2">
        <PrimaryButton disabled={busy} className="!bg-danger">
          {busy ? "취소 중…" : "일정 취소"}
        </PrimaryButton>
        <GhostButton type="button" onClick={() => onDone()}>
          닫기
        </GhostButton>
      </div>
    </form>
  );
}

export function ScheduleBoard({ date, kind, staff, names, rows, pending }: Props) {
  const [open, setOpen] = useState<{ id: string; mode: "edit" | "cancel" } | null>(null);
  const [adding, setAdding] = useState(rows.length === 0);
  const re = useOp();
  const [last, setLast] = useState<OpResult | null>(null);
  const close = (r?: OpResult) => {
    setOpen(null);
    if (r) setLast(r);
  };

  const recheck = rows.filter((r) => r.cancelledBefore.length > 0 || r.stale);
  const workers = [...new Set([...staff.map((p) => p.id), ...rows.map((r) => r.s.assignee_id)])].filter((id) => rows.some((r) => r.s.assignee_id === id));

  return (
    <section className="space-y-3" aria-label="일정">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[24px] font-extrabold">
          {date} 일정 <span className="text-[18px] font-semibold text-ink-3">{rows.filter((r) => r.s.status === "예정").length}건 · 취소 {rows.filter((r) => r.s.status === "취소").length}건</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {pending > 0 && (
            <button
              onClick={async () => setLast(await re.run(() => reprocessAction()))}
              disabled={re.busy}
              className="inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl bg-warning-bg px-3.5 text-[17px] font-bold text-warning"
            >
              <RotateCw size={17} /> 기록 대기 판단 {pending}건 다시 처리
            </button>
          )}
          <GhostButton onClick={() => setAdding((v) => !v)}>
            <CalendarPlus size={20} /> {adding ? "등록 닫기" : "일정 등록"}
          </GhostButton>
        </div>
      </div>
      <Feedback result={last} />
      {recheck.length > 0 && (
        <div className="rounded-2xl border border-warning/40 bg-warning-bg/50 px-4 py-3 text-[17px]">
          <p className="font-bold text-warning">이동 기준 재확인 필요 {recheck.length}건</p>
          <ul className="mt-0.5 text-ink-2">
            {recheck.map((r) => (
              <li key={r.s.id}>
                · {names[r.s.assignee_id] ?? ""} {r.s.site_name}:{" "}
                {r.cancelledBefore.length > 0
                  ? `앞 일정(${r.cancelledBefore.join(", ")}) 취소 — 실제 이동 출발지와 이동시간을 확인해 주세요. 현재 규칙(R7)에서는 이 연결을 판단 보류로 둡니다.`
                  : "이동시간을 넣은 뒤 직전 일정이 바뀌었습니다 — 이동시간을 다시 저장해 주세요."}
              </li>
            ))}
          </ul>
        </div>
      )}

      {adding && (
        <div className="card p-5">
          {staff.length === 0 ? (
            <p className="text-[18px] text-ink-2">활성화된 현장 직원이 없습니다. 계정 메뉴에서 현장 직원을 활성화하세요.</p>
          ) : (
            <ScheduleForm date={date} kind={kind} staff={staff} />
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="card px-5 py-5 text-[18.5px] text-ink-3">이 날짜에 등록된 일정이 없습니다.</p>
      ) : (
        workers.map((w) => (
          <div key={w} className="card overflow-x-auto p-4">
            <p className="mb-2 text-[20px] font-bold">{names[w] ?? "알 수 없는 직원"}</p>
            <table className="w-full min-w-[46rem] text-left text-[17px]">
              <thead className="text-[15.5px] text-ink-3">
                <tr>
                  <th className="py-1 pr-3 font-semibold">예정</th>
                  <th className="py-1 pr-3 font-semibold">현장</th>
                  <th className="py-1 pr-3 font-semibold">이동시간</th>
                  <th className="py-1 pr-3 font-semibold">중요도</th>
                  <th className="py-1 pr-3 font-semibold">진행</th>
                  <th className="py-1 pr-3 font-semibold">수정본</th>
                  <th className="py-1 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => r.s.assignee_id === w)
                  .map((r) => (
                    <Row key={r.s.id} r={r} open={open} setOpen={setOpen} close={close} date={date} kind={kind} staff={staff} />
                  ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </section>
  );
}

function Row({
  r,
  open,
  setOpen,
  close,
  date,
  kind,
  staff,
}: {
  r: BoardRow;
  open: { id: string; mode: "edit" | "cancel" } | null;
  setOpen: (v: { id: string; mode: "edit" | "cancel" } | null) => void;
  close: (r?: OpResult) => void;
  date: string;
  kind: DataKind;
  staff: { id: string; name: string }[];
}) {
  const s = r.s;
  const cancelled = s.status === "취소";
  const mine = open?.id === s.id ? open.mode : null;
  return (
    <>
      <tr className={`border-t border-line align-top ${cancelled ? "text-ink-3 line-through decoration-ink-3/40" : ""}`}>
        <td className="py-2 pr-3 font-semibold whitespace-nowrap tabular-nums">
          {s.planned_start.slice(0, 5)}~{s.planned_end.slice(0, 5)}
        </td>
        <td className="py-2 pr-3">
          <span className="font-bold">{s.site_name}</span>
          {s.region && <span className="ml-1.5 text-ink-3">{s.region}</span>}
          {s.note && <span className="block text-[15px] text-ink-3 no-underline">{s.note}</span>}
        </td>
        <td className="py-2 pr-3">
          {s.travel_minutes === null ? (
            <span className="text-ink-3">없음</span>
          ) : (
            <>
              {s.travel_minutes}분<span className="block text-[15px] text-ink-3">{r.travelFromTitle ? `${r.travelFromTitle}에서` : "출발 현장 없음"}</span>
            </>
          )}
          {r.cancelledBefore.length > 0 ? (
            <span className="mt-0.5 block text-[15px] font-bold text-warning no-underline">
              취소된 일정({r.cancelledBefore.join(", ")}) — 이동 출발지·이동시간 재확인 필요 · 이 연결은 판단 보류(R7)
            </span>
          ) : (
            r.stale && <span className="mt-0.5 block text-[15px] font-bold text-warning no-underline">직전 일정이 바뀜 — 이동시간을 다시 저장해 주세요</span>
          )}
        </td>
        <td className="py-2 pr-3">
          <Badge tone={PRIORITY_TONE[s.priority]}>{s.priority}</Badge>
        </td>
        <td className="py-2 pr-3">
          <Badge tone={PHASE_TONE[r.phase]}>{r.phase}</Badge>
          <span className="block text-[15px] text-ink-3">작업 기록 {r.events}건</span>
        </td>
        <td className="py-2 pr-3 text-ink-3 tabular-nums">{s.version}</td>
        <td className="py-2 text-right whitespace-nowrap">
          {!cancelled && (
            <span className="inline-flex gap-1.5">
              <button onClick={() => setOpen(mine === "edit" ? null : { id: s.id, mode: "edit" })} className="inline-flex items-center gap-1 rounded-lg bg-[#f2f4f6] px-2.5 py-1 font-semibold text-ink-2 hover:bg-[#e8ebee]">
                <Pencil size={15} /> 고치기
              </button>
              <button onClick={() => setOpen(mine === "cancel" ? null : { id: s.id, mode: "cancel" })} className="inline-flex items-center gap-1 rounded-lg bg-[#f2f4f6] px-2.5 py-1 font-semibold text-danger hover:bg-[#e8ebee]">
                <XCircle size={15} /> 취소
              </button>
            </span>
          )}
          {cancelled && <Badge tone="neutral">취소됨</Badge>}
        </td>
      </tr>
      {mine && (
        <tr>
          <td colSpan={7} className="pb-3">
            {mine === "edit" ? (
              <div className="rounded-2xl border border-line p-4">
                <ScheduleForm date={date} kind={kind} staff={staff} initial={s} onDone={close} />
              </div>
            ) : (
              <CancelForm s={s} onDone={close} />
            )}
          </td>
        </tr>
      )}
    </>
  );
}
