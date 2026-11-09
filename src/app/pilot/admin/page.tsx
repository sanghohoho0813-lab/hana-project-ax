import { requireAdmin } from "@/lib/pilot/session";

export default async function AdminPage() {
  const s = await requireAdmin();
  return <h1 className="text-[26px] font-extrabold">관리자 일정판 · {s.profile?.display_name}</h1>;
}
