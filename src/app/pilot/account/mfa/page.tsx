import { redirect } from "next/navigation";
import { requireSession } from "@/lib/pilot/session";
import { MfaForm } from "./MfaForm";

export default async function MfaPage() {
  const s = await requireSession();
  if (s.profile?.role !== "admin" || !s.profile.active) redirect("/pilot");
  if (s.aal === "aal2") redirect("/pilot/admin");
  return (
    <div className="mx-auto max-w-[32rem] pt-6">
      <div className="card space-y-4 px-6 py-6">
        <h1 className="text-[26px] font-extrabold">관리자 2단계 인증</h1>
        <MfaForm enrolled={s.hasTotp} />
      </div>
    </div>
  );
}
