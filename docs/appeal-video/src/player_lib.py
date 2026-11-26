"""영상 장면 조립 도구 — 실제 화면(촬영본) 위에 카메라 · 표시 · 누름 효과를 시간에 맞춰 얹는 HTML을 만든다."""
import json
import re
import subprocess
from functools import lru_cache
from pathlib import Path

SCR = Path("/tmp/claude-0/-home-user-hana-project-ax/54c19aba-f176-58ca-ab0a-d2797ebb9726/scratchpad")
VID = SCR / "vid"
CAP = SCR / "appeal" / "final"
XCAP = SCR / "appeal" / "extra"
FULL = VID / "full"
REPO = Path("/home/user/hana-project-ax")
ATT = REPO / "docs/appeal-package/assets/attached"
PH = REPO / "docs/appeal-package/assets/photos"
FONT = REPO / "docs/appeal-sample/fonts/PretendardVariable.woff2"

STEPS = {s["id"]: s for s in json.loads((CAP / "steps.json").read_text())["steps"]}
ASR = json.loads((VID / "asr.json").read_text())
# ffmpeg silencedetect 출력에서 무음 시작/끝을 뽑는다 (진행 표시 줄에 붙어 나온 항목도 놓치지 않게 정규식으로)
SIL = [(m.group(1), float(m.group(2))) for m in re.finditer(r"(silence_start|silence_end): ([0-9.]+)", (VID / "sil.txt").read_text())]
SIL_END = [t for k, t in SIL if k == "silence_end"]
SIL_START = [t for k, t in SIL if k == "silence_start"]


@lru_cache(None)
def size(p) -> tuple[int, int]:
    w, h = subprocess.check_output(["identify", "-format", "%w %h", f"{p}[0]"]).split()
    return int(w), int(h)


def seg_start(i: int) -> float:
    t = ASR[i]["start"]
    if i == 0:
        # 녹음이 무음으로 시작할 때만 첫 무음 끝을 쓴다 (말이 0초부터 시작하면 받아쓰기 시각 그대로)
        return SIL[0][1] if SIL and SIL[0][0] == "silence_end" and SIL[0][1] < 6 else t
    near = [s for s in SIL_END if abs(s - t) < 0.9]
    return min(near, key=lambda s: abs(s - t)) if near else t


def seg_end(i: int) -> float:
    t = ASR[i]["end"]
    near = [s for s in SIL_START if abs(s - t) < 0.9]
    return min(near, key=lambda s: abs(s - t)) if near else t


def wt(i: int, prefix: str, nth: int = 0) -> float:
    """세그먼트 i 안에서 prefix로 시작하는 n번째 단어의 시각 (첫 세그먼트는 무음 뒤로 보정)"""
    ws = [w for w in ASR[i]["words"] if w["w"].strip().startswith(prefix)]
    if not ws:
        raise KeyError(f"seg {i}: {prefix}")
    t = ws[nth]["s"]
    if i == 0:
        a0, a1 = ASR[0]["start"], ASR[0]["end"]
        b0, b1 = seg_start(0), seg_end(0)
        t = b0 + (t - a0) * (b1 - b0) / (a1 - a0)
    return round(t, 2)


def uri(p) -> str:
    return Path(p).as_uri()


# ── 화면 조각 ───────────────────────────────────────────
def badge(text="실제 화면", cls="real"):
    return f'<span class="bdg {cls}">{text}</span>'


def cam_frame(img, width, box=(0, 0, 1, 1), keys=None, marks=(), taps=(), height=None):
    """img를 box(비율) 영역만 보이게 width(px) 상자에 넣는다. keys=[(t, x, y, w, h)] 이면 카메라가 움직인다.
    marks: [(x, y, w, h, t_in, 번호)] (전체 그림 기준 비율) · taps: [(x, y, t)]"""
    W, H = size(img)
    bx, by, bw, bh = box
    ch = height if height else width * (bh * H) / (bw * W)
    ks = keys or [(0, bx, by, bw, bh)]
    mk = ""
    for x, y, w, h, t, n in marks:
        pad = 0.006
        mk += (f'<i class="mk" data-in="{t}" data-fx="mk" style="left:{(x - pad) * 100:.3f}%;top:{(y - pad * W / H) * 100:.3f}%;width:{(w + 2 * pad) * 100:.3f}%;height:{(h + 2 * pad * W / H) * 100:.3f}%">'
               + (f"<b>{n}</b>" if n else "") + "</i>")
    for x, y, t in taps:
        mk += f'<i class="tap" data-tap="{t}" style="left:{x * 100:.3f}%;top:{y * 100:.3f}%"></i>'
    return (f'<div class="cam" style="width:{width:.0f}px;height:{ch:.0f}px" data-cam=\'{json.dumps(ks)}\' data-ar="{H / W:.6f}" data-cw="{width:.0f}">'
            f'<div class="inner"><img src="{uri(img)}">{mk}</div></div>')


