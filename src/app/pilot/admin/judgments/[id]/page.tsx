import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/pilot/session";
import { kindParam, loadStaff } from "@/lib/pilot/board";
import { recheckJudgment, type DataKind, type JudgmentSummary } from "@/lib/pilot/core";
import { UUID_RE } from "@/lib/pilot/op-id";
import { kst, kstLabel } from "@/lib/pilot/time";
import type { PipelineInput, PipelineResult } from "@/lib/state-events";
import type { RiskDiff } from "@/lib/risk-engine";
import type { PriorityChange } from "@/lib/priority-engine";
import { Badge } from "@/components/ui";
import { AdminNav, KindBanner } from "../../AdminNav";
import { JudgmentFocus } from "../../../_ui/JudgmentFocus";
import { PrintButton } from "../../../_ui/PrintButton";

interface JudgmentRow {
  id: string;
  seq: number;
  data_kind: DataKind;
  work_date: string;
  as_of: string;
  trigger_kind: string;
  trigger_ref: string;
  triggered_by: string;
  rule_version: string;
  state_version: string;
  priority_version: string;
  app_version: string;
  input_before: PipelineInput;
  input_after: PipelineInput;
  result_before: PipelineResult;
  result_after: PipelineResult;
  changes: RiskDiff;
  priority_changes: PriorityChange[];
  summary: JudgmentSummary;
  payload_sha256: string;
  computed_at: string;
  recorded_at: string;
}

function Item({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[14.5px] font-semibold text-ink-3">{k}</dt>
      <dd className="text-[16.5px] break-all tabular-nums">{v}</dd>
    </div>
  );
}

const linkText = (l: { status: string; grade: string | null; slack: number | null } | null) =>
  !l ? "연결 없음" : l.status !== "판정" ? l.status : `${l.grade === "없음" ? "위험 없음" : `위험 ${l.grade}`}${l.slack === null ? "" : l.slack < 0 ? ` · ${-l.slack}분 부족` : ` · 여유 ${l.slack}분`}`;

