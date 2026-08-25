"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, PhoneCall, Wallet, X } from "lucide-react";

const STORAGE_KEY = "hana-ax-guide-dismissed";
const SESSION_KEY = "hana-ax-guide-seen";

const ITEMS = [
  {
    icon: PhoneCall,
    tone: "text-primary",
    bg: "bg-primary-light",
    title: "누가 확인했는지 바로 보여요",
    desc: "업무를 전달한 뒤 담당자가 열어봤는지, 확인 버튼을 눌렀는지까지 추적합니다.",
  },
  {
    icon: AlertTriangle,
    tone: "text-danger",
    bg: "bg-danger-bg",
    title: "지연과 누락을 먼저 알려줘요",
    desc: "미확인 업무, 기한 초과, 일정 충돌, 빠진 결과보고를 위험한 순서로 보여줍니다.",
  },
  {
    icon: Wallet,
    tone: "text-success",
    bg: "bg-success-bg",
    title: "전화로 받은 지시도 남겨요",
    desc: "통화 메모를 붙여넣으면 업무와 일정으로 정리돼 담당자에게 바로 전달됩니다.",
  },
];

/**
 * 첫 진입에만 안내를 띄운다.
 * - 세션 동안 한 번 닫으면 페이지를 옮겨 다녀도 다시 뜨지 않는다
 * - '다시 보지 않기'를 고르면 다음에 방문해도 뜨지 않는다
 */
export function useGuide() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/") return;
    if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    if (window.sessionStorage.getItem(SESSION_KEY) === "1") return;
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, []);

  return { open, setOpen };
}

export function GuideOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [dontShow, setDontShow] = useState(false);
  if (!open) return null;

  const close = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(SESSION_KEY, "1");
      if (dontShow) window.localStorage.setItem(STORAGE_KEY, "1");
    }
    onClose();
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-end justify-end p-4 pb-[6.5rem] lg:p-6">
      <div className="float-in pointer-events-auto w-full max-w-[24rem] overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-modal)]">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <p className="text-[24.8px] font-bold">처음 보셔도 괜찮습니다</p>
            <p className="mt-1 text-[19.5px] leading-relaxed text-ink-2">
              이 화면은 오늘 확인해야 할 업무와 일정을 순서대로 정리해
              보여줍니다.
            </p>
          </div>
          <button
            onClick={close}
            aria-label="안내 닫기"
            className="-mt-1 shrink-0 rounded-full p-2 text-ink-3 transition-colors hover:bg-[#f2f4f6] hover:text-ink"
          >
            <X size={26} />
          </button>
        </div>

        <div className="mt-4 space-y-2.5 px-5">
          {ITEMS.map((it) => (
            <div
              key={it.title}
              className="flex gap-3 rounded-2xl bg-[#f7f8fa] p-3.5"
            >
              <span
                className={`flex h-[3.0rem] w-[3.0rem] shrink-0 items-center justify-center rounded-xl ${it.bg} ${it.tone}`}
              >
                <it.icon size={22} />
              </span>
              <div className="min-w-0">
                <p className="text-[20.2px] font-bold">{it.title}</p>
                <p className="mt-0.5 text-[18.8px] leading-relaxed text-ink-2">
                  {it.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line px-5 py-4">
          <label className="flex cursor-pointer items-center gap-2 text-[18.8px] font-medium text-ink-2">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="h-[1.5rem] w-[1.5rem] rounded border-line accent-[#3182f6]"
            />
            다시 보지 않기
          </label>
          <button
            onClick={close}
            className="rounded-xl bg-primary px-4 py-2 text-[19.5px] font-bold text-white transition-colors hover:bg-primary-dark active:scale-[0.98]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
