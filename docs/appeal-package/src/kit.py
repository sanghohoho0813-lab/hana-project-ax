"""보완자료 패키지 공통 도구 — 쪽 틀 · 표시 · 실제 화면 자르기(①②③ 겹침) · 첨부 그림 · 사진.

실제 화면 원본은 촬영 폴더(APPEAL_CAP: appeal-shots.mjs 결과, APPEAL_XCAP: appeal-extra-shots.mjs 결과)에서 읽는다.
한 번 잘라 만든 화면은 assets/shots/ 에 남기고 겹침 표시(HTML)를 index.json에 적어 두므로,
촬영 폴더가 없어도(컨테이너가 바뀌어도) 같은 문서를 다시 만들 수 있다.
"""
import html
import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # docs/appeal-package
ASSETS = ROOT / "assets"
SHOTS = ASSETS / "shots"
SCRATCH = Path("/tmp/claude-0/-home-user-hana-project-ax/54c19aba-f176-58ca-ab0a-d2797ebb9726/scratchpad/appeal")
CAP = Path(os.environ.get("APPEAL_CAP", SCRATCH / "final"))
XCAP = Path(os.environ.get("APPEAL_XCAP", SCRATCH / "extra"))
REL = "../assets"  # html/ 에서 본 자산 경로

COMPANY = "(주)하나정보통신"
TECH = "복수 현장 업무 위험관리 AX 시스템"
PATENT_NO = "10-2026-0173957"
PATENT_DATE = "2026-09-11"
PATENT_TITLE = "복수 현장 프로젝트의 작업상태 이벤트 및 시공간 제약정보에 기반한 연계업무 위험도 산출 및 대응 우선순위 결정 시스템 및 방법"
APP_VER = "0.6.1"
COMMIT = "c74484c"
WRITTEN = "2026-11-23"
TESTS = 746


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def size(p: Path) -> tuple[int, int]:
    w, h = subprocess.check_output(["identify", "-format", "%w %h", f"{p}[0]"]).split()
    return int(w), int(h)


# ── 표시(배지) ─────────────────────────────────────────────
BADGE = {
    "real": "실제 화면",
    "impl": "구현 확인",
    "calc": "계산 예시",
    "virt": "시험용 가상 일정",
    "plan": "계획",
    "fill": "회사 기재",
    "src": "외부 출처",
    "ai": "AI 연출 사진",
    "idea": "개념 그림",
    "zero": "현장 실증 0건",
}


def B(kind: str, text: str | None = None) -> str:
    return f'<span class="bd {kind}">{text or BADGE[kind]}</span>'


# ── 공통 조각 ─────────────────────────────────────────────
def head(kicker: str, title: str, lead: str = "", badges: str = "") -> str:
    k = f'<div class="kicker">{kicker} {badges}</div>' if kicker else ""
    l = f'<p class="lead">{lead}</p>' if lead else ""
    return f'<div class="head">{k}<h2>{title}</h2>{l}</div>'


def sec(n: str, title: str, right: str = "") -> str:
    return f'<div class="sec"><span class="n">{n}</span>{title}<span class="r">{right}</span></div>'


def card(body: str, cls: str = "", title: str = "", style: str = "") -> str:
    t = f"<h4>{title}</h4>" if title else ""
    st = f' style="{style}"' if style else ""
    return f'<div class="card {cls}"{st}>{t}{body}</div>'


def grid(items, cols: str = "g2", style: str = "") -> str:
    st = f' style="{style}"' if style else ""
    return f'<div class="{cols}"{st}>' + "".join(items) + "</div>"


def col(*items, style: str = "") -> str:
    st = f' style="{style}"' if style else ""
    return f'<div class="col"{st}>' + "".join(items) + "</div>"


def ul(items, cls: str = "dot") -> str:
    return f'<ul class="{cls}">' + "".join(f"<li>{x}</li>" for x in items) + "</ul>"


def table(headers, rows, cls: str = "", widths=None, hl=()) -> str:
    cg = ""
    if widths:
        cg = "<colgroup>" + "".join(f'<col style="width:{w}">' for w in widths) + "</colgroup>"
    th = "".join(f"<th>{h}</th>" for h in headers)
    trs = ""
    for i, r in enumerate(rows):
        c = ' class="hl"' if i in hl else ""
        trs += f"<tr{c}>" + "".join(f"<td>{x}</td>" for x in r) + "</tr>"
    return f'<table class="t {cls}">{cg}<thead><tr>{th}</tr></thead><tbody>{trs}</tbody></table>'