/** 위험 판단 1건 — 계기 기록 · 판단 전후 · 재계산 확인 · 판단 입력 (인쇄해 보고서 첨부로 쓸 수 있는 형태) */
export default async function JudgmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const s = await requireAdmin();
  const { data } = await s.sb.from("risk_judgments").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const j = data as JudgmentRow;
  const staff = await loadStaff(s.sb);
  const name = (uid: string) => staff.find((p) => p.id === uid)?.display_name ?? "알 수 없음";
  const names = Object.fromEntries(staff.map((p) => [p.id, p.display_name]));
  const titles = Object.fromEntries([...j.input_before.planned, ...j.input_after.planned].map((p) => [p.id, p.title]));
  const linkName = (key: string) => key.split(">").map((x) => titles[x] ?? x).join(" → ");

  const isEvent = j.trigger_kind.startsWith("작업 이벤트");
  const ev = isEvent
    ? (await s.sb.from("work_events").select("*").eq("id", j.trigger_ref).maybeSingle()).data
    : null;
  const rev = !isEvent ? (await s.sb.from("schedule_revisions").select("*").eq("seq", j.seq).maybeSingle()).data : null;
  const check = recheckJudgment(j);
  // 판단 입력 표는 계기 현장 담당자의 일정만 보여 준다 (그날 전체 입력은 원본 JSON)
  const siteId = ev?.schedule_id ?? rev?.schedule_id ?? null;
  const worker = j.input_after.planned.find((p) => p.id === siteId)?.workerId ?? null;
  const planned = j.input_after.planned.filter((p) => !worker || p.workerId === worker);
  const plannedIds = new Set(planned.map((p) => p.id));
  const events = j.input_after.events.filter((e) => plannedIds.has(e.siteId));
  const back = `/pilot/admin/records?date=${j.work_date}&kind=${kindParam(j.data_kind)}`;

  return (
    // print-area: 공용 인쇄 규칙(globals.css)은 이 영역만 인쇄한다 — 없으면 PDF가 빈 쪽으로 나온다
    <div className="print-area space-y-5" aria-label="위험 판단 기록">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[27px] font-extrabold">
          위험 판단 번호 {j.seq} <span className="text-[19px] font-semibold text-ink-3">{j.work_date} · {j.data_kind}</span>
        </h1>
        <AdminNav current="records" />
      </div>
      <div className="flex flex-wrap gap-2 print:hidden">
        <Link href={back} className="rounded-xl bg-white px-3.5 py-1.5 text-[17px] font-bold text-ink-2 hover:bg-[#e8ebee]">
          ← 기록·판단 이력
        </Link>
        <PrintButton />
        <a href={`/pilot/admin/judgments/${j.id}/json`} className="rounded-xl bg-white px-3.5 py-1.5 text-[17px] font-bold text-ink-2 hover:bg-[#e8ebee]">
          원본 JSON 내려받기
        </a>
      </div>
      <KindBanner kind={j.data_kind} />

      <section className="card space-y-3 p-5" aria-label="판단 정보">
        <h2 className="text-[21px] font-extrabold">판단 정보</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Item k="계기" v={j.trigger_kind} />
          <Item k="계기 기록자" v={name(j.triggered_by)} />
          <Item k="판단 기준시각" v={kstLabel(j.as_of)} />
          <Item k="서버 계산 시각 · DB 기록시각" v={`${kstLabel(j.computed_at)} · ${kst(j.recorded_at).seconds}`} />
          <Item k="연쇄위험 규칙 버전" v={j.rule_version} />
          <Item k="상태편차 · 우선순위 버전" v={`${j.state_version} · ${j.priority_version}`} />
          <Item k="프로그램 버전" v={j.app_version} />
          <Item k="판단 원문 해시 (SHA-256)" v={<span className="text-[13px]">{j.payload_sha256}</span>} />
        </dl>
        <p className={`rounded-xl px-3.5 py-2 text-[16.5px] font-semibold ${check.checked && check.before && check.after ? "bg-success-bg text-success" : "bg-warning-bg text-warning"}`}>
          재계산 확인: {check.reason}
        </p>
      </section>

      <section className="card space-y-2 p-5" aria-label="계기 기록">
        <h2 className="text-[21px] font-extrabold">계기 기록</h2>
        {ev && (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Item k="현장 · 기록" v={`${titles[ev.schedule_id] ?? ""} · ${ev.kind}${ev.expected_end ? ` (${ev.expected_end.slice(0, 5)} 종료 예상)` : ""}`} />
            <Item k="입력자 · 경로" v={`${name(ev.actor_id)} · ${ev.source}`} />
            <Item k="입력 방식" v={ev.entry_mode} />
            <Item k="정정·무효 대상" v={ev.voids_event_id ? "있음 (이전 기록을 대체)" : "없음"} />
            <Item k="실제 발생시각" v={kstLabel(ev.occurred_at)} />
            <Item k="사용자가 입력한 시각" v={ev.entered_time ? ev.entered_time.slice(0, 5) : "- (즉시 기록)"} />
            <Item k="DB 기록시각" v={kstLabel(ev.recorded_at)} />
            <Item k="전송 지연 (기기 기준)" v={ev.send_delay_seconds === null ? "-" : `${ev.send_delay_seconds}초`} />
            <Item k="기기에서 누른 시각 (기기 시계)" v={ev.client_pressed_at ? kstLabel(ev.client_pressed_at) : "-"} />
            <Item k="기기에서 보낸 시각 (기기 시계)" v={ev.client_sent_at ? kstLabel(ev.client_sent_at) : "-"} />
          </dl>
        )}
        {rev && (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Item k="현장 · 변경" v={`${rev.snapshot.site_name} · ${rev.change_kind} (수정본 ${rev.revision})`} />
            <Item k="담당" v={name(rev.snapshot.assignee_id)} />
            <Item k="예정" v={`${rev.snapshot.planned_start.slice(0, 5)}~${rev.snapshot.planned_end.slice(0, 5)}`} />
            <Item k="이동시간" v={rev.snapshot.travel_minutes === null ? "없음" : `${rev.snapshot.travel_minutes}분 (${titles[rev.snapshot.travel_from_id] ?? "출발 현장 없음"}에서)`} />
            <Item k="관리자" v={name(rev.actor_id)} />
            <Item k="DB 기록시각" v={kstLabel(rev.recorded_at)} />
          </dl>
        )}
      </section>

      <section className="card space-y-3 p-5" aria-label="판단 전후">
        <h2 className="text-[21px] font-extrabold">판단 전 → 판단 후</h2>
        <div className="flex flex-wrap gap-2 text-[17px]">
          <Badge tone={j.summary.risky_after > j.summary.risky_before ? "danger" : "neutral"}>
            위험 연결 {j.summary.risky_before} → {j.summary.risky_after}
          </Badge>
          <Badge tone="neutral">
            판단 보류 {j.summary.held_before} → {j.summary.held_after}
          </Badge>
          <Badge tone="neutral">바뀐 연결 {j.summary.changed_links}</Badge>
          <Badge tone="neutral">예상 시각이 바뀐 현장 {j.summary.affected_sites}</Badge>
        </div>
        {j.changes.changes.length > 0 && (
          <table className="w-full text-[16px]">
            <thead className="text-ink-3">
              <tr>
                <th className="py-1 pr-3 text-left font-semibold">연결</th>
                <th className="py-1 pr-3 text-left font-semibold">변화</th>
                <th className="py-1 pr-3 text-left font-semibold">판단 전</th>
                <th className="py-1 text-left font-semibold">판단 후</th>
              </tr>
            </thead>
            <tbody>
              {j.changes.changes.map((c) => (
                <tr key={c.key} className="border-t border-line">
                  <td className="py-1.5 pr-3 font-semibold">{linkName(c.key)}</td>
                  <td className="py-1.5 pr-3">{c.kind}</td>
                  <td className="py-1.5 pr-3">{linkText(c.before)}</td>
                  <td className="py-1.5">{linkText(c.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-[#f7f8fa] px-4 py-3">
            <p className="text-[16px] font-bold text-ink-3">대응 우선순위 · 판단 전</p>
            {j.summary.priority_before.length === 0 ? <p className="text-[16.5px]">없음</p> : j.summary.priority_before.map((x) => <p key={x} className="text-[16.5px]">{x}</p>)}
          </div>
          <div className="rounded-2xl border border-line px-4 py-3">
            <p className="text-[16px] font-bold text-ink-3">대응 우선순위 · 판단 후</p>
            {j.summary.priority_after.length === 0 ? <p className="text-[16.5px]">없음</p> : j.summary.priority_after.map((x) => <p key={x} className="text-[16.5px] font-semibold">{x}</p>)}
          </div>
        </div>
        <p className="text-[15px] text-ink-3">점수는 관리자 판단을 돕는 규칙 기반 순서이며 사고 확률이 아닙니다.</p>
      </section>

      <JudgmentFocus
        result={j.result_after}
        changedKeys={j.changes.changes.map((c) => c.key)}
        siteId={siteId}
        names={names}
        titles={titles}
      />

      <section className="card overflow-x-auto p-5" aria-label="판단 입력">
        <h2 className="mb-1 text-[21px] font-extrabold">판단 입력 (판단 후 · {worker ? `${name(worker)} 담당` : "전체"})</h2>
        <p className="mb-2 text-[15.5px] text-ink-3">
          이 판단에 쓴 일정과 작업 기록 그대로입니다 (정정·무효로 대체된 기록은 빠짐). 그날 전체 입력 일정 {j.input_after.planned.length}건 · 작업 기록 {j.input_after.events.length}건은 원본 JSON 에 있습니다.
        </p>
        <table className="w-full min-w-[40rem] text-[15.5px] tabular-nums">
          <thead className="text-ink-3">
            <tr>
              <th className="py-1 pr-3 text-left font-semibold">현장</th>
              <th className="py-1 pr-3 text-left font-semibold">담당</th>
              <th className="py-1 pr-3 text-left font-semibold">예정</th>
              <th className="py-1 pr-3 text-left font-semibold">이동시간</th>
              <th className="py-1 text-left font-semibold">상태</th>
            </tr>
          </thead>
          <tbody>
            {planned.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="py-1.5 pr-3">{p.title}</td>
                <td className="py-1.5 pr-3">{name(p.workerId)}</td>
                <td className="py-1.5 pr-3">
                  {p.plannedStart}~{p.plannedEnd}
                </td>
                <td className="py-1.5 pr-3">{p.travelMinutes == null ? "없음" : `${p.travelMinutes}분 (${p.travelFromId ? (titles[p.travelFromId] ?? "") : ""})`}</td>
                <td className="py-1.5">{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="mt-3 w-full min-w-[40rem] text-[15.5px] tabular-nums">
          <thead className="text-ink-3">
            <tr>
              <th className="py-1 pr-3 text-left font-semibold">작업 기록</th>
              <th className="py-1 pr-3 text-left font-semibold">현장</th>
              <th className="py-1 pr-3 text-left font-semibold">실제 시각</th>
              <th className="py-1 pr-3 text-left font-semibold">값</th>
              <th className="py-1 text-left font-semibold">기록 경로 · 구분</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-1.5 text-ink-3">
                  작업 기록 없음
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="border-t border-line">
                  <td className="py-1.5 pr-3">{e.kind}</td>
                  <td className="py-1.5 pr-3">{titles[e.siteId] ?? ""}</td>
                  <td className="py-1.5 pr-3">{e.at?.replace("T", " ") ?? "-"}</td>
                  <td className="py-1.5 pr-3">{e.value ?? "-"}</td>
                  <td className="py-1.5">
                    {e.source} · {e.origin}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
