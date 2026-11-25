"""영상 플레이어 HTML의 디자인(CSS)과 시간 이동(seek) 스크립트"""
from player_lib import FONT, uri

CSS = """
@font-face{font-family:P;src:url(%FONT%) format('woff2-variations');font-weight:45 920}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1920px;height:1080px;overflow:hidden;background:#0d1b26;font-family:P,sans-serif;word-break:keep-all;color:#18242d}
.scene{position:absolute;inset:0;display:none;overflow:hidden;background:#f3f5f4}
.scene.dark{background:radial-gradient(1400px 900px at 70% 30%,#173a52,#0c1d2a);color:#fff}
.bgph{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.22}
.hdr{position:absolute;left:64px;right:64px;top:30px;display:flex;align-items:center;gap:14px;z-index:6}
.logo{display:flex;align-items:center;gap:12px}
.logo .lm{width:46px;height:46px;border-radius:13px;background:#10283a;color:#fff;font:900 25px/46px P;text-align:center;position:relative}
.logo .lm i{position:absolute;right:7px;bottom:7px;width:8px;height:8px;border-radius:50%;background:#4fd1b5}
.logo b{font-size:22px;font-weight:850;color:#10283a;letter-spacing:-.3px}
.logo small{display:block;font-size:14px;color:#75818a;font-weight:650;margin-top:1px}
.dark .logo .lm{background:#fff;color:#10283a}.dark .logo b{color:#fff}.dark .logo small{color:#9fb3c2}
.chaps{margin-left:auto;display:flex;gap:8px}
.chaps span{font-size:16px;font-weight:760;padding:7px 15px;border-radius:99px;background:#e3e9e7;color:#7d8890}
.chaps span.on{background:#127566;color:#fff}
.dark .chaps span{background:rgba(255,255,255,.1);color:#9fb3c2}.dark .chaps span.on{background:#127566;color:#fff}
.kicker{font-size:25px;font-weight:850;color:#127566;letter-spacing:.5px}
.dark .kicker{color:#6fe0c5}
h1{font-size:66px;line-height:1.22;font-weight:880;letter-spacing:-2px;color:#10283a}
h2{font-size:50px;line-height:1.24;font-weight:870;letter-spacing:-1.5px;color:#10283a}
h3{font-size:32px;font-weight:850;color:#10283a;letter-spacing:-.6px;line-height:1.3}
em{font-style:normal;color:#127566}
.red{color:#c0442c}
.dark h1,.dark h2,.dark h3{color:#fff}.dark em{color:#6fe0c5}
.ttl{position:absolute;left:96px;top:112px;right:96px}
.ttl .kicker{margin-bottom:8px}
.abs{position:absolute}
.pc{background:#fff;border-radius:18px;box-shadow:0 22px 60px rgba(16,40,58,.20);overflow:hidden;border:1px solid #d5dcdf;display:inline-block}
.wbar{display:flex;align-items:center;gap:8px;height:46px;padding:0 16px;background:#f1f4f3;border-bottom:1px solid #d9dfe2;font-size:17px;color:#43505a}
.wbar i{width:12px;height:12px;border-radius:50%;background:#d0d7da}
.wbar b{font-weight:800;color:#18242d;margin-left:4px}.wbar span{margin-left:auto;color:#75818a;font-weight:700}
.phone{background:#18232c;border-radius:46px;padding:12px 12px 16px;box-shadow:0 22px 60px rgba(16,40,58,.30);display:inline-block}
.phone .pbar{display:flex;align-items:center;gap:8px;color:#c9d3da;font-size:15px;padding:4px 12px 10px}
.phone .pbar b{color:#fff}.phone .pbar span{margin-left:auto;font-weight:700}
.phone .cam{border-radius:30px}
.fcap{font-size:19px;font-weight:700;color:#43505a;padding:12px 16px;background:#fff;border-top:1px solid #e1e6e8;line-height:1.4}
.phone .fcap{background:transparent;color:#d9e3ea;border:0;padding:10px 8px 0;font-size:17px}
.cam{position:relative;overflow:hidden;background:#fff}
.cam .inner{position:absolute;left:0;top:0;transform-origin:0 0}
.cam .inner img{width:100%;height:100%;display:block}
.mk{position:absolute;border:5px solid #e23b2e;border-radius:12px;opacity:0}
.mk b{position:absolute;left:-21px;top:-21px;width:38px;height:38px;border-radius:50%;background:#e23b2e;color:#fff;font:850 22px/38px P;text-align:center;box-shadow:0 0 0 3px #fff}
.tap{position:absolute;width:96px;height:96px;margin:-48px 0 0 -48px;border-radius:50%;background:rgba(226,59,46,.28);border:5px solid rgba(226,59,46,.95);opacity:0}
.bdg{display:inline-block;font-size:14px;font-weight:850;border-radius:6px;padding:3px 9px;white-space:nowrap;line-height:1.4}
.bdg.real{background:#127566;color:#fff}.bdg.ai{background:rgba(16,40,58,.82);color:#fff}.bdg.idea{background:#f3f0ea;color:#6c5a3c}
.bdg.co{background:#c48a12;color:#fff}.bdg.calc{background:#fcefea;color:#c0442c;border:1px solid #f1c9bd}.bdg.plan{background:#ecf2fc;color:#2f5fb3}
.photo{position:relative;border-radius:22px;overflow:hidden;box-shadow:0 22px 60px rgba(16,40,58,.25);margin:0}
.photo img{width:100%;height:100%;object-fit:cover;display:block;transform-origin:50% 50%}
.photo .bdg{position:absolute;left:16px;top:16px}
.photo figcaption{position:absolute;left:0;right:0;bottom:0;padding:50px 24px 20px;background:linear-gradient(transparent,rgba(10,25,36,.86));color:#fff;font-size:23px;font-weight:720;line-height:1.4}
.art{position:relative;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 22px 60px rgba(16,40,58,.18);margin:0;container-type:inline-size}
.art .bdg{position:absolute;right:16px;top:16px}
.art figcaption{font-size:19px;font-weight:650;color:#43505a;padding:12px 18px;border-top:1px solid #e1e6e8}
.fix{position:absolute;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:820;line-height:1.22;color:#1d2b36}
.card{background:#fff;border-radius:22px;padding:28px 32px;box-shadow:0 12px 34px rgba(16,40,58,.10);border:1px solid #e1e6e8}
.card.n{background:#10283a;color:#fff;border-color:#10283a}.card.n h3{color:#fff}
.card.r{background:#fff7f4;border-color:#f1c9bd}.card.t{background:#f0f8f5;border-color:#c4e1d8}
.card p{font-size:26px;line-height:1.5;color:#43505a}
.card.n p{color:#cfdbe3}
.chip{display:inline-flex;align-items:center;gap:12px;background:#fff;border-radius:16px;padding:18px 26px;font-size:30px;font-weight:800;color:#10283a;box-shadow:0 10px 28px rgba(16,40,58,.12);border:1px solid #e1e6e8}
.chip.r{background:#fff4f0;color:#c0442c;border-color:#f1c9bd}.chip.t{background:#e9f6f2;color:#0c5a4f;border-color:#c4e1d8}.chip.n{background:#10283a;color:#fff;border-color:#10283a}
.chip i{font-style:normal;font-size:20px;font-weight:850;color:#fff;background:#127566;border-radius:10px;padding:4px 10px}
.chip.r i{background:#c0442c}
.arrow{font-size:46px;font-weight:900;color:#127566;line-height:1}
.arrow.r{color:#c0442c}
.flowh{display:flex;align-items:center;gap:18px}
.flowv{display:flex;flex-direction:column;gap:16px}
.stepl{display:flex;flex-direction:column;gap:12px}
.stepl div{display:flex;align-items:center;gap:16px;font-size:34px;font-weight:760;color:#9aa4ab;padding:12px 20px;border-radius:14px}
.stepl div i{font-style:normal;width:44px;height:44px;border-radius:50%;background:#e3e9e7;color:#7d8890;font:850 22px/44px P;text-align:center}
.stepl div.on{background:#fff;color:#10283a;box-shadow:0 10px 26px rgba(16,40,58,.12)}
.stepl div.on i{background:#127566;color:#fff}
.stepl div.done{color:#43505a}.stepl div.done i{background:#c4e1d8;color:#0c5a4f}
.big{font-size:120px;font-weight:900;letter-spacing:-4px;line-height:1}
.secnum{font-size:180px;font-weight:900;color:#6fe0c5;line-height:1;letter-spacing:-6px}
.note{font-size:20px;color:#75818a;font-weight:650}
.dark .note{color:#9fb3c2}
.site{background:#fff;border-radius:22px;padding:26px 30px;box-shadow:0 12px 30px rgba(16,40,58,.12);border:2px solid #e1e6e8;width:480px}
.site h4{font-size:40px;font-weight:880;color:#10283a}
.site .tm{font-size:31px;font-weight:760;color:#43505a;margin-top:6px}
.site .st{font-size:33px;font-weight:880;margin-top:10px}
.travel{font-size:26px;font-weight:800;color:#0c5a4f;background:#e9f6f2;border-radius:99px;padding:8px 20px;white-space:nowrap}
.term{background:#0f1f2b;color:#cfe0d8;border-radius:18px;padding:24px 30px;font:500 21px/1.65 "DejaVu Sans Mono",monospace;box-shadow:0 22px 60px rgba(16,40,58,.25)}
.term .y{color:#ffcf7a}.term .g{color:#6fe0c5}
#sub{position:absolute;left:50%;bottom:34px;transform:translateX(-50%);width:max-content;max-width:1640px;background:rgba(9,20,30,.84);color:#fff;font-size:35px;font-weight:650;line-height:1.42;padding:13px 32px 15px;border-radius:16px;text-align:center;z-index:50;letter-spacing:-.3px;display:none}
"""

