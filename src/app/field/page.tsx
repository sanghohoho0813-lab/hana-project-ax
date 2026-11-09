"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLab } from "@/lib/lab/store";
import { useInFrame } from "@/components/lab/LabShell";
import { LabAlerts } from "@/components/lab/LabAlerts";
import { SessionBar } from "@/components/lab/SessionBar";
import { AdminView } from "@/components/lab/AdminView";
import { WorkerView } from "@/components/lab/WorkerView";
import { useCurrentSession } from "@/components/lab/common";

/** 현장 실증 — 관리자 시점 / 현장기사 시점 (시험용 전환 · 로그인 아님) */
export default function FieldPage() {
  return (
    <Suspense fallback={null}>
      <FieldLab />
    </Suspense>
  );
}

function FieldLab() {
  const params = useSearchParams();
  const inFrame = useInFrame();
  const { state } = useLab();
  const [session] = useCurrentSession();
  // 시점은 창마다 고른다 — PC 는 관리자, 모바일 화면은 현장기사가 기본
  const view = params.get("view") === "worker" || params.get("view") === "admin" ? params.get("view")! : inFrame ? "worker" : "admin";
  const q = (v: string) => `/field?view=${v}${inFrame ? "&frame=1" : ""}`;
  if (!state) return <LabAlerts />;

  return (
    <div className="space-y-3">
      <LabAlerts />
      <div role="tablist" aria-label="시점" className="grid grid-cols-2 gap-1 rounded-2xl bg-[#e8ebee] p-1 sm:inline-grid sm:w-auto">
        {[
          { v: "admin", label: "관리자 시점" },
          { v: "worker", label: "현장기사 시점" },
        ].map((t) => (
          <Link
            key={t.v}
            href={q(t.v)}
            role="tab"
            aria-selected={view === t.v}
            className={`rounded-xl px-4 py-2.5 text-center text-[18px] font-extrabold ${view === t.v ? "bg-white text-ink shadow-sm" : "text-ink-3"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {view === "admin" ? (
        <>
          <SessionBar />
          {session && <AdminView s={state} session={session} />}
        </>
      ) : (
        <>
          <SessionBar compact />
          {session && <WorkerView s={state} session={session} />}
        </>
      )}
    </div>
  );
}
