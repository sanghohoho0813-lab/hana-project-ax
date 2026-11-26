"""소개 영상 3판 — 채널 스타일(영상 도구·스타일 통합 가이드 V1.1 · 유튜브 v1.2 · AX v4.1) 장면 조립 도구.
- 배경: 남색/차콜 + 금빛 · 청록 빛 + 90px 격자 / 밝은 아이보리 / 흐름선 표지
- 색: 금(메인) + 청록(보조) 한 계열, 빨강은 경고에만
- 자막: Pretendard 700 · 52px · 짧은 조각 · 핵심어 금색 굵게
- 기기: 휴대폰 9:19.5 실제 비율(390×844 원본 통째) · PC 브라우저 틀(여백 · 카메라)
- 움직임: 튕김 없음, 글자 0.15~0.2초에 다 밝아짐, 카메라 이동 quintInOut, 정수 px"""
import json
import re
import subprocess
from functools import lru_cache
from pathlib import Path

H = Path(__file__).resolve().parent
SCR = H.parent
VID = SCR / "vid"
CAP = SCR / "appeal" / "final"
XCAP = SCR / "appeal" / "extra"
FULL = VID / "full"
REF = VID / "ref"
REPO = Path("/home/user/hana-project-ax")
ATT = REPO / "docs/appeal-package/assets/attached"
PH = REPO / "docs/appeal-package/assets/photos"
FONT = REPO / "docs/appeal-sample/fonts/PretendardVariable.woff2"
SCREENS = json.loads((H / "screens.json").read_text())

# ── 시각: 대본 글자 → 녹음 시각 ─────────────────────────
_TM = json.loads((H / "timing.json").read_text())
_SCRIPT, _T0 = _TM["script"], _TM["t0"]
SUBS = json.loads((H / "subs.json").read_text())
norm = lambda s: re.sub(r"[^0-9A-Za-z가-힣]", "", s)  # noqa: E731


def K(phrase: str, after: float = 0.0) -> float:
    """대본 문구의 첫 글자가 말해지는 시각 (after 이후 첫 번째)"""
    n = norm(phrase)
    k = 0
    while True:
        k = _SCRIPT.find(n, k)
        if k < 0:
            raise SystemExit(f"대본에 없음: {phrase} (after {after})")
        if _T0[k] >= after - 0.01:
            return round(_T0[k], 2)
        k += 1


def uri(p) -> str:
    return Path(p).as_uri()


@lru_cache(None)
def size(p):
    w, h = subprocess.check_output(["identify", "-format", "%w %h", f"{p}[0]"]).split()
    return int(w), int(h)


# ── 기본 조각 ───────────────────────────────────────────
def at(t, fx="up", cls="", body="", style="", tag="div", dur=None):
    st = f' style="{style}"' if style else ""
    d = f' data-dur="{dur}"' if dur else ""
    return f'<{tag} class="{cls}" data-in="{t:.2f}" data-fx="{fx}"{d}{st}>{body}</{tag}>'


def show(a, b, body, style="", cls=""):
    st = f' style="{style}"' if style else ""
    return f'<div class="win {cls}" data-show="{a:.2f},{b:.2f}"{st}>{body}</div>'


def box(x, y, body, w=None, style=""):
    ws = f"width:{w}px;" if w else ""
    return f'<div class="abs" style="left:{x}px;top:{y}px;{ws}{style}">{body}</div>'


BADGE = {"real": "실제 화면", "ai": "AI 연출 사진", "co": "회사 제공 사진", "idea": "회사 개념 그림", "calc": "프로그램 계산값", "plan": "계획", "ex": "설명용 개념도"}


def badge(kind, text=None):
    return f'<span class="bdg {kind}">{text or BADGE[kind]}</span>'


def head(t, eyebrow, title, light=False, x=110, y=58, w=1700):
    """꼬리표 + 제목 (말 시작 직전에 차례로)"""
    return (f'<div class="abs head" style="left:{x}px;top:{y}px;width:{w}px">'
            + at(t + 0.1, "up", "eyebrow", eyebrow) + at(t + 0.25, "up", "title", title) + "</div>")


# ── 사진 ────────────────────────────────────────────────
def photo(src, w, h, kind, cap="", pos="center", kb=0.04, t=None):
    c = f"<figcaption>{cap}</figcaption>" if cap else ""
    img = f'<img src="{uri(src)}" style="object-position:{pos}" class="kb" data-z="{kb}">'
    fig = f'<figure class="photo" style="width:{w}px;height:{h}px">{img}{badge(kind)}{c}</figure>'
    return at(t, "photo", "", fig) if t is not None else fig


def ai(name):
    return PH / f"{name}.jpg"


def co(name):
    return REF / f"{name}.jpg"