def key(text: str, small: str = "", cls: str = "") -> str:
    s = f"<small>{small}</small>" if small else ""
    return f'<div class="key {cls}">{text}{s}</div>'


def flow(steps, cls: str = "") -> str:
    """steps: [(번호, 제목, 설명, 강조)]"""
    out = []
    for i, st in enumerate(steps):
        n, t, d = st[:3]
        tone = st[3] if len(st) > 3 else ""
        if i:
            out.append('<div class="ar">›</div>')
        out.append(f'<div class="st {tone}"><span class="n">{n}</span><h4>{t}</h4><p>{d}</p></div>')
    return f'<div class="flow {cls}">' + "".join(out) + "</div>"


def steps(items) -> str:
    return '<div class="steps">' + "".join(f'<div class="s"><i>{i}</i><div><h4>{t}</h4><p>{d}</p></div></div>' for i, t, d in items) + "</div>"


def kpis(items, cols: int = 4) -> str:
    """items: (값, 단위, 설명, 표시, 색)"""
    out = []
    for it in items:
        v, u, l = it[:3]
        b = it[3] if len(it) > 3 else ""
        tone = it[4] if len(it) > 4 else ""
        out.append(f'<div class="kpi {tone}"><div class="v">{v}<small>{u}</small></div><div class="l">{l}</div>{b}</div>')
    return f'<div class="kpis" style="grid-template-columns:repeat({cols},1fr)">' + "".join(out) + "</div>"


def marks(items) -> str:
    return '<ul class="marks">' + "".join(f"<li><i>{i}</i><span>{t}</span></li>" for i, t in enumerate(items, 1)) + "</ul>"


def srcs(items) -> str:
    return '<div class="srcs">' + "<br>".join(f"<b>[{i}]</b> {t}" for i, t in enumerate(items, 1)) + "</div>"


def sup(n) -> str:
    return f'<sup class="s">[{n}]</sup>'


def fillbox(text: str) -> str:
    return f'<div class="box-fill">{B("fill")} {text}</div>'


