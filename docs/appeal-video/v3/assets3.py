"""3판 디자인(CSS)과 시간 이동(seek) 스크립트 — 가이드 토큰 그대로"""
import json

from lib3 import FONT, uri

CSS = """
@font-face{font-family:P;src:url(%FONT%) format('woff2-variations');font-weight:45 920}
:root{--gold:#d2a45f;--gold2:#e0b56f;--goldsoft:#e8c995;--teal:#3f8585;--teal2:#2f978d;--ink:#f4f1ec;--ink2:rgba(244,241,236,.72);--ink3:rgba(244,241,236,.46);--warn:#ff8a70;--char:#171b20;--copper:#b97935;--copper2:#a96a27;--red:#c0442c}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1920px;height:1080px;overflow:hidden;background:#0f1216;font-family:P,sans-serif;word-break:keep-all;color:var(--ink)}
.scene{position:absolute;inset:0;display:none;overflow:hidden}
.scene.navy{background:radial-gradient(70% 40% at 85% 8%,rgba(210,164,95,.17),transparent 60%),radial-gradient(60% 35% at 10% 92%,rgba(63,133,133,.10),transparent 60%),linear-gradient(170deg,#111820 0%,#171b20 45%,#0d1218 100%)}
.scene.slate{background:radial-gradient(55% 38% at 12% 90%,rgba(63,133,133,.16),transparent 62%),radial-gradient(60% 40% at 88% 10%,rgba(210,164,95,.10),transparent 60%),linear-gradient(160deg,#1b2630 0%,#22303a 55%,#172129 100%)}
.scene.ivory{background:radial-gradient(58% 34% at 90% 8%,rgba(210,164,95,.16),transparent 62%),linear-gradient(165deg,#fbf7f0 0%,#f3ece2 55%,#ece2d5 100%);color:var(--char)}
.scene.flow{background:#0f1216}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.09) 1px,transparent 1px);background-size:90px 90px;-webkit-mask-image:radial-gradient(80% 58% at 50% 42%,#000 30%,transparent 85%);opacity:.5}
.bgimg{position:absolute;inset:-2px;background-size:cover;background-position:center;opacity:.92}
.abs{position:absolute}
.chap{position:absolute;right:90px;top:62px;font-size:22px;font-weight:700;color:var(--ink3);display:flex;gap:10px;align-items:center;letter-spacing:.02em}
.chap b{color:var(--gold);font-weight:800}
.ivory .chap{color:rgba(23,27,32,.5)}.ivory .chap b{color:var(--copper)}
.eyebrow{font-size:24px;font-weight:800;letter-spacing:.12em;color:var(--goldsoft)}
.title{font-size:62px;font-weight:800;line-height:1.2;letter-spacing:-1.6px;margin-top:10px;color:var(--ink)}
.title em,.h1 em,.big em,.em{font-style:normal;color:var(--goldsoft);font-weight:850}
.ivory .eyebrow{color:var(--copper)}.ivory .title{color:var(--char)}.ivory .title em,.ivory .em{color:var(--copper2)}
.h1{font-size:96px;font-weight:850;line-height:1.14;letter-spacing:-3px}
.big{font-size:150px;font-weight:900;line-height:1;letter-spacing:-5px}
.body{font-size:40px;font-weight:650;line-height:1.42;color:var(--ink2)}
.note{font-size:22px;font-weight:600;color:var(--ink3);line-height:1.5}
.ivory .note{color:rgba(23,27,32,.55)}
.glass{background:rgba(255,255,255,.065);border:1px solid rgba(255,255,255,.13);border-radius:22px;box-shadow:0 30px 70px rgba(0,0,0,.35)}
.ivory .glass{background:#fffdf9;border:1px solid rgba(185,121,53,.18);box-shadow:0 24px 50px rgba(120,80,30,.12)}
.card{padding:28px 32px}
.card h3{font-size:40px;font-weight:800;letter-spacing:-.8px;line-height:1.25}
.card p{font-size:28px;font-weight:600;line-height:1.45;color:var(--ink2);margin-top:10px}
.ivory .card p{color:rgba(23,27,32,.66)}
.gline{border-top:5px solid var(--gold)}
.chip{display:inline-flex;align-items:center;gap:16px;font-size:42px;font-weight:750;padding:18px 30px;border-radius:18px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:var(--ink);letter-spacing:-.6px;white-space:nowrap}
.chip i{width:14px;height:14px;border-radius:50%;background:var(--gold);flex:none}
.chip.g{border-color:rgba(224,181,111,.75);background:rgba(210,164,95,.14)}
.chip.t i{background:var(--teal2)}
.chip.w{border-color:rgba(255,138,112,.6);background:rgba(255,138,112,.10)}.chip.w i{background:var(--warn)}
.chip.s{font-size:32px;padding:12px 22px;gap:12px}
.chip.s i{width:12px;height:12px}
.ivory .chip{background:#fffdf9;border-color:rgba(185,121,53,.25);color:var(--char)}
.node{background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.14);border-top:5px solid var(--gold);border-radius:18px;padding:22px 26px;font-size:36px;font-weight:780;line-height:1.3;letter-spacing:-.6px;box-shadow:0 24px 50px rgba(0,0,0,.3)}
.node small{display:block;font-size:24px;font-weight:600;color:var(--ink3);margin-top:6px;letter-spacing:0}
.node.w{border-top-color:var(--warn)}.node.t{border-top-color:var(--teal2)}.node.g{background:rgba(210,164,95,.16);border-color:rgba(224,181,111,.6)}
.num{font-size:200px;font-weight:900;color:var(--gold);line-height:.9;letter-spacing:-8px}
.row{display:flex;align-items:center;gap:22px;padding:20px 28px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-left:8px solid var(--gold);font-size:40px;font-weight:720;letter-spacing:-.6px}
.row.w{border-left-color:var(--warn)}.row small{margin-left:auto;font-size:26px;color:var(--ink3);font-weight:600}
.arrow{font-size:44px;font-weight:900;color:var(--gold);line-height:1}
.ln{position:absolute;height:4px;border-radius:2px;background:var(--gold)}
.ln.d{background:repeating-linear-gradient(90deg,var(--gold) 0 14px,transparent 14px 24px)}
.lnv{position:absolute;width:4px;border-radius:2px;background:var(--gold)}
.pill{display:inline-block;font-size:26px;font-weight:750;padding:8px 20px;border-radius:99px;background:rgba(210,164,95,.16);color:var(--goldsoft);border:1px solid rgba(224,181,111,.45)}
.ivory .pill{background:rgba(185,121,53,.1);color:var(--copper2);border-color:rgba(185,121,53,.35)}
.bdg{display:inline-block;font-size:17px;font-weight:800;border-radius:7px;padding:4px 10px;white-space:nowrap;line-height:1.35;letter-spacing:.01em}
.bdg.real{background:#2f978d;color:#fff}.bdg.ai{background:rgba(15,18,22,.78);color:#f4f1ec;border:1px solid rgba(255,255,255,.25)}.bdg.co{background:#b97935;color:#fff}
.bdg.idea{background:#f3ede3;color:#6c5a3c}.bdg.calc{background:rgba(210,164,95,.18);color:#8a5a1f;border:1px solid rgba(185,121,53,.4)}.bdg.plan{background:rgba(63,133,133,.16);color:#2f6f6a;border:1px solid rgba(63,133,133,.4)}
.bdg.ex{background:rgba(255,255,255,.1);color:var(--ink2);border:1px solid rgba(255,255,255,.2)}
.photo{position:relative;border-radius:20px;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.45);margin:0;background:#222}
.photo img{width:100%;height:100%;object-fit:cover;display:block;transform-origin:50% 50%}
.photo .bdg{position:absolute;left:16px;top:16px}
.photo figcaption{position:absolute;left:0;right:0;bottom:0;padding:46px 22px 16px;background:linear-gradient(transparent,rgba(10,14,18,.85));color:#f4f1ec;font-size:22px;font-weight:650;line-height:1.4}
.art{position:relative;border-radius:20px;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.45);margin:0;background:#fff;container-type:inline-size}
.art .aimg{position:absolute;inset:0;overflow:hidden}
.art .aimg img{width:100%;height:100%;display:block;transform-origin:50% 50%}
.art .bdg{position:absolute;right:14px;top:14px}
.fix{position:absolute;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:850;line-height:1.18;color:#1d2b3a;background:#f3fdf7;letter-spacing:-.02em}
.dev{display:inline-block}
.devlab{display:flex;align-items:center;gap:12px;font-size:22px;font-weight:700;color:var(--ink2);margin:0 0 14px 4px}
.ivory .devlab{color:rgba(23,27,32,.7)}
.phone{display:inline-block;border:14px solid #08090b;border-radius:54px;background:#08090b;box-shadow:0 40px 90px rgba(0,0,0,.55),0 0 0 2px rgba(255,255,255,.09)}
.phone .scr{position:relative;border-radius:40px;overflow:hidden;background:#fff}
.phone .island{position:absolute;top:9px;left:50%;width:92px;height:25px;margin-left:-46px;border-radius:14px;background:#08090b;z-index:6}
.stack{position:absolute;inset:0}
.stack img{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
.browser{display:inline-block;border-radius:16px;overflow:hidden;background:#1b2129;box-shadow:0 40px 90px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.12)}
.bbar{height:44px;display:flex;align-items:center;gap:9px;padding:0 18px;background:#1d242d;border-bottom:1px solid rgba(255,255,255,.06)}
.bbar i{width:12px;height:12px;border-radius:50%;background:rgba(255,255,255,.22)}
.bbar .url{margin-left:16px;height:28px;border-radius:8px;background:rgba(255,255,255,.08);color:var(--ink3);font-size:16px;font-weight:600;padding:0 16px;line-height:28px;white-space:nowrap}
.cam{position:relative;overflow:hidden;background:#f6f7f9}
.cam .inner{position:absolute;left:0;top:0}
.mk{position:absolute;border:4px solid #e0b56f;border-radius:12px;box-shadow:0 0 0 3px rgba(15,18,22,.5),0 10px 28px rgba(0,0,0,.25);opacity:0;z-index:4}
.mk b{position:absolute;left:-21px;top:-21px;width:40px;height:40px;border-radius:50%;background:#e0b56f;color:#171b20;font:800 22px/40px P;text-align:center;box-shadow:0 0 0 3px rgba(15,18,22,.6)}
.tap{position:absolute;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;background:rgba(255,255,255,.32);border:3px solid rgba(224,181,111,.95);opacity:0;z-index:5}
.cur{position:absolute;width:34px;height:34px;margin:-2px 0 0 -4px;z-index:8;opacity:0;filter:drop-shadow(0 4px 6px rgba(0,0,0,.35))}
.cur svg{position:absolute;left:0;top:0}
.cur u{position:absolute;left:-26px;top:-26px;width:60px;height:60px;border-radius:50%;border:3px solid rgba(224,181,111,.95);opacity:0}
.term{background:#0d1117;color:#cfe0d8;border-radius:14px;padding:18px 24px;font:500 21px/1.6 "DejaVu Sans Mono",monospace;border:1px solid rgba(255,255,255,.1)}
.term .y{color:#e8c995}
.logo{width:132px;height:132px;border-radius:34px;background:#f4f1ec;color:#171b20;font:900 72px/132px P;text-align:center;position:relative}
.logo i{position:absolute;right:20px;bottom:20px;width:18px;height:18px;border-radius:50%;background:#2f978d}
.steps{display:flex;flex-direction:column;gap:18px}
.step{display:flex;align-items:center;gap:22px;font-size:40px;font-weight:760;color:var(--ink3);padding:16px 26px;border-radius:16px;border:1px solid transparent;letter-spacing:-.6px}
.step i{font-style:normal;width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.08);color:var(--ink3);font:800 26px/54px P;text-align:center;flex:none}
.step.on{background:rgba(255,255,255,.07);border-color:rgba(224,181,111,.55);color:var(--ink)}
.step.on i{background:var(--gold);color:#171b20}
.step.done{color:var(--ink2)}.step.done i{background:rgba(47,151,141,.55);color:#fff}
#sub{position:absolute;left:170px;right:170px;bottom:68px;display:flex;justify-content:center;z-index:100;pointer-events:none}
#sub span{max-width:1500px;padding:13px 30px;border-radius:18px;background:rgba(10,14,18,.78);border:1px solid rgba(255,255,255,.08);font-size:52px;font-weight:700;line-height:1.36;color:#f4f1ec;text-align:center;letter-spacing:-.6px;white-space:pre-line}
#sub b{color:#e8c995;font-weight:800}
"""

