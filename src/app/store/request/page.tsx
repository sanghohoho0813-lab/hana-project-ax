"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Paperclip, Phone } from "lucide-react";
import { useApp } from "@/lib/store";
import { TODAY } from "@/lib/format";
import {
  BUDGET_RANGES,
  SERVICES,
  SERVICE_REGIONS,
  serviceBySlug,
} from "@/lib/store-catalog";
import type { LeadType } from "@/lib/types";

const TYPES: { key: LeadType; title: string; desc: string }[] = [
  { key: "상담신청", title: "상담신청", desc: "무엇이 필요한지부터 같이 정리하고 싶어요" },
  { key: "견적문의", title: "견적문의", desc: "대략적인 금액과 기간이 궁금해요" },
  { key: "주문요청", title: "주문요청", desc: "서비스를 정했고 바로 진행하고 싶어요" },
];

/** 문의 유형에 따라 내부 파이프라인의 다음 행동을 정한다 */
function nextActionFor(type: LeadType): { action: string; probability: number; days: number } {
  if (type === "주문요청") return { action: "1일 내 연락 후 착수 협의", probability: 65, days: 1 };
  if (type === "견적문의") return { action: "1일 내 연락 후 현장 확인 일정 협의", probability: 45, days: 1 };
  return { action: "2일 내 연락 후 요구사항 정리", probability: 30, days: 2 };
}

const inputCls =
  "w-full rounded-2xl border border-line bg-white px-5 py-4 text-[20px] outline-none transition-colors placeholder:text-ink-3 focus:border-primary focus:ring-2 focus:ring-primary/15";

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="mb-2 block text-[19px] font-bold text-ink-2">
      {children}
      {required && <span className="ml-1 text-danger">*</span>}
    </span>
  );
}

