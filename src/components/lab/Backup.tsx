"use client";

import { useRef, useState } from "react";
import { Download, FileUp } from "lucide-react";
import { commit, getSnapshot, replaceAll, useLab } from "@/lib/lab/store";
import { markBackup, personName, unsavedChanges } from "@/lib/lab/model";
import { backupFileName, checkBackup, makeBackup, type ImportCheck } from "@/lib/lab/exporting";
import { useOperator } from "./LabShell";
import { MsgBox, btnGhost, btnPrimary, download, kstDT, type Msg } from "./common";

export function useBackup() {
  const op = useOperator();
  const [msg, setMsg] = useState<Msg>(null);
  async function backup() {
    const { state } = getSnapshot();
    if (!state) return;
    const now = new Date();
    const file = await makeBackup(state, personName(state, op), now);
    const name = backupFileName(now);
    download(name, JSON.stringify(file, null, 2), "application/json");
    const r = commit((s, c) => ({ state: markBackup(s, name, c, file.data.changeCount), value: null }));
    setMsg(r.ok ? { ok: true, text: `백업 파일 ${name} 을 받았습니다 — 기록 ${file.counts.entries}건 · 측정 ${file.counts.trials}건 · 피드백 ${file.counts.notes}건. 안전한 곳에 보관하세요.` } : { ok: false, text: r.error });
  }
  return { backup, msg };
}

/** 백업 상태 + 지금 백업 — 홈·기록 화면 */
export function BackupCard() {
  const { state, bytes, unavailable } = useLab();
  const { backup, msg } = useBackup();
  if (!state) return null;
  const n = unsavedChanges(state);
  const has = state.entries.length + state.trials.length + state.notes.length > 0;
  const warn = has && (!state.backup.lastAt || n > 0);
  return (
    <section id="backup" className={`card space-y-2 p-4 ${warn ? "border-2 border-danger/40" : ""}`} aria-label="백업">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-[20px] font-extrabold">백업 (JSON)</h2>
        <button className={btnPrimary} onClick={() => void backup()}>
          <Download size={18} /> 지금 JSON 백업 받기
        </button>
      </div>
      <p className={`text-[16.5px] font-semibold ${warn ? "text-danger" : "text-ink-2"}`}>
        {!has
          ? "아직 기록이 없습니다."
          : !state.backup.lastAt
            ? "백업을 한 번도 받지 않았습니다 — 브라우저 데이터를 지우면 기록이 사라집니다."
            : n > 0
              ? `마지막 백업 ${kstDT(state.backup.lastAt)} 이후 바뀐 기록 ${n}건 — 백업을 다시 받으세요.`
              : `마지막 백업 ${kstDT(state.backup.lastAt)} · 그 뒤 바뀐 기록 없음`}
      </p>
      <p className="text-[14.5px] text-ink-3">
        이 브라우저에만 저장 (중앙 DB 아님 · 다른 기기와 공유 안 됨) · 사용 중 {Math.round(bytes / 1024)}KB{unavailable && " · 저장 불가 상태"}
        {state.backup.lastFile && ` · 마지막 파일 ${state.backup.lastFile}`}
      </p>
      <MsgBox msg={msg} />
    </section>
  );
}

/** 백업 불러오기 — 검사 결과를 보여 준 뒤 확인을 받고 바꾼다 (지금 기록은 따로 한 칸에 남김) */
export function ImportBox() {
  const { state } = useLab();
  const { backup } = useBackup();
  const [check, setCheck] = useState<(ImportCheck & { file: string }) | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const input = useRef<HTMLInputElement>(null);
  if (!state) return null;
  const n = unsavedChanges(state);
  return (
    <section className="card space-y-2 p-4" aria-label="백업 불러오기">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-[20px] font-extrabold">백업 불러와 이어 하기</h2>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          aria-label="백업 JSON 파일"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              const c = await checkBackup(await f.text(), new Date());
              setCheck({ ...c, file: f.name });
              setMsg(null);
            } catch (err) {
              setCheck(null);
              setMsg({ ok: false, text: err instanceof Error ? err.message : "불러오지 못했습니다." });
            }
          }}
        />
        <button className={btnGhost} onClick={() => input.current?.click()}>
          <FileUp size={18} /> JSON 파일 고르기
        </button>
      </div>
      {check && (
        <div className="space-y-2 rounded-2xl border border-line p-3 text-[16px]">
          <p className="font-bold">{check.file}</p>
          <p>
            백업 시각 {kstDT(check.exportedAt)} · 받은 사람 {check.exportedBy} · 세트 {check.counts.sessions} · 기록 {check.counts.entries} · 판단 {check.counts.judgments} · 측정 {check.counts.trials} · 피드백 {check.counts.notes}
          </p>
          <p className={check.checksumOk ? "text-success" : "font-bold text-danger"}>
            {check.checksumOk ? "파일 지문 일치 — 백업 뒤 내용이 바뀌지 않았습니다." : "파일 지문 불일치 — 백업 뒤 파일 내용이 바뀌었습니다. 원본 파일인지 확인하세요."}
          </p>
          <p className={check.recompute.differ.length === 0 ? "text-success" : "font-bold text-warning"}>
            {check.recompute.differ.length === 0
              ? `불러올 기록으로 다시 계산한 위험 판단 ${check.recompute.same}건이 저장된 판단과 모두 같습니다 (재현 확인).`
              : `다시 계산한 판단 중 ${check.recompute.differ.length}건이 저장된 판단과 다릅니다 (번호 ${check.recompute.differ.join(", ")}) — 프로그램 버전이 다를 수 있습니다.`}
          </p>
          {n > 0 && (
            <p className="font-bold text-danger">
              지금 브라우저의 기록 중 백업하지 않은 변경이 {n}건 있습니다. 먼저{" "}
              <button className="underline" onClick={() => void backup()}>
                지금 기록을 백업
              </button>
              하세요.
            </p>
          )}
          <div className="flex gap-2">
            <button
              className={btnPrimary}
              onClick={() => {
                if (!window.confirm("지금 브라우저의 기록을 이 백업으로 바꿉니다. 지금 기록은 따로 한 칸에 남겨 둡니다. 계속할까요?")) return;
                const r = replaceAll(check.state);
                setMsg(r.ok ? { ok: true, text: `불러왔습니다 — 이전 시험을 이어서 할 수 있습니다.${r.keptPrevious ? " (불러오기 전 기록은 따로 보관)" : ""}` } : { ok: false, text: r.error });
                if (r.ok) setCheck(null);
              }}
            >
              이 백업으로 바꾸고 이어 하기
            </button>
            <button className={btnGhost} onClick={() => setCheck(null)}>
              그만두기
            </button>
          </div>
        </div>
      )}
      <MsgBox msg={msg} />
    </section>
  );
}
