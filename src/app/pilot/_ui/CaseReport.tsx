"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, PhoneCall, Send } from "lucide-react";
import { newOpId } from "@/lib/pilot/op-id";
import { kst } from "@/lib/pilot/time";
import { preparePhoto, uploadPhoto } from "@/lib/pilot/photo";
import { BASES, EVIDENCE_CLASSES, INFO_SOURCES, ISSUE_TYPES, NEEDS, PROGRESS } from "@/lib/pilot/cases";
import { attachPhotoAction, reportCaseAction } from "../cases/actions";

/**
 * 현장 문제 보고 · 지원 요청 — 큰 버튼과 간단한 선택만으로 보낸다.
 * 보고 시각(버튼 누른 시각)과 실제 문제 발견시각을 따로 기록한다. 발견시각을 모르면 '모름'(추정하지 않음).
 * 보고가 먼저 저장되고, 사진은 그 뒤에 올라간다 — 사진 때문에 보고가 늦어지지 않는다.
 * proxy(관리자 대리 입력): 지난 현장정보를 전화·메신저·업무일지 근거로 사후 입력할 때.
 */

const chip = (on: boolean, tone: "ink" | "danger" = "ink") =>
  `min-h-[3rem] rounded-xl px-3.5 text-[17px] font-bold ${on ? (tone === "danger" ? "bg-danger text-white" : "bg-ink text-white") : "bg-[#f2f4f6] text-ink-2"}`;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const addMin = (hhmm: string, m: number) => {
  const t = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) + m;
  return t >= 24 * 60 ? null : `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
const minutesAgo = (n: number) => kst(new Date(Date.now() - n * 60_000)).time;

type Disc = { basis: "보고와 같은 시각" | "현장 직원 진술" | "원자료 기록" | "기억에 의한 추정" | "모름"; time: string };
type PhotoState = { file: File; preview: string; status: "대기" | "올리는 중" | "완료" | "실패"; error?: string; exifRemoved?: boolean };

export interface CaseTarget {
  scheduleId: string;
  siteName: string;
  plannedEnd: string;
  currentEnd: string;
  started: boolean;
}

export function CaseReport({
  userId,
  target,
  scenario,
  proxy = false,
  onDone,
  onCancel,
}: {
  userId: string;
  target: CaseTarget;
  /** 검증 시나리오 날짜 — 자료 구분을 현장정보 재현 / 가상 시나리오 중에서 고른다 */
  scenario: boolean;
  proxy?: boolean;
  onDone: (text: string) => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [opId] = useState(newOpId);
  const [type, setType] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>(target.started ? "작업 진행 중" : "작업 시작 전");
  const [needs, setNeeds] = useState<string[]>([]);
  const [urgent, setUrgent] = useState(false);
  const [request, setRequest] = useState("");
  const [end, setEnd] = useState<string | null>(null);
  const [typingEnd, setTypingEnd] = useState(false);
  const [disc, setDisc] = useState<Disc>({ basis: proxy ? "원자료 기록" : "보고와 같은 시각", time: "" });
  const [rep, setRep] = useState<{ time: string; basis: string }>({ time: "", basis: "원자료 기록" });
  const [info, setInfo] = useState<string>(proxy ? "전화" : "현장기사 앱");
  const [evidence, setEvidence] = useState<string>(scenario ? "가상 시나리오" : "실제 업무");
  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; retry: boolean } | null>(null);
  const [saved, setSaved] = useState<{ caseId: string; caseNo: string; engine: boolean } | null>(null);

  const ready =
    !!type &&
    (disc.basis === "보고와 같은 시각" || disc.basis === "모름" || TIME_RE.test(disc.time)) &&
    (!proxy || (TIME_RE.test(rep.time) && (BASES as readonly string[]).includes(rep.basis))) &&
    (end === null || TIME_RE.test(end));
  const urgency = urgent || type === "안전 위험" ? "긴급" : "보통";

  async function uploadAll(caseId: string, list: PhotoState[]) {
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      if (list[i].status === "완료") {
        ok++;
        continue;
      }
      setPhotos((p) => p.map((x, k) => (k === i ? { ...x, status: "올리는 중", error: undefined } : x)));
      try {
        const prepared = await preparePhoto(list[i].file);
        const up = await uploadPhoto(userId, caseId, prepared);
        const r = await attachPhotoAction({ opId: newOpId(), caseId, path: up.path, mime: prepared.mime, size: up.size, sha256: up.sha256, exifRemoved: prepared.exifRemoved });
        if (!r.ok) throw new Error(r.error);
        ok++;
        setPhotos((p) => p.map((x, k) => (k === i ? { ...x, status: "완료", exifRemoved: prepared.exifRemoved } : x)));
      } catch (e) {
        setPhotos((p) => p.map((x, k) => (k === i ? { ...x, status: "실패", error: e instanceof Error ? e.message : String(e) } : x)));
      }
    }
    return ok;
  }

  async function send() {
    setBusy(true);
    setErr(null);
    const pressedAt = new Date().toISOString();
    try {
      let s = saved;
      if (!s) {
        const r = await reportCaseAction({
          opId,
          scheduleId: target.scheduleId,
          issueType: type!,
          progress,
          needs,
          request,
          urgency,
          discovered: { basis: disc.basis, time: disc.basis === "보고와 같은 시각" || disc.basis === "모름" ? undefined : disc.time },
          report: proxy ? { mode: "사후", time: rep.time, basis: rep.basis, pressedAt, sentAt: new Date().toISOString() } : { mode: "즉시", pressedAt, sentAt: new Date().toISOString() },
          expectedEnd: end,
          infoSource: info,
          evidenceClass: evidence,
        });
        if (!r.ok) {
          setErr({ text: r.error, retry: r.retry });
          return;
        }
        s = { caseId: r.caseId, caseNo: r.caseNo, engine: r.engine };
        setSaved(s);
      }
      const n = await uploadAll(s.caseId, photos);
      router.refresh();
      if (n < photos.length) {
        setErr({ text: `사건 ${s.caseNo} 보고는 저장됐습니다. 사진 ${photos.length - n}장을 올리지 못했습니다 — '사진 다시 올리기'를 누르세요.`, retry: true });
        return;
      }
      onDone(`사건 ${s.caseNo} 보고됨${photos.length ? ` · 사진 ${n}장` : ""} · ${s.engine ? `예상 종료 ${end} → 후속 현장 위험 다시 계산` : "예상 종료 미확인 — 위험 판단 변화 없음"}`);
    } catch (e) {
      void e;
      setErr({ text: "보내지 못했습니다 — 연결을 확인하고 '다시 보내기'를 누르세요. 입력한 내용은 그대로 있고, 같은 보고로 한 번만 저장됩니다.", retry: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border-2 border-danger/40 bg-white p-3.5" aria-label="현장 문제 보고">
      <p className="flex items-center gap-1.5 text-[20px] font-extrabold text-danger">
        <AlertTriangle size={23} /> 현장 문제 보고 · 지원 요청 — {target.siteName}
      </p>
      {saved && <p className="rounded-xl bg-success-bg px-3 py-2 text-[16px] font-bold text-success">사건 {saved.caseNo} 저장됨 — 남은 사진만 올리면 됩니다.</p>}

      <fieldset disabled={!!saved} className="space-y-3">
        <Group label="문제 유형">
          {ISSUE_TYPES.map((t) => (
            <button type="button" role="radio" aria-checked={type === t} key={t} className={chip(type === t, t === "안전 위험" ? "danger" : "ink")} onClick={() => setType(t)}>
              {t}
            </button>
          ))}
        </Group>
        {type === "안전 위험" && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger px-3 py-2.5 text-[16.5px] font-bold text-white">
            <PhoneCall size={20} className="mt-0.5 shrink-0" /> 위험하면 프로그램 판단을 기다리지 말고 즉시 작업을 멈추고, 관리자·안전 책임자에게 직접 전화하세요. 이 보고는 기록용입니다.
          </p>
        )}
        <Group label="지금 작업 진행상황">
          {PROGRESS.map((t) => (
            <button type="button" role="radio" aria-checked={progress === t} key={t} className={chip(progress === t)} onClick={() => setProgress(t)}>
              {t}
            </button>
          ))}
        </Group>
        <Group label="요청 (여러 개 가능)" multi>
          {NEEDS.map((t) => (
            <button type="button" aria-pressed={needs.includes(t)} key={t} className={chip(needs.includes(t))} onClick={() => setNeeds((v) => (v.includes(t) ? v.filter((o) => o !== t) : [...v, t]))}>
              {t}
            </button>
          ))}
          <button type="button" aria-pressed={urgency === "긴급"} className={chip(urgency === "긴급", "danger")} onClick={() => setUrgent((v) => !v)} disabled={type === "안전 위험"}>
            긴급
          </button>
        </Group>
        <input value={request} onChange={(e) => setRequest(e.target.value)} maxLength={500} placeholder="설명 (선택 · 말한 그대로)" aria-label="문제 설명" className="min-h-[3rem] w-full rounded-xl border border-line px-3 text-[17px]" />

        <div className="space-y-1.5" role="group" aria-label="변경 예상 종료">
          <span className="block text-[15.5px] font-semibold text-ink-2">변경된 예상 작업 종료 (지금 예상 {target.currentEnd})</span>
          <div className="flex flex-wrap gap-1.5">
            {[30, 60, 120].map((m) => {
              const t = addMin(target.currentEnd, m);
              return (
                <button type="button" key={m} disabled={!t} className={chip(end === t && !typingEnd)} onClick={() => (setTypingEnd(false), setEnd(t))}>
                  +{m >= 60 ? `${m / 60}시간` : `${m}분`}
                </button>
              );
            })}
            <button type="button" className={chip(typingEnd)} onClick={() => setTypingEnd(true)}>
              직접 입력
            </button>
            <button type="button" className={chip(end === null && !typingEnd)} onClick={() => (setTypingEnd(false), setEnd(null))}>
              아직 모름
            </button>
          </div>
          {typingEnd && <input type="time" aria-label="변경 예상 종료 직접 입력" value={end ?? ""} onChange={(e) => setEnd(e.target.value || null)} className="min-h-[3rem] w-full rounded-xl border border-line px-3 text-[20px]" />}
          <p className={`text-[15px] font-bold ${end ? "text-danger" : "text-ink-3"}`}>
            {end ? `→ ${end} 종료 예상 · 이 값으로 다음 현장 도착·위험을 다시 계산합니다` : "예상 종료를 모르면 보고만 남고 위험 판단은 바뀌지 않습니다"}
          </p>
        </div>

        <div className="space-y-1.5" role="group" aria-label="문제 발견시각">
          <span className="block text-[15.5px] font-semibold text-ink-2">문제를 처음 발견한 시각</span>
          <div className="flex flex-wrap gap-1.5">
            {!proxy && (
              <button type="button" className={chip(disc.basis === "보고와 같은 시각")} onClick={() => setDisc({ basis: "보고와 같은 시각", time: "" })}>
                방금
              </button>
            )}
            {!proxy &&
              [10, 30, 60].map((n) => (
                <button type="button" key={n} className={chip(false)} onClick={() => setDisc({ basis: "현장 직원 진술", time: minutesAgo(n) })}>
                  {n === 60 ? "1시간 전" : `${n}분 전`}
                </button>
              ))}
            <input
              type="time"
              aria-label="문제 발견시각 직접 입력"
              value={disc.basis === "보고와 같은 시각" || disc.basis === "모름" ? "" : disc.time}
              onChange={(e) => setDisc({ basis: disc.basis === "보고와 같은 시각" || disc.basis === "모름" ? "현장 직원 진술" : disc.basis, time: e.target.value })}
              className="min-h-[3rem] rounded-xl border border-line px-2 text-[19px]"
            />
            <button type="button" className={chip(disc.basis === "모름")} onClick={() => setDisc({ basis: "모름", time: "" })}>
              모름
            </button>
          </div>
          {(proxy || (disc.basis !== "보고와 같은 시각" && disc.basis !== "모름")) && (
            <Basis value={disc.basis} onChange={(b) => setDisc({ ...disc, basis: b as Disc["basis"] })} />
          )}
        </div>

        {proxy ? (
          <div className="grid gap-2 rounded-xl bg-[#f7f8fa] p-2.5 sm:grid-cols-2">
            <label>
              <span className="block text-[15px] font-semibold text-ink-2">현장에서 본사에 보고한 시각</span>
              <input type="time" aria-label="보고 시각" value={rep.time} onChange={(e) => setRep({ ...rep, time: e.target.value })} className="min-h-[2.8rem] w-full rounded-xl border border-line px-2 text-[18px]" />
            </label>
            <div>
              <span className="block text-[15px] font-semibold text-ink-2">보고 시각 근거</span>
              <Basis value={rep.basis} onChange={(b) => setRep({ ...rep, basis: b })} />
            </div>
            <label>
              <span className="block text-[15px] font-semibold text-ink-2">자료 출처</span>
              <select value={info} onChange={(e) => setInfo(e.target.value)} aria-label="자료 출처" className="min-h-[2.8rem] w-full rounded-xl border border-line px-2 text-[17px]">
                {INFO_SOURCES.filter((x) => x !== "현장기사 앱").map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <p className="text-[14.5px] text-ink-3">보고 시각: 보내는 지금 (버튼 누른 시각) · 서버 기록시각은 서버가 따로 남깁니다.</p>
        )}
        {scenario && (
          <Group label="자료 구분 (검증 시나리오)">
            {EVIDENCE_CLASSES.filter((x) => x !== "실제 업무").map((x) => (
              <button type="button" role="radio" aria-checked={evidence === x} key={x} className={chip(evidence === x)} onClick={() => setEvidence(x)}>
                {x}
              </button>
            ))}
          </Group>
        )}
      </fieldset>

      <div className="space-y-1.5">
        <label className="inline-flex min-h-[3rem] cursor-pointer items-center gap-2 rounded-xl bg-[#e8f1fe] px-4 text-[17px] font-bold text-primary-dark">
          <Camera size={21} /> 사진 찍기 · 고르기
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            aria-label="현장 사진"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])].slice(0, 6);
              setPhotos((p) => [...p, ...files.map((f) => ({ file: f, preview: URL.createObjectURL(f), status: "대기" as const }))].slice(0, 6));
              e.target.value = "";
            }}
          />
        </label>
        {photos.length > 0 && (
          <ul className="grid grid-cols-3 gap-1.5" aria-label="첨부할 사진">
            {photos.map((p, i) => (
              <li key={p.preview} className="relative overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element -- 휴대폰에서 고른 실제 파일의 미리보기 */}
                <img src={p.preview} alt={`첨부 사진 ${i + 1}`} className="aspect-square w-full object-cover" />
                <span className={`absolute right-0 bottom-0 left-0 px-1 py-0.5 text-center text-[12.5px] font-bold text-white ${p.status === "실패" ? "bg-danger" : p.status === "완료" ? "bg-success" : "bg-ink/70"}`}>
                  {p.status}
                </span>
                {p.status === "대기" && !busy && (
                  <button type="button" aria-label={`사진 ${i + 1} 빼기`} onClick={() => setPhotos((x) => x.filter((_, k) => k !== i))} className="absolute top-0.5 right-0.5 rounded-full bg-white/90 px-1.5 text-[13px] font-bold">
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-[13.5px] text-ink-3">사진은 휴대폰에서 줄여 촬영 정보(위치 등)를 지운 뒤 비공개 저장소에 올립니다. 관리자와 본인만 볼 수 있습니다. 얼굴·개인정보가 나오지 않게 찍어 주세요.</p>
      </div>

      {err && (
        <p role="alert" className="rounded-xl bg-danger-bg px-3 py-2 text-[16px] font-bold text-danger">
          {err.text}
        </p>
      )}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button disabled={(!ready && !saved) || busy} onClick={() => void send()} className="inline-flex min-h-[3.6rem] items-center justify-center gap-2 rounded-2xl bg-danger text-[20px] font-extrabold text-white disabled:opacity-40">
          <Send size={21} /> {busy ? "보내는 중…" : saved ? "사진 다시 올리기" : err?.retry ? "다시 보내기" : "보고 보내기"}
        </button>
        <button onClick={onCancel} disabled={busy} className="rounded-2xl bg-[#f2f4f6] px-4 text-[17px] font-bold text-ink-2">
          닫기
        </button>
      </div>
    </div>
  );
}

function Group({ label, children, multi = false }: { label: string; children: React.ReactNode; multi?: boolean }) {
  return (
    <div className="space-y-1.5" role={multi ? "group" : "radiogroup"} aria-label={label}>
      <span className="block text-[15.5px] font-semibold text-ink-2">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function Basis({ value, onChange }: { value: string; onChange: (b: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="시각 근거">
      {BASES.map((b) => (
        <button type="button" role="radio" aria-checked={value === b} key={b} onClick={() => onChange(b)} className={`rounded-lg px-2.5 py-1.5 text-[14.5px] font-bold ${value === b ? "bg-primary text-white" : "bg-[#f2f4f6] text-ink-2"}`}>
          {b}
        </button>
      ))}
    </div>
  );
}