# ── 실제 화면 · 그림 · 사진 ──────────────────────────────────
class Kit:
    def __init__(self):
        SHOTS.mkdir(parents=True, exist_ok=True)
        self.idx_path = SHOTS / "index.json"
        self.idx = json.loads(self.idx_path.read_text()) if self.idx_path.exists() else {}
        self.meta = json.loads((CAP / "steps.json").read_text()) if (CAP / "steps.json").exists() else self.idx.get("__meta")
        self.F = json.loads((CAP / "facts.json").read_text()) if (CAP / "facts.json").exists() else self.idx.get("__facts")
        if (CAP / "steps.json").exists():
            self.idx["__meta"], self.idx["__facts"] = self.meta, self.F
        self.steps = {s["id"]: s for s in self.meta["steps"]}

    def save(self):
        self.idx_path.write_text(json.dumps(self.idx, ensure_ascii=False, indent=1))

    def hm(self, m: int) -> str:
        h, mi = map(int, self.meta["P"].split(":"))
        t = h * 60 + mi + m
        return f"{t // 60:02d}:{t % 60:02d}"

    def at(self, i: str) -> str:
        return self.steps[i]["at"][:5]

    def _frame(self, name: str, mk: str, phone: bool, who: str, t: str, cap: str, cls: str, style: str) -> str:
        c = f"<figcaption>{cap}</figcaption>" if cap else ""
        st = f' style="{style}"' if style else ""
        return (
            f'<figure class="shot {"phone" if phone else "pc"} {cls}"{st}><div class="bar">{B("real")}<b>{who}</b><span class="t">{t}</span></div>'
            f'<div class="frame"><img src="{REL}/shots/{name}.jpg" alt="">{mk}</div>{c}</figure>'
        )

    def shot(self, i, show=None, aspect=None, focus=False, name=None, numbered=True, who=None, cls="", cap="", style="") -> str:
        """핵심 사례 촬영본 — 볼 곳에 빨간 테두리와 번호를 겹친다 (번호 = 아래 설명 번호)"""
        st = self.steps[i]
        phone = st["device"] == "phone"
        name = name or i
        who = who or ("기사 휴대폰" if phone else "관리자 PC")
        key_ = f"shot:{name}"
        c = st.get("crop")
        src = CAP / (c["img"] if c else st["img"])
        if src.exists():
            W, H = size(src)
            ms = []
            if c:
                for k, m in enumerate(c["marks"], 1):
                    if not m or (show and k not in show) or m["y"] + m["h"] < 0.01 or m["y"] > 0.99:
                        continue
                    ms.append([m["x"] * W, m["y"] * H, m["w"] * W, m["h"] * H])
            x0, y0, cw, ch = 0.0, 0.0, float(W), float(H)
            if focus and ms:
                pad = 48 if focus is True else focus
                ux0, uy0 = max(0, min(b[0] for b in ms) - pad), max(0, min(b[1] for b in ms) - pad)
                ux1, uy1 = min(W, max(b[0] + b[2] for b in ms) + pad), min(H, max(b[1] + b[3] for b in ms) + pad)
                x0, y0, cw, ch = ux0, uy0, ux1 - ux0, uy1 - uy0
                if aspect:
                    if cw / ch < aspect:
                        nw = min(W, ch * aspect)
                        x0, cw = max(0, min(W - nw, x0 - (nw - cw) / 2)), nw
                    else:
                        nh = min(H, cw / aspect)
                        y0, ch = max(0, min(H - nh, y0 - (nh - ch) / 2)), nh
            elif aspect and W / H < aspect:
                ch = round(W / aspect)
                cy = (min(b[1] for b in ms) + max(b[1] + b[3] for b in ms)) / 2 if ms else H / 2
                y0 = max(0, min(H - ch, cy - ch / 2))
            x0, y0, cw, ch = round(x0), round(y0), round(cw), round(ch)
            subprocess.run(["convert", str(src), "-crop", f"{cw}x{ch}+{x0}+{y0}", "+repage", "-resize", "1500x>", "-quality", "87", str(SHOTS / f"{name}.jpg")], check=True)
            mk = ""
            for n, (x, y, w, hh) in enumerate(ms, 1):
                p = 6
                L, T = max(0, x - x0 - p) / cw * 100, max(0, y - y0 - p) / ch * 100
                R, Bt = min(cw, x - x0 + w + p) / cw * 100, min(ch, y - y0 + hh + p) / ch * 100
                badge = f"<b>{n}</b>" if numbered else ""
                mk += f'<i class="mk" style="left:{L:.2f}%;top:{T:.2f}%;width:{R - L:.2f}%;height:{Bt - T:.2f}%">{badge}</i>'
            self.idx[key_] = mk
        mk = self.idx.get(key_, "")
        if not (SHOTS / f"{name}.jpg").exists():
            raise FileNotFoundError(f"화면 없음: {name} (촬영 폴더 {CAP})")
        return self._frame(name, mk, phone, who, self.at(i), cap, cls, style)

    def xshot(self, file, name, who="관리자 PC", t="", crop=None, mk=(), trim=True, cap="", cls="", style="", phone=False, width=1700) -> str:
        """추가 촬영본 — crop=(x, y, w, h) 비율로 자르고, mk=[(x, y, w, h), ...] 비율 위치에 번호 테두리를 겹친다"""
        src = XCAP / file
        out = SHOTS / f"{name}.jpg"
        if src.exists():
            args = ["convert", str(src)]
            if crop:
                W, H = size(src)
                x, y, w, h = crop
                args += ["-crop", f"{round(w * W)}x{round(h * H)}+{round(x * W)}+{round(y * H)}", "+repage"]
            if trim:
                args += ["-fuzz", "4%", "-trim", "+repage", "-bordercolor", "#ffffff", "-border", "18"]
            args += ["-resize", f"{width}x>", "-quality", "87", str(out)]
            subprocess.run(args, check=True)
        if not out.exists():
            raise FileNotFoundError(f"화면 없음: {name} ({src})")
        m = "".join(
            f'<i class="mk" style="left:{x * 100:.2f}%;top:{y * 100:.2f}%;width:{w * 100:.2f}%;height:{h * 100:.2f}%"><b>{n}</b></i>' for n, (x, y, w, h) in enumerate(mk, 1)
        )
        return self._frame(name, m, phone, who, t, cap, cls, style)

    def art(self, name, cap="", badge="idea", crop=None, cls="", style="", cover=None) -> str:
        """첨부 그림(회사 제공 인포그래픽) — assets/attached/<name>.jpg"""
        p = ASSETS / "attached" / f"{name}.jpg"
        if not p.exists():
            raise FileNotFoundError(p)
        src = f"{REL}/attached/{name}.jpg"
        if crop:
            cname = f"{name}_c{abs(hash(crop)) % 10000}"
            q = ASSETS / "attached" / "crop" / f"{cname}.jpg"
            q.parent.mkdir(exist_ok=True)
            W, H = size(p)
            x, y, w, h = crop
            subprocess.run(["convert", str(p), "-crop", f"{round(w * W)}x{round(h * H)}+{round(x * W)}+{round(y * H)}", "+repage", "-quality", "90", str(q)], check=True)
            src = f"{REL}/attached/crop/{cname}.jpg"
        c = f"<figcaption>{cap}</figcaption>" if cap else ""
        st = f' style="{style}"' if style else ""
        cov = cover or ""
        return f'<figure class="art {cls}"{st}><img src="{src}" alt="">{cov}{B(badge) if badge else ""}{c}</figure>'

    def photo(self, name, cap="", cls="", style="", slot=None) -> str:
        """현장 분위기 사진 — slot(P-xx) 이름의 새 사진이 assets/photos/new/ 에 있으면 그것을 쓴다(실제 현장 사진 · 새로 만든 사진 교체용)
        slot을 주지 않으면 PHOTO_SLOT의 기본 칸을 쓴다. 같은 이름의 .real 파일을 두면 '현장 사진' 표시로 바뀐다."""
        slot = slot or PHOTO_SLOT.get(name)
        badge = "ai"
        src = f"{REL}/photos/{name}.jpg"
        if slot and (ASSETS / "photos" / "new" / f"{slot}.jpg").exists():
            src = f"{REL}/photos/new/{slot}.jpg"
            badge = "real" if (ASSETS / "photos" / "new" / f"{slot}.real").exists() else "ai"
        lab = "현장 사진" if badge == "real" else None
        c = f"<figcaption>{cap}</figcaption>" if cap else ""
        st = f' style="{style}"' if style else ""
        return f'<figure class="pic {cls}"{st}><img src="{src}" alt="">{B(badge, lab)}{c}</figure>'


