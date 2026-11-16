"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HardHat, PhoneCall } from "lucide-react";
import { newOpId } from "@/lib/pilot/op-id";
import { kst } from "@/lib/pilot/time";
import { preparePhoto, uploadPhoto } from "@/lib/pilot/photo";
import { SAFETY_ITEMS, SAFETY_STAGES, STAGE_LABEL, itemLabel, type ReviewStatus, type SafetyAnswer, type SafetyCheckRow, type SafetyReviewRow, type SafetyStage } from "@/lib/pilot/safety";
import type { PhotoRow } from "@/lib/pilot/cases";
import { attachSafetyPhotoAction, safetyReviewAction, submitSafetyAction } from "../safety/actions";
import { btn, cx, Notice, Pill, type PillTone } from "../_ui/ds";
import { PhotoPicker, uploadEach, usePhotos, type PhotoItem } from "../_ui/PhotoPicker";

export interface FieldSafety {
  c: SafetyCheckRow;
  reviews: SafetyReviewRow[];
  photos: (PhotoRow & { url: string | null })[];
}

const TONE: Record<ReviewStatus, PillTone> = {
  "확인 대기": "warning",
  "적합(육안 확인)": "success",
  "보완 요청": "danger",
  "보완 제출": "info",
  "조치 완료": "success",
};

/** 대기·실패 사진만 올린다 — 실패하면 오류를 던져 '다시 올리기'를 안내한다 */
async function uploadAll(userId: string, checkId: string, items: PhotoItem[], patch: (key: string, p: Partial<PhotoItem>) => void) {
  const r = await uploadEach(items, patch, async (f) => {
    const p = await preparePhoto(f);
    const up = await uploadPhoto(userId, `safety-${checkId}`, p);
    const a = await attachSafetyPhotoAction({ opId: newOpId(), checkId, path: up.path, mime: p.mime, size: up.size, sha256: up.sha256, exifRemoved: p.exifRemoved });
    if (!a.ok) throw new Error(a.error);
    return { exifRemoved: p.exifRemoved };
  });
  if (r.failed > 0) throw new Error(`사진 ${r.failed}장 실패`);
}

