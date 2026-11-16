"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, CheckCircle2, Clock, Megaphone } from "lucide-react";
import { newOpId } from "@/lib/pilot/op-id";
import { kst } from "@/lib/pilot/time";
import { preparePhoto, uploadPhoto } from "@/lib/pilot/photo";
import { RESOLUTIONS, STATUS_TEXT, isOpen, type CaseRow, type CaseStatus, type PhotoRow, type StepRow } from "@/lib/pilot/cases";
import { attachPhotoAction, caseEndAction, caseStepAction } from "../cases/actions";
import { CaseReport, type CaseTarget } from "../_ui/CaseReport";
import { btn, chip, cx, Notice, Pill, type PillTone } from "../_ui/ds";
import { PhotoPicker, uploadEach, usePhotos } from "../_ui/PhotoPicker";

export interface FieldCase {
  c: CaseRow;
  steps: StepRow[];
  photos: (PhotoRow & { url: string | null })[];
}

const TONE: Record<CaseStatus, PillTone> = { 보고됨: "danger", 접수됨: "warning", "조치 중": "info", "현장 해결 보고": "info", 미해결: "danger", 해결: "success", 무효: "neutral" };
const hm = (iso: string | null) => (iso ? kst(iso).time : "모름");
const ADMIN_STEPS = ["접수", "담당자 배정", "지원 조치 결정", "현장 전달", "일정 조정", "예상 종료 변경", "해결 확인", "미해결 유지", "무효 처리"];

/** 본사(관리자)가 남긴 조치 단계 — 현장 카드와 첫 화면 '본사에서 온 소식'이 같이 쓴다 */
export const adminSteps = (x: FieldCase) => x.steps.filter((s) => ADMIN_STEPS.includes(s.kind) && s.source === "관리자");

/** 현장기사 카드 안 — 문제 보고 버튼 · 이 현장의 사건(본사 조치 결과) · 사진 추가 · 예상 종료 다시 알림 · 해결 보고 */
export function CasePanel({
  userId,
  target,
  cases,
  scenario,
  canReport,
  focus = null,
}: {
  userId: string;
  target: CaseTarget;
  cases: FieldCase[];
  scenario: boolean;
  canReport: boolean;
  /** 첫 화면 빠른 버튼: 보고 열기 · 진행 중 사건에 사진 추가 (진행 중 사건이 없으면 보고 열기) */
  focus?: { act: "report" | "photo"; n: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [seen, setSeen] = useState(0);
  const firstLive = cases.find((x) => isOpen(x.c));
  // 빠른 버튼 신호가 바뀌면 한 번만 연다 (렌더 중 상태 맞추기 — effect 없이)
  if (focus && focus.n !== seen) {
    setSeen(focus.n);
    if ((focus.act === "report" || !firstLive) && canReport) setOpen(true);
  }
  return (
    <div className="space-y-2.5">
      {cases.map((x) => (
        <MyCase key={x.c.id} userId={userId} x={x} target={target} onNotice={setNotice} photoSignal={focus?.act === "photo" && x === firstLive ? focus.n : 0} />
      ))}
      {notice && <Notice kind="success">{notice}</Notice>}
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
            className="flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-2xl bg-danger-bg text-[17px] font-extrabold text-danger transition-colors hover:bg-[#fde3e3] active:scale-[0.99]"
          >
            <AlertTriangle size={21} /> 현장 문제 보고 · 지원 요청
          </button>
        )
      )}
    </div>
  );
}

