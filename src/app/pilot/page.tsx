import { redirect } from "next/navigation";
import { getPilotSession } from "@/lib/pilot/session";

export default async function PilotHome() {
  const s = await getPilotSession();
  if (s === "unconfigured") {
    return (
      <div className="card max-w-[44rem] space-y-2 px-6 py-6">
        <h1 className="text-[26px] font-extrabold">실증 DB가 아직 설정되지 않았습니다</h1>
        <p className="text-[19px] text-ink-2">
          관리자가 Supabase 주소와 공개 키(NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)를 배포 설정에 넣으면 이 화면이 열립니다. 데모 화면은 그대로 쓸 수 있습니다.
        </p>
      </div>
    );
  }
  if (!s) redirect("/pilot/login");
  if (!s.profile?.active) {
    return (
      <div className="card max-w-[44rem] space-y-2 px-6 py-6">
        <h1 className="text-[26px] font-extrabold">계정이 아직 활성화되지 않았습니다</h1>
        <p className="text-[19px] text-ink-2">관리자에게 실증 계정 활성화를 요청해 주세요. ({s.email})</p>
      </div>
    );
  }
  if (s.profile.role === "admin") redirect(s.aal === "aal2" ? "/pilot/admin" : "/pilot/account/mfa");
  redirect("/pilot/field");
}