/** 현장기사 카드 안 — 작업 전 · 작업 중 · 작업 종료 안전점검 (착용 사진 + 필수 항목) · 관리자 보완 요청에 보완 제출 */
export function SafetyPanel({
  userId,
  scheduleId,
  checks,
  canCheck,
  openSignal = 0,
  openStage,
}: {
  userId: string;
  scheduleId: string;
  checks: FieldSafety[];
  canCheck: boolean;
  openSignal?: number;
  /** 열 단계 (작업 시작 · 종료 전 확인에서) — 이미 냈으면 아직 안 한 첫 단계 */
  openStage?: SafetyStage;
}) {
  const [stage, setStage] = useState<SafetyStage | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [seen, setSeen] = useState(0);
  const latest = (s: SafetyStage) => checks.filter((x) => x.c.stage === s).at(-1);
  // 첫 화면 '안전점검' 버튼 — 아직 안 한 첫 단계를 바로 연다
  if (openSignal > 0 && openSignal !== seen) {
    setSeen(openSignal);
    const next = openStage && !latest(openStage) ? openStage : SAFETY_STAGES.find((s) => !latest(s));
    if (canCheck && next) setStage(next);
  }
  return (
    <div className="space-y-3 rounded-2xl bg-[#f7f8fa] p-3.5" aria-label="안전점검">
      <p className="flex items-center gap-2 text-[16px] font-extrabold">
        <HardHat size={19} className="text-primary" /> 안전점검
        <span className="ml-auto text-[14.5px] font-semibold text-ink-3">{SAFETY_STAGES.filter((s) => latest(s)).length}/3 단계</span>
      </p>
      <div className="grid grid-cols-3 gap-2">
        {SAFETY_STAGES.map((s) => {
          const l = latest(s);
          return (
            <button
              key={s}
              disabled={!canCheck && !l}
              onClick={() => (setNotice(null), setStage(stage === s ? null : s))}
              aria-pressed={stage === s}
              className={cx(
                "flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-2xl bg-white px-1 text-[15.5px] font-bold transition-shadow disabled:opacity-40",
                stage === s ? "ring-2 ring-primary" : "ring-1 ring-line",
              )}
            >
              {STAGE_LABEL[s]}
              {l ? <Pill tone={TONE[l.c.review_status]} className="!text-[12.5px]">{l.c.review_status}</Pill> : <Pill tone="neutral" dot={false} className="!text-[12.5px]">미점검</Pill>}
            </button>
          );
        })}
      </div>
      {checks
        .filter((x) => x.c.review_status === "보완 요청")
        .map((x) => (
          <Supplement key={x.c.id} userId={userId} x={x} onDone={setNotice} />
        ))}
      {notice && <Notice kind="success">{notice}</Notice>}
      {stage && (
        <div className="space-y-2">
          {checks
            .filter((x) => x.c.stage === stage)
            .map((x) => (
              <p key={x.c.id} className="rounded-xl bg-white px-3 py-2 text-[15px] text-ink-2">
                {x.c.check_no} · {kst(x.c.recorded_at).time} 제출 · {x.c.review_status}
                {x.c.deficient.length > 0 && ` · 미흡 ${x.c.deficient.map(itemLabel).join(", ")}`}
                {x.reviews.filter((r) => r.source === "관리자").map((r) => ` · 본사 ${r.kind}${r.result ? ` ${r.result}` : ""}${r.message ? `: ${r.message}` : ""}`)}
              </p>
            ))}
          {canCheck && (
            <CheckSheet
              key={stage}
              userId={userId}
              scheduleId={scheduleId}
              stage={stage}
              onCancel={() => setStage(null)}
              onDone={(t) => {
                setStage(null);
                setNotice(t);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function CheckSheet({ userId, scheduleId, stage, onDone, onCancel }: { userId: string; scheduleId: string; stage: SafetyStage; onDone: (t: string) => void; onCancel: () => void }) {
  const router = useRouter();
  const [opId] = useState(newOpId);
  const items = SAFETY_ITEMS.filter((x) => x.stages.includes(stage));
  const [answers, setAnswers] = useState<Record<string, SafetyAnswer>>({});
  const photos = usePhotos(4);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ checkId: string; checkNo: string } | null>(null);
  const deficient = Object.entries(answers).filter(([, a]) => a === "미흡");
  const ready = items.filter((x) => x.required).every((x) => answers[x.key]) && photos.items.length > 0;

  async function send() {
    setBusy(true);
    setErr(null);
    try {
      let s = saved;
      if (!s) {
        const t = new Date().toISOString();
        const r = await submitSafetyAction({ opId, scheduleId, stage, items: Object.entries(answers).map(([key, answer]) => ({ key, answer })), note, pressedAt: t, sentAt: t });
        if (!r.ok) return setErr(r.error);
        s = { checkId: r.checkId, checkNo: r.checkNo };
        setSaved(s);
      }
      await uploadAll(userId, s.checkId, photos.items, photos.patch);
      router.refresh();
      onDone(`${STAGE_LABEL[stage]} ${s.checkNo} 제출 · 사진 ${photos.items.length}장 — 관리자가 사진을 눈으로 확인한 뒤 결과를 보냅니다.`);
    } catch {
      setErr(saved ? "점검은 저장됐지만 사진을 올리지 못했습니다 — 다시 눌러 사진을 올리세요." : "보내지 못했습니다 — 연결을 확인하고 다시 누르세요 (같은 점검으로 한 번만 저장).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-3.5" aria-label={STAGE_LABEL[stage]}>
      <ul className="divide-y divide-line">
        {items.map((it) => (
          <li key={it.key} className="space-y-2 py-2.5 first:pt-0" aria-label={it.label}>
            <span className="block text-[15.5px] font-bold">
              {it.label}
              {it.required && <span className="ml-1 text-[14px] text-danger">필수</span>}
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(["확인", "해당 없음", "미흡"] as SafetyAnswer[]).map((a) => (
                <button
                  key={a}
                  disabled={!!saved || (it.required && a === "해당 없음")}
                  onClick={() => setAnswers((v) => ({ ...v, [it.key]: a }))}
                  aria-pressed={answers[it.key] === a}
                  className={cx(
                    "min-h-[2.9rem] rounded-xl text-[15px] font-bold transition-colors disabled:opacity-30",
                    answers[it.key] === a ? (a === "미흡" ? "bg-danger text-white" : a === "확인" ? "bg-success text-white" : "bg-ink text-white") : "bg-[#eef0f3] text-ink-2",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {deficient.length > 0 && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-danger px-4 py-3 text-[15px] font-bold text-white">
          <PhoneCall size={19} className="mt-0.5 shrink-0" /> 미흡 항목이 있습니다 — 프로그램 확인을 기다리지 말고 작업을 멈추고 관리자·안전 책임자에게 직접 전화하세요. 이 점검은 기록용입니다.
        </p>
      )}
      <PhotoPicker items={photos.items} onAdd={photos.add} onRemove={photos.remove} max={4} disabled={busy} inputLabel="안전점검 사진" title="착용 사진" required hint="관리자가 사진을 눈으로 확인합니다 — 사진만으로 적합 처리되지 않습니다. 얼굴이 나오지 않게 착용 부위 위주로 찍어 주세요." />
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} disabled={!!saved} placeholder="메모 (선택)" aria-label="점검 메모" className="min-h-[3rem] w-full rounded-2xl bg-[#f3f4f6] px-4 text-[15.5px] outline-none focus:ring-2 focus:ring-primary" />
      {err && <Notice kind="error">{err}</Notice>}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button disabled={!ready || busy} onClick={() => void send()} className={btn("primary", "lg", true)}>
          {busy ? "보내는 중…" : saved ? "사진 다시 올리기" : `${STAGE_LABEL[stage]} 제출`}
        </button>
        <button onClick={onCancel} disabled={busy} className={btn("ghost", "lg")}>
          닫기
        </button>
      </div>
    </div>
  );
}

function Supplement({ userId, x, onDone }: { userId: string; x: FieldSafety; onDone: (t: string) => void }) {
  const router = useRouter();
  const [opId] = useState(newOpId);
  const [note, setNote] = useState("");
  const photos = usePhotos(4);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const req = x.reviews.filter((r) => r.source === "관리자" && r.message).at(-1);
  return (
    <div className="space-y-3 rounded-2xl bg-white p-3.5 ring-2 ring-danger/40" aria-label={`보완 요청 ${x.c.check_no}`}>
      <p className="text-[15.5px] font-bold text-danger">
        본사 보완 요청 ({STAGE_LABEL[x.c.stage]}): {req?.message}
      </p>
      <PhotoPicker items={photos.items} onAdd={photos.add} onRemove={photos.remove} max={4} disabled={busy} inputLabel="보완 사진" title="보완 사진" />
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="보완한 내용 (필수)" aria-label="보완한 내용" className="min-h-[3rem] w-full rounded-2xl bg-[#f3f4f6] px-4 text-[15.5px] outline-none focus:ring-2 focus:ring-primary" />
      {err && <Notice kind="error">{err}</Notice>}
      <button
        disabled={!note.trim() || busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await uploadAll(userId, x.c.id, photos.items, photos.patch);
            const r = await safetyReviewAction({ opId, checkId: x.c.id, kind: "보완 제출", message: note });
            if (!r.ok) return setErr(r.error);
            router.refresh();
            onDone(`${x.c.check_no} 보완 제출 — 관리자가 다시 확인합니다.`);
          } catch {
            setErr("보내지 못했습니다 — 다시 눌러 주세요.");
          } finally {
            setBusy(false);
          }
        }}
        className={btn("primary", "lg", true)}
      >
        {busy ? "보내는 중…" : "보완 제출"}
      </button>
    </div>
  );
}
