"""자막 조각(chunks.txt)을 최종 녹음 받아쓰기(단어 시각)에 글자 단위로 맞춘다. 글자는 대본 그대로, 시각만 녹음에서.
결과: subs.json(자막) · subs.srt · timing.json(글자별 시각 — 장면 앵커용)"""
import json, re, difflib, sys
from pathlib import Path
H = Path(__file__).resolve().parent
OFFSET = 0.6                      # 녹음 앞에 넣은 무음
norm = lambda s: re.sub(r"[^0-9A-Za-z가-힣]", "", s)
CH = [l for l in (H / "chunks.txt").read_text().strip().split("\n")]

# ① 대본(문장 55 + 제목 4)과 글자 하나 다르지 않은지
src = (H.parent / "vid" / "make_player.py").read_text()
LINES = re.findall(r'^    "(.*)",', src.split("LINES = [")[1].split("]\nassert")[0], re.M)
LINES = [l for l in re.findall(r'^    "(.*?)",', src.split("LINES = [")[1].split("\n]\n")[0], re.M)]
T = {6: "첫 번째 문제, 현장 지원 요청의 지연.", 16: "두 번째 문제, 현장 안전 확인의 누락.", 42: "기술개발 성과 및 향후 방향"}
ref = []
for i, l in enumerate(LINES):
    if i == 27:
        ref.append("세 번째 문제, 복수 현장의 연쇄적인 작업 지연.")
    ref.append(T.get(i, l))
a, b = norm("".join(ref)), norm("".join(c.replace("**", "") for c in CH))
if a != b:
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    for op in sm.get_opcodes():
        if op[0] != "equal":
            print("대본과 다름:", op, a[op[1]:op[2]], "|", b[op[3]:op[4]])
    sys.exit(1)
print(f"대본 일치 · 조각 {len(CH)}개")

# ② 글자 정렬
sc, owner = [], []
for i, c in enumerate(CH):
    n = norm(c.replace("**", "")); sc += list(n); owner += [i] * len(n)
script = "".join(sc)
ac, at0, at1 = [], [], []
for sg in json.load(open(H.parent / "vid" / "asr_raw2_trim.json")):
    for w in sg["words"]:
        n = norm(w["w"])
        if not n:
            continue
        d = (w["e"] - w["s"]) / len(n)
        for k, ch in enumerate(n):
            ac.append(ch); at0.append(w["s"] + k * d); at1.append(w["s"] + (k + 1) * d)
sm = difflib.SequenceMatcher(None, script, "".join(ac), autojunk=False)
t0 = [None] * len(script); t1 = [None] * len(script); matched = 0
for x, y, n in sm.get_matching_blocks():
    for k in range(n):
        t0[x + k] = at0[y + k]; t1[x + k] = at1[y + k]; matched += 1
known = [i for i in range(len(script)) if t0[i] is not None]
import bisect
for i in range(len(script)):
    if t0[i] is None:
        p = bisect.bisect_left(known, i)
        prev = known[p - 1] if p > 0 else None; nxt = known[p] if p < len(known) else None
        if prev is None: t0[i] = t1[i] = t0[nxt]
        elif nxt is None: t0[i] = t1[i] = t1[prev]
        else:
            f = (i - prev) / (nxt - prev); t0[i] = t1[prev] + (t0[nxt] - t1[prev]) * f; t1[i] = t0[i]
print(f"대본 {len(script)}자 중 녹음과 맞은 글자 {matched} ({matched / len(script):.1%})")

out, low = [], []
for i, c in enumerate(CH):
    idx = [k for k, o in enumerate(owner) if o == i]
    hit = sum(1 for k in idx if k in set(known[max(0, bisect.bisect_left(known, idx[0])):bisect.bisect_right(known, idx[-1])]))
    if hit / len(idx) < 0.6:
        low.append(c)
    out.append({"in": t0[idx[0]] + OFFSET, "out": t1[idx[-1]] + OFFSET, "text": c})
for i, s in enumerate(out):
    nxt = out[i + 1]["in"] if i + 1 < len(out) else s["out"] + 1.0
    s["in"] = max(0.0, s["in"] - 0.05); s["out"] = min(s["out"] + 0.35, nxt - 0.08)
for i, s in enumerate(out):
    if s["out"] - s["in"] < 0.9:
        lim = out[i + 1]["in"] - 0.08 if i + 1 < len(out) else s["in"] + 0.9
        s["out"] = min(max(s["out"], s["in"] + 0.9), lim)
for s in out:
    s["in"], s["out"] = round(s["in"], 2), round(s["out"], 2)

# ③ 점검: 길이 · 강조 비율 · 연속 강조 · 표시 시간
L = [len(c.replace("**", "")) for c in CH]
hl = [("**" in c) for c in CH]
run = best = 0
for h in hl:
    run = run + 1 if h else 0; best = max(best, run)
short = [s for s in out if s["out"] - s["in"] < 0.85]
print(f"최대 글자 {max(L)} · 24자 넘는 조각 {sum(1 for x in L if x > 24)} · 강조 {sum(hl)}/{len(hl)} ({sum(hl) / len(hl):.0%}) · 최장 연속 강조 {best}")
print("0.85초 미만:", [(s['text'], round(s['out'] - s['in'], 2)) for s in short])
print("60% 미만 일치 조각:", low)
json.dump(out, open(H / "subs.json", "w"), ensure_ascii=False, indent=0)
json.dump({"script": script, "t0": [round(x + OFFSET, 3) for x in t0], "owner": owner}, open(H / "timing.json", "w"))
def ts(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s_, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s_:02},{ms:03}"
(H / "subs.srt").write_text("".join(f"{i}\n{ts(s['in'])} --> {ts(s['out'])}\n{s['text'].replace('**', '')}\n\n" for i, s in enumerate(out, 1)))
