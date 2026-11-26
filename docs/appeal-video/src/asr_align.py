"""새 녹음 받아쓰기(raw)를 기존 55문장 구분(ref)에 맞춘다.
- 단어 문자열은 ref 그대로 두고(장면 코드가 단어 앞부분으로 시각을 찾음), 시각만 새 녹음 값으로 바꾼다.
- 글자 단위로 두 받아쓰기를 맞춘 뒤, 맞은 글자의 시각을 옮기고 나머지는 앞뒤 사이를 비례 배분한다."""
import json, re, sys
from difflib import SequenceMatcher

ref = json.load(open(sys.argv[1]))
raw = json.load(open(sys.argv[2]))
norm = lambda s: re.sub(r"[^0-9A-Za-z가-힣]", "", s).lower()

# 새 받아쓰기: 글자별 시각
nc, nt, nd, nseg = [], [], [], []
for si, seg in enumerate(raw):
    for w in seg["words"]:
        c = norm(w["w"])
        if not c:
            continue
        d = max(w["e"] - w["s"], 0.05) / len(c)
        for k, ch in enumerate(c):
            nc.append(ch); nt.append(w["s"] + d * k); nd.append(d); nseg.append(si)
# 기존: 글자별 (문장, 단어)
oc, own = [], []
for i, seg in enumerate(ref):
    for j, w in enumerate(seg["words"]):
        for ch in norm(w["w"]):
            oc.append(ch); own.append((i, j))
sm = SequenceMatcher(None, "".join(oc), "".join(nc), autojunk=False)
anchor = {}
for a, b, n in sm.get_matching_blocks():
    for k in range(n):
        anchor[a + k] = b + k
print(f"글자 맞춤 {len(anchor)}/{len(oc)} ({len(anchor) / len(oc):.1%}) · 새 받아쓰기 {len(nc)}자")
keys = sorted(anchor)

def t_of(k):
    if k in anchor:
        return nt[anchor[k]], nd[anchor[k]]
    import bisect
    p = bisect.bisect_left(keys, k)
    lo = keys[max(p - 1, 0)]; hi = keys[min(p, len(keys) - 1)]
    tl, th = nt[anchor[lo]], nt[anchor[hi]]
    f = 0 if hi == lo else (k - lo) / (hi - lo)
    return tl + (th - tl) * f, 0.08

out = []
k = 0
for i, seg in enumerate(ref):
    words = []
    for j, w in enumerate(seg["words"]):
        n = len(norm(w["w"]))
        if n == 0:
            continue
        s, _ = t_of(k)
        e, d = t_of(k + n - 1)
        words.append({"s": round(s, 3), "e": round(e + d, 3), "w": w["w"]})
        k += n
    hit = sum(1 for kk in range(k - sum(len(norm(w["w"])) for w in seg["words"]), k) if kk in anchor)
    tot = sum(len(norm(w["w"])) for w in seg["words"])
    out.append({"start": words[0]["s"], "end": words[-1]["e"], "text": seg["text"], "words": words, "match": round(hit / max(tot, 1), 3)})
for i, s in enumerate(out):
    flag = "  <-- 확인" if s["match"] < 0.85 else ""
    print(f"{i:2d} {s['start']:7.2f}-{s['end']:7.2f} {s['match']:.2f} {s['text'][:34]}{flag}")
json.dump(out, open(sys.argv[3], "w"), ensure_ascii=False)
# 기존 녹음에 없던 문장(새로 추가된 말) — 장면 코드가 필요하면 쓴다
used = set(anchor.values())
extra = []
for si, seg in enumerate(raw):
    idx = [k for k, x in enumerate(nseg) if x == si]
    if idx and sum(1 for k in idx if k in used) / len(idx) < 0.3:
        extra.append({"start": seg["start"], "end": seg["end"], "text": seg["text"].strip()})
        print(f"추가된 말 {seg['start']:7.2f}-{seg['end']:7.2f} {seg['text'].strip()}")
json.dump(extra, open(sys.argv[3].replace(".json", "_extra.json"), "w"), ensure_ascii=False)