# ── 휴대폰 (실제 비율 9:19.5 — 원본 390×844 통째) ─────────
def phone(sid, W, marks=(), taps=(), seq=None, label="현장 직원 휴대폰", lab=True):
    """sid: 촬영 id 또는 [(t, id), …] 순서 — W: 화면 안쪽 폭(px). marks [(x,y,w,h,t,n)] · taps [(x,y,t)] 는 390×844 좌표"""
    Hh = round(W * 844 / 390)
    ids = [s for _, s in seq] if seq else [sid]
    imgs = "".join(f'<img src="{uri(CAP / SCREENS[i]["img"])}">' for i in ids)
    sq = f" data-seq='{json.dumps([[round(t, 2), k] for k, (t, _) in enumerate(seq)])}'" if seq else ""
    mk = ""
    for x, y, w, h, t, n in marks:
        p = 4
        mk += (f'<i class="mk" data-in="{t:.2f}" data-fx="mk" style="left:{(x - p) / 3.9:.3f}%;top:{(y - p) / 8.44:.3f}%;width:{(w + 2 * p) / 3.9:.3f}%;height:{(h + 2 * p) / 8.44:.3f}%">'
               + (f"<b>{n}</b>" if n else "") + "</i>")
    for x, y, t in taps:
        mk += f'<i class="tap" data-tap="{t:.2f}" style="left:{x / 3.9:.3f}%;top:{y / 8.44:.3f}%"></i>'
    lb = f'<div class="devlab">{badge("real")}<span>{label}</span></div>' if lab else ""
    return (f'<div class="dev">{lb}<div class="phone"><div class="scr" style="width:{W}px;height:{Hh}px">'
            f'<div class="stack"{sq}>{imgs}</div>{mk}<i class="island"></i></div></div></div>')


# ── PC 브라우저 (여백 있는 틀 + 카메라) ───────────────────
def browser(src, W, Hc, keys, marks=(), cur=None, seq=None, label="본사 관리자 PC", url="hana-ax · 관리자 화면 · 검증 시나리오", lab=True):
    """src: 촬영 id 또는 그림 경로 · W×Hc: 화면 칸 크기(px) · keys [(t, x, y, w[, 'l'])]: 페이지 CSS 좌표 카메라(세로는 칸 비율로)
    marks [(x,y,w,h,t,n)] · cur [(t,x,y,click)] 는 페이지 CSS 좌표 · seq [(t, src)]: 같은 틀 안에서 화면 바뀜"""
    srcs = [s for _, s in seq] if seq else [src]
    paths = [CAP / SCREENS[s]["img"] if s in SCREENS else Path(s) for s in srcs]
    iw, ih = size(paths[0])
    pw = 1080 if iw == 2160 else iw // 2
    ph = ih * pw / iw
    imgs = "".join(f'<img src="{uri(p)}">' for p in paths)
    sq = f" data-seq='{json.dumps([[round(t, 2), k] for k, (t, _) in enumerate(seq)])}'" if seq else ""
    mk = ""
    for x, y, w, h, t, n in marks:
        p = 6
        mk += (f'<i class="mk" data-in="{t:.2f}" data-fx="mk" style="left:{(x - p) / pw * 100:.3f}%;top:{(y - p) / ph * 100:.3f}%;width:{(w + 2 * p) / pw * 100:.3f}%;height:{(h + 2 * p) / ph * 100:.3f}%">'
               + (f"<b>{n}</b>" if n else "") + "</i>")
    cr = ""
    if cur:
        ks = [[round(t, 2), round(x / pw * 100, 3), round(y / ph * 100, 3), c] for t, x, y, c in cur]
        cr = (f"<i class='cur' data-cur='{json.dumps(ks)}'><svg viewBox='0 0 24 24' width='34' height='34'><path d='M3 2 L3 20 L8 15.5 L11.5 22.5 L14.5 21 L11 14 L18 14 Z' fill='#fff' stroke='#171b20' stroke-width='1.6' stroke-linejoin='round'/></svg><u></u></i>")
    ks = [[round(k[0], 2), k[1], k[2], k[3]] + ([k[4]] if len(k) > 4 else []) for k in keys]
    lb = f'<div class="devlab">{badge("real")}<span>{label}</span></div>' if lab else ""
    return (f'<div class="dev">{lb}<div class="browser" style="width:{W}px"><div class="bbar"><i></i><i></i><i></i><span class="url">{url}</span></div>'
            f"<div class='cam' style='width:{W}px;height:{Hc}px' data-cam='{json.dumps(ks)}' data-pw='{pw}' data-ph='{ph:.1f}'>"
            f'<div class="inner"><div class="stack"{sq}>{imgs}</div>{mk}{cr}</div></div></div></div>')


def art(path, w, kind="idea", cover="", cap=""):
    iw, ih = size(path)
    h = round(w * ih / iw)
    return (f'<div class="dev"><div class="devlab">{badge(kind)}<span>{cap}</span></div><figure class="art" style="width:{w}px;height:{h}px"><div class="aimg"><img src="{uri(path)}" class="kb" data-z="0.02">{cover}</div>'
            f"</figure></div>")


# ── 장면 ────────────────────────────────────────────────
SCENES = []
CHAP = {1: ("01", "현장 지원 요청의 지연"), 2: ("02", "현장 안전 확인의 누락"), 3: ("03", "복수 현장의 연쇄 지연"), 4: ("→", "성과 · 향후 방향")}


def scene(start, body, bg="navy", chap=None, flow=None):
    tag = ""
    if chap:
        n, name = CHAP[chap]
        tag = f'<div class="chap"><b>{n}</b>{name}</div>'
    layer = ""
    if bg == "flow":
        layer = f'<div class="bgimg kb" data-z="0.04" style="background-image:url({uri(H / "bg" / f"flow_{flow}.jpg")})"></div>'
    elif bg in ("navy", "slate"):
        layer = '<div class="grid"></div>'
    SCENES.append([round(start, 2), bg, layer + tag + body])
