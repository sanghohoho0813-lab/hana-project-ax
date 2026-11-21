"""촬영한 시험 기록(로컬 DB)에서 문서에 쓸 값을 뽑는다 — 사건 1건(보령 지사)"""
import json
import subprocess
import sys

out = sys.argv[1]


def q(sql: str) -> list[list[str]]:
    r = subprocess.run(["docker", "exec", "supabase_db_hana-ax-pilot", "psql", "-U", "postgres", "-At", "-F", "|", "-c", sql], capture_output=True, text=True, check=True)
    return [l.split("|") for l in r.stdout.strip().splitlines() if l]


c = q(
    """select id, case_no, to_char(discovered_at at time zone 'Asia/Seoul','HH24:MI'), to_char(reported_at at time zone 'Asia/Seoul','HH24:MI'),
       round(extract(epoch from reported_at - discovered_at)/60)::int, to_char(expected_end,'HH24:MI'), extract(epoch from reported_at)
       from field_cases where data_kind = '검증 시나리오' order by recorded_at desc limit 1;"""
)[0]
steps = q(
    f"""select kind, to_char(recorded_at at time zone 'Asia/Seoul','HH24:MI'), extract(epoch from recorded_at)
        from case_steps where case_id = '{c[0]}' order by step_no;"""
)
first = {}
adj = []
for k, hm, ep in steps:
    first.setdefault(k, (hm, float(ep)))
    if k == "일정 조정":
        adj.append(hm)
sec = lambda a, b: f"{round(b - a)}초"
f = {
    "case_no": c[1],
    "discovered": c[2],
    "reported": c[3],
    "disc_to_report": f"{c[4]}분",
    "new_end": c[5],
    "decided": first["지원 조치 결정"][0],
    "adjust1": adj[0],
    "adjust2": adj[1],
    "report_to_ack": sec(float(c[6]), first["접수"][1]),  # 보고(누른 시각) → 접수 — 사건 증빙 화면과 같은 기준
    "ack_to_decide": sec(first["접수"][1], first["지원 조치 결정"][1]),
    "decide_to_deliver": sec(first["지원 조치 결정"][1], first["현장 전달"][1]),
    "steps": [[k, hm] for k, hm, _ in steps],
}
ev = {k: hm for k, hm in q("select kind, to_char(occurred_at at time zone 'Asia/Seoul','HH24:MI') from work_events where data_kind = '검증 시나리오' order by occurred_at;")}
chk = q(
    """select c.stage, to_char(c.checked_at at time zone 'Asia/Seoul','HH24:MI'),
       (select to_char(min(r.recorded_at) at time zone 'Asia/Seoul','HH24:MI') from safety_reviews r where r.check_id = c.id)
       from safety_checks c where c.data_kind = '검증 시나리오' order by c.checked_at;"""
)
f["started"] = ev.get("작업개시")
f["ended"] = ev.get("작업종료")
f["checks"] = {st: {"at": t, "review": r} for st, t, r in chk}
json.dump(f, open(out, "w"), ensure_ascii=False, indent=1)
print(json.dumps(f, ensure_ascii=False))