def step_img(i):
    st = STEPS[i]
    c = st.get("crop")
    return CAP / (c["img"] if c else st["img"]), (c["marks"] if c else [])


def shot(i, width, kind=None, label=None, show=None, t_marks=None, taps=None, box=(0, 0, 1, 1), keys=None, height=None, cap="", extra_cls=""):
    """촬영 장면 i — t_marks: 번호별 등장 시각 {1: t, 2: t}; taps: {번호: t} (그 표시 가운데를 누르는 효과)"""
    img, ms = step_img(i)
    st = STEPS[i]
    phone = (kind or st["device"]) == "phone"
    marks, tps = [], []
    for n, m in enumerate(ms, 1):
        if not m or (show and n not in show) or m["y"] + m["h"] < 0.01 or m["y"] > 0.99:
            continue
        t = (t_marks or {}).get(n)
        if t is None:
            continue
        marks.append((m["x"], m["y"], m["w"], m["h"], t, n))
        if taps and n in taps:
            tps.append((m["x"] + m["w"] / 2, m["y"] + m["h"] / 2, taps[n]))
    inner = cam_frame(img, width, box, keys, marks, tps, height)
    who = label or ("기사 휴대폰" if phone else "관리자 PC")
    c = f'<div class="fcap">{cap}</div>' if cap else ""
    if phone:
        return f'<div class="phone {extra_cls}"><div class="pbar">{badge()}<b>{who}</b><span>{st["at"][:5]}</span></div>{inner}{c}</div>'
    return f'<div class="pc {extra_cls}"><div class="wbar"><i></i><i></i><i></i>{badge()}<b>{who}</b><span>{st["at"][:5]}</span></div>{inner}{c}</div>'


def xshot(img, width, label, t="", box=(0, 0, 1, 1), keys=None, marks=(), height=None, cap="", phone=False):
    inner = cam_frame(img, width, box, keys, marks, (), height)
    c = f'<div class="fcap">{cap}</div>' if cap else ""
    if phone:
        return f'<div class="phone"><div class="pbar">{badge()}<b>{label}</b><span>{t}</span></div>{inner}{c}</div>'
    return f'<div class="pc"><div class="wbar"><i></i><i></i><i></i>{badge()}<b>{label}</b><span>{t}</span></div>{inner}{c}</div>'


def photo(name, width, height, cap="", fx_t=None, kb=True):
    st = f'width:{width}px;height:{height}px'
    c = f'<figcaption>{cap}</figcaption>' if cap else ""
    return f'<figure class="photo {"kb" if kb else ""}" style="{st}"><img src="{uri(PH / (name + ".jpg"))}"><span class="bdg ai">AI 연출 사진</span>{c}</figure>'


REF = VID / "ref"


def rphoto(name, width, height, cap="", pos="center"):
    """회사 제공 사진 (참고 PDF에서 꺼낸 현장 사진)"""
    c = f'<figcaption>{cap}</figcaption>' if cap else ""
    return f'<figure class="photo kb" style="width:{width}px;height:{height}px"><img src="{uri(REF / (name + ".jpg"))}" style="object-position:{pos}"><span class="bdg co">회사 제공 사진</span>{c}</figure>'


def art(name, width, cap="", cover="", crop=None):
    img = ATT / f"{name}.jpg"
    W, H = size(img)
    box = crop or (0, 0, 1, 1)
    inner = cam_frame(img, width, box)
    c = f'<figcaption>{cap}</figcaption>' if cap else ""
    return f'<figure class="art" style="width:{width}px">{inner}{cover}<span class="bdg idea">회사 개념 그림</span>{c}</figure>'


def at(t, fx="up", cls="", tag="div", body="", style=""):
    st = f' style="{style}"' if style else ""
    return f'<{tag} class="{cls}" data-in="{t}" data-fx="{fx}"{st}>{body}</{tag}>'


def show(a, b, body, cls="", style=""):
    st = f' style="{style}"' if style else ""
    return f'<div class="win {cls}" data-show="{a},{b}"{st}>{body}</div>'
