"use client";

import { useActionState, useState } from "react";
import { PrimaryButton, inputClass } from "@/components/ui";
import { requestResetAction, signInAction, type FormState } from "../auth-actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signInAction, undefined);
  const [reset, resetAction, resetting] = useActionState<FormState, FormData>(requestResetAction, undefined);
  const [forgot, setForgot] = useState(false);
  return (
    <div className="space-y-5">
      <form action={action} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[18px] font-semibold text-ink-2">이메일</span>
          <input key={state?.email ?? ""} name="email" type="email" autoComplete="username" defaultValue={state?.email} required className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[18px] font-semibold text-ink-2">비밀번호</span>
          <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </label>
        {state?.error && <p className="text-[17.5px] font-semibold text-danger">{state.error}</p>}
        <PrimaryButton disabled={pending} className="w-full">
          {pending ? "확인 중…" : "로그인"}
        </PrimaryButton>
      </form>
      <button onClick={() => setForgot((v) => !v)} className="text-[16.5px] font-semibold text-primary-dark hover:underline">
        비밀번호를 잊었어요
      </button>
      {forgot && (
        <form action={resetAction} className="space-y-2 rounded-2xl bg-[#f7f8fa] p-4">
          <input name="email" type="email" placeholder="계정 이메일" required className={inputClass} />
          {reset?.error && <p className="text-[16.5px] font-semibold text-danger">{reset.error}</p>}
          {reset?.ok && <p className="text-[16.5px] font-semibold text-ink-2">{reset.ok}</p>}
          <PrimaryButton disabled={resetting}>재설정 메일 받기</PrimaryButton>
        </form>
      )}
    </div>
  );
}
