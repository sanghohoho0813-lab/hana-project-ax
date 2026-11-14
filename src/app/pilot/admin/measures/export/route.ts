import { NextResponse } from "next/server";
import { getPilotSession } from "@/lib/pilot/session";
import { parseDay } from "@/lib/pilot/board";
import { loadMeasures } from "@/lib/pilot/measure-data";
import { toCsv } from "@/lib/pilot/csv";

/** 성과 측정 CSV — 사건 측정(1~6) · 수기 vs AX(7) · 의견·오류·개선(8·9). 관리자(2단계 인증)만 · 내보내기 기록 */
export async function GET(req: Request) {
  const s = await getPilotSession();
  if (!s || s === "unconfigured" || s.profile?.role !== "admin" || !s.profile.active || s.aal !== "aal2") return new NextResponse("권한 없음", { status: 403 });
  const u = new URL(req.url).searchParams;
  const { kind } = parseDay({ kind: u.get("kind") ?? undefined });
  const D = /^\d{4}-\d{2}-\d{2}$/;
  const to = D.test(u.get("to") ?? "") ? u.get("to")! : new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const from = D.test(u.get("from") ?? "") ? u.get("from")! : to;
  const type = u.get("type") === "trials" ? "trials" : u.get("type") === "notes" ? "notes" : "cases";
  const m = await loadMeasures(s.sb, from, to, kind);
  let rows: Record<string, unknown>[];
  if (type === "cases") {
    rows = m.measures.map((x) => ({
      사건번호: x.c.case_no,
      자료구분: x.c.evidence_class,
      날짜: x.c.work_date,
      현장기사: x.c.worker_id,
      입력자: x.c.reporter_id,
      자료출처: x.c.info_source,
      문제유형: x.c.issue_type,
      상태: x.c.status,
      발견시각: x.c.discovered_at ?? "",
      발견근거: x.c.discovered_basis,
      보고시각: x.c.reported_at,
      보고근거: `${x.c.report_mode} · ${x.c.report_basis}`,
      서버기록시각: x.c.recorded_at,
      ...Object.fromEntries(x.spans.flatMap((sp) => [[`${sp.key}_분`, sp.minutes ?? ""], [`${sp.key}_품질`, sp.quality ?? sp.missing ?? ""]])),
      보고_위험생김커짐_계산값: x.report?.worsened ?? "",
      보고_시각바뀐현장_계산값: x.report?.affectedSites ?? "",
      판단보류_전후: x.report ? `${x.report.heldBefore}→${x.report.heldAfter}` : "",
      조치재판단_해소: x.actions.reduce((a, b) => a + b.resolved, 0),
      조치재판단_새위험: x.actions.reduce((a, b) => a + b.newRisks, 0),
      프로그램버전: x.c.app_version,
    }));
  } else if (type === "trials") {
    rows = m.trials.map((t) => ({
      측정번호: t.trial_no,
      자료구분: t.evidence_class,
      방식: t.method,
      시나리오: t.scenario,
      대응묶음: t.pair_key ?? "",
      참가자: t.participant_id,
      위험파악초: t.find_sec ?? "",
      재판단초: t.rejudge_sec ?? "",
      정확: t.correct ?? "",
      정답: t.expected ?? "",
      놓침: t.missed ?? "",
      오판: t.wrong ?? "",
      값근거: t.value_basis,
      측정방법: t.measure_method,
      측정시작: t.started_at ?? "",
      측정끝: t.ended_at ?? "",
      원자료: t.raw_ref ?? "",
      입력자: t.actor_id,
      서버기록시각: t.recorded_at,
      프로그램버전: t.app_version,
      무효: t.voided_at ? `무효(${t.void_reason})` : "",
    }));
  } else {
    rows = m.notes.map((n) => ({
      번호: n.note_no,
      종류: n.kind,
      내용: n.text,
      말한사람: n.speaker_id ?? n.speaker_name ?? "",
      확인: n.confirmation,
      관련사건: n.case_id ?? "",
      원래기록: n.ref_note_id ?? "",
      반영날짜: n.dev_date ?? "",
      반영버전: n.dev_version ?? "",
      입력자: n.actor_id,
      자료출처: n.source,
      서버기록시각: n.recorded_at,
      프로그램버전: n.app_version,
    }));
  }
  await s.sb.rpc("log_export", { p_dataset: `성과 측정 ${type}`, p_format: "csv", p_data_kind: kind, p_from: from, p_to: to, p_rows: rows.length });
  const name = encodeURIComponent(`성과측정-${type}-${from}-${to}.csv`);
  return new NextResponse(toCsv(Object.keys(rows[0] ?? { 없음: "" }), rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename*=UTF-8''${name}` } });
}
