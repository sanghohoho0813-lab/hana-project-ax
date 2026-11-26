"""player.html 시간 점검: 장면 밖에서 나타나는 요소, 뒤집힌 창, 카메라 키 순서, 장면 순서"""
import json, re, sys
h = open(sys.argv[1]).read()
parts = re.split(r'(?=<section class="scene)', h)[1:]
bad = 0
prev = -1
for p in parts:
    a, b = map(float, re.search(r'data-start="([0-9.]+)" data-end="([0-9.]+)"', p).groups())
    if a <= prev or b <= a + 1.5:
        print(f"[장면] {a}-{b} 순서/길이 이상"); bad += 1
    prev = a
    for v in re.findall(r'data-in="([0-9.]+)"', p):
        v = float(v)
        if v > b - 0.8:
            print(f"[등장 늦음] 장면 {a:.2f}-{b:.2f} 요소 {v:.2f} (끝 {b - v:.2f}초 전)"); bad += 1
        if v < a - 0.05:
            print(f"[등장 이름] 장면 {a:.2f}-{b:.2f} 요소 {v:.2f}"); bad += 1
    for x, y in re.findall(r'data-show="([0-9.]+),([0-9.]+)"', p):
        x, y = float(x), float(y)
        if y - x < 1.0 or x > b - 0.8 or y < a + 0.5:
            print(f"[창] 장면 {a:.2f}-{b:.2f} 창 {x:.2f}-{y:.2f}"); bad += 1
    for c in re.findall(r"data-cam='([^']*)'", p):
        ks = json.loads(c)
        ts = [k[0] for k in ks]
        if ts != sorted(ts) or (len(ts) > 1 and ts[-1] > b + 0.01):
            print(f"[카메라] 장면 {a:.2f}-{b:.2f} 키 {ts}"); bad += 1
    for v in re.findall(r'data-(?:tap|at)="([0-9.]+)', p):
        if float(v) > b - 0.3:
            print(f"[누름] 장면 {a:.2f}-{b:.2f} {v}"); bad += 1
print("이상", bad, "· 장면", len(parts))
