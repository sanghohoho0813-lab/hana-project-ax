import { Suspense } from "react";
import { AdminSidebar } from "./AdminSidebar";

/** 관리자 화면 틀 — PC는 왼쪽 메뉴, 모바일은 위쪽 가로 메뉴. 권한 확인은 각 화면(requireAdmin)이 그대로 한다 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-8 print:block">
      <Suspense fallback={<div className="hidden lg:block" />}>
        <AdminSidebar />
      </Suspense>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
