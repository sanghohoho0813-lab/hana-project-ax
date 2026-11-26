"""촬영본 잘라낸 그림(crop)이 전체 화면(img)의 어디인지 찾아, 번호 표시 위치를 전체 화면 CSS 좌표로 옮긴다."""
import json, sys
import numpy as np
from PIL import Image
CAP = sys.argv[1]
st = json.load(open(f"{CAP}/steps.json"))["steps"]
def gray(p, scale):
    im = Image.open(p).convert("L")
    w, h = im.size
    return np.asarray(im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.BILINEAR), dtype=np.float32)
out = {}
for s in st:
    c = s.get("crop")
    full = Image.open(f"{CAP}/{s['img']}")
    css_w = 390 if s["device"] == "phone" else 1080
    fs = full.size[0] / css_w                       # 전체 그림 px / css px
    if not c:
        out[s["id"]] = {"img": s["img"], "css": [css_w, full.size[1] / fs], "marks": []}
        continue
    cim = Image.open(f"{CAP}/{c['img']}")
    cs = cim.size[0] / c["w"]                        # 잘라낸 그림 px / css px
    if c["img"] == s["img"]:
        ox = oy = 0.0
    else:
        k = 0.5                                      # css 0.5배로 낮춰 찾기
        F = gray(f"{CAP}/{s['img']}", k / fs); T = gray(f"{CAP}/{c['img']}", k / cs)
        th, tw = T.shape; fh, fw = F.shape
        if th > fh or tw > fw:
            print("skip", s["id"]); continue
        # FFT 상관으로 SSD 최소 위치
        from numpy.fft import rfft2, irfft2
        Fm = F - F.mean(); Tm = T - T.mean()
        sh = (fh + th, fw + tw)
        corr = irfft2(rfft2(Fm, sh) * np.conj(rfft2(Tm, sh)), sh)[:fh - th + 1, :fw - tw + 1]
        ones = np.ones_like(T)
        F2 = irfft2(rfft2(Fm ** 2, sh) * np.conj(rfft2(ones, sh)), sh)[:fh - th + 1, :fw - tw + 1]
        ssd = F2 - 2 * corr + (Tm ** 2).sum()
        y, x = np.unravel_index(np.argmin(ssd), ssd.shape)
        ox, oy = x / k, y / k
        err = ssd[y, x] / T.size
        print(f"{s['id']:22s} off=({ox:.0f},{oy:.0f}) css  err={err:.1f}")
    cw, ch = c["w"], c["h"]
    marks = [[ox + m["x"] * cw, oy + m["y"] * ch, m["w"] * cw, m["h"] * ch] for m in c["marks"]]
    out[s["id"]] = {"img": s["img"], "css": [css_w, full.size[1] / fs], "crop": [ox, oy, cw, ch], "marks": marks, "at": s.get("at", "")}
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
