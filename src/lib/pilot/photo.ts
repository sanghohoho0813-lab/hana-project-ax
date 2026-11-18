"use client";

/**
 * 현장 사진 올리기 (브라우저) — 사진을 휴대폰에서 줄여(긴 변 1600px · JPEG) 다시 저장한 뒤 비공개 저장소에 올린다.
 * - 다시 저장하면 사진 속 촬영 정보(EXIF: 위치·기기 등)가 빠진다 → exifRemoved=true 로 기록.
 * - 다시 저장(캔버스)이 안 되는 브라우저 · 사진이면 파일에서 촬영정보 구간을 직접 지우고(photo-meta.ts) 다시 확인한 뒤 올린다.
 *   지우지 못하는 형식(HEIC 등)은 올리지 않고 바꾸는 방법을 알려 준다 — 원본을 그대로 올리지 않는다 (0.6.0까지는 원본을 올렸음).
 * - 파일 지문(SHA-256)과 크기를 함께 기록해 나중에 같은 파일인지 확인할 수 있다.
 * - 다시 올리기 안전: 사진마다 저장 위치와 요청 번호를 한 번 정해 두고 다시 쓴다
 *   → 올라간 뒤 응답만 끊겨도 다시 누르면 같은 파일 · 같은 기록 한 건 (중복 사진 · 남는 파일 없음).
 * - 로그인 세션(쿠키)으로 올리므로 저장소 권한(본인 폴더만)이 그대로 적용된다. 관리자 키를 쓰지 않는다.
 */
import { createBrowserClient } from "@supabase/ssr";
import { newOpId } from "./op-id";
import { hasMetadata, stripMetadata } from "./photo-meta";

export interface PreparedPhoto {
  blob: Blob;
  mime: "image/jpeg" | "image/png" | "image/webp";
  exifRemoved: boolean;
  width: number | null;
  height: number | null;
  /** 어떻게 촬영정보를 지웠는지 (기록용 설명) */
  method: "다시 저장" | "촬영정보 구간 삭제";
}

const MAX = 1600;
const MAX_BYTES = 10 * 1024 * 1024;

export const PHOTO_ERR = {
  unsafe:
    "이 사진은 촬영정보(위치 등)를 지울 수 없어 올리지 않았습니다. 사진을 빼고 다른 사진을 고르거나, 휴대폰 카메라 설정을 '높은 호환성(JPEG)'으로 바꿔 다시 찍어 주세요.",
  tooBig: "사진이 너무 큽니다 (10MB 이하). 사진을 빼고 다시 찍어 주세요.",
} as const;

/** 캔버스로 다시 저장 — 대부분의 휴대폰 브라우저 */
async function redraw(file: Blob): Promise<PreparedPhoto> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("그리기 불가");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
  if (!blob || blob.size === 0) throw new Error("변환 실패");
  return { blob, mime: "image/jpeg", exifRemoved: true, width: w, height: h, method: "다시 저장" };
}

/**
 * 올릴 사진 만들기 — 결과는 언제나 촬영정보가 없는 사진이다. 그렇게 만들 수 없으면 오류(PHOTO_ERR)를 던진다.
 * deps 는 시험용 (기본은 브라우저의 캔버스 다시 저장).
 */
export async function preparePhoto(file: Blob, deps: { redraw?: (f: Blob) => Promise<PreparedPhoto> } = {}): Promise<PreparedPhoto> {
  let first: PreparedPhoto | null = null;
  try {
    first = await (deps.redraw ?? redraw)(file);
  } catch {
    first = null;
  }
  if (first) {
    // 다시 저장한 결과도 한 번 더 확인한다 (드물게 브라우저가 정보를 붙이는 경우)
    const bytes = new Uint8Array(await first.blob.arrayBuffer());
    if (!hasMetadata(bytes)) return first;
    const s = stripMetadata(bytes);
    if (s) return { ...first, blob: new Blob([s.bytes as BlobPart], { type: s.mime }), mime: s.mime };
  }
  // 다시 저장이 안 되면: 파일에서 촬영정보 구간을 지운다 (형식은 파일 앞부분으로 판단)
  if (file.size > MAX_BYTES) throw new Error(PHOTO_ERR.tooBig);
  const s = stripMetadata(new Uint8Array(await file.arrayBuffer()));
  if (!s) throw new Error(PHOTO_ERR.unsafe);
  return { blob: new Blob([s.bytes as BlobPart], { type: s.mime }), mime: s.mime, exifRemoved: true, width: null, height: null, method: "촬영정보 구간 삭제" };
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("[설정] 저장소 주소가 설정되지 않았습니다.");
  return createBrowserClient(url, key);
}

const extOf = (mime: PreparedPhoto["mime"]) => (mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg");

/** 이미 올라간 파일인가 (같은 위치에 다시 올릴 때 저장소가 돌려주는 '이미 있음') */
export const alreadyExists = (e: { message?: string; statusCode?: string | number; status?: number } | null | undefined) =>
  !!e && (String(e.statusCode ?? "") === "409" || e.status === 409 || /already exists|duplicate/i.test(e.message ?? ""));

export interface PhotoAttach {
  opId: string;
  path: string;
  mime: PreparedPhoto["mime"];
  size: number;
  sha256: string;
  exifRemoved: boolean;
}

/** 사진마다 한 번 정한 계획 (같은 File 을 다시 보내면 같은 위치 · 같은 요청 번호) */
interface Plan extends PhotoAttach {
  folder: string;
  blob: Blob;
  uploaded: boolean;
}
const plans = new WeakMap<Blob, Plan>();

/**
 * 사진 1장을 본인 폴더/{folder}/{번호}.{확장자} 로 올리고 기록(attach)까지 한다 — 다시 불러도 안전.
 * upload 는 시험용 (기본은 Supabase 저장소).
 */
export async function sendPhoto(
  userId: string,
  folder: string,
  file: File,
  attach: (x: PhotoAttach) => Promise<void>,
  deps: { prepare?: (f: Blob) => Promise<PreparedPhoto>; upload?: (path: string, blob: Blob, mime: string) => Promise<{ error: { message?: string; statusCode?: string | number; status?: number } | null }> } = {},
): Promise<{ exifRemoved: boolean }> {
  let plan = plans.get(file);
  if (!plan || plan.folder !== folder) {
    const p = await (deps.prepare ?? preparePhoto)(file);
    plan = { folder, blob: p.blob, mime: p.mime, exifRemoved: p.exifRemoved, size: p.blob.size, sha256: await sha256Hex(p.blob), path: `${userId}/${folder}/${newOpId()}.${extOf(p.mime)}`, opId: newOpId(), uploaded: false };
    plans.set(file, plan);
  }
  if (!plan.uploaded) {
    const up = deps.upload ?? ((path: string, blob: Blob, mime: string) => client().storage.from("field-photos").upload(path, blob, { contentType: mime, upsert: false }));
    const { error } = await up(plan.path, plan.blob, plan.mime);
    if (error && !alreadyExists(error)) throw new Error(`사진을 올리지 못했습니다: ${error.message ?? "연결 오류"} — 다시 누르면 그 사진만 다시 올립니다.`);
    plan.uploaded = true;
  }
  await attach({ opId: plan.opId, path: plan.path, mime: plan.mime, size: plan.size, sha256: plan.sha256, exifRemoved: plan.exifRemoved });
  return { exifRemoved: plan.exifRemoved };
}
