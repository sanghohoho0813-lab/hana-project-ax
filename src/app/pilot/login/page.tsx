import { redirect } from "next/navigation";
import { getPilotSession } from "@/lib/pilot/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const s = await getPilotSession();
  if (s === "unconfigured") redirect("/pilot");
  if (s) redirect("/pilot");
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-[30rem] space-y-4 pt-6">
      <div className="card space-y-4 px-6 py-6">
        <h1 className="text-[28px] font-extrabold">실증 시스템 로그인</h1>
        <p className="text-[17.5px] text-ink-3">관리자가 발급하거나 초대한 계정만 쓸 수 있습니다. 회원가입은 받지 않습니다.</p>
        {error && <p className="text-[17px] font-semibold text-danger">링크가 만료됐거나 이미 쓴 링크입니다. 관리자에게 다시 요청해 주세요.</p>}
        <LoginForm />
      </div>
    </div>
  );
}
