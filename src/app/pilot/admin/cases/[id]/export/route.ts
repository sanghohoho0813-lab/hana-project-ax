import { NextResponse } from "next/server";
import { getPilotSession } from "@/lib/pilot/session";
import { loadCaseEvidence } from "@/lib/pilot/case-data";
import { caseSpans } from "@/lib/pilot/cases";
import { toCsv } from "@/lib/pilot/csv";
import { appVersion } from "@/lib/pilot/config";
import { UUID_RE } from "@/lib/pilot/op-id";

/** 사건 증빙 내보내기 — JSON(전체 원자료) · CSV(사건 1행 + 조치 단계) · 관리자(2단계 인증)만 · 내보내기 기록을 남긴다 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getPilotSession();
  if (!s || s === "unconfigured" || s.profile?.role !== "admin" || !s.profile.active || s.aal !== "aal2") return new NextResponse("권한 없음", { status: 403 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return new NextResponse("잘못된 사건 번호", { status: 400 });
  const ev = await loadCaseEvidence(s.sb, id);
  if (!ev) return new NextResponse("사건 없음", { status: 404 });
  const c = ev.cases[0];
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const spans = caseSpans(c, ev.steps);
  await s.sb.rpc("log_export", { p_dataset: `사건 ${c.case_no}`, p_format: format, p_data_kind: c.data_kind, p_from: c.work_date, p_to: c.work_date, p_rows: 1 + ev.steps.length });
  const name = encodeURIComponent(`${c.case_no}.${format}`);
  if (format === "json") {
    const body = JSON.stringify(
      {
        format: "hana-ax-case-evidence",
        exported_at: new Date().toISOString(),
        exported_by: s.userId,
        program: appVersion(),
        note: "사건번호 하나로 묶은 원자료 — 사진 파일은 비공개 저장소에 있고 여기에는 지문(SHA-256)·크기·경로만 담는다",
        case: c,
        schedule: ev.schedule,
        steps: ev.steps,
        // 서명 주소(10분짜리 접근 권한)는 파일에 담지 않는다
        photos: ev.photos.map((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== "url"))),
        engine_events: ev.events,
        engine_schedule_revisions: ev.revisions,
        judgments: ev.judgments,
        measures: spans,
      },
      null,
      2,
    );
    return new NextResponse(body, { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename*=UTF-8''${name}` } });
  }
  const rows: Record<string, unknown>[] = [
    {
      구분: "사건",
      사건번호: c.case_no,
      자료구분: c.evidence_class,
      데이터구분: c.data_kind,
      날짜: c.work_date,
      내용: `${c.issue_type} · ${c.progress} · 요청 ${c.needs.join("/")}${c.request ? ` · ${c.request}` : ""}`,
      실제시각: c.discovered_at ?? "",
      시각근거: c.discovered_basis,
      보고시각: c.reported_at,
      보고근거: `${c.report_mode} · ${c.report_basis}`,
      서버기록시각: c.recorded_at,
      입력자: c.reporter_id,
      현장기사: c.worker_id,
      자료출처: c.info_source,
      프로그램버전: c.app_version,
      엔진기록: c.end_event_id ?? "",
      ...Object.fromEntries(spans.map((x) => [`${x.key}_분`, x.minutes ?? ""])),
      ...Object.fromEntries(spans.map((x) => [`${x.key}_품질`, x.quality ?? x.missing ?? ""])),
    },
    ...ev.steps.map((x) => ({
      구분: `조치 ${x.step_no}`,
      사건번호: c.case_no,
      자료구분: c.evidence_class,
      데이터구분: c.data_kind,
      날짜: c.work_date,
      내용: `${x.kind}${x.action ? ` · ${x.action}` : ""}${x.resolution ? ` · ${x.resolution}` : ""}${x.message ? ` · ${x.message}` : ""}`,
      실제시각: x.occurred_at ?? "",
      시각근거: `${x.occurred_mode} · ${x.occurred_basis}`,
      보고시각: "",
      보고근거: "",
      서버기록시각: x.recorded_at,
      입력자: x.actor_id,
      현장기사: c.worker_id,
      자료출처: x.source,
      프로그램버전: x.app_version,
      엔진기록: x.linked_seq ?? "",
    })),
  ];
  return new NextResponse(toCsv(Object.keys(rows[0]), rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename*=UTF-8''${name}` } });
}
