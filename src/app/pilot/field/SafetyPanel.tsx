"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, HardHat, PhoneCall } from "lucide-react";
import { newOpId } from "@/lib/pilot/op-id";
import { kst } from "@/lib/pilot/time";
import { preparePhoto, uploadPhoto } from "@/lib/pilot/photo";
import { SAFETY_ITEMS, SAFETY_STAGES, STAGE_LABEL, itemLabel, type ReviewStatus, type SafetyAnswer, type SafetyCheckRow, type SafetyReviewRow, type SafetyStage } from "@/lib/pilot/safety";
import type { PhotoRow } from "@/lib/pilot/cases";
import { attachSafetyPhotoAction, safetyReviewAction, submitSafetyAction } from "../safety/actions";

export interface FieldSafety {
  c: SafetyCheckRow;
  reviews: SafetyReviewRow[];
  photos: (PhotoRow & { url: string | null })[];
}

const TONE: Record<ReviewStatus, string> = {
  "확인 대기": "bg-warning-bg text-warning",
  "적합(육안 확인)": "bg-success-bg text-success",
  "보완 요청": "bg-danger text-white",
  "보완 제출": "bg-[#e8f1fe] text-[#1b64da]",
  "조치 완료": "bg-success-bg text-success",
};

async function uploadAll(userId: string, checkId: string, files: File[]) {
  for (const f of files) {
    const p = await preparePhoto(f);
    const up = await uploadPhoto(userId, `safety-${checkId}`, p);
    const r = await attachSafetyPhotoAction({ opId: newOpId(), checkId, path: up.path, mime: p.mime, size: up.size, sha256: up.sha256, exifRemoved: p.exifRemoved });
    if (!r.ok) throw new Error(r.error);
  }
}

