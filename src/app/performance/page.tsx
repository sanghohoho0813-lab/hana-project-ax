"use client";

import { useState } from "react";
import { FileText, Info, Printer, TrendingUp } from "lucide-react";
import { useApp } from "@/lib/store";
import { COMPANY } from "@/lib/company";
import { PERF_METRICS, FACILITIES, ACCESS_LOGS } from "@/lib/ops-data";
import { opsKpi } from "@/lib/ops-calc";
import { Badge, Modal, PageIntro, ProgressBar } from "@/components/ui";

const ROADMAP = [
  { step: "01", title: `${COMPANY.main.name} 내부 도입`, desc: "업무지시·일정·보고를 한 시스템으로 통합" },
  { step: "02", title: "일정·보고 누락 문제 개선", desc: "확인 여부 추적으로 놓치는 일정을 줄임" },
  { step: "03", title: "운영 데이터 축적", desc: "확인률·완료율·보고 제출률을 실제 사용에서 수집" },
  { step: "04", title: "업종 표준 기능화", desc: "전기·통신공사업체가 공통으로 쓰는 기능으로 정리" },
  { step: "05", title: "현장 설비 연동", desc: "CCTV·출입통제 등 현장 기기와 연계 (연동 준비 단계)" },
  { step: "06", title: "외부 업체 공급", desc: "다른 공사업체와 시설관리업체에 SaaS로 제공" },
];

const REPORT_SECTIONS = [
  {
    h: "1. 도입 배경",
    b: [
      "업무가 전화, 메신저, 구두지시, 개인 메모로 흩어져 전달됩니다.",
      "일정을 등록해도 담당자가 확인했는지 알 수 없어 놓치는 일이 생깁니다.",
      "업무지시 이후 진행상황과 결과보고를 관리자가 계속 물어봐야 합니다.",
    ],
  },
  {
    h: "2. 기존 문제",
    b: [
      "직원별 일정이 공유되지 않아 같은 시간대에 중복 배정되는 경우가 있습니다.",
      "결과보고 양식이 통일되지 않아 자료가 남지 않습니다.",
      "대표와 이사가 직접 기억해야 관리가 유지됩니다.",
    ],
  },
  {
    h: "3. 주요 기능",
    b: [
      "업무지시와 담당자 확인(읽음·응답) 추적",
      "통합일정과 일정 충돌·미확인 탐지",
      "업무보고 표준화 및 관리자 검토·승인",
      "프로젝트별 현장소통 타임라인",
      "전화메모를 업무·일정으로 전환",
    ],
  },
  {
    h: "4. 사용자 역할",
    b: [
      "대표 · 이사: 전체 일정, 업무지시, 보고 검토, 승인",
      "사무담당: 일정 등록, 견적·문서, 준공자료, 수금 일정",
      "현장책임자: 현장 배정, 진행 관리, 소속 기사 보고 검토",
      "현장기사: 업무 확인, 진행·완료보고, 사진과 이슈 등록",
    ],
  },
  {
    h: "5. 업무 흐름",
    b: [
      "지시 → 확인 → 진행 → 완료보고 → 검토 → 승인 완료",
      "각 단계의 시각과 담당자가 기록으로 남습니다.",
    ],
  },
  {
    h: "6. 수집 데이터",
    b: [
      "업무 확인 시각, 진행률, 완료보고 제출 시각",
      "일정 확인 여부와 충돌 발생 건수",
      "관리자 검토 소요시간, 보완 요청 비율",
    ],
  },
  {
    h: "7. 도입 목표",
    b: [
      "일정 누락 월 7건 → 월 1건 이하",
      "업무 확인 평균 6시간 → 1시간 이내",
      "업무보고 제출률 58% → 90%",
      "완료 후 관리자 확인 2.1일 → 당일",
    ],
  },
  {
    h: "8. 제품화 계획",
    b: [
      "현장에서 검증한 운영방식을 다른 전기·통신공사업체에도 적용할 수 있도록 표준화합니다.",
      "업종 공통 기능을 정리한 뒤 시설관리업체까지 대상을 넓힙니다.",
    ],
  },
  {
    h: "9. 향후 CCTV·출입통제 연계 계획",
    b: [
      "시공한 현장 설비의 상태를 같은 화면에서 확인할 수 있도록 연동을 준비합니다.",
      "현재 단계에서는 연동 준비 화면만 제공하며 실제 스트리밍·제어는 포함하지 않습니다.",
    ],
  },
];

