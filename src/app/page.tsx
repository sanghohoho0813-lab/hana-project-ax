"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardList, Database, FlaskConical, PlayCircle, ShieldCheck, Trash2 } from "lucide-react";
import { commit, setPref, useLab } from "@/lib/lab/store";
import { EXAMPLE_CASES, hasExamples, loadExamples, removeExamples } from "@/lib/lab/examples";
import { useOperator } from "@/components/lab/LabShell";
import { currentSchedules, personName, sessionEvents, type LabState } from "@/lib/lab/model";
import { kst } from "@/lib/pilot/time";
import { LabAlerts } from "@/components/lab/LabAlerts";
import { BackupCard } from "@/components/lab/Backup";
import { KindBadge, useCurrentSession } from "@/components/lab/common";

/** 실증 홈 — 오늘의 실증 상황 · 기록 시작 · 백업 상태 · 최근 입력 (KPI 대시보드 아님) */
export default function LabHome() {
  const { state } = useLab();
  const [session] = useCurrentSession();
  if (!state) return <LabAlerts />;
  const today = kst(new Date()).date;
  const isToday = (iso: string) => kst(iso).date === today;
  const todayEntries = state.entries.filter((e) => isToday(e.enteredAt));
  const todayTrials = state.trials.filter((t) => isToday(t.createdAt) && !t.voided);
  const todayNotes = state.notes.filter((n) => isToday(n.at));

  return (
    <div className="mx-auto max-w-[64rem] space-y-4">
      <LabAlerts />
      <section className="card space-y-2 p-4" aria-label="오늘의 실증 상황">
        <h2 className="text-[21px] font-extrabold">오늘의 실증 상황 · {today}</h2>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { k: "오늘 입력한 기록", v: todayEntries.length },
            { k: "오늘 비교시험 측정", v: todayTrials.length },
            { k: "오늘 문제·피드백", v: todayNotes.length },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl bg-[#f7f8fa] px-2 py-2.5">
              <p className="text-[26px] font-extrabold tabular-nums">{x.v}</p>
              <p className="text-[14.5px] font-semibold text-ink-3">{x.k}</p>
            </div>
          ))}
        </div>
        {session ? (
          <p className="flex flex-wrap items-center gap-2 text-[16px] text-ink-2">
            지금 세트: <KindBadge kind={session.kind} /> <b>세트 {session.no} · {session.title}</b> · 현장 업무 {session.workDate} · 일정 {currentSchedules(state, session.id).length}건 · 작업 기록{" "}
            {sessionEvents(state, session.id).length}건
          </p>
        ) : (
          <p className="text-[16px] text-ink-3">아직 실증 세트가 없습니다. 아래 &lsquo;현장 실증 기록 시작&rsquo;에서 만드세요.</p>
        )}
      </section>

      <ExampleCard s={state} />

      <section className="grid gap-2.5 sm:grid-cols-3" aria-label="기록 시작">
        {[
          { href: "/field", icon: ClipboardList, title: session ? "현장 실증 이어서 기록" : "현장 실증 기록 시작", desc: "관리자 일정 입력 → 현장기사 버튼 입력 → 위험 판단 확인" },
          { href: "/compare", icon: FlaskConical, title: "전후 비교시험 측정", desc: "수기 vs AX — 발견시간·정확도·재판단시간 기록" },
          { href: "/records", icon: Database, title: "기록 확인·내보내기", desc: "입력 이력·판단 전후·측정 결과, CSV·JSON" },
        ].map((x) => (
          <Link key={x.href} href={x.href} className="card flex min-h-[7rem] flex-col justify-center gap-1 p-4 transition-colors hover:bg-primary-light">
            <span className="flex items-center gap-2 text-[20px] font-extrabold">
              <x.icon size={24} className="text-primary" /> {x.title}
            </span>
            <span className="text-[15px] text-ink-3">{x.desc}</span>
          </Link>
        ))}
      </section>

      {/* 0.4.0 — 로그인 · 중앙 DB 실증 시스템 (현장기사 휴대폰 · 본사 관리자) 바로가기 */}
      <a
        href="/pilot"
        aria-label="실증 시스템 열기"
        className="flex items-center gap-3 rounded-[20px] bg-gradient-to-br from-[#4f46e5] to-[#3730a3] p-4 text-white shadow-[0_14px_32px_-16px_rgba(79,70,229,0.7)] transition-transform hover:-translate-y-0.5"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
          <ShieldCheck size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[19px] font-extrabold">실증 시스템 (로그인 · 중앙 DB)</span>
          <span className="block text-[14.5px] text-white/80">현장기사 휴대폰 화면 · 본사 관리자 대시보드 — 0.4.0 새 화면. 계정이 있어야 들어갑니다.</span>
        </span>
        <ArrowRight size={22} className="shrink-0" />
      </a>

      <BackupCard />

      <section className="card space-y-2 p-4" aria-label="최근 입력기록">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-extrabold">최근 입력기록</h2>
          <Link href="/records" className="text-[15.5px] font-bold text-primary-dark underline">
            전체 보기
          </Link>
        </div>
        <Recent s={state} />
      </section>
    </div>
  );
}

