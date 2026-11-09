import { NextResponse } from "next/server";
import { getPilotSession } from "@/lib/pilot/session";
import { UUID_RE } from "@/lib/pilot/op-id";
import { appVersion } from "@/lib/pilot/config";

/** 위험 판단 1건 원본(JSON) — 관리자(2단계 인증)만 · 내보내기 기록을 남긴다 */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = await getPilotSession();
  if (!s || s === "unconfigured" || s.profile?.role !== "admin" || !s.profile.active || s.aal !== "aal2") {
    return NextResponse.json({ error: "관리자(2단계 인증 완료)만 내려받을 수 있습니다." }, { status: 403 });
  }
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "판단 번호가 올바르지 않습니다." }, { status: 400 });
  const { data, error } = await s.sb.from("risk_judgments").select("*").eq("id", id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "판단을 찾을 수 없습니다." }, { status: 404 });
  await s.sb.rpc("log_export", { p_dataset: "judgment", p_format: "json", p_data_kind: data.data_kind, p_from: data.work_date, p_to: data.work_date, p_rows: 1 });
  const body = {
    meta: {
      kind: "하나 프로젝트 AX 실증 · 위험 판단 1건",
      data_kind: data.data_kind,
      exported_at: new Date().toISOString(),
      exported_by: s.email,
      exporter_app_version: appVersion(),
      note: "input_before/input_after 로 같은 판단규칙 버전의 엔진을 다시 돌리면 result_before/result_after 가 나온다. payload_sha256 은 서버가 기록할 때 계산한 원문 해시.",
    },
    judgment: data,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="judgment-${data.work_date}-${data.seq}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
