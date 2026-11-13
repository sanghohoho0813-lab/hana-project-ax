"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { newOpId } from "@/lib/pilot/op-id";
import { kst } from "@/lib/pilot/time";
import { STAGE_LABEL, itemLabel, type ReviewStatus, type SafetyCheckRow, type SafetyReviewRow } from "@/lib/pilot/safety";
import type { PhotoRow } from "@/lib/pilot/cases";
import { safetyReviewAction } from "../../safety/actions";

type Item = { c: SafetyCheckRow; reviews: SafetyReviewRow[]; photos: (PhotoRow & { url: string | null })[] };
const TONE: Record<ReviewStatus, string> = {
  "확인 대기": "bg-warning-bg text-warning",
  "적합(육안 확인)": "bg-success-bg text-success",
  "보완 요청": "bg-danger-bg text-danger",
  "보완 제출": "bg-[#e8f1fe] text-[#1b64da]",
  "조치 완료": "bg-success-bg text-success",
};

export function SafetyBoard({ items, names, sites }: { items: Item[]; names: Record<string, string>; sites: Record<string, string> }) {
  if (items.length === 0) return <p className="card px-4 py-4 text-[16.5px] text-ink-3">안전점검 기록이 없습니다. 현장기사 휴대폰에서 작업 전·중·종료 점검을 제출하면 자동 갱신으로 나타납니다.</p>;
  return (
    <ol className="space-y-3" aria-label="안전점검 목록">
      {items.map((x) => (
        <Check key={x.c.id} x={x} names={names} site={sites[x.c.schedule_id]} />
      ))}
    </ol>
  );
}

function Check({ x, names, site }: { x: Item; names: Record<string, string>; site: string }) {
  const router = useRouter();
  const [opId, setOpId] = useState(newOpId);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ ok: boolean; text: string } | null>(null);
  const c = x.c;
  const live = x.photos.filter((p) => p.url && !p.deleted_at);
  async function send(kind: string, result?: string) {
    setBusy(true);
    try {
      const r = await safetyReviewAction({ opId, checkId: c.id, kind, result: result ?? null, message: msg });
      setOut(r.ok ? { ok: true, text: `${kind}${result ? ` · ${result}` : ""} 기록 (상태: ${r.status})` } : { ok: false, text: r.error });
      if (r.ok) {
        setOpId(newOpId());
        setMsg("");
        router.refresh();
      }
    } catch {
      setOut({ ok: false, text: "서버에 연결하지 못했습니다. 다시 누르면 같은 요청으로 한 번만 저장됩니다." });
    } finally {
      setBusy(false);
    }
  }
  const b = "min-h-[2.7rem] rounded-xl px-3.5 text-[15.5px] font-bold disabled:opacity-40";
  return (
    <li className={`card space-y-2 p-4 ${c.deficient.length ? "border-2 border-danger/50" : ""}`} aria-label={`안전점검 ${c.check_no}`}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[17px]">
        <b className="tabular-nums">{c.check_no}</b>
        <b>{STAGE_LABEL[c.stage]}</b>
        <span>
          {site} · {names[c.worker_id]}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[14px] font-bold ${TONE[c.review_status]}`}>{c.review_status}</span>
        <span className="text-[14px] text-ink-3">
          점검 {c.checked_at ? kst(c.checked_at).time : "모름"} ({c.check_basis}) · 서버 {kst(c.recorded_at).seconds} · 입력 {names[c.reporter_id]} · {c.app_version}
        </span>
      </p>
      <ul className="flex flex-wrap gap-1.5 text-[15px]">
        {c.items.map((i) => (
          <li key={i.key} className={`rounded-lg px-2 py-1 font-semibold ${i.answer === "미흡" ? "bg-danger text-white" : i.answer === "확인" ? "bg-[#f2f4f6]" : "bg-[#f7f8fa] text-ink-3"}`}>
            {itemLabel(i.key)}: {i.answer}
          </li>
        ))}
      </ul>
      {c.note && <p className="text-[15px] text-ink-2">메모: {c.note}</p>}
      {c.deficient.length > 0 && <p className="text-[15px] font-bold text-danger">미흡 {c.deficient.map(itemLabel).join(", ")} — 현장에 직접 연락해 작업 중지 여부를 확인하세요.</p>}
      {x.photos.length === 0 ? (
        <p className="text-[15px] font-semibold text-warning">사진 없음 — 눈으로 확인할 수 없으므로 적합으로 둘 수 없습니다.</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="점검 사진">
          {x.photos.map((p) =>
            p.url && !p.deleted_at ? (
              <li key={p.id} className="text-[12.5px] text-ink-3">
                <a href={p.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 비공개 저장소의 서명 주소(10분) */}
                  <img src={p.url} alt="안전점검 사진" className="h-28 w-28 rounded-lg border border-line object-cover" />
                </a>
                {kst(p.recorded_at).time} · {p.exif_removed ? "촬영정보 제거" : "원본"}
              </li>
            ) : (
              <li key={p.id} className="rounded-lg bg-[#f2f4f6] p-2 text-[12.5px] text-ink-3">
                삭제됨 · {p.delete_reason}
              </li>
            ),
          )}
        </ul>
      )}
      {x.reviews.length > 0 && (
        <ol className="space-y-0.5 rounded-xl bg-[#f7f8fa] px-3 py-2 text-[15px]" aria-label="확인 이력">
          {x.reviews.map((r) => (
            <li key={r.id}>
              <b>{r.kind}</b>
              {r.result && ` · ${r.result}`}
              {r.message && `: ${r.message}`} <span className="text-ink-3">({kst(r.occurred_at).time} · {names[r.actor_id]})</span>
            </li>
          ))}
        </ol>
      )}
      {c.review_status !== "적합(육안 확인)" && c.review_status !== "조치 완료" && (
        <div className="space-y-1.5">
          <input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={500} placeholder="보완할 내용 (보완 요청에 필수)" aria-label="보완할 내용" className="w-full rounded-xl border border-line px-3 py-2 text-[16px]" />
          <div className="flex flex-wrap gap-1.5">
            {c.review_status === "확인 대기" && (
              <>
                <button disabled={busy || live.length === 0 || c.deficient.length > 0} onClick={() => void send("관리자 확인", "적합(육안 확인)")} className={`${b} bg-success text-white`}>
                  사진 확인 — 적합 (육안)
                </button>
                <button disabled={busy || !msg.trim()} onClick={() => void send("관리자 확인", "보완 필요")} className={`${b} bg-danger text-white`}>
                  보완 요청
                </button>
              </>
            )}
            {c.review_status === "보완 제출" && (
              <>
                <button disabled={busy} onClick={() => void send("조치 완료 확인")} className={`${b} bg-success text-white`}>
                  보완 확인 — 조치 완료
                </button>
                <button disabled={busy || !msg.trim()} onClick={() => void send("보완 요청")} className={`${b} bg-danger text-white`}>
                  다시 보완 요청
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {out && (
        <p role={out.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-[15.5px] font-semibold ${out.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>
          {out.text}
        </p>
      )}
    </li>
  );
}