function Recent({ s }: { s: LabState }) {
  type Row = { at: string; text: string; who: string; kind?: React.ReactNode };
  const rows: Row[] = [];
  for (const e of s.entries) {
    const x = s.sessions.find((o) => o.id === e.sessionId)!;
    const site = currentSchedules(s, x.id).find((o) => o.id === e.scheduleId)?.siteName ?? "";
    rows.push({
      at: e.enteredAt,
      text:
        e.type === "schedule"
          ? `${site} 일정 ${e.changeKind}`
          : `${site} ${e.kind}${e.expectedEnd ? ` ${e.expectedEnd}` : ""} · ${x.kind === "가상 시나리오" ? "가상 시각" : "실제"} ${e.occurredAt ? kst(e.occurredAt).time : "시각 모름"}`,
      who: `입력 ${personName(s, e.enteredBy)} · 제공 ${personName(s, e.informantId)}`,
      kind: <KindBadge kind={x.kind} />,
    });
  }
  for (const t of s.trials) rows.push({ at: t.createdAt, text: `비교시험 #${t.no} ${t.method} · ${t.scenario}${t.voided ? " (무효)" : ""}`, who: `참가자 ${personName(s, t.participantId)} · 입력 ${personName(s, t.operatorId)}` });
  for (const n of s.notes) rows.push({ at: n.at, text: `${n.type}: ${n.text.slice(0, 40)}`, who: `${personName(s, n.speakerId)} · ${n.confirmation}` });
  rows.sort((a, b) => (a.at < b.at ? 1 : -1));
  if (rows.length === 0) return <p className="text-[16px] text-ink-3">아직 입력한 기록이 없습니다.</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.slice(0, 6).map((r, i) => (
        <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-2 text-[16px]">
          <span className="tabular-nums text-ink-3">{kst(r.at).date.slice(5)} {kst(r.at).time}</span>
          {r.kind}
          <b className="min-w-0">{r.text}</b>
          <span className="text-[14.5px] text-ink-3">{r.who}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * 예시 기록 2건 — 이 브라우저에 가상 시나리오 세트 2개를 만들어 화면이 어떻게 이어지는지 바로 보게 한다.
 * 화면 버튼과 같은 입력 함수 · 같은 엔진을 쓰고, 예시 표시가 붙으며, '예시 기록 지우기'로 예시만 뺄 수 있다.
 */
function ExampleCard({ s }: { s: LabState }) {
  const router = useRouter();
  const op = useOperator();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const has = hasExamples(s);
  const make = () => {
    const r = commit((st, c) => {
      const out = loadExamples(st, op, c);
      return { state: out.state, value: out.sessionIds };
    });
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    if (r.value[0]) setPref("session", r.value[0]);
    setMsg({ ok: true, text: "예시 기록 2건을 만들었습니다 — 현장 실증 화면으로 갑니다." });
    router.push("/field");
  };
  const remove = () => {
    const r = commit((st, c) => ({ state: removeExamples(st, c), value: null }));
    setConfirm(false);
    setMsg(r.ok ? { ok: true, text: "예시 기록을 지웠습니다. 다른 기록은 그대로입니다." } : { ok: false, text: r.error });
  };
  return (
    <section className="card space-y-3 border-2 border-dashed border-[#94a3b8] p-4" aria-label="예시 기록">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[19px] font-extrabold">{has ? "예시 기록 2건이 들어 있습니다" : "처음이면 — 예시 기록 2건 만들어 보기"}</h2>
          <p className="text-[15px] text-ink-2">
            {has
              ? "가상 시나리오입니다. 현장 실증에서 세트를 골라 일정 · 작업 기록 · 현장 문제 · 위험 판단 전후를 보세요."
              : "누르면 이 브라우저에 가상 시나리오 세트 2개가 만들어집니다. 일정 등록부터 문제 보고 · 본사 지원 · 일정 조정 · 재판단 · 해결까지 실제 화면과 같은 방법으로 입력되고, 위험 판단도 같은 엔진이 계산합니다."}
          </p>
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {EXAMPLE_CASES.map((x) => (
          <li key={x.title} className="rounded-2xl bg-[#f7f8fa] px-3.5 py-3 text-[15px]">
            <b className="block">{x.title}</b>
            <span className="text-ink-3">
              {x.worker} · {x.sites.map((o) => o.title).join(" → ")}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        {!has ? (
          <button onClick={make} className="inline-flex min-h-[3rem] items-center gap-2 rounded-xl bg-primary px-5 text-[17px] font-bold text-white hover:bg-primary-dark">
            <PlayCircle size={20} /> 예시 기록 2건 만들기
          </button>
        ) : (
          <>
            <Link href="/field" className="inline-flex min-h-[3rem] items-center gap-2 rounded-xl bg-primary px-5 text-[17px] font-bold text-white hover:bg-primary-dark">
              현장 실증에서 보기 <ArrowRight size={18} />
            </Link>
            {confirm ? (
              <span className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-danger-bg px-3 py-2 text-[15px] font-semibold text-danger">
                예시 세트 2개와 그 기록만 지웁니다.
                <button onClick={remove} className="rounded-lg bg-danger px-3 py-1.5 font-bold text-white">
                  지우기
                </button>
                <button onClick={() => setConfirm(false)} className="rounded-lg bg-white px-3 py-1.5 font-bold text-ink-2">
                  그만두기
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirm(true)} className="inline-flex min-h-[3rem] items-center gap-2 rounded-xl bg-[#f2f4f6] px-4 text-[16px] font-bold text-ink-2 hover:bg-[#e8ebee]">
                <Trash2 size={18} /> 예시 기록 지우기
              </button>
            )}
          </>
        )}
      </div>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-3 py-2 text-[15.5px] font-semibold ${msg.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>
          {msg.text}
        </p>
      )}
      <p className="text-[13.5px] text-ink-3">이 브라우저에만 저장됩니다 (중앙 DB 아님). 실제 현장 기록이 아니며 &lsquo;가상 시나리오&rsquo;로 표시됩니다.</p>
    </section>
  );
}

