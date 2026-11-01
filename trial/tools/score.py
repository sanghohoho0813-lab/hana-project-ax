"""비교시험 채점·집계 — 실제로 기록한 결과(trial/results/*.csv)만 읽는다.

- 측정하지 않은 값은 만들지 않는다. 빈 칸은 '기록 없음'으로 두고 통계에서 뺀다. 결과가 없으면 '측정 전'만 쓴다.
- 채점은 방식을 가린 채 한다: answers.csv 에는 방식 칸이 없고, 방식은 timing.csv(기록지)에서 참가자·시나리오로 붙인다.
- 정답은 data/answer-key.json. 시험 전에 기록해 둔 sha256과 다르면 경고한다.

    python3 trial/tools/score.py              # 채점 → results/summary.json · results/scored_trials.csv · report/additional_verification.md
    python3 trial/tools/score.py --selftest   # 채점 규칙 자체 점검 (메모리 안에서만, 결과 파일을 만들지 않음)
"""
import csv
import hashlib
import json
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA, RES, REP = ROOT / "data", ROOT / "results", ROOT / "report"
RISK = ("중간", "높음", "매우 높음")
# 시험 전에 고정한 정답·시나리오 파일 지문 (TRIAL_PLAN.md 와 같은 값) — 시험 뒤 정답을 고치면 경고
PINNED = {
    "scenarios.json": "980e8e3f1b6f86df4cee45611030f46956e8ed610de9f424ce57f64a6c359b2b",
    "answer-key.json": "f2b76efdcd1290807f5b96a79441c84a565c5541379966d7e040d31bcdbb2d92",
}


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def load_key():
    scen = {s["id"]: s for s in json.loads((DATA / "scenarios.json").read_text(encoding="utf-8"))["scenarios"]}
    key = json.loads((DATA / "answer-key.json").read_text(encoding="utf-8"))["scenarios"]
    return scen, key


def read_csv(name):
    p = RES / name
    if not p.exists():
        return []
    with p.open(encoding="utf-8-sig", newline="") as f:
        return [{k.strip(): (v or "").strip() for k, v in r.items() if k} for r in csv.DictReader(f)]


# ── 채점 규칙 ──
def site_id(sc, name, errors, where):
    for s in sc["sites"]:
        if s["region"] == name:
            return s["id"]
    errors.append(f"{where}: 시나리오 {sc['id']}에 없는 현장 이름 '{name}'")
    return None


def link_id(sc, a, b, errors, where):
    x, y = site_id(sc, a, errors, where), site_id(sc, b, errors, where)
    return frozenset((x, y)) if x and y else None  # 방향을 거꾸로 적어도 같은 연결로 본다


