// 사진 촬영정보(EXIF 등) 처리 — 0.6.1 안정화: 변환에 실패해도 원본(촬영정보 포함)을 올리지 않는다 · 다시 올려도 중복 없음
import { describe, expect, it } from "vitest";
import { detectFormat, hasMetadata, stripMetadata } from "@/lib/pilot/photo-meta";
import { PHOTO_ERR, alreadyExists, preparePhoto, sendPhoto, type PreparedPhoto } from "@/lib/pilot/photo";

const enc = (s: string) => [...new TextEncoder().encode(s)];
const u8 = (...parts: (number | number[])[]) => new Uint8Array(parts.flat());
const has = (b: Uint8Array, s: string) => Buffer.from(b).includes(Buffer.from(s));

/** 촬영정보가 든 작은 JPEG (APP0 JFIF · APP1 Exif(GPS) · APP1 XMP · APP13 · COM · DQT · SOS · 그림 데이터 · EOI) */
function jpegWithExif() {
  const seg = (m: number, body: number[]) => [0xff, m, ((body.length + 2) >> 8) & 0xff, (body.length + 2) & 0xff, ...body];
  return u8(
    [0xff, 0xd8],
    seg(0xe0, [...enc("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    seg(0xe1, [...enc("Exif"), 0, 0, ...enc("GPS 36.33N 126.61E")]),
    seg(0xe1, [...enc("http://ns.adobe.com/xap/1.0/"), 0, ...enc("<x:xmpmeta/>")]),
    seg(0xed, [...enc("Photoshop 3.0"), 0, ...enc("IPTC")]),
    seg(0xfe, enc("camera note")),
    seg(0xdb, [0, 1, 2, 3]),
    seg(0xda, [1, 1, 0, 0, 0x3f, 0]),
    [0x12, 0x34, 0xff, 0x00, 0x56], // 그림 데이터 (FF 00 은 데이터 안의 FF)
    [0xff, 0xd9],
  );
}

function pngWithText() {
  const chunk = (type: string, data: number[]) => [0, 0, 0, data.length, ...enc(type), ...data, 0, 0, 0, 0];
  return u8([0x89, ...enc("PNG"), 0x0d, 0x0a, 0x1a, 0x0a], chunk("IHDR", Array(13).fill(1)), chunk("tEXt", enc("Comment\0GPS here")), chunk("eXIf", enc("MM\0*")), chunk("tIME", [7, 0xea, 11, 16, 9, 0, 0]), chunk("IDAT", [9, 9]), chunk("IEND", []));
}

function webpWithExif() {
  const le = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
  const chunk = (t: string, data: number[]) => [...enc(t), ...le(data.length), ...data, ...(data.length % 2 ? [0] : [])];
  const body = [...enc("WEBP"), ...chunk("VP8X", [0x08 | 0x04 | 0x10, 0, 0, 0, 1, 0, 0, 1, 0, 0]), ...chunk("VP8 ", [1, 2, 3]), ...chunk("EXIF", enc("GPS!")), ...chunk("XMP ", enc("<xmp>"))];
  return u8(enc("RIFF"), le(body.length), body);
}

describe("photo-meta — 파일에서 촬영정보 구간 지우기", () => {
  it("형식은 파일 앞부분으로 알아낸다 (HEIC 등은 모름)", () => {
    expect(detectFormat(jpegWithExif())).toBe("image/jpeg");
    expect(detectFormat(pngWithText())).toBe("image/png");
    expect(detectFormat(webpWithExif())).toBe("image/webp");
    expect(detectFormat(u8([0, 0, 0, 0x18], enc("ftypheic")))).toBeNull();
  });

  it("JPEG: Exif · XMP · IPTC · 설명을 빼고, JFIF · 양자화표 · 그림 데이터는 그대로 둔다", () => {
    const src = jpegWithExif();
    expect(hasMetadata(src)).toBe(true);
    const out = stripMetadata(src)!;
    expect(out.mime).toBe("image/jpeg");
    for (const s of ["Exif", "GPS", "xmpmeta", "Photoshop", "camera note"]) expect(has(out.bytes, s)).toBe(false);
    expect(has(out.bytes, "JFIF")).toBe(true);
    expect([...out.bytes.slice(0, 2)]).toEqual([0xff, 0xd8]);
    expect([...out.bytes.slice(-7)]).toEqual([0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9]);
    expect(hasMetadata(out.bytes)).toBe(false);
    expect(stripMetadata(out.bytes)!.bytes).toEqual(out.bytes); // 두 번 지워도 같음
  });

  it("PNG: eXIf · tEXt · tIME 묶음을 빼고 그림 묶음은 그대로 둔다", () => {
    const out = stripMetadata(pngWithText())!;
    for (const s of ["tEXt", "eXIf", "tIME", "GPS"]) expect(has(out.bytes, s)).toBe(false);
    for (const s of ["IHDR", "IDAT", "IEND"]) expect(has(out.bytes, s)).toBe(true);
    expect(hasMetadata(out.bytes)).toBe(false);
  });

  it("WEBP: EXIF · XMP 묶음을 빼고 VP8X 표시를 지우고 전체 크기를 다시 적는다", () => {
    const out = stripMetadata(webpWithExif())!.bytes;
    expect(has(out, "EXIF")).toBe(false);
    expect(has(out, "XMP ")).toBe(false);
    expect(has(out, "VP8 ")).toBe(true);
    const size = out[4] | (out[5] << 8) | (out[6] << 16) | (out[7] << 24);
    expect(size).toBe(out.length - 8);
    expect(out[20] & 0x0c).toBe(0); // VP8X 표시 (12: 'RIFF'+크기+'WEBP', 8: 묶음 머리 → 20번째)
    expect(out[20] & 0x10).toBe(0x10); // 다른 표시(알파)는 그대로
  });

  it("지울 수 없는 형식 · 깨진 파일은 null (올리지 않음)", () => {
    expect(stripMetadata(u8([0, 0, 0, 0x18], enc("ftypheic"), [1, 2, 3]))).toBeNull();
    expect(stripMetadata(u8([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]))).toBeNull(); // 길이가 파일보다 김
    expect(hasMetadata(u8([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]))).toBe(true);
  });
});

describe("preparePhoto — 결과는 언제나 촬영정보가 없는 사진", () => {
  const fail = async (): Promise<PreparedPhoto> => {
    throw new Error("이 브라우저는 다시 저장 불가");
  };

  it("다시 저장(캔버스)이 안 되면 파일에서 촬영정보를 지워 올린다 — 원본을 그대로 쓰지 않음", async () => {
    const p = await preparePhoto(new Blob([jpegWithExif()], { type: "image/jpeg" }), { redraw: fail });
    const bytes = new Uint8Array(await p.blob.arrayBuffer());
    expect(p.exifRemoved).toBe(true);
    expect(p.method).toBe("촬영정보 구간 삭제");
    expect(has(bytes, "GPS")).toBe(false);
    expect(hasMetadata(bytes)).toBe(false);
  });

  it("지울 수 없는 형식(HEIC 등)은 오류 — 사진을 빼고 다른 사진을 고르라고 안내", async () => {
    await expect(preparePhoto(new Blob([u8([0, 0, 0, 0x18], enc("ftypheic"), [1, 2])], { type: "image/jpeg" }), { redraw: fail })).rejects.toThrow(PHOTO_ERR.unsafe);
  });

  it("10MB 넘는 사진은 지우기 전에 막는다", async () => {
    await expect(preparePhoto(new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]), { redraw: fail })).rejects.toThrow(PHOTO_ERR.tooBig);
  });

  it("다시 저장한 결과에 정보가 붙어 있으면 한 번 더 지운다", async () => {
    const redraw = async (): Promise<PreparedPhoto> => ({ blob: new Blob([jpegWithExif()]), mime: "image/jpeg", exifRemoved: true, width: 10, height: 10, method: "다시 저장" });
    const p = await preparePhoto(new Blob([jpegWithExif()]), { redraw });
    expect(hasMetadata(new Uint8Array(await p.blob.arrayBuffer()))).toBe(false);
  });
});

describe("sendPhoto — 다시 올려도 같은 사진 한 건", () => {
  const prepare = async (): Promise<PreparedPhoto> => ({ blob: new Blob([stripMetadata(jpegWithExif())!.bytes as BlobPart]), mime: "image/jpeg", exifRemoved: true, width: 1, height: 1, method: "다시 저장" });

  it("올리기 실패 → 다시 누르면 같은 위치 · 같은 요청 번호 · 저장소 '이미 있음'은 성공으로 본다", async () => {
    const file = new File([jpegWithExif()], "a.jpg", { type: "image/jpeg" });
    const paths: string[] = [];
    const attached: { opId: string; path: string }[] = [];
    let n = 0;
    const upload = async (path: string) => {
      paths.push(path);
      n++;
      if (n === 1) return { error: { message: "Failed to fetch" } };
      if (n === 2) return { error: { message: "The resource already exists", statusCode: "409" } }; // 앞 시도에서 실제로는 올라갔던 경우
      return { error: null };
    };
    const attach = async (x: { opId: string; path: string }) => void attached.push(x);
    await expect(sendPhoto("u1", "case-1", file, attach, { prepare, upload })).rejects.toThrow("다시 누르면");
    await sendPhoto("u1", "case-1", file, attach, { prepare, upload });
    expect(paths).toHaveLength(2);
    expect(paths[0]).toBe(paths[1]);
    expect(paths[0]).toMatch(/^u1\/case-1\/[0-9a-f-]{36}\.jpg$/);
    expect(attached).toHaveLength(1);
    expect(attached[0].path).toBe(paths[0]);
  });

  it("기록(attach)만 실패하면 다시 누를 때 올리기는 건너뛰고 같은 요청 번호로 기록한다", async () => {
    const file = new File([jpegWithExif()], "b.jpg");
    let uploads = 0;
    const ops: string[] = [];
    let fails = 1;
    const upload = async () => (uploads++, { error: null });
    const attach = async (x: { opId: string }) => {
      ops.push(x.opId);
      if (fails-- > 0) throw new Error("연결 끊김");
    };
    await expect(sendPhoto("u1", "safety-9", file, attach, { prepare, upload })).rejects.toThrow("연결 끊김");
    await sendPhoto("u1", "safety-9", file, attach, { prepare, upload });
    expect(uploads).toBe(1);
    expect(ops).toHaveLength(2);
    expect(ops[0]).toBe(ops[1]);
  });

  it("'이미 있음' 판단", () => {
    expect(alreadyExists({ statusCode: "409" })).toBe(true);
    expect(alreadyExists({ message: "Duplicate" })).toBe(true);
    expect(alreadyExists({ message: "new row violates row-level security policy" })).toBe(false);
    expect(alreadyExists(null)).toBe(false);
  });
});
