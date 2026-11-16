"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, RotateCw, X } from "lucide-react";
import { cx } from "./ds";

/**
 * 사진 첨부 — 카메라 촬영 · 앨범 선택 · 미리보기 · 장별 올리기 상태 · 실패한 사진만 다시 올리기.
 * 실제 파일만 다룬다 (사진처럼 보이는 가짜 미리보기 없음). 올리기는 부모가 한다 — 이 부품은 고르기와 상태 표시만.
 * 앨범 입력칸의 aria-label(inputLabel)은 기존 화면시험·자동화가 파일을 넣는 이름이라 바꾸지 않는다.
 */
export type PhotoStatus = "대기" | "올리는 중" | "완료" | "실패";
export interface PhotoItem {
  key: string;
  file: File;
  preview: string;
  status: PhotoStatus;
  error?: string;
  exifRemoved?: boolean;
}

/** 사진 목록 상태 — 추가 · 빼기 · 상태 바꾸기 · 미리보기 주소 정리 */
export function usePhotos(max = 6) {
  const [items, setItems] = useState<PhotoItem[]>([]);
  const urls = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const u of urls.current) URL.revokeObjectURL(u);
    },
    [],
  );
  const add = useCallback(
    (files: File[]) =>
      setItems((cur) => {
        const room = Math.max(0, max - cur.length);
        const next = files.slice(0, room).map((f, i) => {
          const preview = URL.createObjectURL(f);
          urls.current.push(preview);
          return { key: `${Date.now()}-${i}-${f.name}`, file: f, preview, status: "대기" as const };
        });
        return [...cur, ...next];
      }),
    [max],
  );
  const remove = useCallback((key: string) => setItems((cur) => cur.filter((x) => x.key !== key)), []);
  const patch = useCallback((key: string, p: Partial<PhotoItem>) => setItems((cur) => cur.map((x) => (x.key === key ? { ...x, ...p } : x))), []);
  const reset = useCallback(() => setItems([]), []);
  return { items, add, remove, patch, reset, setItems };
}

export function PhotoPicker({
  items,
  onAdd,
  onRemove,
  max = 6,
  disabled = false,
  inputLabel = "현장 사진",
  title = "사진",
  required = false,
  hint,
}: {
  items: PhotoItem[];
  onAdd: (files: File[]) => void;
  onRemove: (key: string) => void;
  max?: number;
  disabled?: boolean;
  inputLabel?: string;
  title?: string;
  required?: boolean;
  hint?: string;
}) {
  const full = items.length >= max;
  const done = items.filter((x) => x.status === "완료").length;
  const failed = items.filter((x) => x.status === "실패").length;
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    onAdd([...(e.target.files ?? [])]);
    e.target.value = "";
  };
  const tile = "relative flex min-h-[3.5rem] flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl text-[16px] font-bold transition-colors active:scale-[0.99]";
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-bold text-ink">
          {title}
          {required && <span className="ml-1 text-danger">필수</span>}
        </p>
        <p className="text-[13.5px] font-semibold text-ink-3 tabular-nums">
          {items.length}/{max}장{done > 0 && ` · 올림 ${done}`}
          {failed > 0 && <span className="text-danger"> · 실패 {failed}</span>}
        </p>
      </div>
      <div className="flex gap-2">
        <label className={cx(tile, "bg-ink text-white", (disabled || full) && "pointer-events-none opacity-40")}>
          <Camera size={20} /> 촬영
          <input type="file" accept="image/*" capture="environment" className="sr-only" aria-label={`${inputLabel} 촬영`} disabled={disabled || full} onChange={pick} />
        </label>
        <label className={cx(tile, "bg-[#eef0f3] text-ink-2", (disabled || full) && "pointer-events-none opacity-40")}>
          <ImagePlus size={20} /> 앨범
          <input type="file" accept="image/*" multiple className="sr-only" aria-label={inputLabel} disabled={disabled || full} onChange={pick} />
        </label>
      </div>
      {items.length > 0 && (
        <ul className="grid grid-cols-3 gap-2" aria-label="첨부할 사진">
          {items.map((p, i) => (
            <li key={p.key} className="relative overflow-hidden rounded-2xl bg-[#eef0f3]">
              {/* eslint-disable-next-line @next/next/no-img-element -- 휴대폰에서 고른 실제 파일의 미리보기 */}
              <img src={p.preview} alt={`첨부 사진 ${i + 1}`} className={cx("aspect-square w-full object-cover", p.status === "올리는 중" && "opacity-60")} />
              <span
                className={cx(
                  "absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold text-white",
                  p.status === "실패" ? "bg-danger" : p.status === "완료" ? "bg-success" : p.status === "올리는 중" ? "bg-primary" : "bg-ink/70",
                )}
              >
                {p.status === "올리는 중" && <RotateCw size={11} className="animate-spin" />}
                {p.status}
              </span>
              {(p.status === "대기" || p.status === "실패") && !disabled && (
                <button
                  type="button"
                  aria-label={`사진 ${i + 1} 빼기`}
                  onClick={() => onRemove(p.key)}
                  className="absolute top-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-ink shadow"
                >
                  <X size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {failed > 0 && <p className="text-[13.5px] font-semibold text-danger">실패한 사진은 아래 버튼을 다시 누르면 그 사진만 다시 올립니다.</p>}
      {hint && <p className="text-[13px] text-ink-3">{hint}</p>}
    </div>
  );
}

/** 대기·실패 사진만 차례로 올린다 — 실패해도 나머지는 계속, 결과는 장별 상태로 남는다 */
export async function uploadEach(items: PhotoItem[], patch: (key: string, p: Partial<PhotoItem>) => void, upload: (file: File) => Promise<{ exifRemoved: boolean }>): Promise<{ ok: number; failed: number }> {
  let ok = items.filter((x) => x.status === "완료").length;
  let failed = 0;
  for (const it of items) {
    if (it.status === "완료") continue;
    patch(it.key, { status: "올리는 중", error: undefined });
    try {
      const r = await upload(it.file);
      patch(it.key, { status: "완료", exifRemoved: r.exifRemoved });
      ok++;
    } catch (e) {
      patch(it.key, { status: "실패", error: e instanceof Error ? e.message : String(e) });
      failed++;
    }
  }
  return { ok, failed };
}