JS = r"""
const cl=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)),eo=x=>1-Math.pow(1-x,3),eio=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2,
q5=x=>x<.5?16*x*x*x*x*x:1-Math.pow(-2*x+2,5)/2,so=x=>Math.sin(x*Math.PI/2),R=Math.round;
const SC=[...document.querySelectorAll('.scene')].map(e=>({e,a:+e.dataset.start,b:+e.dataset.end}));
const IN=[...document.querySelectorAll('[data-in]')].map(e=>({e,t:+e.dataset.in,fx:e.dataset.fx||'up',d:+(e.dataset.dur||0)}));
const WIN=[...document.querySelectorAll('[data-show]')].map(e=>{const[a,b]=e.dataset.show.split(',').map(Number);return{e,a,b}});
const CAM=[...document.querySelectorAll('[data-cam]')].map(e=>({e,inner:e.firstElementChild,k:JSON.parse(e.dataset.cam),pw:+e.dataset.pw,ph:+e.dataset.ph,cw:e.offsetWidth||+e.style.width.replace('px','')}));
const SEQ=[...document.querySelectorAll('[data-seq]')].map(e=>({e,k:JSON.parse(e.dataset.seq),im:[...e.children]}));
const TAP=[...document.querySelectorAll('[data-tap]')].map(e=>({e,t:+e.dataset.tap}));
const CUR=[...document.querySelectorAll('[data-cur]')].map(e=>({e,u:e.querySelector('u'),k:JSON.parse(e.dataset.cur)}));
const CNT=[...document.querySelectorAll('[data-count]')].map(e=>({e,v:+e.dataset.count,t:+e.dataset.at,d:+(e.dataset.dur||1.4)}));
const ON=[...document.querySelectorAll('[data-on]')].map(e=>{const[a,b]=e.dataset.on.split(',').map(Number);return{e,a,b}});
const KB=[...document.querySelectorAll('.kb')].map(e=>{const s=e.closest('.scene');return{e,a:+s.dataset.start,b:+s.dataset.end,z:+(e.dataset.z||0.04)}});
const SUB=window.SUBS,subEl=document.getElementById('sub');let subCur=null;
function seek(t){
  for(const s of SC){const vis=t>=s.a&&t<s.b+0.55;s.e.style.display=vis?'block':'none';if(vis)s.e.style.opacity=s.a<=0?1:eio(cl((t-s.a)/0.55))}
  for(const x of IN){const s=x.e.style,dt=t-x.t;
    if(x.fx==='up'){const d=x.d||0.6;s.opacity=so(cl(dt/0.18));s.transform=`translateY(${R((1-eo(cl(dt/d)))*26)}px)`}
    else if(x.fx==='card'){const d=x.d||0.75;s.opacity=so(cl(dt/0.3));const p=eo(cl(dt/d));s.transform=`translateY(${R((1-p)*40)}px) scale(${(0.97+0.03*p).toFixed(4)})`}
    else if(x.fx==='fade'){s.opacity=eo(cl(dt/(x.d||0.5)))}
    else if(x.fx==='photo'){s.opacity=eo(cl(dt/(x.d||0.45)))}
    else if(x.fx==='left'){const d=x.d||0.7;s.opacity=so(cl(dt/0.2));s.transform=`translateX(${R((1-eo(cl(dt/d)))*-40)}px)`}
    else if(x.fx==='right'){const d=x.d||0.7;s.opacity=so(cl(dt/0.2));s.transform=`translateX(${R((1-eo(cl(dt/d)))*40)}px)`}
    else if(x.fx==='wipe'){const p=eio(cl(dt/(x.d||0.9)));s.opacity=dt>0?1:0;s.clipPath=`inset(-20px ${((1-p)*100).toFixed(2)}% -20px -20px)`}
    else if(x.fx==='wipev'){const p=eio(cl(dt/(x.d||0.9)));s.opacity=dt>0?1:0;s.clipPath=`inset(-20px -20px ${((1-p)*100).toFixed(2)}% -20px)`}
    else if(x.fx==='mk'){s.opacity=eo(cl(dt/0.3))}
  }
  for(const w of WIN){const o=cl((t-w.a)/0.45)*cl((w.b-t)/0.45);w.e.style.opacity=eio(o);w.e.style.display=o>0?'':'none'}
  for(const x of ON){x.e.classList.toggle('on',t>=x.a&&t<x.b);x.e.classList.toggle('done',t>=x.b)}
  for(const q of SEQ){let cur=0;for(let i=0;i<q.k.length;i++)if(t>=q.k[i][0])cur=i;
    q.im.forEach((im,i)=>{let o=0;if(i===cur)o=cur===0?1:eio(cl((t-q.k[cur][0])/0.4));else if(i===cur-1)o=1;im.style.opacity=o;im.style.zIndex=i===cur?2:1})}
  for(const c of CAM){const k=c.k;let b=k[0];
    if(t>=k[k.length-1][0])b=k[k.length-1];else for(let i=0;i<k.length-1;i++){if(t>=k[i][0]&&t<k[i+1][0]){const lin=k[i+1][4]==='l';const p=lin?eio((t-k[i][0])/(k[i+1][0]-k[i][0])):q5((t-k[i][0])/(k[i+1][0]-k[i][0]));b=[0,1,2,3].map(j=>k[i][j]+(k[i+1][j]-k[i][j])*p);break}}
    const sc=c.cw/b[3];c.inner.style.width=R(c.pw*sc)+'px';c.inner.style.height=R(c.ph*sc)+'px';c.inner.style.left=R(-b[1]*sc)+'px';c.inner.style.top=R(-b[2]*sc)+'px'}
  for(const x of TAP){const p=(t-x.t)/0.6;const s=x.e.style;if(p<0||p>1){s.opacity=0}else{s.opacity=(0.95*(1-p)).toFixed(3);s.transform=`scale(${(0.4+0.9*eo(p)).toFixed(3)})`}}
  for(const c of CUR){const k=c.k,s=c.e.style;if(t<k[0][0]-0.5){s.opacity=0;continue}
    let x=k[0][1],y=k[0][2],click=-9;
    for(let i=0;i<k.length;i++){if(t>=k[i][0]){x=k[i][1];y=k[i][2];if(k[i][3])click=k[i][0]+0.12}
      if(i<k.length-1&&t>=k[i][0]&&t<k[i+1][0]){const mv=Math.min(0.85,k[i+1][0]-k[i][0]-0.15);const st=k[i+1][0]-mv;if(t>st){const p=q5((t-st)/mv);const dx=k[i+1][1]-k[i][1],dy=k[i+1][2]-k[i][2];const arc=Math.sin(Math.PI*p)*0.1;x=k[i][1]+dx*p-dy*arc;y=k[i][2]+dy*p+dx*arc}}}
    const last=k[k.length-1][0];s.opacity=cl((t-k[0][0]+0.5)/0.3)*cl((last+1.6-t)/0.4);s.left=x.toFixed(3)+'%';s.top=y.toFixed(3)+'%';
    const cp=t-click;s.transform=cp>=0&&cp<0.18?'scale(0.88)':'none';const u=c.u.style;if(cp>=0&&cp<0.45){const p=cp/0.45;u.opacity=(1-p).toFixed(3);u.transform=`scale(${(0.3+0.9*eo(p)).toFixed(3)})`}else u.opacity=0}
  for(const c of CNT){const p=eo(cl((t-c.t)/c.d));c.e.textContent=Math.round(c.v*p).toLocaleString()}
  for(const k of KB){const p=cl((t-k.a)/Math.max(1,k.b-k.a));k.e.style.transform=`scale(${(1+k.z*p).toFixed(4)})`}
  let cur=null;for(const s of SUB){if(t>=s.in&&t<s.out){cur=s;break}}
  if(cur){if(subCur!==cur){subEl.innerHTML='<span>'+cur.text.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')+'</span>';subCur=cur}subEl.style.opacity=((cur.fi?cl((t-cur.in)/0.12):1)*(cur.fo?cl((cur.out-t)/0.12):1)).toFixed(3);subEl.style.display=''}
  else{subEl.style.display='none';subCur=null}
}
window.seek=seek;
"""


def page(scenes_html: str, subs) -> str:
    return ("<!doctype html><html lang='ko'><head><meta charset='utf-8'><style>" + CSS.replace("%FONT%", uri(FONT)) + "</style></head><body>"
            + scenes_html + "<div id='sub'></div><script>window.SUBS=" + json.dumps(subs, ensure_ascii=False) + ";" + JS + "</script></body></html>")
