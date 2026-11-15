import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/pilot/session";
import { loadStaff } from "@/lib/pilot/board";
import { loadCaseEvidence } from "@/lib/pilot/case-data";
import { CLASS_LABEL, caseChanges, caseLinkFilter, caseSpans, classOf, fmtSpan, isTestOnly, tally, timeMeaning } from "@/lib/pilot/cases";
import { UUID_RE } from "@/lib/pilot/op-id";
import { kst, kstLabel } from "@/lib/pilot/time";
import { appVersion } from "@/lib/pilot/config";
import type { JudgmentSummary } from "@/lib/pilot/core";
import type { LinkChange, RiskLink } from "@/lib/risk-engine";
import { PrintButton } from "../../../_ui/PrintButton";

/**
 * 사건 증빙 — 사건번호 하나로 현장 사진 · 입력 기록 · 관리자 조치 · 엔진 입력 · 위험 판단 전후를 묶는다 (인쇄 → PDF)
 * 1쪽: 핵심 흐름 요약 (현장 문제 → 엔진 계산 → 관리자 조치 → 조치 전후) · 2쪽부터: 상세 증빙 1~6
 * 가상 시나리오의 시각은 '실제 시각'이라고 쓰지 않는다 — 시험 중 누른 시각 / 시험용 가정 시각 / 서버 기록을 나눈다.
 */
