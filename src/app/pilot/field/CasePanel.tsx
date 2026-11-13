"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, CheckCircle2, Clock } from "lucide-react";
import { Badge, type Tone } from "@/components/ui";
import { newOpId } from "@/lib/pilot/op-id";
import { kst } from "@/lib/pilot/time";
import { preparePhoto, uploadPhoto } from "@/lib/pilot/photo";
import { RESOLUTIONS, STATUS_TEXT, isOpen, type CaseRow, type CaseStatus, type PhotoRow, type StepRow } from "@/lib/pilot/cases";
import { attachPhotoAction, caseEndAction, caseStepAction } from "../cases/actions";
import { CaseReport, type CaseTarget } from "../_ui/CaseReport";

export interface FieldCase {
  c: CaseRow;
  steps: StepRow[];
  photos: (PhotoRow & { url: string | null })[];
}

const TONE: Record<CaseStatus, Tone> = { 보고됨: "danger", 접수됨: "warning", "조치 중": "info", "현장 해결 보고": "info", 미해결: "danger", 해결: "success", 무효: "neutral" };
const hm = (iso: string | null) => (iso ? kst(iso).time : "모름");
const ADMIN_STEPS = ["접수", "담당자 배정", "지원 조치 결정", "현장 전달", "일정 조정", "예상 종료 변경", "해결 확인", "미해결 유지", "무효 처리"];

/** 현장기사 카드 안 — 문제 보고 버튼 · 이 현장의 사건(본사 조치 결과) · 사진 추가 · 예상 종료 다시 알림 · 해결 보고 */
export function CasePanel({ userId, target, cases, scenario, canReport }: { userId: string; target: CaseTarget; cases: FieldCase[]; scenario: boolean; canReport: boolean }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {cases.map((x) => (
        <MyCase key={x.c.id} userId={userId} x={x} target={target} onNotice={setNotice} />
      ))}
      {notice && (
        <p role="status" className="rounded-2xl bg-success-bg px-3.5 py-2.5 text-[16.5px] font-semibold text-success">
          {notice}
        </p>
      )}
      {open ? (
        <CaseReport
          userId={userId}
          target={target}
          scenario={scenario}
          onCancel={() => setOpen(false)}
          onDone={(t) => {
            setOpen(false);
            setNotice(t);
          }}
        />
      ) : (
        canReport && (
          <button
            onClick={() => (setNotice(null), setOpen(true))}
            className="flex min-h-[3.8rem] w-full items-center justify-center gap-2 rounded-2xl border-2 border-danger/50 bg-white text-[20px] font-extrabold text-danger active:scale-[0.99]"
          >
            <AlertTriangle size={25} /> 현장 문제 보고 · 지원 요청
          </button>
        )
      )}
    </div>
  );
}