def as_int(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def score_trial(sc, k, rows, errors):
    """한 참가자의 한 시나리오 답안 채점 — rows: answers.csv 의 해당 행들"""
    where = lambda r: f"answers.csv {r.get('participant')}·{sc['id']}·{r.get('item')}"
    key_risk = {frozenset(l["key"].split(">")): -l["slack"] for l in k["links"] if l["grade"] in RISK}
    key_after = {frozenset(l["key"].split(">")): -l["slack"] for l in k["after"]["links"] if l["grade"] in RISK}
    key_new = {frozenset(x.split(">")) for x in k["after"]["new"]}
    key_res = {frozenset(x.split(">")) for x in k["after"]["resolved"]}

    def links(item):
        out = {}
        for r in rows:
            if r.get("item") == item:
                lid = link_id(sc, r.get("from", ""), r.get("to", ""), errors, where(r))
                if lid:
                    out[lid] = (as_int(r.get("minutes")), r.get("new") in ("1", "Y", "y", "O", "o", "true"))
        return out

    def sites(item):
        out = {}
        for r in rows:
            if r.get("item") == item:
                sid = site_id(sc, r.get("site", ""), errors, where(r))
                if sid:
                    out[sid] = as_int(r.get("minutes"))
        return out

    got_r, got_a, got_res, got_aff = links("risk"), links("after_risk"), links("resolved"), sites("affected")
    tp = set(got_r) & set(key_risk)
    atp = set(got_a) & set(key_after)
    aff_tp = set(got_aff) & set(k["affected"])
    return {
        "risk_key": len(key_risk), "risk_tp": len(tp), "risk_fp": len(set(got_r) - set(key_risk)), "risk_fn": len(set(key_risk) - set(got_r)),
        "risk_min_exact": sum(1 for l in tp if got_r[l][0] == key_risk[l]),
        "aff_key": len(k["affected"]), "aff_tp": len(aff_tp), "aff_fp": len(set(got_aff) - set(k["affected"])),
        "aff_fn": len(set(k["affected"]) - set(got_aff)), "aff_min_exact": sum(1 for s in aff_tp if got_aff[s] == k["affected"][s]),
        "after_key": len(key_after), "after_tp": len(atp), "after_fp": len(set(got_a) - set(key_after)), "after_fn": len(set(key_after) - set(got_a)),
        "after_min_exact": sum(1 for l in atp if got_a[l][0] == key_after[l]),
        "res_key": len(key_res), "res_tp": len(set(got_res) & key_res), "res_fp": len(set(got_res) - key_res), "res_fn": len(key_res - set(got_res)),
        "new_key": len(key_new), "new_tp": sum(1 for l in key_new if l in got_a and got_a[l][1]),
        "new_flag_fp": sum(1 for l, v in got_a.items() if v[1] and l not in key_new),
    }


# ── 집계 ──
def med(xs):
    return round(statistics.median(xs), 1) if xs else None


def aggregate(trials):
    out = {}
    for method in ("수기", "AX"):
        ts = [t for t in trials if t["method"] == method]
        if not ts:
            out[method] = None
            continue
        t1 = [t["t1_sec"] for t in ts if t["t1_sec"] is not None]
        t2 = [t["t2_sec"] for t in ts if t["t2_sec"] is not None]
        tot = lambda f: sum(t[f] for t in ts if t["scored"])
        per = {}
        for p in sorted({t["participant"] for t in ts}):
            pt = [t for t in ts if t["participant"] == p]
            per[p] = {"set": pt[0]["set"], "t1_median": med([t["t1_sec"] for t in pt if t["t1_sec"] is not None]),
                      "t2_median": med([t["t2_sec"] for t in pt if t["t2_sec"] is not None]),
                      "risk": f'{sum(t["risk_tp"] for t in pt if t["scored"])}/{sum(t["risk_key"] for t in pt if t["scored"])}'}
        out[method] = {
            "participants": len(per), "trials": len(ts), "scored_trials": sum(1 for t in ts if t["scored"]),
            "t1": {"n": len(t1), "median": med(t1), "min": min(t1) if t1 else None, "max": max(t1) if t1 else None,
                   "timeouts": sum(1 for t in ts if t["t1_timeout"])},
            "t2": {"n": len(t2), "median": med(t2), "min": min(t2) if t2 else None, "max": max(t2) if t2 else None,
                   "timeouts": sum(1 for t in ts if t["t2_timeout"])},
            **{f: tot(f) for f in ("risk_key", "risk_tp", "risk_fp", "risk_min_exact", "aff_key", "aff_tp", "aff_fp", "aff_min_exact",
                                   "after_key", "after_tp", "after_fp", "res_key", "res_tp", "res_fp", "new_key", "new_tp", "new_flag_fp")},
            "per_participant": per,
        }
    return out


def build_trials(timing, answers, scen, key, errors):
    trials = []
    by = {}
    for r in answers:
        by.setdefault((r.get("participant", ""), r.get("scenario", "")), []).append(r)
    for r in timing:
        if r.get("practice") == "1" or r.get("scenario", "").startswith("R"):
            continue  # 연습 문제는 채점하지 않는다
        sid, pid = r.get("scenario", ""), r.get("participant", "")
        if sid not in scen:
            errors.append(f"timing.csv: 알 수 없는 시나리오 '{sid}'")
            continue
        if r.get("method") not in ("수기", "AX"):
            errors.append(f"timing.csv {pid}·{sid}: 방식은 '수기' 또는 'AX'")
            continue
        rows = by.get((pid, sid), [])
        t = {"participant": pid, "session": r.get("session"), "method": r.get("method"), "set": r.get("set"), "scenario": sid,
             "t1_sec": float(r["t1_sec"]) if r.get("t1_sec") else None, "t2_sec": float(r["t2_sec"]) if r.get("t2_sec") else None,
             "t1_timeout": r.get("t1_timeout") == "1", "t2_timeout": r.get("t2_timeout") == "1", "scored": bool(rows), "note": r.get("note", "")}
        t.update(score_trial(scen[sid], key[sid], rows, errors) if rows else {})
        trials.append(t)
    known = {(t["participant"], t["scenario"]) for t in trials}
    for (pid, sid) in by:
        if (pid, sid) not in known and not sid.startswith("R"):
            errors.append(f"answers.csv {pid}·{sid}: 기록지(timing.csv)에 없는 답안 — 방식을 알 수 없어 집계하지 않음")
    return trials


def fmt_t(sec):
    if sec is None:
        return "기록 없음"
    s = int(round(sec))
    return f"{s // 60}분 {s % 60:02d}초"


def report(agg, trials, warn):
    """추가 검증자료 — 측정값이 있는 칸만 채운다"""
    tpl = (ROOT / "REPORT_TEMPLATE.md").read_text(encoding="utf-8")
    ms = [m for m in ("수기", "AX") if agg.get(m)]
    if not ms:
        body = "**측정 전** — trial/results/ 에 실제 시험 결과가 없습니다. 이 문서의 결과 칸은 비어 있습니다."
        return (tpl.replace("{{RESULTS}}", body).replace("{{PARTICIPANTS}}", "측정 전").replace("{{N}}", "○명(시험 후 기재)")
                .replace("{{WARN}}", "\n".join(f"> 주의: {w}" for w in warn)))

    def cell(m, f):
        a = agg.get(m)
        return f(a) if a else "측정 전"
    rows = [
        ("위험 인지시간 (1부, 중앙값 · 범위)", lambda a: f'{fmt_t(a["t1"]["median"])} ({fmt_t(a["t1"]["min"])}~{fmt_t(a["t1"]["max"])}) · n={a["t1"]["n"]}' + (f' · 시간 초과 {a["t1"]["timeouts"]}' if a["t1"]["timeouts"] else "")),
        ("정확히 발견한 위험", lambda a: f'{a["risk_tp"]} / {a["risk_key"]}건 · 부족 분까지 정확 {a["risk_min_exact"]}건'),
        ("위험이 아닌데 위험으로 적은 건", lambda a: f'{a["risk_fp"]}건'),
        ("후속 현장 영향 파악", lambda a: f'{a["aff_tp"]} / {a["aff_key"]}곳 · 늦어지는 분까지 정확 {a["aff_min_exact"]}곳 · 잘못 적은 현장 {a["aff_fp"]}곳'),
        ("조치 후 재판단 시간 (2부, 중앙값 · 범위)", lambda a: f'{fmt_t(a["t2"]["median"])} ({fmt_t(a["t2"]["min"])}~{fmt_t(a["t2"]["max"])}) · n={a["t2"]["n"]}' + (f' · 시간 초과 {a["t2"]["timeouts"]}' if a["t2"]["timeouts"] else "")),
        ("조치 후 위험 판정", lambda a: f'{a["after_tp"]} / {a["after_key"]}건 · 잘못 적은 건 {a["after_fp"]}'),
        ("없어진 위험 · 새로 생긴 위험 파악", lambda a: f'해소 {a["res_tp"]} / {a["res_key"]} · 신규 {a["new_tp"]} / {a["new_key"]}'),
    ]
    t = "| 측정 항목 | 수기 일정확인 | AX 시스템 사용 |\n|---|---|---|\n" + "".join(
        f"| {name} | {cell('수기', f)} | {cell('AX', f)} |\n" for name, f in rows)
    pp = "| 참가자 | 방식 · 세트 | 1부 중앙값 | 2부 중앙값 | 위험 발견 |\n|---|---|---|---|---|\n"
    for m in ("수기", "AX"):
        for p, v in (agg.get(m) or {}).get("per_participant", {}).items():
            pp += f'| {p} | {m} · {v["set"]}세트 | {fmt_t(v["t1_median"])} | {fmt_t(v["t2_median"])} | {v["risk"]} |\n'
    n = len({t["participant"] for t in trials})
    return (tpl.replace("{{RESULTS}}", t).replace("{{PARTICIPANTS}}", pp).replace("{{N}}", f"{n}명")
            .replace("{{WARN}}", "\n".join(f"> 주의: {w}" for w in warn)))


def main():
    scen, key = load_key()
    warn = [f"{name}이 시험 전에 고정한 값과 다릅니다 (sha256 {sha(DATA / name)[:12]}…). 정답을 시험 뒤 바꿨다면 이유를 기록하세요."
            for name, h in PINNED.items() if sha(DATA / name) != h]
    timing, answers = read_csv("timing.csv"), read_csv("answers.csv")
    errors = []
    trials = build_trials(timing, answers, scen, key, errors)
    agg = aggregate(trials)
    REP.mkdir(exist_ok=True)
    (REP / "additional_verification.md").write_text(report(agg, trials, warn), encoding="utf-8")
    if not trials:
        print("측정 전 — trial/results/timing.csv 에 기록이 없습니다. 보고서 결과 칸을 '측정 전'으로 두었습니다.")
        for w in warn:
            print("주의:", w)
        return
    (RES / "summary.json").write_text(json.dumps({"note": "실제 기록(timing.csv·answers.csv)만으로 계산", "warnings": warn, "errors": errors,
                                                  "methods": agg}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    cols = list(trials[0].keys())
    for t in trials:
        cols += [c for c in t if c not in cols]
    with (RES / "scored_trials.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(trials)
    print(f"채점 {len(trials)}건 (답안 있음 {sum(1 for t in trials if t['scored'])}) → results/summary.json · results/scored_trials.csv · report/additional_verification.md")
    for m in ("수기", "AX"):
        a = agg[m]
        print(f" {m}: " + ("측정 전" if not a else f'참가자 {a["participants"]} · 1부 중앙값 {fmt_t(a["t1"]["median"])} · 위험 {a["risk_tp"]}/{a["risk_key"]} · 2부 중앙값 {fmt_t(a["t2"]["median"])}'))
    for x in warn + errors:
        print("확인 필요:", x)


# ── 자체 점검 (메모리 안에서만 — 결과 파일·보고서를 만들지 않는다) ──
def selftest():
    scen, key = load_key()
    errors = []

    def perfect(sid, pid="T"):
        sc, k = scen[sid], key[sid]
        name = {s["id"]: s["region"] for s in sc["sites"]}
        rows = []
        for l in k["links"]:
            if l["grade"] in RISK:
                a, b = l["key"].split(">")
                rows.append({"participant": pid, "scenario": sid, "item": "risk", "from": name[a], "to": name[b], "minutes": str(-l["slack"])})
        for s, v in k["affected"].items():
            rows.append({"participant": pid, "scenario": sid, "item": "affected", "site": name[s], "minutes": str(v)})
        for l in k["after"]["links"]:
            if l["grade"] in RISK:
                a, b = l["key"].split(">")
                rows.append({"participant": pid, "scenario": sid, "item": "after_risk", "from": name[a], "to": name[b],
                             "minutes": str(-l["slack"]), "new": "1" if l["key"] in k["after"]["new"] else ""})
        for x in k["after"]["resolved"]:
            a, b = x.split(">")
            rows.append({"participant": pid, "scenario": sid, "item": "resolved", "from": name[a], "to": name[b]})
        return rows

    # 1) 정답을 그대로 적으면 만점
    for sid in [s for s in scen if not s.startswith("R")]:
        r = score_trial(scen[sid], key[sid], perfect(sid), errors)
        assert r["risk_tp"] == r["risk_key"] and r["risk_fp"] == 0 and r["risk_min_exact"] == r["risk_key"], (sid, r)
        assert r["aff_tp"] == r["aff_key"] and r["aff_fp"] == 0 and r["aff_min_exact"] == r["aff_key"], (sid, r)
        assert r["after_tp"] == r["after_key"] and r["res_tp"] == r["res_key"] and r["new_tp"] == r["new_key"] and r["new_flag_fp"] == 0, (sid, r)
    assert not errors, errors
    # 2) 일부러 틀린 답안 — A2: 위험 1건 빠뜨림, '주의' 연결을 위험으로 적음, 부족 분 틀림, 방향 거꾸로
    rows = [r for r in perfect("A2") if not (r["item"] == "risk" and r["from"] == "세종")]
    rows.append({"participant": "T", "scenario": "A2", "item": "risk", "from": "부여", "to": "청양", "minutes": "3"})
    for r in rows:
        if r["item"] == "risk" and r["from"] == "공주":
            r["minutes"] = "20"
        if r["item"] == "risk" and r["from"] == "계룡":
            r["from"], r["to"] = r["to"], r["from"]
    r = score_trial(scen["A2"], key["A2"], rows, errors)
    assert (r["risk_tp"], r["risk_fn"], r["risk_fp"], r["risk_min_exact"]) == (2, 1, 1, 1), r
    # 3) A4: 새로 생긴 위험에 표시하지 않음, 남은 위험에 '새로 생김' 잘못 표시
    rows = perfect("A4")
    for x in rows:
        if x["item"] == "after_risk":
            x["new"] = "" if x["from"] == "평택" else "1"
    r = score_trial(scen["A4"], key["A4"], rows, errors)
    assert (r["new_tp"], r["new_flag_fp"], r["after_tp"]) == (0, 1, 2), r
    # 4) 없는 현장 이름은 오류로 알린다
    e2 = []
    score_trial(scen["A1"], key["A1"], [{"participant": "T", "scenario": "A1", "item": "risk", "from": "천안", "to": "부산", "minutes": "15"}], e2)
    assert e2 and "부산" in e2[0], e2
    # 5) 기록지에 없는 답안은 집계하지 않는다 · 연습 문제는 채점하지 않는다
    e3 = []
    tr = build_trials([{"participant": "T", "method": "AX", "set": "A", "scenario": "R2", "practice": "1", "t1_sec": "5"}],
                      perfect("A1"), scen, key, e3)
    assert tr == [] and any("기록지" in x for x in e3), (tr, e3)
    # 6) 결과가 없으면 '측정 전'
    agg = aggregate([])
    assert agg == {"수기": None, "AX": None}
    assert "측정 전" in report(agg, [], [])
    print("채점 규칙 자체 점검 통과 (만점 10문항 · 누락/오탐/분 오차/방향 · 신규 표시 · 현장 이름 오류 · 연습 제외 · 측정 전 처리)")


if __name__ == "__main__":
    selftest() if "--selftest" in sys.argv else main()
