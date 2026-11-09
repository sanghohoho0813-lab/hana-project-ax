"use client";

import { useActionState, useState } from "react";
import { PrimaryButton, inputClass } from "@/components/ui";
import { mfaEnrollAction, mfaVerifyAction, type FormState } from "../../auth-actions";

export function MfaForm({ enrolled }: { enrolled: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mfaVerifyAction, undefined);
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    const r = await mfaEnrollAction();
    setBusy(false);
    if ("error" in r) setError(r.error);
    else setEnroll(r);
  };

  if (!enrolled && !enroll) {
    return (
      <div className="space-y-3">
        <p className="text-[18px] text-ink-2">관리자 계정은 휴대폰 인증 앱(Google Authenticator 등)으로 2단계 인증을 등록해야 쓸 수 있습니다.</p>
        {error && <p className="text-[17px] font-semibold text-danger">{error}</p>}
        <PrimaryButton onClick={start} disabled={busy}>
          {busy ? "준비 중…" : "2단계 인증 등록 시작"}
        </PrimaryButton>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3">
      {enroll && (
        <div className="space-y-2">
          <p className="text-[18px] text-ink-2">인증 앱으로 아래 QR 코드를 찍거나, 설정 키를 직접 넣으세요.</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase 가 만든 QR(SVG data URL) */}
          <img src={enroll.qr} alt="2단계 인증 등록 QR 코드" className="h-[200px] w-[200px] rounded-xl border border-line bg-white p-2" />
          <p className="font-mono text-[15px] break-all text-ink-2">설정 키: {enroll.secret}</p>
          <input type="hidden" name="factorId" value={enroll.factorId} />
        </div>
      )}
      <label className="block">
        <span className="mb-1.5 block text-[18px] font-semibold text-ink-2">인증 앱의 6자리 숫자</span>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required className={inputClass} />
      </label>
      {state?.error && <p className="text-[17.5px] font-semibold text-danger">{state.error}</p>}
      <PrimaryButton disabled={pending} className="w-full">
        {pending ? "확인 중…" : "확인"}
      </PrimaryButton>
    </form>
  );
}
