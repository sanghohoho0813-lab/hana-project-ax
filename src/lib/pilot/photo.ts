"use client";

/**
 * 현장 사진 올리기 (브라우저) — 사진을 휴대폰에서 줄여(긴 변 1600px · JPEG) 다시 저장한 뒤 비공개 저장소에 올린다.
 * - 다시 저장하면 사진 속 촬영 정보(EXIF: 위치·기기 등)가 빠진다 → exifRemoved=true 로 기록.
 * - 줄이지 못한 형식은 원본을 올리고 exifRemoved=false 로 기록(위치 정보가 남을 수 있음을 화면에 알림).
 * - 파일 지문(SHA-256)과 크기를 함께 기록해 나중에 같은 파일인지 확인할 수 있다.
 * - 로그인 세션(쿠키)으로 올리므로 저장소 권한(본인 폴더만)이 그대로 적용된다. 관리자 키를 쓰지 않는다.
 */
import { createBrowserClient } from "@supabase/ssr";
import { newOpId } from "./op-id";

export interface PreparedPhoto {
  blob: Blob;
  mime: "image/jpeg" | "image/png" | "image/webp";
  exifRemoved: boolean;
  width: number | null;
  height: number | null;
}

const MAX = 1600;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"] as const;

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob) throw new Error("변환 실패");
    return { blob, mime: "image/jpeg", exifRemoved: true, width: w, height: h };
  } catch {
    if ((ALLOWED as readonly string[]).includes(file.type) && file.size <= 10 * 1024 * 1024) {
      return { blob: file, mime: file.type as PreparedPhoto["mime"], exifRemoved: false, width: null, height: null };
    }
    throw new Error("이 사진 형식은 올릴 수 없습니다 (JPEG·PNG·WEBP, 10MB 이하).");
  }
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

/** 사진 1장을 본인 폴더/{사건}/{번호}.jpg 로 올린다 — 같은 파일 이름은 덮어쓰지 않는다 */
export async function uploadPhoto(userId: string, folder: string, p: PreparedPhoto): Promise<{ path: string; size: number; sha256: string }> {
  const ext = p.mime === "image/png" ? "png" : p.mime === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${folder}/${newOpId()}.${ext}`;
  const sha256 = await sha256Hex(p.blob);
  const { error } = await client().storage.from("field-photos").upload(path, p.blob, { contentType: p.mime, upsert: false });
  if (error) throw new Error(`사진을 올리지 못했습니다: ${error.message}`);
  return { path, size: p.blob.size, sha256 };
}
