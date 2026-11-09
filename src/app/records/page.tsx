"use client";

import { useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, FileText } from "lucide-react";
import { useLab } from "@/lib/lab/store";
import {
  activeLabEvents,
  currentSchedules,
  isProxy,
  LAB_KINDS,
  personName,
  repeatNo,
  replacedBy,
  sessionEvents,
  sessionRound,
  type LabKind,
  type LabState,
} from "@/lib/lab/model";
import { CSV_SETS } from "@/lib/lab/exporting";
import { kst } from "@/lib/pilot/time";
import { LabAlerts } from "@/components/lab/LabAlerts";
import { BackupCard, ImportBox } from "@/components/lab/Backup";
import { HistoryList } from "@/components/lab/History";
import { KindBadge, btnGhost, download, kstDT } from "@/components/lab/common";

export default function RecordsPage() {
  const { state } = useLab();
  const [kind, setKind] = useState<LabKind | "전체">("전체");
  const [sid, setSid] = useState<string>("");
  if (!state) return <LabAlerts />;
  const stamp = kst(new Date());
  return (
    <div className="space-y-4">
      <LabAlerts />
      <BackupCard />
      <ImportBox />

      <section className="card space-y-2 p-4" aria-label="CSV 내보내기">
        <h2 className="text-[20px] font-extrabold">CSV 내보내기 (엑셀에서 열림)</h2>
        <div className="flex flex-wrap gap-2">
          {CSV_SETS.map((c) => (
            <button key={c.key} className={btnGhost} onClick={() => download(`hana-ax-${c.file}-${stamp.date}.csv`, c.make(state), "text/csv;charset=utf-8")}>
              <FileSpreadsheet size={18} /> {c.label}
            </button>
          ))}
        </div>
        <p className="text-[14.5px] text-ink-3">모든 CSV 에 데이터 구분(실제 업무·사후 재현·가상 시나리오)과 입력자·정보 제공자·자료 출처가 들어갑니다. 전체 원자료는 JSON 백업입니다.</p>
      </section>

      <section className="card space-y-2 p-4" aria-label="결과보고서">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-[20px] font-extrabold">결과보고서 정리</h2>
          <Link href="/records/report" className="inline-flex min-h-[2.9rem] items-center gap-1.5 rounded-xl bg-primary px-4 text-[17.5px] font-bold text-white">
            <FileText size={18} /> 보고서 정리 화면
          </Link>
        </div>
        <p className="text-[15px] text-ink-3">① 기간·참가자·횟수 ~ ⑦ 한계를 저장된 실측 기록으로 모읍니다. 측정하지 않은 값은 만들지 않습니다.</p>
      </section>

      <Sessions s={state} />

      <section className="card space-y-2 p-4" aria-label="입력 이력">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-[20px] font-extrabold">입력 이력</h2>
          <select value={kind} onChange={(e) => setKind(e.target.value as LabKind | "전체")} className="rounded-xl border border-line px-2 py-1.5 text-[16px]" aria-label="데이터 구분 거르기">
            <option>전체</option>
            {LAB_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <Entries s={state} kind={kind} />
      </section>

      <section className="card space-y-2 p-4" aria-label="위험 판단 전후">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 text-[20px] font-extrabold">위험 판단 전 → 후 (기록 1건마다)</h2>
          <select value={sid} onChange={(e) => setSid(e.target.value)} className="rounded-xl border border-line px-2 py-1.5 text-[16px]" aria-label="세트 거르기">
            <option value="">모든 세트</option>
            {state.sessions.map((x) => (
              <option key={x.id} value={x.id}>
                세트 {x.no} · {x.title}
              </option>
            ))}
          </select>
        </div>
        <HistoryList s={state} sessionId={sid || undefined} limit={30} />
      </section>
    </div>
  );
}

function Sessions({ s }: { s: LabState }) {
  if (s.sessions.length === 0) return null;
  return (
    <section className="card overflow-x-auto p-4" aria-label="실증 세트와 회차">
      <h2 className="mb-2 text-[20px] font-extrabold">실증 세트·회차 ({s.sessions.length})</h2>
      <table className="w-full min-w-[52rem] text-[15.5px]">
        <thead className="text-[14px] text-ink-3">
          <tr>
            {["세트", "구분", "이름", "현장 업무", "핵심 참여자", "만든 날 · 회차", "반복", "출처", "일정", "작업 기록"].map((h) => (
              <th key={h} className="py-1 pr-2 text-left font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...s.sessions].reverse().map((x) => (
            <tr key={x.id} className="border-t border-line">
              <td className="py-1.5 pr-2 font-bold">{x.no}</td>
              <td className="py-1.5 pr-2">
                <KindBadge kind={x.kind} />
              </td>
              <td className="py-1.5 pr-2">{x.title}</td>
              <td className="py-1.5 pr-2">{x.workDate}</td>
              <td className="py-1.5 pr-2">{personName(s, x.participantId)}</td>
              <td className="py-1.5 pr-2 whitespace-nowrap">
                {kst(x.createdAt).date} · {sessionRound(s, x)}회차
              </td>
              <td className="py-1.5 pr-2">{repeatNo(s, x)}회</td>
              <td className="py-1.5 pr-2">
                {x.source}
                {x.sourceRef && <span className="block text-[13.5px] text-ink-3">{x.sourceRef}</span>}
              </td>
              <td className="py-1.5 pr-2">{currentSchedules(s, x.id).length}</td>
              <td className="py-1.5 pr-2">{sessionEvents(s, x.id).length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Entries({ s, kind }: { s: LabState; kind: LabKind | "전체" }) {
  const sessions = s.sessions.filter((x) => kind === "전체" || x.kind === kind);
  const rows = s.entries.filter((e) => sessions.some((x) => x.id === e.sessionId)).slice().reverse();
  if (rows.length === 0) return <p className="text-[16px] text-ink-3">기록이 없습니다.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[72rem] text-[15px] tabular-nums">
        <thead className="text-[13.5px] text-ink-3">
          <tr>
            {["번호", "세트·구분", "현장", "기록", "실제 발생시각 (근거)", "프로그램 입력시각", "입력자", "정보 제공자", "본인/대리", "자료 출처", "상태"].map((h) => (
              <th key={h} className="py-1 pr-2 text-left font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const x = s.sessions.find((o) => o.id === e.sessionId)!;
            const sched = currentSchedules(s, x.id).find((o) => o.id === e.scheduleId);
            const evs = sessionEvents(s, x.id);
            const rep = replacedBy(evs).get(e.seq);
            const alive = e.type === "event" && activeLabEvents(evs).some((o) => o.seq === e.seq);
            return (
              <tr key={e.seq} className="border-t border-line align-top">
                <td className="py-1.5 pr-2">{e.seq}</td>
                <td className="py-1.5 pr-2 whitespace-nowrap">
                  {x.no} <KindBadge kind={x.kind} />
                </td>
                <td className="py-1.5 pr-2">{sched?.siteName ?? ""}</td>
                <td className="py-1.5 pr-2 font-semibold">
                  {e.type === "schedule" ? `일정 ${e.changeKind}` : e.kind}
                  {e.type === "event" && e.expectedEnd && ` ${e.expectedEnd}`}
                  {e.type === "event" && e.voidsSeq !== null && <span className="block text-[13.5px] font-normal text-ink-3">번호 {e.voidsSeq} 대체</span>}
                </td>
                <td className="py-1.5 pr-2">{e.type === "event" ? `${e.occurredAt ? kstDT(e.occurredAt) : "모름"} (${e.timeBasis})` : "-"}</td>
                <td className="py-1.5 pr-2 whitespace-nowrap">{kst(e.enteredAt).date} {kst(e.enteredAt).seconds}</td>
                <td className="py-1.5 pr-2">{personName(s, e.enteredBy)}</td>
                <td className="py-1.5 pr-2">{personName(s, e.informantId)}</td>
                <td className="py-1.5 pr-2">{e.type === "event" ? (isProxy(e.enteredBy, sched?.workerId ?? null) ? "대리" : "본인") : "-"}</td>
                <td className="py-1.5 pr-2">
                  {e.source}
                  {e.sourceRef && <span className="block text-[13.5px] text-ink-3">{e.sourceRef}</span>}
                </td>
                <td className="py-1.5 pr-2">{e.type === "schedule" ? "-" : e.kind === "기록 무효" ? "무효 처리" : rep ? `${rep.kind === "기록 무효" ? "무효" : "정정됨"} (${rep.seq})` : alive ? "유효" : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
