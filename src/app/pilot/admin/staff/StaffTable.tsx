"use client";

import { Badge, inputClass } from "@/components/ui";
import type { StaffRow } from "@/lib/pilot/board";
import { setProfileAction } from "../actions";
import { useOp } from "../../_ui/useOp";
import { Feedback } from "../../_ui/Feedback";

function StaffItem({ p, me }: { p: StaffRow & { created: string }; me: string }) {
  const { run, busy, result } = useOp();
  const self = p.id === me;
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("user_id", p.id);
    if (self) {
      fd.set("role", "admin");
      fd.set("active", "on");
    }
    await run(() => setProfileAction(fd));
  };
  return (
    <form onSubmit={submit} className="grid items-end gap-2 border-t border-line py-3 sm:grid-cols-[1.3fr_1fr_auto_auto_auto]">
      <div className="min-w-0">
        <p className="truncate text-[17px] font-semibold text-ink-2">{p.email || "(이메일 없음)"}</p>
        <p className="text-[14.5px] text-ink-3">
          만든 시각 {p.created} {self && <Badge tone="info">나</Badge>}
        </p>
      </div>
      <label className="block">
        <span className="text-[15px] font-semibold text-ink-3">이름</span>
        <input name="display_name" defaultValue={p.display_name} required maxLength={40} className={`${inputClass} !py-1.5 !text-[18px]`} />
      </label>
      <label className="block">
        <span className="text-[15px] font-semibold text-ink-3">역할</span>
        <select name="role" defaultValue={p.role} disabled={self} className={`${inputClass} !py-1.5 !text-[18px]`}>
          <option value="field">현장 직원</option>
          <option value="admin">관리자</option>
        </select>
      </label>
      <label className="flex items-center gap-2 pb-2 text-[17px] font-semibold">
        <input type="checkbox" name="active" defaultChecked={p.active} disabled={self} className="h-5 w-5" /> 활성
      </label>
      <button disabled={busy} className="rounded-xl bg-primary px-3.5 py-2 text-[17px] font-bold text-white disabled:opacity-45">
        {busy ? "저장 중…" : "저장"}
      </button>
      {result && (
        <div className="sm:col-span-5">
          <Feedback result={result} />
        </div>
      )}
    </form>
  );
}

export function StaffTable({ rows, me }: { rows: (StaffRow & { created: string })[]; me: string }) {
  return (
    <section className="card px-5 py-2" aria-label="계정 목록">
      {rows.map((p) => (
        <StaffItem key={p.id} p={p} me={me} />
      ))}
    </section>
  );
}
