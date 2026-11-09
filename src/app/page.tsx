"use client";

import Link from "next/link";
import { ClipboardList, Database, FlaskConical } from "lucide-react";
import { useLab } from "@/lib/lab/store";
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
      text: e.type === "schedule" ? `${site} 일정 ${e.changeKind}` : `${site} ${e.kind}${e.type === "event" && e.expectedEnd ? ` ${e.expectedEnd}` : ""}${e.type === "event" ? ` · 실제 ${e.occurredAt ? kst(e.occurredAt).time : "시각 모름"}` : ""}`,
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
