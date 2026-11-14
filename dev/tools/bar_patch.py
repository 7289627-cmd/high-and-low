p='/home/claude/hl/src/main.js';s=open(p).read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n,(a[:70],s.count(a));s=s.replace(a,b)
# ---- range bar: a ruler that gets chopped and zooms back in ----
i=s.index("let hpPrev={},hpGid='';");j=s.index("function cardHTML(p,i){")
s=s[:i]+r'''let hpPrev={},hpGid='';
function hpHTML(pid,v,z){
  if(hpGid!==G.gid){hpGid=G.gid;hpPrev={}}
  const n=v.hi-v.lo+1;
  let st=hpPrev[pid];if(!st)st=hpPrev[pid]={lo:v.lo,hi:v.hi,plo:v.lo,phi:v.hi,at:0};
  if(st.lo!==v.lo||st.hi!==v.hi){st.plo=st.lo;st.phi=st.hi;st.lo=v.lo;st.hi=v.hi;st.at=Date.now()}
  const el=Date.now()-st.at,pn=st.phi-st.plo+1,cut=pn-n,live=el<1700&&cut>0;
  const frac=Math.log(n)/Math.log(Math.max(G.max,2)),tone=z?'hot':frac>0.66?'ok':frac>0.38?'mid':'low';
  const d=`animation-delay:-${el}ms`;
  const cl=live?(v.lo-st.plo)/pn*100:0,cr=live?(st.phi-v.hi)/pn*100:0;
  const seg=(side,w)=>w>0?`<i class="cut ${side}" style="--w:${Math.max(4,w).toFixed(2)}%;${d}"></i>`:'';
  let mid;
  if(z){
    const xs=myXs(v);let pips='';
    for(let k=v.lo;k<=v.hi;k++)pips+=`<i class="pip ${xs.includes(k)?'x':''}"></i>`;
    mid=`<span class="rb-pips">${pips}</span>`;
  }else mid=`<i class="keep"><em>${fmt(n)} left</em></i>`;
  return `<span class="rb ${tone} ${live?'live':''}"><span class="rb-ends"><b class="${live&&cl>0?'pop':''}" style="${d}">${fmt(v.lo)}</b><b class="${live&&cr>0?'pop':''}" style="${d}">${fmt(v.hi)}</b></span><span class="rb-track">${seg('l',cl)}${mid}${seg('r',cr)}</span>${live?`<b class="dmg" style="${d}">−${fmt(cut)}</b>`:''}</span>`;
}
'''+s[j:]
rep("""`<span class="rng"><b>${fmt(v.lo)} – ${fmt(v.hi)}</b></span>
${hpHTML(p.pid,v,z)}
${z?`<span class="zone">${leftX(v)} LEFT</span>`:`<span class="left"><b>${fmt(v.hi-v.lo+1)} left</b></span>`}`}""","""`${hpHTML(p.pid,v,z)}${z?`<span class="zone">${leftX(v)} LEFT</span>`:''}`}""")
# ---- hold-to-repeat that can never run away ----
i=s.index("  $$('.key.nb').forEach(b=>{let h=null,iv=null;");j=s.index("\n",i)
s=s[:i]+"  $$('.key.nb').forEach(b=>{b.onpointerdown=()=>{nbStop();const k=b.dataset.k;nbN=0;nbTimer=setTimeout(()=>{nbIv=setInterval(()=>{if(++nbN>300||!document.querySelector('.key.nb')){nbStop();return}padPress(k)},60)},380)};b.onpointerleave=nbStop});"+s[j:]
rep("let sldDown=false,sldPend=false;","""let nbTimer=null,nbIv=null,nbN=0;
function nbStop(){clearTimeout(nbTimer);clearInterval(nbIv);nbTimer=nbIv=null}
['pointerup','pointercancel','blur','contextmenu'].forEach(t=>window.addEventListener(t,nbStop,true));
document.addEventListener('visibilitychange',nbStop);
let sldDown=false,sldPend=false;""")
# ---- clock keeps its sway across re-renders ----
rep("""<span class="tclock ${v<6?'low':''}" style="--f:${f.toFixed(3)}" """,""" <span class="tclock ${v<6?'low':''}" style="--f:${f.toFixed(3)};${ph(v<6?0.28:3.6,0)}" """.strip()+" ")
# ---- guess grid columns follow the size of the numbers ----
rep("""<div class="guess-grid big n${btns.length}">""","""<div class="guess-grid big n${btns.length} ${fmt(tv.hi).length>=7?'c2':fmt(tv.hi).length>=5?'c3':''}">""")
open(p,'w').write(s)
open('/home/claude/hl/src/ui2.css','a').write('''
/* ---- range bar: a ruler that gets chopped ---- */
.rb{display:block;position:relative;width:100%}
.rb-ends{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-family:var(--display);font-variant-numeric:tabular-nums;line-height:1.05;margin-bottom:3px}
.rb-ends b{font-weight:400;font-size:15px;white-space:nowrap}
.rb-ends b.pop{animation:rbPop 1.7s ease-out both;color:var(--red)}
@keyframes rbPop{0%,30%{scale:1;color:var(--ink)}42%{scale:1.5;color:var(--red)}60%,85%{scale:1.15;color:var(--red)}100%{scale:1;color:var(--ink)}}
.rb-track{display:flex;height:24px;border:3px solid var(--ink);border-radius:9px;background:var(--paper-2);overflow:hidden;box-shadow:0 3px 0 var(--ink)}
.rb .keep{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;background:var(--green);transition:background .3s}
.rb.mid .keep{background:var(--yellow)}.rb.low .keep{background:var(--red)}
.rb .keep em{font-style:normal;font-family:var(--body);font-weight:800;font-size:12px;color:var(--ink);white-space:nowrap;background:rgba(255,255,255,.72);border-radius:99px;padding:0 7px;line-height:16px}
.rb .cut{flex:none;width:0;background:repeating-linear-gradient(135deg,var(--red) 0 7px,#C9382A 7px 14px);animation:rbCut 1.7s cubic-bezier(.6,0,.3,1) both}
.rb .cut.l{border-right:3px solid var(--ink)}.rb .cut.r{border-left:3px solid var(--ink)}
@keyframes rbCut{0%{width:var(--w);filter:brightness(1.6)}10%{filter:none}20%{filter:brightness(1.6)}30%,45%{width:var(--w);filter:none}100%{width:0;border-width:0}}
.rb-pips{flex:1;display:flex;gap:3px;padding:3px;background:var(--paper)}
.rb-pips .pip{flex:1;border-radius:4px;background:var(--red);border:2px solid var(--ink);animation:hppulse .7s ease-in-out infinite alternate}
.rb-pips .pip.x{background:var(--paper-2);opacity:.5;animation:none}
.rb .dmg{position:absolute;right:0;top:auto;bottom:-20px;font-family:var(--display);font-size:15px;line-height:1;color:var(--red);-webkit-text-stroke:3px var(--white);paint-order:stroke fill;white-space:nowrap;pointer-events:none;animation:hpdmg 1.7s ease-out both;z-index:2}
.cast.duel .card .rb-ends b{font-size:24px}
.cast.duel .card .rb-track{height:34px;border-radius:12px;border-width:4px}
.cast.duel .card .rb .keep em{font-size:15px;line-height:22px;padding:0 10px}
.cast.duel .card .rb-pips{gap:5px;padding:4px}
.cast.duel .card .rb .dmg{font-size:22px;bottom:-28px}
.cast.duel .card .zone{margin-top:8px}
@media (prefers-reduced-motion:reduce){.rb .cut{display:none}.rb-ends b.pop,.rb-pips .pip{animation:none}}
/* ---- target ring follows the card's corners ---- */
.card.is-target{outline:0;border-color:var(--red);box-shadow:0 0 0 3px var(--red),0 6px 0 3px var(--red)}
/* ---- final-ten grid fits long numbers ---- */
.guess-grid.big.c3{grid-template-columns:repeat(3,minmax(0,1fr))}
.guess-grid.big.c2{grid-template-columns:repeat(2,minmax(0,1fr))}
.guess-grid.big.c2 .g,.guess-grid.big.c3 .g{min-height:54px;font-size:clamp(18px,5.6vw,26px);white-space:nowrap}
''')
print('ok')