function RequestInner() {
  const searchParams = useSearchParams();
  const { addLead, showToast } = useApp();

  const presetService = searchParams.get("service") ?? "";
  const presetType = (searchParams.get("type") as LeadType) ?? "상담신청";

  const [type, setType] = useState<LeadType>(
    TYPES.some((t) => t.key === presetType) ? presetType : "상담신청"
  );
  const [form, setForm] = useState({
    customer: "",
    contact: "",
    region: "충남 보령",
    service: serviceBySlug(presetService) ? presetService : "",
    budget: BUDGET_RANGES[0],
    content: "",
    schedule: "",
    agree: false,
    fileName: "",
  });
  const [done, setDone] = useState<null | { code: string; type: LeadType; service: string }>(null);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const service = useMemo(() => serviceBySlug(form.service), [form.service]);
  const valid = form.customer.trim() && form.contact.trim() && form.content.trim() && form.agree;

  const submit = () => {
    if (!valid) return;
    const meta = nextActionFor(type);
    const serviceName = service?.name ?? "미정 (상담 후 결정)";
    const code = `SM-${String(Date.now()).slice(-6)}`;

    addLead({
      id: `lead-${Date.now()}`,
      customer: form.customer.trim(),
      contact: form.contact.trim(),
      region: form.region,
      workType: service ? service.name : "상담 후 결정",
      // 시작 금액이 있는 서비스는 그 값을 예상금액 기준으로 잡아 둔다
      amount: service?.priceFrom ?? 0,
      manager: type === "주문요청" ? "구본석 이사" : "김성태 과장",
      probability: meta.probability,
      stage: "inquiry",
      nextAction: meta.action,
      nextDate: meta.days === 1 ? "2026-07-29" : "2026-07-30",
      needsVisit: type !== "상담신청",
      visitConfirmed: false,
      memo: [form.content.trim(), form.schedule.trim() && `희망 일정 ${form.schedule.trim()}`]
        .filter(Boolean)
        .join(" · "),
      source: "서비스몰",
      leadType: type,
      interestService: serviceName,
      interestServiceSlug: service?.slug,
      budgetRange: form.budget,
      desiredSchedule: form.schedule.trim() || undefined,
      receivedAt: TODAY,
    });

    showToast("문의가 접수됐어요. 담당자가 곧 연락드립니다");
    setDone({ code, type, service: serviceName });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ── 접수 완료 화면 ── */
  if (done) {
    return (
      <div className="page-in mx-auto w-full max-w-[900px] px-4 py-16 lg:px-8">
        <div className="rounded-3xl border border-line bg-white p-10 text-center">
          <span className="mx-auto flex h-[5rem] w-[5rem] items-center justify-center rounded-full bg-success-bg text-success">
            <CheckCircle2 size={44} />
          </span>
          <h1 className="mt-6 text-[32px] font-extrabold">
            {done.type} 접수가 완료됐습니다
          </h1>
          <p className="mt-3 text-[21px] leading-relaxed text-ink-2">
            담당자가 확인 후 영업일 기준 1~2일 안에 연락드립니다.
            <br />
            급하신 경우 041-000-0000으로 전화 주시면 더 빠르게 도와드릴 수 있습니다.
          </p>

          <div className="mt-8 grid gap-3 rounded-3xl bg-[#f7f8fa] p-6 text-left sm:grid-cols-2">
            {[
              ["접수번호", done.code],
              ["문의 유형", done.type],
              ["관심 서비스", done.service],
              ["접수일", "2026년 7월 28일"],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-[17.5px] text-ink-3">{k}</p>
                <p className="text-[20px] font-bold">{v}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/store/services"
              className="rounded-2xl bg-[#f2f4f6] px-7 py-4 text-[20px] font-bold text-ink-2 transition-colors hover:bg-[#e8ebee]"
            >
              다른 서비스 보기
            </Link>
            <Link
              href="/inquiries"
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-7 py-4 text-[20px] font-bold text-white transition-colors hover:bg-primary-dark"
            >
              내부 시스템에서 접수 확인 <ArrowRight size={20} />
            </Link>
          </div>
          <p className="mt-4 text-[17px] text-ink-3">
            데모 안내 · 접수한 문의는 하나정보통신 내부 운영 시스템의 문의·견적
            파이프라인에 바로 등록됩니다.
          </p>
        </div>
      </div>
    );
  }

  /* ── 입력 폼 ── */
  return (
    <div className="page-in mx-auto w-full max-w-[1100px] px-4 py-12 lg:px-8">
      <h1 className="text-[34px] font-extrabold lg:text-[38px]">상담·견적·주문 요청</h1>
      <p className="mt-3 text-[21px] leading-relaxed text-ink-2">
        아래 내용을 남겨 주시면 담당자가 확인하고 연락드립니다. 어떤 공사가 필요한지
        정하지 못하셨어도 괜찮습니다.
      </p>

      {/* 문의 유형 */}
      <div className="mt-9">
        <Label required>문의 유형</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          {TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`rounded-3xl border-2 p-6 text-left transition-all ${
                type === t.key
                  ? "border-primary bg-primary-light/50"
                  : "border-line bg-white hover:border-ink-3/40"
              }`}
            >
              <span
                className={`block text-[22px] font-extrabold ${
                  type === t.key ? "text-primary-dark" : ""
                }`}
              >
                {t.title}
              </span>
              <span className="mt-1.5 block text-[18px] leading-relaxed text-ink-2">
                {t.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-9 grid gap-6 sm:grid-cols-2">
        <label className="block">
          <Label required>회사명 또는 고객명</Label>
          <input
            className={inputCls}
            value={form.customer}
            onChange={(e) => set("customer", e.target.value)}
            placeholder="예: (주)웅천금속 / 김○○"
          />
        </label>
        <label className="block">
          <Label required>연락처</Label>
          <input
            className={inputCls}
            value={form.contact}
            onChange={(e) => set("contact", e.target.value)}
            placeholder="010-0000-0000"
          />
        </label>
        <label className="block">
          <Label required>지역</Label>
          <select
            className={inputCls}
            value={form.region}
            onChange={(e) => set("region", e.target.value)}
          >
            {SERVICE_REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <Label>관심 서비스</Label>
          <select
            className={inputCls}
            value={form.service}
            onChange={(e) => set("service", e.target.value)}
          >
            <option value="">아직 정하지 못했어요</option>
            {SERVICES.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <Label>예산 범위</Label>
          <select
            className={inputCls}
            value={form.budget}
            onChange={(e) => set("budget", e.target.value)}
          >
            {BUDGET_RANGES.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <Label>희망 일정</Label>
          <input
            className={inputCls}
            value={form.schedule}
            onChange={(e) => set("schedule", e.target.value)}
            placeholder="예: 8월 중순 착공 희망"
          />
        </label>
      </div>

      <label className="mt-6 block">
        <Label required>요청 내용</Label>
        <textarea
          className={`${inputCls} min-h-[10rem] resize-y leading-relaxed`}
          value={form.content}
          onChange={(e) => set("content", e.target.value)}
          placeholder="예: 공장 증축으로 전기 용량이 부족합니다. 150kW 정도 증설이 필요할 것 같은데 현장 확인 부탁드립니다."
        />
      </label>

      {/* 파일 첨부 (UI만) */}
      <div className="mt-6">
        <Label>도면·사진 첨부</Label>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => set("fileName", form.fileName ? "" : "현장사진_1.jpg")}
            className="inline-flex items-center gap-2 rounded-2xl border-2 border-dashed border-line px-6 py-4 text-[19px] font-bold text-ink-2 transition-colors hover:border-primary hover:text-primary"
          >
            <Paperclip size={21} /> {form.fileName ? "첨부 취소" : "파일 선택"}
          </button>
          {form.fileName && (
            <span className="rounded-xl bg-primary-light px-4 py-2.5 text-[18px] font-bold text-primary-dark">
              {form.fileName}
            </span>
          )}
          <span className="text-[17.5px] text-ink-3">
            도면이나 현장 사진이 있으면 견적이 더 정확해집니다.
          </span>
        </div>
      </div>

      {service && (
        <div className="mt-6 rounded-3xl bg-[#f7f8fa] p-6">
          <p className="text-[19px] font-bold">선택한 서비스</p>
          <p className="mt-1.5 text-[21px] font-extrabold">{service.name}</p>
          <p className="mt-1 text-[18.5px] text-ink-2">
            {service.priceNote} · 예상 기간 {service.duration}
          </p>
        </div>
      )}

      {/* 동의 */}
      <label className="mt-8 flex cursor-pointer items-start gap-3 rounded-2xl bg-[#f7f8fa] p-5">
        <input
          type="checkbox"
          checked={form.agree}
          onChange={(e) => set("agree", e.target.checked)}
          className="mt-1 h-[1.4rem] w-[1.4rem] shrink-0 rounded border-line accent-[#3182f6]"
        />
        <span className="text-[18.5px] leading-relaxed text-ink-2">
          <b className="text-ink">개인정보 수집·이용에 동의합니다.</b> 상담과 견적 안내를
          위해 회사명, 연락처, 요청 내용을 수집하며 문의 처리 완료 후 파기합니다.
        </span>
      </label>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          onClick={submit}
          disabled={!valid}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-9 py-5 text-[22px] font-bold text-white transition-all hover:bg-primary-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {type} 접수하기 <ArrowRight size={22} />
        </button>
        <a
          href="tel:041-000-0000"
          className="inline-flex items-center gap-2 rounded-2xl border border-line bg-white px-8 py-5 text-[22px] font-bold text-ink-2 transition-colors hover:bg-[#f7f8fa]"
        >
          <Phone size={22} /> 전화 상담 요청
        </a>
      </div>
      {!valid && (
        <p className="mt-3 text-[18px] text-ink-3">
          회사명, 연락처, 요청 내용을 입력하고 개인정보 수집에 동의하시면 접수할 수 있어요.
        </p>
      )}
    </div>
  );
}

export default function RequestPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1100px] px-4 py-20 text-center text-[20px] text-ink-3">
          불러오는 중입니다...
        </div>
      }
    >
      <RequestInner />
    </Suspense>
  );
}