# 사진 칸 — 내부용 제작 지시서(99)의 P-xx 번호와 같다
PHOTO_SLOT = {"ai-stuck": "P-01", "ai-pole": "P-02", "ai-van": "P-03", "ai-hq": "P-04", "ai-photo": "P-06", "ai-tablet": "P-07", "ai-map": "P-10"}


def slot_src(rel_path: str) -> str:
    """표지 배경 등 경로로 쓰는 사진도 새 사진 칸이 있으면 바꾼다"""
    name = rel_path.rsplit("/", 1)[-1].removesuffix(".jpg")
    sl = PHOTO_SLOT.get(name)
    if rel_path.startswith("photos/") and sl and (ASSETS / "photos" / "new" / f"{sl}.jpg").exists():
        return f"photos/new/{sl}.jpg"
    return rel_path


# ── 문서 조립 ─────────────────────────────────────────────
def cover(doc, art: str = "") -> str:
    ans = "".join(f"<li>{a}</li>" for a in doc["answers"])
    tags = "".join(f"<span>{t}</span>" for t in doc.get("tags", []))
    bg = f'<div class="art" style="background-image:url({REL}/{slot_src(art)})"></div>' if art else ""
    label = doc.get("label", f"보완자료 {doc['code']} / 12")
    return f"""<section class="page cover">{bg}<div class="in">
<div class="lg"><div class="mk">H<i></i></div><div><b>{COMPANY}</b><small>벤처기업확인(혁신성장유형) 이의신청 보완자료</small></div></div>
<div class="no">{label}</div>
<h1>{doc['title_html']}</h1>
<p class="sub">{doc['sub']}</p>
<div class="tags">{tags}</div>
<div class="ans"><h4>이 문서가 답하는 보완 요청</h4><ul>{ans}</ul></div>
<div class="meta"><div>신청기술<b>{TECH}</b></div><div>관련 특허<b>출원 {PATENT_NO}</b>({PATENT_DATE} 출원 · 등록 전)</div><div>기준 프로그램<b>v{APP_VER} · {COMMIT}</b>GitHub 저장소 커밋</div><div>작성일<b>{WRITTEN}</b>{doc.get('pages_note', '')}</div></div>
</div></section>"""


def render(doc, pages, art: str = "") -> str:
    n = len(pages) + 1
    out = [cover(doc, art)]
    for i, body in enumerate(pages, 2):
        out.append(
            f"""<section class="page"><header class="top"><div class="logo"><div class="mk">H<i></i></div><div><b>{COMPANY}</b><small>{TECH}</small></div></div>
<div class="doccode"><span class="no">{doc.get('tag', '보완자료 ' + doc['code'])}</span>{doc['short']}</div></header>
<main>{body}</main>
<footer class="bot"><span><b>{doc['short']}</b> · {doc.get('foot', '벤처기업확인 이의신청 보완자료')}</span><span>{doc['code']} — {i} / {n}</span></footer></section>"""
        )
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>보완자료 {doc['code']} {doc['short']}</title>
<link rel="stylesheet" href="../src/pkg.css"></head><body>{''.join(out)}</body></html>"""
