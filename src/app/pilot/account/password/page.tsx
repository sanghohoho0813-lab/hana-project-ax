import { requireSession } from "@/lib/pilot/session";
import { PasswordForm } from "./PasswordForm";

export default async function PasswordPage() {
  const s = await requireSession();
  return (
    <div className="mx-auto max-w-[30rem] pt-6">
      <div className="card space-y-4 px-6 py-6">
        <h1 className="text-[26px] font-extrabold">비밀번호 정하기</h1>
        <p className="text-[17.5px] text-ink-3">{s.email}</p>
        <PasswordForm />
      </div>
    </div>
  );
}
