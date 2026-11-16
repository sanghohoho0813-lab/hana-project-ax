"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, PhoneCall, Send, X } from "lucide-react";
import { newOpId } from "@/lib/pilot/op-id";
import { kst } from "@/lib/pilot/time";
import { preparePhoto, uploadPhoto } from "@/lib/pilot/photo";
import { BASES, INFO_SOURCES, ISSUE_TYPES, NEEDS, PROGRESS } from "@/lib/pilot/cases";
import { attachPhotoAction, reportCaseAction } from "../cases/actions";
import { btn, chip, cx, Steps } from "./ds";
import { PhotoPicker, uploadEach, usePhotos } from "./PhotoPicker";

/**
 * 현장 문제 보고 · 지원 요청 — 단계별 입력 (문제 유형 → 현재 상태 → 필요한 지원 → 예상 종료 → 사진 → 보내기).
 * 현장(모바일)은 화면 전체를 덮는 시트로 열고, 보내기 버튼은 아래에 고정한다. 관리자 대리 입력(proxy)은 화면 안에 펼친다.
 * 기록 원칙은 그대로: 보고 시각(버튼 누른 시각)과 발견시각을 따로 남기고, 모르면 '모름'. 보고가 먼저 저장되고 사진은 그 뒤에 올라간다.
 * 연결이 끊기면 입력한 내용을 그대로 두고 '다시 보내기' — 같은 요청 번호라 한 번만 저장된다.
 */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const addMin = (hhmm: string, m: number) => {
  const t = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) + m;
  return t >= 24 * 60 ? null : `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
const minutesAgo = (n: number) => kst(new Date(Date.now() - n * 60_000)).time;

type Disc = { basis: "보고와 같은 시각" | "현장 직원 진술" | "원자료 기록" | "기억에 의한 추정" | "모름"; time: string };

export interface CaseTarget {
  scheduleId: string;
  siteName: string;
  plannedEnd: string;
  currentEnd: string;
  started: boolean;
}

const STEP_NAMES = ["유형", "상태", "지원", "예상 종료", "사진", "보내기"];

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
  /** 검증 시나리오 날짜 — 자료 구분을 가상 시나리오 / 실제 과거 현장정보 재현(원자료 필수) 중에서 고른다 */
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
  const [endTouched, setEndTouched] = useState(false);
  const [typingEnd, setTypingEnd] = useState(false);
  const [disc, setDisc] = useState<Disc>({ basis: proxy ? "원자료 기록" : "보고와 같은 시각", time: "" });
  const [rep, setRep] = useState<{ time: string; basis: string }>({ time: "", basis: "원자료 기록" });
  const [info, setInfo] = useState<string>(proxy ? "전화" : "현장기사 앱");
  const [evidence, setEvidence] = useState<string>(scenario ? "가상 시나리오" : "실제 업무");
  const [sourceRef, setSourceRef] = useState("");
  const photos = usePhotos(6);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; retry: boolean } | null>(null);
  const [saved, setSaved] = useState<{ caseId: string; caseNo: string; engine: boolean } | null>(null);
  const stateRef = useRef<HTMLDivElement>(null);

  // 현장 시트가 열려 있는 동안 뒤 화면이 스크롤되지 않게
  useEffect(() => {
    if (proxy) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [proxy]);

  const discOk = disc.basis === "보고와 같은 시각" || disc.basis === "모름" || TIME_RE.test(disc.time);
  const ready =
    !!type &&
    discOk &&
    (!proxy || (TIME_RE.test(rep.time) && (BASES as readonly string[]).includes(rep.basis))) &&
    (end === null || TIME_RE.test(end)) &&
    (evidence !== "현장정보 재현" || sourceRef.trim().length > 0);
  const urgency = urgent || type === "안전 위험" ? "긴급" : "보통";
  const done = [!!type, !!type && discOk, needs.length > 0 || urgent, endTouched, photos.items.length > 0, !!saved];
  const current = Math.max(0, done.findIndex((d) => !d));

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
          sourceRef: evidence === "현장정보 재현" ? sourceRef : null,
        });
        if (!r.ok) {
          setErr({ text: r.error, retry: r.retry });
          return;
        }
        s = { caseId: r.caseId, caseNo: r.caseNo, engine: r.engine };
        setSaved(s);
      }
      const caseId = s.caseId;
      const res = await uploadEach(photos.items, photos.patch, async (file) => {
        const prepared = await preparePhoto(file);
        const up = await uploadPhoto(userId, caseId, prepared);
        const r = await attachPhotoAction({ opId: newOpId(), caseId, path: up.path, mime: prepared.mime, size: up.size, sha256: up.sha256, exifRemoved: prepared.exifRemoved });
        if (!r.ok) throw new Error(r.error);
        return { exifRemoved: prepared.exifRemoved };
      });
      router.refresh();
      if (res.failed > 0) {
        setErr({ text: `사건 ${s.caseNo} 보고는 저장됐습니다. 사진 ${res.failed}장을 올리지 못했습니다 — '사진 다시 올리기'를 누르세요.`, retry: true });
        return;
      }
      onDone(
        `사건 ${s.caseNo} 보고됨${photos.items.length ? ` · 사진 ${res.ok}장` : ""} · ${s.engine ? `예상 종료 ${end} → 후속 현장 위험 다시 계산` : "예상 종료 미확인 — 위험 판단 변화 없음"}`,
      );
    } catch (e) {
      void e;
      setErr({ text: "보내지 못했습니다 — 연결을 확인하고 '다시 보내기'를 누르세요. 입력한 내용은 그대로 있고, 같은 보고로 한 번만 저장됩니다.", retry: true });
    } finally {
      setBusy(false);
    }
  }

  const sendLabel = busy ? "보내는 중…" : saved ? "사진 다시 올리기" : err?.retry ? "다시 보내기" : "보고 보내기";

  const body = (
    <>
      {saved && (
        <p className="rounded-2xl bg-success-bg px-4 py-3 text-[15.5px] font-bold text-success">사건 {saved.caseNo} 저장됨 — 남은 사진만 올리면 됩니다.</p>
      )}
      <fieldset disabled={!!saved} className="space-y-3">
        <Step n={1} title="어떤 문제인가요?" done={done[0]}>
          <Group label="문제 유형" grid>
            {ISSUE_TYPES.map((t) => (
              <button
                type="button"
                role="radio"
                aria-checked={type === t}
                key={t}
                className={cx(chip(type === t, t === "안전 위험" ? "danger" : "primary"), "min-h-[3.25rem] w-full rounded-2xl text-[16px]")}
                onClick={() => {
                  setType(t);
                  if (!proxy && !type) window.setTimeout(() => stateRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 60);
                }}
              >
                {t}
              </button>
            ))}
          </Group>
          {type === "안전 위험" && (
            <p role="alert" className="mt-2 flex items-start gap-2 rounded-2xl bg-danger px-4 py-3 text-[15.5px] font-bold text-white">
              <PhoneCall size={20} className="mt-0.5 shrink-0" /> 위험하면 프로그램 판단을 기다리지 말고 즉시 작업을 멈추고, 관리자·안전 책임자에게 직접 전화하세요. 이 보고는 기록용입니다.
            </p>
          )}
        </Step>

        <Step n={2} title="지금 상태" done={done[1]} anchor={stateRef}>
          <Group label="지금 작업 진행상황">
            {PROGRESS.map((t) => (
              <button type="button" role="radio" aria-checked={progress === t} key={t} className={chip(progress === t)} onClick={() => setProgress(t)}>
                {t}
              </button>
            ))}
          </Group>
          <div className="mt-3 space-y-2" role="group" aria-label="문제 발견시각">
            <span className="block text-[15px] font-bold text-ink-3">문제를 처음 발견한 시각</span>
            <div className="flex flex-wrap gap-2">
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
              <button type="button" className={chip(disc.basis === "모름")} onClick={() => setDisc({ basis: "모름", time: "" })}>
                모름
              </button>
              <input
                type="time"
                aria-label="문제 발견시각 직접 입력"
                value={disc.basis === "보고와 같은 시각" || disc.basis === "모름" ? "" : disc.time}
                onChange={(e) => setDisc({ basis: disc.basis === "보고와 같은 시각" || disc.basis === "모름" ? "현장 직원 진술" : disc.basis, time: e.target.value })}
                className="min-h-[2.75rem] rounded-full bg-[#eef0f3] px-4 text-[16px] font-semibold tabular-nums"
              />
            </div>
            {(proxy || (disc.basis !== "보고와 같은 시각" && disc.basis !== "모름")) && <Basis value={disc.basis} onChange={(b) => setDisc({ ...disc, basis: b as Disc["basis"] })} />}
          </div>
        </Step>

        <Step n={3} title="어떤 지원이 필요한가요?" hint="여러 개 고를 수 있어요" done={done[2]}>
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
          <input
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            maxLength={500}
            placeholder="설명 (선택 · 말한 그대로)"
            aria-label="문제 설명"
            className="mt-3 min-h-[3rem] w-full rounded-2xl bg-[#f3f4f6] px-4 text-[16px] outline-none focus:bg-white focus:ring-2 focus:ring-primary"
          />
        </Step>

        <Step n={4} title="예상 종료가 바뀌나요?" hint={`지금 예상 ${target.currentEnd}`} done={done[3]}>
          <div className="space-y-2" role="group" aria-label="변경 예상 종료">
            <div className="flex flex-wrap gap-2">
              {[30, 60, 120].map((m) => {
                const t = addMin(target.currentEnd, m);
                return (
                  <button type="button" key={m} disabled={!t} className={chip(end === t && !typingEnd)} onClick={() => (setTypingEnd(false), setEnd(t), setEndTouched(true))}>
                    +{m >= 60 ? `${m / 60}시간` : `${m}분`}
                  </button>
                );
              })}
              <button type="button" className={chip(typingEnd)} onClick={() => (setTypingEnd(true), setEndTouched(true))}>
                직접 입력
              </button>
              <button type="button" className={chip(end === null && !typingEnd && endTouched)} onClick={() => (setTypingEnd(false), setEnd(null), setEndTouched(true))}>
                아직 모름
              </button>
            </div>
            {typingEnd && (
              <input
                type="time"
                aria-label="변경 예상 종료 직접 입력"
                value={end ?? ""}
                onChange={(e) => setEnd(e.target.value || null)}
                className="min-h-[3rem] w-full rounded-2xl bg-[#f3f4f6] px-4 text-[19px] tabular-nums outline-none focus:ring-2 focus:ring-primary"
              />
            )}
            <p className={cx("rounded-xl px-3 py-2 text-[15.5px] font-semibold", end ? "bg-danger-bg text-danger" : "bg-[#f3f4f6] text-ink-3")}>
              {end ? `→ ${end} 종료 예상 · 이 값으로 다음 현장 도착·위험을 다시 계산합니다` : "예상 종료를 모르면 보고만 남고 위험 판단은 바뀌지 않습니다"}
            </p>
          </div>
        </Step>
      </fieldset>

      <Step n={5} title="사진 첨부" hint="선택 · 최대 6장" done={done[4]}>
        <PhotoPicker
          items={photos.items}
          onAdd={photos.add}
          onRemove={photos.remove}
          disabled={busy}
          title="현장 사진"
          hint="휴대폰에서 줄여 촬영 정보(위치 등)를 지운 뒤 비공개로 올립니다. 관리자와 본인만 봅니다. 얼굴·개인정보가 나오지 않게 찍어 주세요."
        />
      </Step>

      <Step n={6} title="확인하고 보내기" done={done[5]}>
        <fieldset disabled={!!saved} className="space-y-3">
          <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1 text-[15.5px]">
            <dt className="text-ink-3">현장</dt>
            <dd className="font-semibold">{target.siteName}</dd>
            <dt className="text-ink-3">문제</dt>
            <dd className="font-semibold">{type ?? "고르지 않음"}</dd>
            <dt className="text-ink-3">지원</dt>
            <dd className="font-semibold">{[...needs, urgency === "긴급" ? "긴급" : null].filter(Boolean).join(" · ") || "없음"}</dd>
            <dt className="text-ink-3">예상 종료</dt>
            <dd className="font-semibold">{end ?? "모름"}</dd>
            <dt className="text-ink-3">보고 시각</dt>
            <dd className="font-semibold">{proxy ? "아래에 입력" : "보내는 지금 (버튼 누른 시각)"}</dd>
          </dl>
          {proxy && (
            <div className="grid gap-2 rounded-2xl bg-[#f7f8fa] p-3 sm:grid-cols-2">
              <label>
                <span className="block text-[15px] font-bold text-ink-3">현장에서 본사에 보고한 시각</span>
                <input type="time" aria-label="보고 시각" value={rep.time} onChange={(e) => setRep({ ...rep, time: e.target.value })} className="min-h-[2.8rem] w-full rounded-xl bg-white px-3 text-[17px] ring-1 ring-line" />
              </label>
              <div>
                <span className="block text-[15px] font-bold text-ink-3">보고 시각 근거</span>
                <Basis value={rep.basis} onChange={(b) => setRep({ ...rep, basis: b })} />
              </div>
              <label>
                <span className="block text-[15px] font-bold text-ink-3">자료 출처</span>
                <select value={info} onChange={(e) => setInfo(e.target.value)} aria-label="자료 출처" className="min-h-[2.8rem] w-full rounded-xl bg-white px-2 text-[16px] ring-1 ring-line">
                  {INFO_SOURCES.filter((x) => x !== "현장기사 앱").map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {scenario && (
            <Group label="자료 구분 (검증 시나리오)">
              {(["가상 시나리오", "현장정보 재현"] as const).map((x) => (
                <button type="button" role="radio" aria-checked={evidence === x} key={x} className={chip(evidence === x)} onClick={() => setEvidence(x)}>
                  {x === "가상 시나리오" ? "가상 시나리오 (시험용 가정값)" : "실제 과거 현장정보 재현 (원자료 있음)"}
                </button>
              ))}
            </Group>
          )}
          {scenario && evidence === "현장정보 재현" && (
            <div className="space-y-1">
              <input
                value={sourceRef}
                onChange={(e) => setSourceRef(e.target.value)}
                maxLength={200}
                placeholder="원자료 이름 (예: 10월 2일 업무일지 · A현장 통화기록)"
                aria-label="원자료 이름"
                className="min-h-[3rem] w-full rounded-2xl bg-[#f3f4f6] px-4 text-[16px] outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-[15px] text-ink-3">실제 과거 현장의 원자료가 있을 때만 고릅니다. 원자료가 없는 시험·연습은 가상 시나리오입니다.</p>
            </div>
          )}
        </fieldset>
      </Step>

      {err && (
        <p role="alert" className="rounded-2xl bg-danger-bg px-4 py-3 text-[15px] font-bold text-danger">
          {err.text}
        </p>
      )}
    </>
  );

  const actions = (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <button disabled={(!ready && !saved) || busy} onClick={() => void send()} className={btn("primary", "xl", true)}>
        <Send size={20} /> {sendLabel}
      </button>
      <button onClick={onCancel} disabled={busy} className={btn("ghost", "xl")}>
        닫기
      </button>
    </div>
  );

  if (proxy) {
    return (
      <div className="space-y-3 rounded-[20px] bg-white p-4 ring-1 ring-line" aria-label="현장 문제 보고">
        <p className="flex items-center gap-2 text-[18px] font-extrabold text-ink">
          <AlertTriangle size={20} className="text-danger" /> 대리 보고 — {target.siteName}
        </p>
        {body}
        {actions}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f5f6f8]" aria-label="현장 문제 보고" role="dialog" aria-modal="true">
      <header className="shrink-0 space-y-3 bg-white px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 shadow-[0_1px_0_#e7e9ee]">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[14.5px] font-bold text-danger">현장 문제 보고 · 지원 요청</p>
            <p className="truncate text-[19px] font-extrabold">{target.siteName}</p>
          </div>
          <button onClick={onCancel} disabled={busy} aria-label="보고 닫기" className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eef0f3] text-ink-2">
            <X size={22} />
          </button>
        </div>
        <Steps items={STEP_NAMES} current={current} label="보고 단계" />
      </header>
      <div className="mx-auto w-full max-w-[40rem] flex-1 space-y-3 overflow-y-auto px-4 py-4">{body}</div>
      <footer className="safe-bottom mx-auto w-full max-w-[40rem] shrink-0 bg-white px-4 pt-3 shadow-[0_-1px_0_#e7e9ee]">{actions}</footer>
    </div>
  );
}

function Step({ n, title, hint, done, children, anchor }: { n: number; title: string; hint?: string; done: boolean; children: React.ReactNode; anchor?: React.Ref<HTMLDivElement> }) {
  return (
    <section ref={anchor} className="scroll-mt-4 rounded-[20px] bg-white p-4" aria-label={`${n}단계 ${title}`}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold", done ? "bg-primary text-white" : "bg-[#eef0f3] text-ink-2")}>
          {done ? "✓" : n}
        </span>
        <h3 className="text-[17px] font-extrabold">{title}</h3>
        {hint && <span className="ml-auto text-[14.5px] font-semibold text-ink-3">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Group({ label, children, multi = false, grid = false }: { label: string; children: React.ReactNode; multi?: boolean; grid?: boolean }) {
  return (
    <div role={multi ? "group" : "radiogroup"} aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className={grid ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-2"}>{children}</div>
    </div>
  );
}

export function Basis({ value, onChange }: { value: string; onChange: (b: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="시각 근거">
      {BASES.map((b) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === b}
          key={b}
          onClick={() => onChange(b)}
          className={cx("min-h-[2.5rem] rounded-full px-3 text-[15px] font-bold", value === b ? "bg-ink text-white" : "bg-[#eef0f3] text-ink-2")}
        >
          {b}
        </button>
      ))}
    </div>
  );
}
