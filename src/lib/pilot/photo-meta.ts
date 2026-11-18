/**
 * 사진 촬영정보(메타데이터) 지우기 — 파일 바이트에서 직접 지운다 (순수 · 브라우저 기능에 기대지 않음)
 *
 * 쓰는 곳: 휴대폰에서 사진을 다시 그려 저장(캔버스)하는 방법이 실패했을 때.
 *   예전에는 이때 원본을 그대로 올려 위치 · 기기 정보(EXIF)가 남을 수 있었다 (0.6.0까지).
 *   이제는 아래 형식만 바이트 단위로 촬영정보를 지운 뒤 다시 확인하고 올린다. 지울 수 없는 형식은 올리지 않는다.
 *
 * - JPEG: APP1(Exif · XMP) · APP13(Photoshop · IPTC) · COM(설명) 구간을 뺀다. 그림 데이터(SOS 이후)는 그대로.
 *         Exif 를 빼면 '사진 방향' 정보도 빠져, 일부 사진은 옆으로 누워 보일 수 있다 (내용은 그대로).
 * - PNG : eXIf · tEXt · zTXt · iTXt · tIME 묶음을 뺀다.
 * - WEBP: EXIF · XMP 묶음을 빼고, VP8X 머리의 해당 표시를 지우고, 전체 크기를 다시 적는다.
 * 그 밖의 형식(HEIC 등)은 지우지 못한다 → null.
 */

export type PhotoFormat = "image/jpeg" | "image/png" | "image/webp";

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));

/** 파일 앞부분으로 형식을 알아낸다 (파일 이름 · 브라우저가 알려 준 형식은 믿지 않음) */
export function detectFormat(b: Uint8Array): PhotoFormat | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  return null;
}

/* ── JPEG ─────────────────────────────────────────── */

/** JPEG 구간들 (SOS 전까지) — [표지, 시작, 끝(다음 구간 시작)] */
function jpegSegments(b: Uint8Array): { marker: number; start: number; end: number }[] | null {
  const out: { marker: number; start: number; end: number }[] = [];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    // 채움 0xFF 건너뛰기
    let j = i;
    while (j < b.length && b[j] === 0xff) j++;
    if (j >= b.length) return null;
    const marker = b[j];
    const start = j - 1;
    // 길이 없는 표지 (RSTn · TEM · SOI)
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0xd8) {
      out.push({ marker, start, end: j + 1 });
      i = j + 1;
      continue;
    }
    if (marker === 0xd9) {
      out.push({ marker, start, end: j + 1 });
      return out;
    }
    if (j + 2 >= b.length) return null;
    const len = (b[j + 1] << 8) | b[j + 2];
    if (len < 2 || j + 1 + len > b.length) return null;
    const end = j + 1 + len;
    out.push({ marker, start, end });
    if (marker === 0xda) {
      // SOS 뒤는 그림 데이터 — 끝까지 그대로 둔다
      out.push({ marker: -1, start: end, end: b.length });
      return out;
    }
    i = end;
  }
  return out;
}

const isMetaJpeg = (s: { marker: number }) => s.marker === 0xe1 || s.marker === 0xed || s.marker === 0xfe;

function stripJpeg(b: Uint8Array): Uint8Array | null {
  const segs = jpegSegments(b);
  if (!segs) return null;
  const keep = [b.subarray(0, 2), ...segs.filter((s) => !isMetaJpeg(s)).map((s) => b.subarray(s.start, s.end))];
  return concat(keep);
}

/* ── PNG ──────────────────────────────────────────── */

const PNG_META = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

function pngChunks(b: Uint8Array): { type: string; start: number; end: number }[] | null {
  const out: { type: string; start: number; end: number }[] = [];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (end > b.length) return null;
    out.push({ type, start: i, end });
    i = end;
    if (type === "IEND") return out;
  }
  return i === b.length ? out : null;
}

function stripPng(b: Uint8Array): Uint8Array | null {
  const chunks = pngChunks(b);
  if (!chunks) return null;
  return concat([b.subarray(0, 8), ...chunks.filter((c) => !PNG_META.has(c.type)).map((c) => b.subarray(c.start, c.end))]);
}

/* ── WEBP ─────────────────────────────────────────── */

const le32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

function webpChunks(b: Uint8Array): { type: string; start: number; end: number }[] | null {
  const out: { type: string; start: number; end: number }[] = [];
  const total = Math.min(b.length, 8 + le32(b, 4));
  let i = 12;
  while (i + 8 <= total) {
    const len = le32(b, i + 4);
    const end = i + 8 + len + (len % 2);
    if (end > total + 1) return null;
    out.push({ type: ascii(b, i, 4), start: i, end: Math.min(end, total) });
    i = end;
  }
  return out;
}

function stripWebp(b: Uint8Array): Uint8Array | null {
  const chunks = webpChunks(b);
  if (!chunks) return null;
  const body = chunks.filter((c) => c.type !== "EXIF" && c.type !== "XMP ").map((c) => b.slice(c.start, c.end));
  for (const c of body) if (ascii(c, 0, 4) === "VP8X" && c.length > 8) c[8] &= ~(0x08 | 0x04); // EXIF · XMP 표시 지우기
  const payload = concat(body);
  const head = new Uint8Array(12);
  head.set(b.subarray(0, 12));
  const size = 4 + payload.length;
  head[4] = size & 0xff;
  head[5] = (size >> 8) & 0xff;
  head[6] = (size >> 16) & 0xff;
  head[7] = (size >>> 24) & 0xff;
  return concat([head, payload]);
}

/* ── 공통 ─────────────────────────────────────────── */

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** 촬영정보가 남아 있는가 — 지운 뒤 다시 확인하는 데 쓴다 (형식을 읽지 못하면 '남아 있음'으로 본다) */
export function hasMetadata(b: Uint8Array): boolean {
  const f = detectFormat(b);
  if (f === "image/jpeg") {
    const segs = jpegSegments(b);
    return !segs || segs.some((s) => isMetaJpeg(s));
  }
  if (f === "image/png") {
    const c = pngChunks(b);
    return !c || c.some((x) => PNG_META.has(x.type));
  }
  if (f === "image/webp") {
    const c = webpChunks(b);
    return !c || c.some((x) => x.type === "EXIF" || x.type === "XMP ");
  }
  return true;
}

/** 촬영정보를 지운 사본 — 지우지 못하거나 지운 뒤에도 남아 있으면 null (그때는 올리지 않는다) */
export function stripMetadata(b: Uint8Array): { bytes: Uint8Array; mime: PhotoFormat } | null {
  const mime = detectFormat(b);
  if (!mime) return null;
  const out = mime === "image/jpeg" ? stripJpeg(b) : mime === "image/png" ? stripPng(b) : stripWebp(b);
  if (!out || hasMetadata(out)) return null;
  return { bytes: out, mime };
}
