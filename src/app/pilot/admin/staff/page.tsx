import { requireAdmin } from "@/lib/pilot/session";
import { loadStaff } from "@/lib/pilot/board";
import { kstLabel } from "@/lib/pilot/time";
import { AdminNav } from "../AdminNav";
import { StaffTable } from "./StaffTable";

export default async function StaffPage() {
  const s = await requireAdmin();
  const staff = await loadStaff(s.sb);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[28px] font-extrabold">계정</h1>
        <AdminNav current="staff" />
      </div>
      <div className="card space-y-1.5 px-5 py-4 text-[17.5px] text-ink-2">
        <p>
          계정은 Supabase 대시보드 <b>Authentication → Users → Invite user</b>로 초대합니다 (회원가입은 받지 않음). 초대받은 사람은 메일 링크로 비밀번호를 정하고, 여기서 활성화해야 쓸 수 있습니다.
        </p>
        <p className="text-ink-3">이름·역할·활성 상태를 바꾸면 바꾼 사람과 시각이 이력으로 남습니다. 본인의 관리자 권한은 여기서 끌 수 없습니다.</p>
      </div>
      <StaffTable me={s.userId} rows={staff.map((p) => ({ ...p, created: kstLabel(p.created_at) }))} />
    </div>
  );
}
