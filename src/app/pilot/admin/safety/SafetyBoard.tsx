"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { newOpId } from "@/lib/pilot/op-id";
import { kst } from "@/lib/pilot/time";
import { STAGE_LABEL, itemLabel, type ReviewStatus, type SafetyCheckRow, type SafetyReviewRow } from "@/lib/pilot/safety";
import type { PhotoRow } from "@/lib/pilot/cases";
import { safetyReviewAction } from "../../safety/actions";
import { HardHat, PhoneCall } from "lucide-react";
import { cx, Empty, Notice, Pill, type PillTone } from "../../_ui/ds";

type Item = { c: SafetyCheckRow; reviews: SafetyReviewRow[]; photos: (PhotoRow & { url: string | null })[] };
const TONE: Record<ReviewStatus, PillTone> = {
  "확인 대기": "warning",
  "적합(육안 확인)": "success",
  "보완 요청": "danger",
  "보완 제출": "info",
  "조치 완료": "success",
};

export function SafetyBoard({ items, names, sites }: { items: Item[]; names: Record<string, string>; sites: Record<string, string> }) {
  if (items.length === 0) return <Empty icon={<HardHat size={22} />} title="안전점검 기록이 없습니다." desc="현장기사 휴대폰에서 시작 전 · 진행 중 · 마친 뒤 점검을 제출하면 자동 갱신으로 나타납니다." />;
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
  const b = "inline-flex min-h-[2.75rem] items-center justify-center rounded-xl px-4 text-[15px] font-bold transition-colors active:scale-[0.985] disabled:opacity-40";
  return (
    <li className={cx("card space-y-3 p-5", c.deficient.length > 0 && "ring-2 ring-danger/50")} aria-label={`안전점검 ${c.check_no}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={TONE[c.review_status]}>{c.review_status}</Pill>
        <span className="text-[13px] font-semibold text-ink-3 tabular-nums">{c.check_no}</span>
      </div>
      <div>
        <p className="text-[18px] font-extrabold">
          {site} · {STAGE_LABEL[c.stage]}
        </p>
        <p className="text-[13.5px] text-ink-3">
          {names[c.worker_id]} · 점검 {c.checked_at ? kst(c.checked_at).time : "모름"} ({c.check_basis}) · 서버 {kst(c.recorded_at).seconds} · 입력 {names[c.reporter_id]} · {c.app_version}
        </p>
      </div>
      <ul className="flex flex-wrap gap-1.5 text-[14px]">
        {c.items.map((i) => (
          <li key={i.key} className={cx("rounded-full px-3 py-1 font-semibold", i.answer === "미흡" ? "bg-danger text-white" : i.answer === "확인" ? "bg-success-bg text-success" : "bg-[#eef0f3] text-ink-3")}>
            {itemLabel(i.key)}: {i.answer}
          </li>
        ))}
      </ul>
      {c.note && <p className="text-[14.5px] text-ink-2">메모: {c.note}</p>}
      {c.deficient.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-danger-bg px-3 py-2 text-[14.5px] font-bold text-danger">
          <PhoneCall size={17} className="mt-0.5 shrink-0" /> 미흡 {c.deficient.map(itemLabel).join(", ")} — 현장에 직접 연락해 작업 중지 여부를 확인하세요.
        </p>
      )}
      {x.photos.length === 0 ? (
        <p className="rounded-xl bg-warning-bg px-3 py-2 text-[14.5px] font-semibold text-warning">사진 없음 — 눈으로 확인할 수 없으므로 적합으로 둘 수 없습니다.</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="점검 사진">
          {x.photos.map((p) =>
            p.url && !p.deleted_at ? (
              <li key={p.id} className="text-[12.5px] text-ink-3">
                <a href={p.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 비공개 저장소의 서명 주소(10분) */}
                  <img src={p.url} alt="안전점검 사진" className="h-32 w-32 rounded-2xl object-cover" />
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
        <ol className="space-y-1 rounded-xl bg-[#f7f8fa] px-3.5 py-2.5 text-[14.5px]" aria-label="확인 이력">
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
        <div className="space-y-2 rounded-2xl bg-[#f7f8fa] p-3">
          <input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={500} placeholder="보완할 내용 (보완 요청에 필수)" aria-label="보완할 내용" className="min-h-[2.75rem] w-full rounded-xl bg-white px-3 text-[15px] ring-1 ring-line outline-none focus:ring-2 focus:ring-primary" />
          <div className="flex flex-wrap gap-2">
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
      {out && <Notice kind={out.ok ? "success" : "error"}>{out.text}</Notice>}
    </li>
  );
}
