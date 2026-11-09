"use client";

import { useActionState } from "react";
import { PrimaryButton, inputClass } from "@/components/ui";
import { setPasswordAction, type FormState } from "../../auth-actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(setPasswordAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-[18px] font-semibold text-ink-2">새 비밀번호</span>
        <input name="password" type="password" autoComplete="new-password" minLength={10} required className={inputClass} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[18px] font-semibold text-ink-2">한 번 더</span>
        <input name="confirm" type="password" autoComplete="new-password" minLength={10} required className={inputClass} />
      </label>
      <p className="text-[16px] text-ink-3">10자 이상, 영문 대문자·소문자·숫자를 모두 넣어 주세요.</p>
      {state?.error && <p className="text-[17.5px] font-semibold text-danger">{state.error}</p>}
      <PrimaryButton disabled={pending} className="w-full">
        {pending ? "저장 중…" : "비밀번호 저장"}
      </PrimaryButton>
    </form>
  );
}
