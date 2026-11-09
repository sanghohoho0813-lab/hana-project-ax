import { requireField } from "@/lib/pilot/session";

export default async function FieldPage() {
  const s = await requireField();
  return <h1 className="text-[26px] font-extrabold">오늘 내 일정 · {s.profile?.display_name}</h1>;
}
