"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Clock, FileText, FolderOpen, Search, Sparkles } from "lucide-react";
import { useApp } from "@/lib/store";
import { DOCUMENTS, DOC_CATEGORIES } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { closeoutDone, missingCloseoutDocs, receivable } from "@/lib/calc";
import { Badge, EmptyState, PageIntro, ProgressBar } from "@/components/ui";

const SUGGESTED = [
  "군산 CCTV 견적서",
  "대천동 현장사진",
  "미수금 현장",
  "서천 주간보고서",
  "준공사진 누락",
];

function DocumentsInner() {
  const { projects } = useApp();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState("전체");

  const results = useMemo(() => {
    const query = q.trim();
    let list = DOCUMENTS;
    if (category !== "전체") list = list.filter((d) => d.category === category);
    if (!query) return list;
    const terms = query.split(/\s+/);
    return list.filter((d) => {
      const project = projects.find((p) => p.id === d.projectId);
      const missing = project ? missingCloseoutDocs(project) : [];
      const hay = [
        d.name,
        d.category,
        d.owner,
        project?.name ?? "",
        project?.shortName ?? "",
        project?.region ?? "",
        project?.client ?? "",
        project && receivable(project) > 0 ? "미수금" : "",
        missing.includes("공사사진") ? "준공사진 누락" : "",
        missing.length > 0 ? "누락" : "",
      ].join(" ");
      return terms.every((t) => hay.includes(t));
    });
  }, [q, category, projects]);

  const activeProjects = projects.filter((p) => p.statusKey !== "done");
  const recent = DOCUMENTS.filter((d) => d.recentlyOpened);
  const today = DOCUMENTS.filter((d) => d.date === "2026-07-27" || d.date === "2026-07-28");
  const missingProjects = activeProjects.filter((p) => missingCloseoutDocs(p).length > 0);

  return (
    <div className="page-in space-y-5">
      <PageIntro message="바탕화면과 메신저에 흩어진 자료를 프로젝트별로 모으세요." />

      {/* 검색 */}
      <div className="card p-5">
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="프로젝트명, 고객명, 견적서, 준공사진을 검색하세요"
            className="w-full rounded-2xl border border-line bg-[#f7f8fa] py-3.5 pr-4 pl-11 text-[15px] outline-none transition-all placeholder:text-ink-3 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-[12px] font-semibold text-ink-3">
            <Sparkles size={12} /> 자주 찾는 검색어
          </span>
          {SUGGESTED.map((s) => (
            <button
              key={s}
              onClick={() => setQ(s)}
              className="rounded-full bg-[#f2f4f6] px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 transition-colors hover:bg-primary-light hover:text-primary-dark"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 3종 */}
      {!q.trim() && (
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="card p-5">
            <p className="mb-3 flex items-center gap-1.5 text-[14px] font-bold">
              <Clock size={15} className="text-ink-3" /> 최근 열어본 문서
            </p>
            <div className="space-y-2">
              {recent.slice(0, 3).map((d) => (
                <p key={d.id} className="truncate rounded-xl bg-[#f7f8fa] px-3.5 py-2.5 text-[13px]">
                  {d.name}
                </p>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <p className="mb-3 flex items-center gap-1.5 text-[14px] font-bold">
              <FileText size={15} className="text-primary" /> 오늘 추가된 문서
              <Badge tone="info">{today.length}건</Badge>
            </p>
            <div className="space-y-2">
              {today.slice(0, 3).map((d) => (
                <p key={d.id} className="truncate rounded-xl bg-[#f7f8fa] px-3.5 py-2.5 text-[13px]">
                  {d.name}
                </p>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <p className="mb-3 flex items-center gap-1.5 text-[14px] font-bold">
              <AlertTriangle size={15} className="text-warning" /> 준공에 필요한데 없는 문서
            </p>
            <div className="space-y-2">
              {missingProjects.slice(0, 3).map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}?tab=closeout`}
                  className="block rounded-xl bg-warning-bg/60 px-3.5 py-2.5 transition-colors hover:bg-warning-bg"
                >
                  <p className="truncate text-[13px] font-bold">{p.shortName}</p>
                  <p className="truncate text-[12px] text-warning">
                    {missingCloseoutDocs(p).slice(0, 2).join(", ")}
                    {missingCloseoutDocs(p).length > 2 &&
                      ` 외 ${missingCloseoutDocs(p).length - 2}건`}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 분류 */}
      <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <div className="flex min-w-max gap-1.5">
          {["전체", ...DOC_CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                category === c
                  ? "bg-primary text-white"
                  : "bg-white text-ink-2 shadow-[var(--shadow-card)] hover:bg-[#f7f8fa]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 결과 */}
      <section>
        <h3 className="mb-3 text-[17px] font-bold">
          {q.trim() ? `"${q.trim()}" 검색 결과` : "문서"}{" "}
          <span className="text-ink-3">{results.length}건</span>
        </h3>
        {results.length === 0 ? (
          <EmptyState
            title="찾는 문서가 없어요"
            desc="검색어를 줄이거나 분류를 바꿔서 다시 찾아보세요."
          />
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {results.map((d) => {
              const project = projects.find((p) => p.id === d.projectId);
              return (
                <div key={d.id} className="card card-hover flex items-center gap-3.5 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-bg text-info">
                    <FileText size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold">{d.name}</p>
                    <p className="truncate text-[12.5px] text-ink-3">
                      {project ? (
                        <Link
                          href={`/projects/${project.id}?tab=docs`}
                          className="text-primary-dark hover:underline"
                        >
                          {project.shortName}
                        </Link>
                      ) : (
                        "공통 문서"
                      )}{" "}
                      · {formatDate(d.date)} · {d.owner}
                    </p>
                  </div>
                  <Badge tone="neutral">{d.category}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 프로젝트별 문서 완성도 */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-[17px] font-bold">
          <FolderOpen size={17} className="text-primary" /> 프로젝트별 문서 완성도
        </h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {activeProjects.map((p) => {
            const count = DOCUMENTS.filter((d) => d.projectId === p.id).length;
            const latest = DOCUMENTS.filter((d) => d.projectId === p.id).sort((a, b) =>
              a.date < b.date ? 1 : -1
            )[0];
            const done = closeoutDone(p);
            const missing = missingCloseoutDocs(p);
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}?tab=closeout`}
                className="card card-hover block p-5"
              >
                <p className="truncate text-[14px] font-bold">{p.name}</p>
                <p className="mt-1 text-[12.5px] text-ink-3">
                  문서 {count}건 · 최신 {latest ? formatDate(latest.date) : "없음"} · 담당{" "}
                  {p.manager}
                </p>
                <div className="mt-3.5">
                  <div className="mb-1 flex justify-between text-[12.5px] font-semibold">
                    <span className="text-ink-3">준공 문서</span>
                    <span>
                      {done}/{p.closeoutDocs.length} 완료
                    </span>
                  </div>
                  <ProgressBar
                    value={(done / p.closeoutDocs.length) * 100}
                    tone={missing.length === 0 ? "success" : missing.length <= 2 ? "warning" : "info"}
                  />
                </div>
                {missing.length > 0 && missing.length <= 4 && (
                  <p className="mt-2 truncate text-[12px] font-semibold text-warning">
                    누락: {missing.join(", ")}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={<div className="card p-10 text-center text-ink-3">불러오는 중입니다...</div>}
    >
      <DocumentsInner />
    </Suspense>
  );
}