export default function PerformancePage() {
  const { tasks, schedules } = useApp();
  const [reportOpen, setReportOpen] = useState(false);
  const kpi = opsKpi(tasks, schedules);

  return (
    <div className="page-in space-y-6">
      <PageIntro message="AX 도입으로 무엇이 얼마나 좋아지는지 숫자로 관리합니다.">
        <button
          onClick={() => setReportOpen(true)}
          className="inline-flex min-h-[3.5rem] items-center gap-2 rounded-2xl bg-primary px-5 text-[20px] font-bold text-white transition-colors hover:bg-primary-dark"
        >
          <FileText size={22} /> AX 도입·검증 리포트
        </button>
      </PageIntro>

      <div className="card flex items-start gap-3 border border-warning/25 bg-warning-bg/40 p-5">
        <Info size={24} className="mt-0.5 shrink-0 text-warning" />
        <p className="text-[19px] leading-relaxed text-ink-2">
          아래 도입 전 수치와 목표치는 <b>데모용 기준값</b>입니다. 실제 확정된 성과가 아니며,
          시스템을 사용하면서 수집되는 데이터로 대체됩니다.
        </p>
      </div>

      {/* 오늘 실측 */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-[25.5px] font-bold">
          <TrendingUp size={26} className="text-primary" /> 오늘 시스템에서 측정된 값
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "오늘 등록 업무", value: `${kpi.todayTasks}건` },
            { label: "확인 완료", value: `${kpi.todayTasks - kpi.unacked}건` },
            {
              label: "현재 확인률",
              value: `${Math.round(((kpi.todayTasks - kpi.unacked) / Math.max(1, kpi.todayTasks)) * 100)}%`,
            },
            { label: "기한 초과", value: `${kpi.overdue}건`, tone: "text-danger" },
          ].map((k) => (
            <div key={k.label} className="card min-w-0 p-5">
              <p className="text-[18.5px] font-semibold text-ink-3">{k.label}</p>
              <p className={`mt-1 text-[30px] font-extrabold ${k.tone ?? ""}`}>{k.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 도입 전 → 목표 */}
      <section>
        <h3 className="mb-3 text-[25.5px] font-bold">도입 전 기준과 목표치</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {PERF_METRICS.map((m) => {
            const pct = m.lowerIsBetter
              ? Math.round((m.target / Math.max(m.before, 0.1)) * 100)
              : Math.round((m.before / Math.max(m.target, 1)) * 100);
            return (
              <div key={m.key} className="card min-w-0 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[21.8px] font-bold">{m.label}</p>
                  <Badge tone={m.lowerIsBetter ? "warning" : "info"}>
                    {m.lowerIsBetter ? "낮을수록 좋음" : "높을수록 좋음"}
                  </Badge>
                </div>
                <p className="mt-1.5 text-[18.5px] text-ink-2">{m.desc}</p>
                <div className="mt-4 flex items-end gap-4">
                  <div>
                    <p className="text-[17.5px] text-ink-3">도입 전</p>
                    <p className="text-[26px] font-extrabold text-ink-3">
                      {m.before}
                      <span className="ml-0.5 text-[18px]">{m.unit}</span>
                    </p>
                  </div>
                  <span className="pb-2 text-[22px] text-ink-3">→</span>
                  <div>
                    <p className="text-[17.5px] text-ink-3">목표</p>
                    <p className="text-[26px] font-extrabold text-primary">
                      {m.target}
                      <span className="ml-0.5 text-[18px]">{m.unit}</span>
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <ProgressBar value={Math.min(100, pct)} tone="info" thick />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 제품화 로드맵 */}
      <section>
        <h3 className="mb-1 text-[25.5px] font-bold">제품화 방향</h3>
        <p className="mb-3 text-[19.5px] text-ink-2">
          현장에서 검증한 운영방식을 다른 전기·통신공사업체에도 적용할 수 있도록 표준화합니다.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROADMAP.map((r) => (
            <div key={r.step} className="card min-w-0 p-5">
              <span className="text-[19px] font-extrabold text-primary">{r.step}</span>
              <p className="mt-1.5 text-[21px] font-bold">{r.title}</p>
              <p className="mt-1.5 text-[18.5px] leading-relaxed text-ink-2">{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 현장 설비 연동 준비 */}
      <section>
        <h3 className="mb-1 text-[25.5px] font-bold">현장 설비 연동 준비</h3>
        <p className="mb-3 text-[19.5px] text-ink-2">
          아래는 <b>데모 데이터</b>입니다. 실제 CCTV 영상이나 출입통제 장비와 연결돼 있지 않으며,
          향후 연동을 위한 화면 구조만 준비한 단계입니다.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {FACILITIES.map((f) => (
            <div key={f.name} className="card min-w-0 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={f.tone}>{f.status}</Badge>
                <Badge tone="neutral">{f.kind}</Badge>
                <Badge tone="neutral">데모 데이터</Badge>
              </div>
              <p className="mt-2.5 text-[21px] font-bold">{f.name}</p>
              <p className="mt-1 text-[18.5px] text-ink-2">{f.detail}</p>
            </div>
          ))}
        </div>
        <div className="card mt-3 p-5">
          <p className="text-[21px] font-bold">
            출입 이력 <span className="text-[17.5px] font-semibold text-ink-3">샘플 데이터</span>
          </p>
          <div className="mt-3 space-y-2">
            {ACCESS_LOGS.map((l, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f7f8fa] px-4 py-3 text-[18.5px]"
              >
                <span className="font-semibold">{l.who}</span>
                <span className="text-ink-2">
                  {l.place} · {l.action}
                </span>
                <span className="text-ink-3">{l.at}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 리포트 */}
      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="AX 도입·검증 리포트"
        desc={`${COMPANY.main.name} · ${COMPANY.product.name} · 2026년 7월`}
        size="xl"
      >
        <div className="rounded-2xl bg-[#f7f8fa] p-5">
          <p className="text-[19px] leading-relaxed text-ink-2">
            {COMPANY.main.name}이 실제로 사용하는 업무지시·일정·보고 데이터를 기준으로 작성한
            도입 리포트입니다. 정부지원사업이나 기업 심사 자료로 활용할 수 있도록 인쇄용 A4
            형식으로 구성했습니다.
          </p>
        </div>

        <div className="mt-6 space-y-6">
          {REPORT_SECTIONS.map((s) => (
            <div key={s.h}>
              <p className="text-[22px] font-bold">{s.h}</p>
              <ul className="mt-2 space-y-1.5">
                {s.b.map((b) => (
                  <li key={b} className="flex gap-2.5 text-[19px] leading-relaxed text-ink-2">
                    <span className="mt-3 h-[0.45rem] w-[0.45rem] shrink-0 rounded-full bg-ink-3" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-6 rounded-xl bg-[#f7f8fa] px-4 py-3 text-[17.5px] leading-relaxed text-ink-3">
          본 리포트의 도입 목표치는 데모용 기준값이며 확정된 성과가 아닙니다. CCTV·출입통제
          연동은 준비 단계로, 현재 실제 장비와 연결돼 있지 않습니다.
        </p>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={() => window.print()}
            className="inline-flex min-h-[3.5rem] items-center gap-2 rounded-2xl bg-primary px-6 text-[20px] font-bold text-white transition-colors hover:bg-primary-dark"
          >
            <Printer size={22} /> 인쇄 · PDF로 저장
          </button>
        </div>
      </Modal>
    </div>
  );
}
