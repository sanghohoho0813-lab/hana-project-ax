"use client";

/** 브라우저 인쇄 → 'PDF로 저장'으로 보고서 첨부용 PDF 를 만든다 */
export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="rounded-xl bg-white px-3.5 py-1.5 text-[17px] font-bold text-ink-2 hover:bg-[#e8ebee] print:hidden">
      인쇄 · PDF로 저장
    </button>
  );
}
