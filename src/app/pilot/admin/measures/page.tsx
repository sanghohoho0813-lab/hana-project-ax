import { requireAdmin } from "@/lib/pilot/session";
import { kindParam, loadStaff, parseDay } from "@/lib/pilot/board";
import { loadMeasures } from "@/lib/pilot/measure-data";
import { fmtStat, spanSummary, trialComparison } from "@/lib/pilot/measures";
import { EVIDENCE_CLASSES } from "@/lib/pilot/cases";
import { appVersion } from "@/lib/pilot/config";
import { kst } from "@/lib/pilot/time";
import { AdminNav, KindBanner } from "../AdminNav";
import { MeasureForms, VoidTrialButton } from "./MeasureForms";

const D_RE = /^\d{4}-\d{2}-\d{2}$/;
const back = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) - n * 86400_000).toISOString().slice(0, 10);

/**
 * 성과 측정 — 측정 항목 1~9를 실제 기록에서만 모은다. 실제 업무 · 현장정보 재현 · 가상 시나리오를 나눈다.
 * 기능이 작동한 것과 업무개선 효과가 생긴 것은 다르다 — 이 화면은 측정값만 보여 주며 개선율·절감효과를 계산해 만들지 않는다.
 */
export default async function MeasuresPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; kind?: string }> }) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const { kind } = parseDay(sp);
  const today = kst(new Date()).date;
  const to = sp.to && D_RE.test(sp.to) ? sp.to : today;
  const from = sp.from && D_RE.test(sp.from) ? sp.from : back(to, 30);
  const [m, staff] = await Promise.all([loadMeasures(s.sb, from, to, kind), loadStaff(s.sb)]);
  const names = Object.fromEntries(staff.map((p) => [p.id, p.display_name]));
  const sum = spanSummary(m.measures);
  const cmp = trialComparison(m.trials);
  const classes = kind === "실제 업무" ? (["실제 업무"] as const) : (["현장정보 재현", "가상 시나리오"] as const);
  const SECTION: Record<(typeof EVIDENCE_CLASSES)[number], string> = { "실제 업무": "실측 결과 (실제 업무)", "현장정보 재현": "현장정보 재현시험 결과", "가상 시나리오": "가상 시나리오 결과 (실제 효과 아님)" };
  const h2 = "text-[20px] font-extrabold";
  const th = "py-1 pr-2 text-left font-semibold whitespace-nowrap";
  const td = "py-1 pr-2 align-top";
  const q = `from=${from}&to=${to}&kind=${kindParam(kind)}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-extrabold">성과 측정</h1>
        <AdminNav current="measures" />
      </div>
      <form action="/pilot/admin/measures" className="flex flex-wrap items-center gap-2 print:hidden">
        <select name="kind" defaultValue={kindParam(kind)} className="rounded-xl border border-line bg-white px-3 py-1.5 text-[17px]" aria-label="데이터 구분">
          <option value="real">실제 업무</option>
          <option value="scenario">검증 시나리오 (현장정보 재현 · 가상)</option>
        </select>
        <input type="date" name="from" defaultValue={from} aria-label="시작 날짜" className="rounded-xl border border-line bg-white px-3 py-1.5 text-[17px]" />
        ~
        <input type="date" name="to" defaultValue={to} aria-label="끝 날짜" className="rounded-xl border border-line bg-white px-3 py-1.5 text-[17px]" />
        <button className="rounded-xl bg-white px-3 py-1.5 text-[17px] font-semibold text-ink-2">보기</button>
        {(["cases", "trials", "notes"] as const).map((t) => (
          <a key={t} href={`/pilot/admin/measures/export?type=${t}&${q}`} className="rounded-xl bg-white px-3 py-1.5 text-[16px] font-semibold text-primary-dark underline">
            CSV {t === "cases" ? "사건 측정" : t === "trials" ? "수기·AX" : "의견·개선"}
          </a>
        ))}
      </form>
      <KindBanner kind={kind} />
      <p className="rounded-2xl bg-white px-4 py-2.5 text-[16px] text-ink-2">
        기능이 작동한 것과 업무개선 효과가 생긴 것은 다릅니다. 이 화면은 기록된 측정값만 모으며 개선율·절감효과를 계산해 만들지 않습니다. 기억에 의한 추정 값은 통계에서 빼고 따로 적습니다. 출력 프로그램 {appVersion()}
      </p>

      {classes.map((cls) => {
        const x = sum.byClass[cls];
        return (
          <section key={cls} className="card space-y-2 p-4" aria-label={SECTION[cls]}>
            <h2 className={h2}>
              {SECTION[cls]} — 사건 {x.cases}건 ({from} ~ {to})
            </h2>
            <table className="w-full text-[15.5px] tabular-nums">
              <thead className="text-[14px] text-ink-3">
                <tr>
                  <th className={th}>측정 (분)</th>
                  <th className={th}>값</th>
                  <th className={th}>시각 근거</th>
                  <th className={th}>값 없음</th>
                </tr>
              </thead>
              <tbody>
                {x.spans.map((r) => (
                  <tr key={r.key} className="border-t border-line">
                    <td className={td}>{r.label}</td>
                    <td className={td}>{fmtStat(r.stat, "분")}</td>
                    <td className={td}>
                      {Object.entries(r.qualities)
                        .map(([k, v]) => `${k} ${v}`)
                        .join(", ") || "-"}
                    </td>
                    <td className={td}>{r.missing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[15.5px]">
              측정 5 — 예상 종료가 엔진에 들어간 사건 {x.withEngine}건 · 위험이 새로 생기거나 커진 후속 연결 수: {fmtStat(x.affected, "개")} (계산값)
            </p>
            <p className="text-[15.5px]">
              측정 6 — 관리자 조치 재판단 {x.actions.length}건 · 위험 해소 연결 {x.actions.reduce((a, b) => a + b.resolved, 0)}개 · 조치 뒤 새로 생긴 위험 연결 {x.actions.reduce((a, b) => a + b.newRisks, 0)}개 (계산값)
            </p>
          </section>
        );
      })}

      <section className="card space-y-2 overflow-x-auto p-4" aria-label="사건별 측정">
        <h2 className={h2}>사건별 측정 (측정 1~6)</h2>
        {m.measures.length === 0 && <p className="text-[16px] text-ink-3">기간 안의 사건이 없습니다.</p>}
        <table className="w-full min-w-[60rem] text-[14.5px] tabular-nums">
          <thead className="text-[13.5px] text-ink-3">
            <tr>
              {["사건", "자료 구분", "현장기사", "상태", "발견→보고", "보고→확인", "확인→결정", "발생→해결", "보고 영향(계산값)", "조치 재판단(계산값)", "판단 보류", "버전"].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.measures.map((x) => (
              <tr key={x.c.id} className="border-t border-line">
                <td className={td}>
                  <a href={`/pilot/admin/cases/${x.c.id}`} className="font-bold text-primary-dark underline">
                    {x.c.case_no}
                  </a>
                </td>
                <td className={td}>{x.c.evidence_class}</td>
                <td className={td}>{names[x.c.worker_id]}</td>
                <td className={td}>{x.c.status}</td>
                {x.spans.slice(0, 4).map((sp2) => (
                  <td key={sp2.key} className={td}>
                    {sp2.minutes === null ? "-" : `${sp2.minutes}분 (${sp2.quality})`}
                  </td>
                ))}
                <td className={td}>{x.report ? `위험 생김·커짐 ${x.report.worsened} · 시각 바뀐 현장 ${x.report.affectedSites}` : "예상 종료 미확인"}</td>
                <td className={td}>{x.actions.length ? x.actions.map((a) => `${a.kind}: 해소 ${a.resolved} · 새 위험 ${a.newRisks}`).join(" / ") : "-"}</td>
                <td className={td}>{x.report ? `${x.report.heldBefore}→${x.report.heldAfter}` : "-"}</td>
                <td className={td}>{x.c.app_version}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sum.estimates.length > 0 && (
          <p className="text-[14.5px] text-warning">
            추정 값(통계 제외): {sum.estimates.map((e) => `${e.caseNo} ${e.label} ${e.minutes}분`).join(" · ")}
          </p>
        )}
      </section>

      <section className="card space-y-2 overflow-x-auto p-4" aria-label="수기 대 AX">
        <h2 className={h2}>측정 7 — 수기 방식 vs AX 방식 (같은 시나리오 · 판단시간 · 정확도)</h2>
        {cmp.byClass
          .filter((x) => (classes as readonly string[]).includes(x.cls))
          .map((x) => (
            <div key={x.cls} className="space-y-1">
              <p className="text-[16px] font-bold">
                {SECTION[x.cls]} — <span className="font-semibold text-ink-2">{x.note}</span>
              </p>
              <table className="w-full min-w-[40rem] text-[15px] tabular-nums">
                <thead className="text-[13.5px] text-ink-3">
                  <tr>
                    <th className={th}>측정</th>
                    <th className={th}>수기</th>
                    <th className={th}>AX</th>
                    <th className={th}>차이 (AX − 수기)</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["위험 파악 시간(초)", x.find],
                      ["조치 후 재판단 시간(초)", x.rejudge],
                      ["정확도(정답 대비 %)", x.accuracy],
                      ["놓친 위험(건)", x.missed],
                      ["잘못 판단(건)", x.wrong],
                    ] as const
                  ).map(([label, r]) => (
                    <tr key={label} className="border-t border-line">
                      <td className={td}>{label}</td>
                      <td className={td}>{fmtStat(r.manual)}</td>
                      <td className={td}>{fmtStat(r.ax)}</td>
                      <td className={td}>{r.diff ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        <table className="w-full min-w-[60rem] text-[14px] tabular-nums">
          <thead className="text-[13px] text-ink-3">
            <tr>
              {["#", "자료 구분", "방식", "시나리오(묶음)", "참가자", "파악(초)", "재판단(초)", "정확/정답", "놓침·오판", "근거", "측정 방법", "입력자 · 서버 시각 · 버전", ""].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.trials.map((t) => (
              <tr key={t.id} className={`border-t border-line ${t.voided_at ? "text-ink-3 line-through" : ""}`}>
                <td className={td}>{t.trial_no}</td>
                <td className={td}>{t.evidence_class}</td>
                <td className={`${td} font-bold`}>{t.method}</td>
                <td className={td}>
                  {t.scenario}
                  {t.pair_key && ` (${t.pair_key})`}
                </td>
                <td className={td}>{names[t.participant_id]}</td>
                <td className={td}>{t.find_sec ?? "-"}</td>
                <td className={td}>{t.rejudge_sec ?? "-"}</td>
                <td className={td}>
                  {t.correct ?? "-"}/{t.expected ?? "-"}
                </td>
                <td className={td}>
                  {t.missed ?? "-"} · {t.wrong ?? "-"}
                </td>
                <td className={td}>{t.value_basis}</td>
                <td className={td}>{t.measure_method}</td>
                <td className={td}>
                  {names[t.actor_id]} · {kst(t.recorded_at).date} {kst(t.recorded_at).time} · {t.app_version}
                </td>
                <td className={`${td} no-underline`}>{t.voided_at ? `무효: ${t.void_reason}` : <VoidTrialButton id={t.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card space-y-2 p-4" aria-label="의견·오류·개선 이력">
        <h2 className={h2}>측정 8·9 — 현장기사·관리자 의견 · 시험 중 오류 · 개선 이력</h2>
        {m.notes.length === 0 && <p className="text-[16px] text-ink-3">기록 없음</p>}
        <ul className="divide-y divide-line text-[15.5px]">
          {m.notes.map((n) => {
            const ref = n.ref_note_id ? m.notes.find((o) => o.id === n.ref_note_id) : undefined;
            return (
              <li key={n.id} className="py-1.5">
                <b>#{n.note_no}</b> <span className="rounded-full bg-[#f2f4f6] px-2 py-0.5 text-[13.5px] font-bold">{n.kind}</span> {n.text}
                <span className="block text-[13.5px] text-ink-3">
                  말한 사람 {n.speaker_id ? names[n.speaker_id] : (n.speaker_name ?? "-")} · {n.confirmation} · 입력 {names[n.actor_id]}({n.source}) · 서버 {kst(n.recorded_at).date} {kst(n.recorded_at).time} · {n.app_version}
                  {n.case_id && ` · 사건 ${m.cases.find((c) => c.id === n.case_id)?.case_no ?? "기간 밖"}`}
                  {n.kind === "개선 반영" && ` · 원래 기록 #${ref?.note_no ?? "?"} · 반영 ${n.dev_date} · 버전 ${n.dev_version}`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <MeasureForms
        staff={staff.filter((p) => p.active).map((p) => ({ id: p.id, name: p.display_name }))}
        cases={m.cases.map((c) => ({ id: c.id, no: c.case_no, cls: c.evidence_class }))}
        notes={m.notes.filter((n) => n.kind !== "개선 반영").map((n) => ({ id: n.id, no: n.note_no, text: n.text.slice(0, 40) }))}
        classes={[...classes]}
        version={appVersion()}
      />
    </div>
  );
}