function MyCase({ userId, x, target, onNotice }: { userId: string; x: FieldCase; target: CaseTarget; onNotice: (t: string) => void }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<"사진" | "종료" | "해결" | null>(null);
  const [opId, setOpId] = useState(newOpId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [end, setEnd] = useState(target.currentEnd);
  const [files, setFiles] = useState<File[]>([]);
  const c = x.c;
  const admin = x.steps.filter((s) => ADMIN_STEPS.includes(s.kind) && s.source === "관리자");
  const last = admin.at(-1);
  const live = isOpen(c);
  const pressed = () => new Date().toISOString();
  const finish = (t: string) => {
    setSheet(null);
    setOpId(newOpId());
    setMsg("");
    setRes(null);
    setFiles([]);
    onNotice(t);
    router.refresh();
  };

  async function run(f: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setBusy(true);
    setErr(null);
    try {
      const r = await f();
      if (!r.ok) setErr(r.error ?? "처리하지 못했습니다.");
      else finish(okText);
    } catch {
      setErr("서버에 연결하지 못했습니다. 다시 누르면 같은 요청으로 한 번만 저장됩니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`space-y-2 rounded-2xl border px-3.5 py-3 ${live ? "border-danger/35 bg-danger-bg/25" : "border-line bg-[#f7f8fa]"}`} aria-label={`사건 ${c.case_no}`}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[17px]">
        <b className="tabular-nums">{c.case_no}</b>
        <span className="font-semibold">{c.issue_type}</span>
        <Badge tone={TONE[c.status]} className="!py-0 !text-[14.5px]">
          {STATUS_TEXT[c.status]}
        </Badge>
        {c.urgency === "긴급" && <Badge tone="danger" className="!py-0 !text-[14.5px]">긴급</Badge>}
      </p>
      <p className="text-[15px] text-ink-2">
        보고 {hm(c.reported_at)} · 발견 {c.discovered_at ? hm(c.discovered_at) : "모름"}
        {c.expected_end && ` · 예상 종료 ${c.expected_end.slice(0, 5)}`}
        {c.needs.length > 0 && ` · 요청 ${c.needs.join(", ")}`}
      </p>
      {admin.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-white px-3 py-2" aria-label="본사 조치">
          {admin.map((s) => (
            <li key={s.id} className={`text-[16px] ${s === last ? "font-bold text-primary-dark" : "text-ink-2"}`}>
              본사 {s.kind}
              {s.action && ` — ${s.action}`}
              {s.assignee_name && ` — ${s.assignee_name}`}
              {s.message && `: ${s.message}`} <span className="text-[13.5px] font-normal text-ink-3">({hm(s.occurred_at)})</span>
            </li>
          ))}
        </ul>
      )}
      {x.photos.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="사건 사진">
          {x.photos.map((p) =>
            p.deleted_at || !p.url ? (
              <li key={p.id} className="rounded-lg bg-white px-2 py-1 text-[13px] text-ink-3">
                삭제된 사진 ({p.delete_reason})
              </li>
            ) : (
              <li key={p.id}>
                <a href={p.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 비공개 저장소의 서명 주소(10분) */}
                  <img src={p.url} alt={p.caption ?? "현장 사진"} className="h-16 w-16 rounded-lg border border-line object-cover" />
                </a>
              </li>
            ),
          )}
        </ul>
      )}
      {err && (
        <p role="alert" className="rounded-xl bg-danger-bg px-3 py-2 text-[15.5px] font-bold text-danger">
          {err}
        </p>
      )}

      {live && !sheet && (
        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={() => setSheet("사진")} className="inline-flex min-h-[3rem] items-center justify-center gap-1 rounded-xl bg-white text-[15.5px] font-bold text-ink-2">
            <Camera size={18} /> 사진 추가
          </button>
          <button onClick={() => setSheet("종료")} className="inline-flex min-h-[3rem] items-center justify-center gap-1 rounded-xl bg-white text-[15.5px] font-bold text-primary-dark">
            <Clock size={18} /> 예상 종료
          </button>
          <button onClick={() => setSheet("해결")} className="inline-flex min-h-[3rem] items-center justify-center gap-1 rounded-xl bg-white text-[15.5px] font-bold text-success">
            <CheckCircle2 size={18} /> 해결 보고
          </button>
        </div>
      )}

      {sheet === "사진" && (
        <div className="space-y-2 rounded-xl bg-white p-2.5" aria-label="사진 추가">
          <label className="inline-flex min-h-[3rem] cursor-pointer items-center gap-2 rounded-xl bg-[#e8f1fe] px-4 text-[16.5px] font-bold text-primary-dark">
            <Camera size={20} /> 사진 찍기 · 고르기 {files.length > 0 && `(${files.length}장)`}
            <input type="file" accept="image/*" capture="environment" multiple className="sr-only" aria-label="추가 사진" onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 6))} />
          </label>
          <Buttons
            busy={busy}
            disabled={files.length === 0}
            label="올리기"
            onCancel={() => setSheet(null)}
            onSend={() =>
              void run(async () => {
                for (const f of files) {
                  const p = await preparePhoto(f);
                  const up = await uploadPhoto(userId, c.id, p);
                  const r = await attachPhotoAction({ opId: newOpId(), caseId: c.id, path: up.path, mime: p.mime, size: up.size, sha256: up.sha256, exifRemoved: p.exifRemoved });
                  if (!r.ok) return r;
                }
                return { ok: true };
              }, `${c.case_no} 사진 ${files.length}장을 올렸습니다.`)
            }
          />
        </div>
      )}

      {sheet === "종료" && (
        <div className="space-y-2 rounded-xl bg-white p-2.5" aria-label="예상 종료 다시 알림">
          <label className="block">
            <span className="block text-[15px] font-semibold text-ink-2">새 예상 종료</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="새 예상 종료" className="min-h-[3rem] w-full rounded-xl border border-line px-3 text-[20px]" />
          </label>
          <Buttons
            busy={busy}
            disabled={!/^\d{2}:\d{2}$/.test(end)}
            label="보내기"
            onCancel={() => setSheet(null)}
            onSend={() =>
              void run(() => caseEndAction({ opId, caseId: c.id, expectedEnd: end, moment: { mode: "즉시", pressedAt: pressed(), sentAt: pressed() } }), `${c.case_no} 예상 종료 ${end} 전달 — 후속 현장 위험을 다시 계산했습니다.`)
            }
          />
        </div>
      )}

      {sheet === "해결" && (
        <div className="space-y-2 rounded-xl bg-white p-2.5" aria-label="해결 보고">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="해결 여부">
            {RESOLUTIONS.map((r) => (
              <button key={r} role="radio" aria-checked={res === r} onClick={() => setRes(r)} className={`min-h-[3rem] rounded-xl px-3.5 text-[17px] font-bold ${res === r ? "bg-ink text-white" : "bg-[#f2f4f6] text-ink-2"}`}>
                {r}
              </button>
            ))}
          </div>
          <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="내용 (선택)" aria-label="해결 내용" className="min-h-[3rem] w-full rounded-xl border border-line px-3 text-[17px]" />
          <Buttons
            busy={busy}
            disabled={!res}
            label="해결 보고 보내기"
            onCancel={() => setSheet(null)}
            onSend={() =>
              void run(
                () => caseStepAction({ opId, caseId: c.id, kind: "현장 해결 보고", resolution: res, message: msg, moment: { mode: "즉시", pressedAt: pressed(), sentAt: pressed() } }),
                `${c.case_no} ${res} 보고됨 — 본사 확인 후 종결됩니다.`,
              )
            }
          />
        </div>
      )}
    </section>
  );
}

function Buttons({ busy, disabled, label, onSend, onCancel }: { busy: boolean; disabled: boolean; label: string; onSend: () => void; onCancel: () => void }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-1.5">
      <button disabled={disabled || busy} onClick={onSend} className="min-h-[3.2rem] rounded-xl bg-primary text-[18px] font-extrabold text-white disabled:opacity-40">
        {busy ? "보내는 중…" : label}
      </button>
      <button disabled={busy} onClick={onCancel} className="rounded-xl bg-[#f2f4f6] px-3.5 text-[16px] font-bold text-ink-2">
        닫기
      </button>
    </div>
  );
}
