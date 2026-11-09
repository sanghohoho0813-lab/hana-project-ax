/**
 * CSV 만들기 — 엑셀에서 한글이 깨지지 않게 BOM 을 붙이고, 수식 주입(=,+,-,@ 로 시작하는 문자)을 막는다.
 * 숫자 값은 그대로 둔다 (음수 여유시간 등).
 */
const FORMULA = /^[=+\-@\t\r]/;
const NUMBER = /^-?\d+(\.\d+)?$/;

export function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  let s = typeof v === "string" ? v : JSON.stringify(v);
  if (FORMULA.test(s) && !NUMBER.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map(cell).join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}
