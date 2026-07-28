"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileText, FolderOpen, Search } from "lucide-react";
import { useApp } from "@/lib/store";
import { DOCUMENTS, DOC_CATEGORIES } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { receivable } from "@/lib/calc";
import { Badge, EmptyState, ProgressBar } from "@/components/ui";

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
    let docs = DOCUMENTS;
    if (category !== "전체") docs = docs.filter((d) => d.category === category);
    if (!query) return docs;
    const terms = query.split(/\s+/);
    return docs.filter((d) => {
      const project = projects.find((p) => p.id === d.projectId);
      const hay = [
        d.name,
        d.category,
        d.owner,
        project?.name ?? "",
        project?.region ?? "",
        project?.client ?? "",
        project && receivable(project) > 0 ? "미수금" : "",
        project?.closeoutDocs.some((c) => !c.done && c.name === "공사사진")
          ? "준공사진 누락"
          : "",
      ].join(" ");
      return terms.every((t) => hay.includes(t));
    });
  }, [q, category, projects]);

  const activeProjects = projects.filter((p) => p.statusKey !== "done");

  return (
    <div className="page-in space-y-6">
      {/* 검색 */}
      <div className="card p-5">
        <div className="relative">
          <Search
            size={17}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="예: 군산 CCTV 견적서, 미수금 현장, 준공사진 누락"
            className="w-full rounded-2xl border border-line bg-[#f7f8fa] py-3.5 pr-4 pl-11 text-[15px] outline-none transition-all placeholder:text-ink-3 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
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

      {/* 분류 필터 */}
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

      {/* 검색 결과 */}
      <section>
        <h3 className="mb-3 text-[17px] font-bold">
          문서 <span className="text-ink-3">{results.length}건</span>
        </h3>
        {results.length === 0 ? (
          <EmptyState
            title="검색 결과가 없어요"
            desc="다른 검색어나 분류로 다시 찾아보세요."
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
                          {project.name}
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

      {/* 프로젝트 문서 현황 */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-[17px] font-bold">
          <FolderOpen size={17} className="text-primary" /> 프로젝트 문서 현황
        </h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {activeProjects.map((p) => {
            const count = DOCUMENTS.filter((d) => d.projectId === p.id).length;
            const latest = DOCUMENTS.filter((d) => d.projectId === p.id).sort(
              (a, b) => (a.date < b.date ? 1 : -1)
            )[0];
            const doneDocs = p.closeoutDocs.filter((d) => d.done).length;
            const missing = p.closeoutDocs.filter((d) => !d.done).length;
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}?tab=docs`}
                className="card card-hover block p-5"
              >
                <p className="truncate text-[14px] font-bold">{p.name}</p>
                <p className="mt-1 text-[12.5px] text-ink-3">
                  문서 {count}건 · 최근{" "}
                  {latest ? formatDate(latest.date) : "업데이트 없음"} · 담당{" "}
                  {p.manager}
                </p>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[12px] font-semibold">
                    <span className="text-ink-3">준공 준비율</span>
                    <span>
                      {doneDocs}/{p.closeoutDocs.length}
                    </span>
                  </div>
                  <ProgressBar
                    value={(doneDocs / p.closeoutDocs.length) * 100}
                    tone={missing === 0 ? "success" : missing <= 2 ? "warning" : "info"}
                  />
                </div>
                {missing > 0 && missing < 9 && (
                  <p className="mt-2 truncate text-[12px] text-warning">
                    누락:{" "}
                    {p.closeoutDocs
                      .filter((d) => !d.done)
                      .map((d) => d.name)
                      .join(", ")}
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
    <Suspense fallback={<div className="card p-8 text-center text-ink-3">불러오는 중...</div>}>
      <DocumentsInner />
    </Suspense>
  );
}
