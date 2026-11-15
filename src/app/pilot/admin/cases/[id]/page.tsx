import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/pilot/session";
import { loadStaff } from "@/lib/pilot/board";
import { loadCaseEvidence } from "@/lib/pilot/case-data";
import { CLASS_LABEL, caseChanges, caseSpans, classOf, fmtSpan, isTestOnly, tally } from "@/lib/pilot/cases";
import { UUID_RE } from "@/lib/pilot/op-id";
import { kst, kstLabel } from "@/lib/pilot/time";
import { appVersion } from "@/lib/pilot/config";
import type { JudgmentSummary } from "@/lib/pilot/core";
import type { LinkChange } from "@/lib/risk-engine";
import { PrintButton } from "../../../_ui/PrintButton";

/** 사건 증빙 — 사건번호 하나로 현장 사진 · 입력 기록 · 관리자 조치 · 엔진 입력 · 위험 판단 전후를 묶는다 (인쇄 → PDF) */
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
  const site = String(ev.schedule?.site_name ?? "현장");
  const h2 = "text-[19px] font-extrabold";
  const td = "py-1 pr-2 align-top";
  type J = { seq: number; trigger_kind: string; as_of: string; summary: JudgmentSummary; changes: { changes: LinkChange[] }; rule_version: string; state_version: string; priority_version: string; app_version: string; payload_sha256: string; recorded_at: string };
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
            {cls === "가상 시나리오" && "가상 시나리오 — 시험용 가정값입니다. 인물·현장·사진은 시험용이며 실제 참여자·실제 현장·실제 현장사진이 아닙니다. 업무 효과의 근거로 쓰지 않습니다."}
            {cls === "분류 확인 필요" &&
              "분류 확인 필요 — '현장정보 재현'으로 저장됐지만 원자료 기록이 없습니다. 실제 과거 사례 재현으로 인정하지 않고 가상 시나리오와 같이 다룹니다 (기록은 고치지 않음). 인물·현장·사진은 시험용입니다."}
          </p>
        </header>

        <section className="space-y-1">
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

        <section className="space-y-1">
          <h2 className={h2}>2. 시각 (실제 발생 · 보고 · 서버 기록 구분)</h2>
          <ul className="text-[16px]">
            <li>
              · 문제 발견(발생) {dt(c.discovered_at)} — 근거 {c.discovered_basis}
            </li>
            <li>
              · 보고 {dt(c.reported_at)} — {c.report_mode} · {c.report_basis}
              {c.send_delay_seconds !== null && ` · 기기 전송 지연 ${c.send_delay_seconds}초`}
            </li>
            <li>· 서버 기록 {dt(c.recorded_at)}</li>
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
                  {who(p.owner_id)} · 서버 {kst(p.recorded_at).date} {kst(p.recorded_at).seconds} · {Math.round(p.size_bytes / 1024)}KB · {p.exif_removed ? "촬영정보 제거" : "원본"} · 보관 {p.retain_until}까지 · SHA-256 {p.sha256.slice(0, 16)}…
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-1">
          <h2 className={h2}>4. 관리자 조치 · 현장 해결 이력</h2>
          {ev.steps.length === 0 && <p className="text-[15.5px] text-ink-3">조치 기록 없음</p>}
          <table className="w-full text-[14.5px]">
            <tbody>
              {ev.steps.map((x) => (
                <tr key={x.id} className="border-t border-line">
                  <td className={td}>{x.step_no}</td>
                  <td className={`${td} font-bold`}>{x.kind}</td>
                  <td className={td}>
                    {[x.action, x.resolution, x.assignee_id ? who(x.assignee_id) : null, x.assignee_name, x.message].filter(Boolean).join(" · ")}
                  </td>
                  <td className={td}>
                    실제 {dt(x.occurred_at)} ({x.occurred_mode} · {x.occurred_basis})
                  </td>
                  <td className={td}>서버 {dt(x.recorded_at)}</td>
                  <td className={td}>
                    {who(x.actor_id)} · {x.app_version}
                    {x.linked_seq !== null && ` · 엔진 기록 #${x.linked_seq}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="space-y-1.5">
          <h2 className={h2}>5. 연쇄위험 엔진 입력 · 판단 전후 (계산값)</h2>
          {ev.events.length + ev.revisions.length === 0 && <p className="text-[15.5px] text-ink-3">엔진 입력 없음 — 예상 종료가 확인되지 않아 위험 판단에 반영하지 않았습니다.</p>}
          <ul className="text-[15px]">
            {(ev.events as { seq: number; kind: string; expected_end: string | null; occurred_at: string; entry_mode: string; recorded_at: string }[]).map((e) => (
              <li key={e.seq}>
                · 작업 기록 #{e.seq} {e.kind} {e.expected_end?.slice(0, 5) ?? ""} · 실제 {dt(e.occurred_at)} ({e.entry_mode}) · 서버 {dt(e.recorded_at)}
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

        <section className="space-y-1">
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