function MyCase({ userId, x, target, onNotice, photoSignal }: { userId: string; x: FieldCase; target: CaseTarget; onNotice: (t: string) => void; photoSignal: number }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<"사진" | "종료" | "해결" | null>(null);
  const [seen, setSeen] = useState(0);
  if (photoSignal > 0 && photoSignal !== seen) {
    setSeen(photoSignal);
    setSheet("사진");
  }
  const [opId, setOpId] = useState(newOpId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [end, setEnd] = useState(target.currentEnd);
  const photos = usePhotos(6);
  const c = x.c;
  const admin = adminSteps(x);
  const last = admin.at(-1);
  const live = isOpen(c);
  const pressed = () => new Date().toISOString();
  const finish = (t: string) => {
    setSheet(null);
    setOpId(newOpId());
    setMsg("");
    setRes(null);
    photos.reset();
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
    <section id={`case-${c.id}`} className={cx("scroll-mt-20 space-y-3 rounded-2xl p-3.5", live ? "bg-white ring-1 ring-danger/25" : "bg-[#f7f8fa]")} aria-label={`사건 ${c.case_no}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <Pill tone={TONE[c.status]}>{STATUS_TEXT[c.status]}</Pill>
        {c.urgency === "긴급" && <Pill tone="danger">긴급</Pill>}
        <span className="text-[13px] font-semibold text-ink-3 tabular-nums">{c.case_no}</span>
      </div>
      <div>
        <p className="text-[17px] font-extrabold">{c.issue_type}</p>
        <p className="text-[14.5px] text-ink-3">
          보고 {hm(c.reported_at)} · 발견 {c.discovered_at ? hm(c.discovered_at) : "모름"}
          {c.expected_end && ` · 예상 종료 ${c.expected_end.slice(0, 5)}`}
          {c.needs.length > 0 && ` · 요청 ${c.needs.join(", ")}`}
        </p>
      </div>
      {admin.length > 0 && (
        <ul className="space-y-1.5 rounded-2xl bg-primary-light/60 px-3.5 py-3" aria-label="본사 조치">
          {admin.map((s) => (
            <li key={s.id} className={cx("flex gap-2 text-[15px] leading-snug", s === last ? "font-bold text-primary-dark" : "text-ink-2")}>
              {s === last ? <Megaphone size={16} className="mt-0.5 shrink-0" /> : <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-3" />}
              <span>
                본사 {s.kind}
                {s.action && ` — ${s.action}`}
                {s.assignee_name && ` — ${s.assignee_name}`}
                {s.message && `: ${s.message}`} <span className="text-[12.5px] font-normal text-ink-3">({hm(s.occurred_at)})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {x.photos.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="사건 사진">
          {x.photos.map((p) =>
            p.deleted_at || !p.url ? (
              <li key={p.id} className="rounded-xl bg-[#eef0f3] px-2.5 py-1.5 text-[12.5px] text-ink-3">
                삭제된 사진 ({p.delete_reason})
              </li>
            ) : (
              <li key={p.id}>
                <a href={p.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 비공개 저장소의 서명 주소(10분) */}
                  <img src={p.url} alt={p.caption ?? "현장 사진"} className="h-[4.5rem] w-[4.5rem] rounded-xl object-cover" />
                </a>
              </li>
            ),
          )}
        </ul>
      )}
      {err && <Notice kind="error">{err}</Notice>}

      {live && !sheet && (
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => setSheet("사진")} className={btn("ghost", "lg")}>
            <Camera size={18} /> 사진 추가
          </button>
          <button onClick={() => setSheet("종료")} className={btn("soft", "lg")}>
            <Clock size={18} /> 예상 종료
          </button>
          <button onClick={() => setSheet("해결")} className={cx(btn("ghost", "lg"), "!bg-success-bg !text-success")}>
            <CheckCircle2 size={18} /> 해결 보고
          </button>
        </div>
      )}

      {sheet === "사진" && (
        <div className="space-y-3 rounded-2xl bg-[#f7f8fa] p-3" aria-label="사진 추가">
          <PhotoPicker items={photos.items} onAdd={photos.add} onRemove={photos.remove} disabled={busy} inputLabel="추가 사진" title="사진 추가" />
          <Buttons
            busy={busy}
            disabled={photos.items.length === 0}
            label={photos.items.some((p) => p.status === "실패") ? "실패한 사진 다시 올리기" : "올리기"}
            onCancel={() => setSheet(null)}
            onSend={() =>
              void run(async () => {
                const r = await uploadEach(photos.items, photos.patch, async (f) => {
                  const p = await preparePhoto(f);
                  const up = await uploadPhoto(userId, c.id, p);
                  const a = await attachPhotoAction({ opId: newOpId(), caseId: c.id, path: up.path, mime: p.mime, size: up.size, sha256: up.sha256, exifRemoved: p.exifRemoved });
                  if (!a.ok) throw new Error(a.error);
                  return { exifRemoved: p.exifRemoved };
                });
                return r.failed > 0 ? { ok: false, error: `사진 ${r.failed}장을 올리지 못했습니다 — 다시 누르면 실패한 사진만 다시 올립니다.` } : { ok: true };
              }, `${c.case_no} 사진 ${photos.items.length}장을 올렸습니다.`)
            }
          />
        </div>
      )}

      {sheet === "종료" && (
        <div className="space-y-3 rounded-2xl bg-[#f7f8fa] p-3" aria-label="예상 종료 다시 알림">
          <label className="block">
            <span className="mb-1 block text-[14px] font-bold text-ink-3">새 예상 종료</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="새 예상 종료" className="min-h-[3.25rem] w-full rounded-2xl bg-white px-4 text-[20px] tabular-nums ring-1 ring-line outline-none focus:ring-2 focus:ring-primary" />
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
        <div className="space-y-3 rounded-2xl bg-[#f7f8fa] p-3" aria-label="해결 보고">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="해결 여부">
            {RESOLUTIONS.map((r) => (
              <button key={r} role="radio" aria-checked={res === r} onClick={() => setRes(r)} className={cx(chip(res === r), "min-h-[3.25rem] rounded-2xl")}>
                {r}
              </button>
            ))}
          </div>
          <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="내용 (선택)" aria-label="해결 내용" className="min-h-[3rem] w-full rounded-2xl bg-white px-4 text-[16px] ring-1 ring-line outline-none focus:ring-2 focus:ring-primary" />
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
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <button disabled={disabled || busy} onClick={onSend} className={btn("primary", "lg", true)}>
        {busy ? "보내는 중…" : label}
      </button>
      <button disabled={busy} onClick={onCancel} className={btn("ghost", "lg")}>
        닫기
      </button>
    </div>
  );
}