JS = r"""
const cl=x=>Math.max(0,Math.min(1,x)), eo=p=>1-Math.pow(1-p,3), ez=p=>p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
const SC=[...document.querySelectorAll('.scene')].map(e=>({e,a:+e.dataset.start,b:+e.dataset.end}));
const IN=[...document.querySelectorAll('[data-in]')].map(e=>({e,t:+e.dataset.in,fx:e.dataset.fx||'up',d:+(e.dataset.dur||0.6)}));
const WIN=[...document.querySelectorAll('[data-show]')].map(e=>{const[a,b]=e.dataset.show.split(',').map(Number);return{e,a,b}});
const CAM=[...document.querySelectorAll('[data-cam]')].map(e=>({e,inner:e.firstElementChild,k:JSON.parse(e.dataset.cam),ar:+e.dataset.ar,cw:+e.dataset.cw}));
const TAP=[...document.querySelectorAll('[data-tap]')].map(e=>({e,t:+e.dataset.tap}));
const CNT=[...document.querySelectorAll('[data-count]')].map(e=>({e,v:+e.dataset.count,t:+e.dataset.at,d:+(e.dataset.dur||1.4)}));
const ON=[...document.querySelectorAll('[data-on]')].map(e=>{const[a,b]=e.dataset.on.split(',').map(Number);return{e,a,b}});
const KB=[...document.querySelectorAll('.kb')].map(e=>{const s=e.closest('.scene');return{e,img:e.querySelector('img')||e,a:+s.dataset.start,b:+s.dataset.end,z:+(e.dataset.z||0.06)}});
const SUB=window.SUBS, subEl=document.getElementById('sub');
function seek(t){
  for(const s of SC){const vis=t>=s.a&&t<s.b+0.5;s.e.style.display=vis?'block':'none';if(vis)s.e.style.opacity=s.a<=0?1:cl((t-s.a)/0.5);}
  for(const x of IN){const p=eo(cl((t-x.t)/x.d)),s=x.e.style;
    if(x.fx==='up'){s.opacity=p;s.transform=`translateY(${(1-p)*34}px)`}
    else if(x.fx==='pop'){s.opacity=p;s.transform=`scale(${0.86+0.14*p})`}
    else if(x.fx==='fade'){s.opacity=p}
    else if(x.fx==='left'){s.opacity=p;s.transform=`translateX(${(1-p)*-60}px)`}
    else if(x.fx==='right'){s.opacity=p;s.transform=`translateX(${(1-p)*60}px)`}
    else if(x.fx==='wipe'){s.opacity=p>0?1:0;s.clipPath=`inset(0 ${(1-p)*100}% 0 0)`}
    else if(x.fx==='mk'){const q=eo(cl((t-x.t)/0.45));s.opacity=q;s.transform=`scale(${1.22-0.22*q})`;
      const pu=t>x.t+0.45?(0.5+0.5*Math.sin((t-x.t)*4.2)):0;s.boxShadow=`0 0 0 ${3+5*pu}px rgba(226,59,46,${0.18+0.25*pu}), 0 0 0 3px rgba(255,255,255,.85) inset`}
  }
  for(const w of WIN){const o=cl((t-w.a)/0.4)*cl((w.b-t)/0.4);w.e.style.opacity=o;w.e.style.display=o>0?'':'none'}
  for(const x of ON){x.e.classList.toggle('on',t>=x.a&&t<x.b);x.e.classList.toggle('done',t>=x.b)}
  for(const c of CAM){const k=c.k;let b=k[0];
    if(t>=k[k.length-1][0])b=k[k.length-1];else for(let i=0;i<k.length-1;i++){if(t>=k[i][0]&&t<k[i+1][0]){const p=ez((t-k[i][0])/(k[i+1][0]-k[i][0]));b=k[i].map((v,j)=>v+(k[i+1][j]-v)*p);break}}
    const iw=c.cw/b[3],ih=iw*c.ar;c.inner.style.width=iw+'px';c.inner.style.height=ih+'px';c.inner.style.left=(-b[1]*iw)+'px';c.inner.style.top=(-b[2]*ih)+'px'}
  for(const x of TAP){const p=(t-x.t)/0.9;const s=x.e.style;if(p<0||p>1){s.opacity=0}else{s.opacity=0.95*(1-p);s.transform=`scale(${0.35+1.1*p})`}}
  for(const c of CNT){const p=eo(cl((t-c.t)/c.d));c.e.textContent=Math.round(c.v*p).toLocaleString()}
  for(const k of KB){const p=cl((t-k.a)/(k.b-k.a));k.img.style.transform=`scale(${1+k.z*p}) translate(${-1.2*p}%,${-0.6*p}%)`}
  let cur=null;for(const s of SUB){if(t>=s[0]-0.05&&t<s[1])cur=s}
  if(cur&&cur[2]){subEl.style.display='block';subEl.textContent=cur[2];subEl.style.opacity=cl((t-cur[0]+0.05)/0.2)}else subEl.style.display='none';
}
window.seek=seek;
"""


def page(scenes_html: str, subs) -> str:
    import json
    return ("<!doctype html><html lang='ko'><head><meta charset='utf-8'><style>" + CSS.replace("%FONT%", uri(FONT)) + "</style></head><body>"
            + scenes_html + "<div id='sub'></div><script>window.SUBS=" + json.dumps(subs, ensure_ascii=False) + ";" + JS + "</script></body></html>")