export default async function CaseEvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const [ev, staff] = await Promise.all([loadCaseEvidence(s.sb, id), loadStaff(s.sb)]);
  if (!ev) notFound();
  const c = ev.cases[0];
  const names = Object.fromEntries(staff.map((p) => [p.id, p.display_name]));
  const who = (x: unknown) => names[String(x)] ?? String(x ?? "-");
  const spans = caseSpans(c, ev.steps);
  const dt = (x: unknown) => (x ? kstLabel(String(x)) : "모름");
  // 사건 날짜와 같은 날이면 시각만 (초까지)
  const tm = (x: unknown) => {
    if (!x) return "모름";
    const k = kst(String(x));
    return k.date === c.work_date ? k.seconds : `${k.date} ${k.seconds}`;
  };
  const site = String(ev.schedule?.site_name ?? "현장");
  const h2 = "text-[19px] font-extrabold print:mt-1";
  const td = "py-1.5 pr-2 align-top";
  type J = {
    seq: number;
    trigger_kind: string;
    as_of: string;
    summary: JudgmentSummary;
    changes: { changes: LinkChange[] };
    result_before: { risk: { links: RiskLink[] } };
    result_after: { risk: { links: RiskLink[] } };
    rule_version: string;
    state_version: string;
    priority_version: string;
    app_version: string;
    payload_sha256: string;
    recorded_at: string;
  };
  const judgments = ev.judgments as unknown as J[];
  const cls = classOf(c);
  const testOnly = isTestOnly(c);
  const siteOf = new Map(ev.workerSchedules.map((x) => [x.id, x.site]));
  const linkName = (key: string) =>
    key
      .split(">")
      .map((x) => siteOf.get(x) ?? "다른 기사 현장")
      .join(" → ");
  const grade = (x: LinkChange["before"]) => x?.grade ?? x?.status ?? "연결 없음";
  const meaning = (basis: string) => timeMeaning(c, basis);
  const timeHead = testOnly ? "시험 시각 (실제 현장 발생시각 아님)" : cls === "현장정보 재현" ? "재현 시각 (근거)" : "발생 시각 (근거)";

  // ── 요약용: 보고 시점 판단 · 마지막 조치 재판단 · 이 사건 연결 ──
  const events = ev.events as { id: string; seq: number; kind: string; expected_end: string | null; occurred_at: string; entry_mode: string; recorded_at: string }[];
  const reportSeq = events.find((e) => e.id === c.end_event_id)?.seq;
  const reportJ = judgments.find((j) => j.seq === reportSeq) ?? null;
  const actionJs = judgments.filter((j) => j.seq !== reportSeq);
  const lastJ = actionJs[actionJs.length - 1] ?? null;
  const isCase = caseLinkFilter(ev.workerSchedules, c.schedule_id, c.worker_id);
  const linksOf = (j: J | null, side: "result_before" | "result_after") => new Map((j?.[side]?.risk?.links ?? []).filter((l) => isCase(l.key)).map((l) => [l.key, l]));
  const before = linksOf(reportJ, "result_before");
  const afterReport = linksOf(reportJ, "result_after");
  const afterAction = linksOf(lastJ, "result_after");
  const keys = [...new Set([...afterReport.keys(), ...afterAction.keys()])].sort((a, b) => (afterReport.get(a)?.order ?? afterAction.get(a)?.order ?? 0) - (afterReport.get(b)?.order ?? afterAction.get(b)?.order ?? 0));
  const state = (l?: RiskLink) =>
    !l ? "-" : l.status !== "판정" ? l.status : `${l.grade ?? "없음"}${l.slack !== null ? (l.slack < 0 ? ` · ${-l.slack}분 늦음` : ` · 여유 ${l.slack}분`) : ""}`;
  const changeOf = (key: string, j: J | null) => j?.changes.changes.find((x) => x.key === key)?.kind ?? "변화 없음";
  const plannedEnd = String(ev.schedule?.planned_end ?? "").slice(0, 5);
  const endShift = (() => {
    if (!c.expected_end || !plannedEnd) return null;
    const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    return m(c.expected_end.slice(0, 5)) - m(plannedEnd);
  })();
  const reported = Date.parse(c.reported_at);
  const since = (x: string | null) => {
    if (!x) return "";
    const sec = Math.round((Date.parse(x) - reported) / 1000);
    return sec < 60 ? `+${sec}초` : `+${Math.floor(sec / 60)}분 ${sec % 60}초`;
  };
  const tallyReport = reportJ ? tally(caseChanges(reportJ.changes.changes, ev.workerSchedules, c.schedule_id, c.worker_id).mine) : null;
  const tallyAction = actionJs.map((j) => tally(caseChanges(j.changes.changes, ev.workerSchedules, c.schedule_id, c.worker_id).mine));
  const versions = [...new Set(ev.steps.map((x) => x.app_version))];
  const box = "rounded-xl border border-line p-3 print:p-2";
  const th = "py-1 pr-2 text-left text-[13.5px] font-semibold text-ink-3";

  return (
    <div className="mx-auto max-w-[62rem] space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href="/pilot/admin/cases" className="rounded-xl bg-white px-3 py-1.5 text-[17px] font-semibold text-ink-2">
          ← 현장 문제·지원
        </Link>
        <PrintButton />
        <a href={`/pilot/admin/cases/${c.id}/export?format=json`} className="rounded-xl bg-white px-3 py-1.5 text-[17px] font-semibold text-ink-2">
          JSON 내려받기
        </a>
        <a href={`/pilot/admin/cases/${c.id}/export?format=csv`} className="rounded-xl bg-white px-3 py-1.5 text-[17px] font-semibold text-ink-2">
          CSV 내려받기
        </a>
      </div>
      {/* print-area: 공용 인쇄 규칙(globals.css)은 이 영역만 인쇄한다 — 없으면 PDF가 빈 쪽으로 나온다 */}
      <article className="card print-area print-compact space-y-4 p-5" aria-label="사건 증빙">
        <header>
          <h1 className="text-[24px] font-extrabold">
            사건 증빙 {c.case_no} — {site}
          </h1>
          <p className="text-[14.5px] text-ink-3">
            출력 {kstLabel(new Date())} · 출력 프로그램 {appVersion()} · 자료 구분 <b>{CLASS_LABEL[cls]}</b> ({c.data_kind}) · 서버 기록시각은 DB 서버가 정한 값 · 계산값 = 기존 연쇄위험 엔진 결과
          </p>
          <p
            aria-label="자료 구분 안내"
            className={`mt-1.5 rounded-lg border px-3 py-2 text-[15px] font-semibold ${cls === "실제 업무" ? "border-success bg-success-bg text-success" : cls === "현장정보 재현" ? "border-primary bg-primary-light text-primary-dark" : "border-dashed border-[#8b5cf6] bg-[#f5f0ff] text-[#5b21b6]"}`}
          >
            {cls === "실제 업무" && "실제 업무 기록 — 그날 실제로 일어난 일을 그때 입력한 기록입니다."}
            {cls === "현장정보 재현" && `실제 과거 현장정보 재현 — 원자료: ${c.source_ref}. 지난 사례를 원자료·진술로 다시 입력한 기록이며, 시각 근거를 항목마다 따로 표시합니다.`}
            {cls === "가상 시나리오" &&
              "가상 시나리오 — 시험용 가정값입니다. 인물·현장·사진은 시험용이며 실제 참여자·실제 현장·실제 현장사진이 아닙니다. 시각은 시험 중 누른 시각 또는 시험용 가정 시각이며 실제 현장 발생시각이 아닙니다. 업무 효과의 근거로 쓰지 않습니다."}
            {cls === "분류 확인 필요" &&
              "분류 확인 필요 — '현장정보 재현'으로 저장됐지만 원자료 기록이 없습니다. 실제 과거 사례 재현으로 인정하지 않고 가상 시나리오와 같이 다룹니다 (기록은 고치지 않음). 인물·현장·사진·시각은 시험용입니다."}
          </p>
        </header>

        {/* ── 1쪽: 핵심 흐름 요약 ───────────────────────────── */}
        <section className="space-y-3 print:break-after-page" aria-label="핵심 흐름 요약">
          <h2 className="text-[21px] font-extrabold">핵심 흐름 요약 — 현장 문제 → 엔진 계산 → 관리자 조치 → 조치 전후</h2>

          <div className={box}>
            <p className="text-[14px] font-bold text-ink-3">① 현장 문제 (입력값)</p>
            <p className="text-[17px] font-bold">
              {c.issue_type} · {c.progress}
              {c.urgency === "긴급" ? " · 긴급" : ""} · 요청 {c.needs.join(", ") || "없음"}
            </p>
            <p className="text-[15px]">
              발견 {tm(c.discovered_at)} ({meaning(c.discovered_basis)}) → 보고 {tm(c.reported_at)} ({meaning(c.report_basis)}) · 서버 기록 {tm(c.recorded_at)} · {testOnly ? "시험용 이미지" : "현장 사진"} {ev.photos.length}장
            </p>
          </div>

          <div className={box}>
            <p className="text-[14px] font-bold text-ink-3">② 엔진 입력 → 계산 (보고 시점 · 계산값 = 기존 연쇄위험 엔진)</p>
            {c.expected_end ? (
              <p className="text-[16px]">
                {site} 예정 종료 {plannedEnd || "?"} → 변경 예상 종료 <b>{c.expected_end.slice(0, 5)}</b>
                {endShift !== null && ` (${endShift >= 0 ? "+" : ""}${endShift}분, 보고값)`} → 이동시간(입력값)을 더해 후속 현장 도착을 계산
              </p>
            ) : (
              <p className="text-[16px]">예상 종료 미확인 — 엔진에 넣지 않았습니다 (판단 변화 없음).</p>
            )}
            {reportJ && (
              <table className="mt-1 w-full text-[14.5px]">
                <thead>
                  <tr>
                    {["연결 (이 사건)", "앞 현장 예상 종료", "이동", "도착 (계산)", "다음 현장 예정 시작", "보고 전 → 보고 직후"].map((h) => (
                      <th key={h} className={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...afterReport.values()]
                    .sort((a, b) => a.order - b.order)
                    .map((l) => (
                      <tr key={l.key} className="border-t border-line">
                        <td className={`${td} font-semibold`}>{linkName(l.key)}</td>
                        <td className={td}>{l.prev.expectedEnd}</td>
                        <td className={td}>{l.travel.minutes === null ? "누락" : `${l.travel.minutes}분`}</td>
                        <td className={td}>{l.arrival ?? "-"}</td>
                        <td className={td}>{l.next.plannedStart}</td>
                        <td className={td}>
                          {state(before.get(l.key))} → <b>{state(l)}</b> ({changeOf(l.key, reportJ)})
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
            {tallyReport && (
              <p className="mt-1 text-[15px] font-semibold">
                이 사건으로 새로 생긴 위험 {tallyReport.newRisk}건 · 커진 위험 {tallyReport.worse}건 (그날 전체 위험 연결 {reportJ!.summary.risky_before} → {reportJ!.summary.risky_after}건은 참고 — 다른 기사·다른 시험 기록 포함)
              </p>
            )}
          </div>

          <div className={box}>
            <p className="text-[14px] font-bold text-ink-3">③ 관리자 조치 · 해결 (보고 뒤 경과 · {testOnly ? "시험 중 누른 시각" : "기록 시각"})</p>
            {ev.steps.length === 0 ? (
              <p className="text-[15px] text-ink-3">조치 기록 없음</p>
            ) : (
              <ol className="flex flex-wrap gap-x-2 gap-y-1 text-[15px]">
                {ev.steps.map((x, i) => (
                  <li key={x.id}>
                    {i > 0 && "→ "}
                    <b>{x.kind}</b> {tm(x.occurred_at)} <span className="text-ink-3">({since(x.occurred_at)})</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className={box}>
            <p className="text-[14px] font-bold text-ink-3">④ 조치 전후 — 관리자 일정 조정 뒤 재판단 (계산값)</p>
            {!lastJ ? (
              <p className="text-[15px]">조치로 인한 재판단 없음 (일정 조정·예상 종료 변경 기록이 없음).</p>
            ) : (
              <>
                <table className="w-full text-[14.5px]">
                  <thead>
                    <tr>
                      {["연결 (이 사건)", "조치 전 (보고 직후)", "조치 후", "변화"].map((h) => (
                        <th key={h} className={th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((k) => (
                      <tr key={k} className="border-t border-line">
                        <td className={`${td} font-semibold`}>{linkName(k)}</td>
                        <td className={td}>{state(afterReport.get(k))}</td>
                        <td className={td}>
                          <b>{state(afterAction.get(k))}</b>
                        </td>
                        <td className={td}>{changeOf(k, lastJ)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1 text-[15px] font-semibold">
                  조치 {actionJs.length}건의 재판단(이 사건 관련): 풀린 위험 {tallyAction.reduce((a, b) => a + b.resolved, 0)}건 · 새로 생긴 위험 {tallyAction.reduce((a, b) => a + b.newRisk, 0)}건 · 커진 위험{" "}
                  {tallyAction.reduce((a, b) => a + b.worse, 0)}건 · 등급은 같고 부족시간이 바뀐 위험 {tallyAction.reduce((a, b) => a + b.kept, 0)}건 — 남은 위험을 숨기지 않습니다.
                </p>
              </>
            )}
          </div>

          <div className={box}>
            <p className="text-[14px] font-bold text-ink-3">⑤ 측정 (항목 1~4 · 품질)</p>
            <ul className="grid grid-cols-1 gap-x-4 text-[15px] sm:grid-cols-2">
              {spans.map((x) => (
                <li key={x.key}>
                  {x.label}: {x.minutes === null ? <span className="text-ink-3">{x.missing}</span> : fmtSpan(x)}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[13px] text-ink-3">
            근거: 판단 {judgments.map((j) => `#${j.seq}`).join(" · ") || "없음"} · {judgments[0]?.rule_version ?? "chain-risk"} · 판단 전후는 서버가 계산해 서명(SHA-256)과 함께 기록 · 개선율·절감효과는 계산하지 않음 · 상세 증빙은 다음 쪽
          </p>
        </section>

        {/* ── 2쪽부터: 상세 증빙 ───────────────────────────── */}
        <section className="space-y-1.5">
          <h2 className={h2}>1. 사건 · 참가자 · 출처</h2>
          <p className="text-[16px]">
            날짜 {c.work_date} · 현장 {site}
            {testOnly ? " (시험용 현장)" : ""} · {testOnly ? "시험 계정(현장기사 역할)" : "현장기사(참가자)"} {who(c.worker_id)} · 입력자 {who(c.reporter_id)} ({c.source}) · 자료 출처 {c.info_source}
            {c.source_ref && ` · 원자료 ${c.source_ref}`} · 프로그램 {c.app_version}
          </p>
          <p className="text-[16px]">
            {c.issue_type} · {c.progress} · {c.urgency} · 요청 {c.needs.join(", ") || "없음"}
            {c.request && ` · "${c.request}"`} · 현재 상태 <b>{c.status}</b>
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className={h2}>2. 시각 ({testOnly ? "시험 시각 · 서버 기록 구분 — 실제 현장 발생시각 아님" : "발생 · 보고 · 서버 기록 구분"})</h2>
          <ul className="text-[16px]">
            <li>
              · 문제 발견 {dt(c.discovered_at)} — {meaning(c.discovered_basis)}
              {testOnly ? "" : ` (근거 ${c.discovered_basis})`}
            </li>
            <li>
              · 보고 {dt(c.reported_at)} — {meaning(c.report_basis)} · {c.report_mode}
              {c.send_delay_seconds !== null && ` · 기기 전송 지연 ${c.send_delay_seconds}초`}
            </li>
            <li>· 서버 기록 {dt(c.recorded_at)} — DB 서버가 정한 시각</li>
          </ul>
        </section>

        <section className="space-y-1.5">
          <h2 className={h2}>{testOnly ? `3. 시험용 이미지 (${ev.photos.length}장) — 실제 현장사진 아님` : `3. 현장 사진 (${ev.photos.length}장)`}</h2>
          {ev.photos.length === 0 && <p className="text-[15.5px] text-ink-3">사진 없음</p>}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-4 print:gap-2">
            {ev.photos.map((p) => (
              <li key={p.id} className="text-[13px] text-ink-3">
                {p.url && !p.deleted_at ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 비공개 저장소의 서명 주소(10분)
                  <img src={p.url} alt={p.caption ?? (testOnly ? "시험용 이미지" : "현장 사진")} className="aspect-square w-full rounded-lg border border-line object-cover" />
                ) : (
                  <span className="block rounded-lg bg-[#f2f4f6] p-3">삭제됨 · {p.delete_reason}</span>
                )}
                <span className="block break-all">
                  {who(p.owner_id)} · 서버 기록 {kst(p.recorded_at).date} {kst(p.recorded_at).seconds} · {Math.round(p.size_bytes / 1024)}KB · {p.exif_removed ? "촬영정보 제거" : "원본"} · 보관 {p.retain_until}까지 · SHA-256 {p.sha256.slice(0, 16)}…
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-1.5">
          <h2 className={h2}>4. 관리자 조치 · 현장 해결 이력</h2>
          {ev.steps.length === 0 && <p className="text-[15.5px] text-ink-3">조치 기록 없음</p>}
          {ev.steps.length > 0 && (
            <table className="w-full table-fixed text-[14.5px]">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[34%]" />
                <col className="w-[22%]" />
                <col className="w-[13%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr>
                  {["조치", "내용", timeHead, "서버 기록", "입력자"].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ev.steps.map((x) => (
                  <tr key={x.id} className="border-t border-line">
                    <td className={`${td} font-bold`}>
                      <span className="block text-[12.5px] font-normal text-ink-3">#{x.step_no}</span>
                      {x.kind}
                    </td>
                    <td className={`${td} break-words`}>
                      {[x.action, x.resolution, x.assignee_id ? who(x.assignee_id) : null, x.assignee_name, x.message].filter(Boolean).join(" · ") || "-"}
                      {x.linked_seq !== null && <span className="block text-[12.5px] text-ink-3">엔진 기록 #{x.linked_seq}</span>}
                    </td>
                    <td className={td}>
                      {tm(x.occurred_at)}
                      <span className="block text-[12.5px] text-ink-3">
                        {meaning(x.occurred_basis)} · {x.occurred_mode}
                      </span>
                    </td>
                    <td className={td}>{tm(x.recorded_at)}</td>
                    <td className={`${td} break-words`}>{who(x.actor_id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {versions.length > 0 && <p className="text-[13px] text-ink-3">조치 기록 프로그램 버전: {versions.join(" · ")} · 시각은 {c.work_date} 기준 (초까지)</p>}
        </section>

        <section className="space-y-1.5">
          <h2 className={h2}>5. 연쇄위험 엔진 입력 · 판단 전후 (계산값)</h2>
          {ev.events.length + ev.revisions.length === 0 && <p className="text-[15.5px] text-ink-3">엔진 입력 없음 — 예상 종료가 확인되지 않아 위험 판단에 반영하지 않았습니다.</p>}
          <ul className="text-[15px]">
            {events.map((e) => (
              <li key={e.seq}>
                · 작업 기록 #{e.seq} {e.kind} {e.expected_end?.slice(0, 5) ?? ""} · {meaning(e.entry_mode)} {tm(e.occurred_at)} ({e.entry_mode}) · 서버 기록 {tm(e.recorded_at)}
              </li>
            ))}
            {(ev.revisions as { seq: number; change_kind: string; snapshot: { site_name: string; planned_start: string; planned_end: string } }[]).map((r) => (
              <li key={r.seq}>
                · 일정 수정본 #{r.seq} {r.change_kind}: {r.snapshot.site_name} {r.snapshot.planned_start.slice(0, 5)}~{r.snapshot.planned_end.slice(0, 5)}
              </li>
            ))}
          </ul>
          {judgments.map((j) => {
            const split = caseChanges(j.changes.changes, ev.workerSchedules, c.schedule_id, c.worker_id);
            const t = tally(split.mine);
            return (
              <div key={j.seq} className="break-inside-avoid rounded-xl border border-line p-2.5 text-[15px]" aria-label={`판단 ${j.seq}`}>
                <p className="font-bold">
                  판단 #{j.seq} ({j.trigger_kind}) · 기준시각 {dt(j.as_of)} · 예상 시각이 바뀐 현장 {j.summary.affected_sites}곳
                </p>
                <p className="font-semibold">
                  이 사건 관련 연결 (담당 기사 · 사건 현장부터): 새로 생긴 위험 {t.newRisk}건 · 커진 위험 {t.worse}건 · 풀린 위험 {t.resolved}건 · 등급은 같고 부족시간이 바뀐 위험 {t.kept}건
                </p>
                <ul>
                  {split.mine.map((x) => (
                    <li key={x.key}>
                      · {linkName(x.key)}: {x.kind} ({grade(x.before)} → {grade(x.after)})
                      {x.after?.slack !== null && x.after?.slack !== undefined && (x.after.slack < 0 ? ` · ${-x.after.slack}분 늦음` : ` · 여유 ${x.after.slack}분`)}
                    </li>
                  ))}
                  {split.mine.length === 0 && <li className="text-ink-3">· 이 사건 관련 연결 변화 없음</li>}
                </ul>
                <p className="text-[13.5px] text-ink-3">
                  참고 — 그날 전체(모든 기사·모든 일정, 같은 날 다른 시험 기록 포함) 위험 연결 {j.summary.risky_before} → {j.summary.risky_after}건 · 판단 보류 {j.summary.held_before} → {j.summary.held_after}건
                  {split.others.length > 0 && ` · 이 사건과 무관한 연결 변화 ${split.others.length}건`}. 이 수는 이 사건만의 결과가 아닙니다. 바뀌지 않은 연결은 목록에 없습니다.
                </p>
                <p className="text-[13px] text-ink-3">
                  {j.rule_version} · {j.state_version} · {j.priority_version} · 계산 프로그램 {j.app_version} · 서명 기록 {dt(j.recorded_at)} · SHA-256 {j.payload_sha256.slice(0, 16)}…
                </p>
              </div>
            );
          })}
        </section>

        <section className="space-y-1.5">
          <h2 className={h2}>6. 측정 (측정 항목 1~4 · 시각 근거별 품질)</h2>
          <ul className="text-[16px]">
            {spans.map((x) => (
              <li key={x.key}>
                · {x.label}: {x.minutes === null ? <span className="text-ink-3">{x.missing}</span> : fmtSpan(x)}
              </li>
            ))}
          </ul>
          <p className="text-[13.5px] text-ink-3">
            품질: 실측(두 시각 모두 버튼 시각) · 원자료 · 진술 · 추정(기억 — 비교 통계에서 뺌) · 가상(시험 시나리오). 두 시각이 모두 버튼 누른 시각이면 초 단위까지 표시한다 — 자동 시험처럼 같은 초에 연달아 누르면 0초로 나온다.
            측정하지 않은 개선율·절감효과는 만들지 않는다.
          </p>
        </section>
      </article>
    </div>
  );
}