/** 현장기사 카드 안 — 작업 전 · 작업 중 · 작업 종료 안전점검 (착용 사진 + 필수 항목) · 관리자 보완 요청에 보완 제출 */
export function SafetyPanel({ userId, scheduleId, checks, canCheck }: { userId: string; scheduleId: string; checks: FieldSafety[]; canCheck: boolean }) {
  const [stage, setStage] = useState<SafetyStage | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const latest = (s: SafetyStage) => checks.filter((x) => x.c.stage === s).at(-1);
  return (
    <div className="space-y-2 rounded-2xl bg-[#f7f8fa] p-3" aria-label="안전점검">
      <p className="flex items-center gap-1.5 text-[17px] font-extrabold">
        <HardHat size={20} /> 안전점검
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {SAFETY_STAGES.map((s) => {
          const l = latest(s);
          return (
            <button
              key={s}
              disabled={!canCheck && !l}
              onClick={() => (setNotice(null), setStage(stage === s ? null : s))}
              aria-pressed={stage === s}
              className={`flex min-h-[3.6rem] flex-col items-center justify-center rounded-xl border px-1 text-[15.5px] font-bold ${stage === s ? "border-ink bg-white" : "border-line bg-white"} disabled:opacity-40`}
            >
              {STAGE_LABEL[s]}
              <span className={`mt-0.5 rounded-full px-1.5 text-[12.5px] ${l ? TONE[l.c.review_status] : "bg-[#f2f4f6] text-ink-3"}`}>{l ? l.c.review_status : "미점검"}</span>
            </button>
          );
        })}
      </div>
      {checks
        .filter((x) => x.c.review_status === "보완 요청")
        .map((x) => (
          <Supplement key={x.c.id} userId={userId} x={x} onDone={setNotice} />
        ))}
      {notice && (
        <p role="status" className="rounded-xl bg-success-bg px-3 py-2 text-[16px] font-semibold text-success">
          {notice}
        </p>
      )}
      {stage && (
        <div className="space-y-2">
          {checks
            .filter((x) => x.c.stage === stage)
            .map((x) => (
              <p key={x.c.id} className="text-[14.5px] text-ink-2">
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
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ checkId: string; checkNo: string } | null>(null);
  const deficient = Object.entries(answers).filter(([, a]) => a === "미흡");
  const ready = items.filter((x) => x.required).every((x) => answers[x.key]) && files.length > 0;

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
      await uploadAll(userId, s.checkId, files);
      router.refresh();
      onDone(`${STAGE_LABEL[stage]} ${s.checkNo} 제출 · 사진 ${files.length}장 — 관리자가 사진을 눈으로 확인한 뒤 결과를 보냅니다.`);
    } catch {
      setErr(saved ? "점검은 저장됐지만 사진을 올리지 못했습니다 — 다시 눌러 사진을 올리세요." : "보내지 못했습니다 — 연결을 확인하고 다시 누르세요 (같은 점검으로 한 번만 저장).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border-2 border-ink/20 bg-white p-3" aria-label={STAGE_LABEL[stage]}>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.key} className="flex flex-wrap items-center gap-1.5" aria-label={it.label}>
            <span className="min-w-[8.5rem] flex-1 text-[16px] font-semibold">
              {it.label}
              {it.required && <span className="text-danger"> *</span>}
            </span>
            {(["확인", "해당 없음", "미흡"] as SafetyAnswer[]).map((a) => (
              <button
                key={a}
                disabled={!!saved || (it.required && a === "해당 없음")}
                onClick={() => setAnswers((v) => ({ ...v, [it.key]: a }))}
                aria-pressed={answers[it.key] === a}
                className={`min-h-[2.7rem] rounded-lg px-2.5 text-[15px] font-bold disabled:opacity-30 ${answers[it.key] === a ? (a === "미흡" ? "bg-danger text-white" : "bg-ink text-white") : "bg-[#f2f4f6] text-ink-2"}`}
              >
                {a}
              </button>
            ))}
          </li>
        ))}
      </ul>
      {deficient.length > 0 && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger px-3 py-2.5 text-[16px] font-bold text-white">
          <PhoneCall size={19} className="mt-0.5 shrink-0" /> 미흡 항목이 있습니다 — 프로그램 확인을 기다리지 말고 작업을 멈추고 관리자·안전 책임자에게 직접 전화하세요. 이 점검은 기록용입니다.
        </p>
      )}
      <label className="inline-flex min-h-[3rem] cursor-pointer items-center gap-2 rounded-xl bg-[#e8f1fe] px-4 text-[16.5px] font-bold text-primary-dark">
        <Camera size={20} /> 착용 사진 {files.length > 0 ? `${files.length}장` : "(1장 이상 필수)"}
        <input type="file" accept="image/*" capture="environment" multiple className="sr-only" aria-label="안전점검 사진" disabled={busy} onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 4))} />
      </label>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} disabled={!!saved} placeholder="메모 (선택)" aria-label="점검 메모" className="min-h-[2.8rem] w-full rounded-xl border border-line px-3 text-[16px]" />
      <p className="text-[13px] text-ink-3">사진은 관리자가 눈으로 확인합니다 — 사진만으로 적합 처리되지 않습니다. 얼굴이 나오지 않게 착용 부위 위주로 찍어 주세요. * 필수 항목</p>
      {err && (
        <p role="alert" className="rounded-xl bg-danger-bg px-3 py-2 text-[15px] font-bold text-danger">
          {err}
        </p>
      )}
      <div className="grid grid-cols-[1fr_auto] gap-1.5">
        <button disabled={!ready || busy} onClick={() => void send()} className="min-h-[3.2rem] rounded-xl bg-primary text-[18px] font-extrabold text-white disabled:opacity-40">
          {busy ? "보내는 중…" : saved ? "사진 다시 올리기" : `${STAGE_LABEL[stage]} 제출`}
        </button>
        <button onClick={onCancel} disabled={busy} className="rounded-xl bg-[#f2f4f6] px-3.5 text-[16px] font-bold text-ink-2">
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
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const req = x.reviews.filter((r) => r.source === "관리자" && r.message).at(-1);
  return (
    <div className="space-y-1.5 rounded-xl border-2 border-danger/50 bg-white p-2.5" aria-label={`보완 요청 ${x.c.check_no}`}>
      <p className="text-[16px] font-bold text-danger">
        본사 보완 요청 ({STAGE_LABEL[x.c.stage]}): {req?.message}
      </p>
      <label className="inline-flex min-h-[2.9rem] cursor-pointer items-center gap-2 rounded-xl bg-[#e8f1fe] px-3 text-[15.5px] font-bold text-primary-dark">
        <Camera size={18} /> 보완 사진 {files.length > 0 && `${files.length}장`}
        <input type="file" accept="image/*" capture="environment" multiple className="sr-only" aria-label="보완 사진" onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 4))} />
      </label>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="보완한 내용 (필수)" aria-label="보완한 내용" className="min-h-[2.8rem] w-full rounded-xl border border-line px-3 text-[16px]" />
      {err && <p className="text-[14.5px] font-bold text-danger">{err}</p>}
      <button
        disabled={!note.trim() || busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await uploadAll(userId, x.c.id, files);
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
        className="min-h-[3rem] w-full rounded-xl bg-primary text-[17px] font-extrabold text-white disabled:opacity-40"
      >
        {busy ? "보내는 중…" : "보완 제출"}
      </button>
    </div>
  );
}
