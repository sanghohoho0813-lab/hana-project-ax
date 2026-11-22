"""이의신청 자료 공통 도구 — 촬영 결과(steps.json · facts.json)를 읽고, 화면을 잘라 표시를 겹친다.
make_simple.py(간결판)가 쓴다. (상세판 make.py는 같은 방식을 자체로 가진다)
"""
import json
import shutil
import subprocess
from pathlib import Path


def size(p: Path) -> tuple[int, int]:
    w, h = subprocess.check_output(["identify", "-format", "%w %h", str(p)]).split()
    return int(w), int(h)


TAG_REAL = '<span class="tag real">실제 화면</span>'
TAG_AI = '<span class="tag ai">AI 연출 사진</span>'


class Kit:
    def __init__(self, shots: Path, photos: Path, img: Path, rel: str):
        self.shots, self.photos, self.img, self.rel = shots, photos, img, rel
        if img.exists():
            shutil.rmtree(img)
        img.mkdir(parents=True)
        self.meta = json.loads((shots / "steps.json").read_text())
        self.F = json.loads((shots / "facts.json").read_text())
        self.steps = {s["id"]: s for s in self.meta["steps"]}

    def hm(self, m: int) -> str:
        """보령 예정 시작 + m분 → HH:MM"""
        h, mi = map(int, self.meta["P"].split(":"))
        t = h * 60 + mi + m
        return f"{t // 60:02d}:{t % 60:02d}"

    def at(self, i: str) -> str:
        return self.steps[i]["at"][:5]

    def shot(self, i: str, show=None, aspect=None, focus=False, name=None, numbered=False, who=None, cls="") -> str:
        """실제 화면 — 핵심 부분을 잘라 볼 곳에 빨간 테두리(numbered면 번호도)를 겹친다"""
        st = self.steps[i]
        c = st.get("crop")
        phone = st["device"] == "phone"
        src = self.shots / (c["img"] if c else st["img"])
        W, H = size(src)
        marks = []
        if c:
            for k, m in enumerate(c["marks"], 1):
                if not m or (show and k not in show) or m["y"] + m["h"] < 0.01 or m["y"] > 0.99:
                    continue
                marks.append([m["x"] * W, m["y"] * H, m["w"] * W, m["h"] * H])
        x0, y0, cw, ch = 0.0, 0.0, float(W), float(H)
        if focus and marks:
            pad = 48 if focus is True else focus
            ux0, uy0 = max(0, min(b[0] for b in marks) - pad), max(0, min(b[1] for b in marks) - pad)
            ux1, uy1 = min(W, max(b[0] + b[2] for b in marks) + pad), min(H, max(b[1] + b[3] for b in marks) + pad)
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
            cy = (min(b[1] for b in marks) + max(b[1] + b[3] for b in marks)) / 2 if marks else H / 2
            y0 = max(0, min(H - ch, cy - ch / 2))
        x0, y0, cw, ch = round(x0), round(y0), round(cw), round(ch)
        name = name or i
        subprocess.run(["convert", str(src), "-crop", f"{cw}x{ch}+{x0}+{y0}", "+repage", "-resize", "1500x>", "-quality", "86", str(self.img / f"{name}.jpg")], check=True)
        mk = ""
        for n, (x, y, w, hh) in enumerate(marks, 1):
            p = 6
            L, T = max(0, x - x0 - p) / cw * 100, max(0, y - y0 - p) / ch * 100
            R, B = min(cw, x - x0 + w + p) / cw * 100, min(ch, y - y0 + hh + p) / ch * 100
            badge = f"<b>{n}</b>" if numbered else ""
            mk += f'<i class="mk" style="left:{L:.2f}%;top:{T:.2f}%;width:{R - L:.2f}%;height:{B - T:.2f}%">{badge}</i>'
        who = who or ("기사 휴대폰" if phone else "관리자 PC")
        return f"""<figure class="shot {'phone' if phone else 'pc'} {cls}"><div class="bar">{TAG_REAL}<b>{who}</b><span>{self.at(i)}</span></div><div class="frame"><img src="{self.rel}/{name}.jpg" alt="">{mk}</div></figure>"""

    def photo(self, name: str, cls: str = "") -> str:
        shutil.copy(self.photos / f"{name}.jpg", self.img / f"{name}.jpg")
        return f"""<figure class="pic {cls}"><img src="{self.rel}/{name}.jpg" alt="">{TAG_AI}</figure>"""
