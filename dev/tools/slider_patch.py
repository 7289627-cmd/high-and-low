p='/home/claude/hl/src/main.js';s=open(p).read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n,(a[:70],s.count(a));s=s.replace(a,b)
# ---- slider helpers (replace rulerHTML) ----
i=s.index("function rulerHTML(t,sl){");j=s.index("function askRowHTML(f,fv){")
s=s[:i]+r'''/* The asking slider. x is always a whole number inside the allowed range for the chosen direction. */
function askX(){
  const t=curTarget();if(!t)return null;
  const sl=askSlots(mv(t));if(!ui.num)return null;
  const x=Number(sl.prefix+ui.num);
  return Number.isInteger(x)?Math.min(sl.hi,Math.max(sl.lo,x)):null;
}
function setAskX(x){
  const t=curTarget();if(!t)return;
  const sl=askSlots(mv(t));x=Math.min(sl.hi,Math.max(sl.lo,Math.round(x)));
  const str=String(x);ui.num=sl.prefix&&str.startsWith(sl.prefix)&&str.length===sl.n?str.slice(sl.prefix.length):str;ui.err='';
}
function askMid(tv){return ui.dir==='l'?Math.ceil((tv.lo+tv.hi+1)/2):Math.floor((tv.lo+tv.hi-1)/2)}
function sliderParts(tv,x){
  const T=tv.hi-tv.lo+1,hiMode=ui.dir!=='l';
  const leftN=Math.min(T-1,Math.max(1,hiMode?x-tv.lo+1:x-tv.lo)),cut=tv.lo+leftN;
  const rg=(a,b)=>a===b?fmt(a):fmt(a)+' – '+fmt(b);
  return{T,leftN,f:leftN/T,lc:hiMode?'no':'yes',rc:hiMode?'yes':'no',lt:rg(tv.lo,cut-1),rt:rg(cut,tv.hi)};
}
function sliderHTML(tv){
  const x=askX();if(x===null)return '';
  const q=sliderParts(tv,x),seg=(c,fl,fr)=>`<i class="${c} ${fr<0.17?'tiny':''}" style="flex:${fl} 1 0"><em>${c.toUpperCase()}</em></i>`;
  return `<div class="sld" id="sld" role="slider" tabindex="0" aria-label="Number" aria-valuemin="${askSlots(tv).lo}" aria-valuemax="${askSlots(tv).hi}" aria-valuenow="${x}">
<div class="sld-track" id="sldTrack">${seg(q.lc,q.leftN,q.f)}${seg(q.rc,q.T-q.leftN,1-q.f)}<b class="sld-thumb" id="sldThumb" style="left:${(q.f*100).toFixed(3)}%"></b></div>
<div class="rl-caps"><span class="${q.lc}" id="sldL">${q.lt}</span><span class="${q.rc}" id="sldR">${q.rt}</span></div></div>`;
}
/* Repaint the slider in place while dragging, so the finger never loses the thumb. */
function sliderPaint(){
  const t=curTarget(),x=askX();if(!t||x===null)return;
  const tv=mv(t),q=sliderParts(tv,x),tr=$('#sldTrack');if(!tr)return;
  const segs=tr.querySelectorAll('i');
  if(segs[0]){segs[0].style.flex=q.leftN+' 1 0';segs[0].classList.toggle('tiny',q.f<0.17)}
  if(segs[1]){segs[1].style.flex=(q.T-q.leftN)+' 1 0';segs[1].classList.toggle('tiny',1-q.f<0.17)}
  const th=$('#sldThumb');if(th)th.style.left=(q.f*100).toFixed(3)+'%';
  const l=$('#sldL'),r=$('#sldR');if(l)l.textContent=q.lt;if(r)r.textContent=q.rt;
  const bn=$('#bigNum');if(bn)bn.textContent=fmt(x);
  const sd=$('#sld');if(sd)sd.setAttribute('aria-valuenow',x);
}
let sldTickAt=0;
function sliderBind(){
  const sd=$('#sld'),tr=$('#sldTrack');if(!sd||!tr)return;
  const at=e=>{
    const t=curTarget();if(!t)return;
    const tv=mv(t),r=tr.getBoundingClientRect(),T=tv.hi-tv.lo+1;
    const f=Math.min(1,Math.max(0,(e.clientX-r.left)/Math.max(1,r.width)));
    const leftN=Math.min(T-1,Math.max(1,Math.round(f*T)));
    const before=ui.num;setAskX(ui.dir!=='l'?tv.lo+leftN-1:tv.lo+leftN);
    if(ui.num!==before){sliderPaint();const now=Date.now();if(now-sldTickAt>70){sldTickAt=now;sfx('tick',{vol:0.5,rate:0.9+f*0.5})}}
  };
  let down=false;
  sd.onpointerdown=e=>{down=true;try{sd.setPointerCapture(e.pointerId)}catch(_){}sd.classList.add('drag');at(e);e.preventDefault()};
  sd.onpointermove=e=>{if(down)at(e)};
  const up=()=>{if(down){down=false;sd.classList.remove('drag');buzz(8)}};
  sd.onpointerup=up;sd.onpointercancel=up;
}
'''+s[j:]
# ask view: big number + slider + nudge row instead of the pad
i=s.index("  const sl=askSlots(tv),lo=sl.lo,hi=sl.hi;\n  return `<section class=\"askv\">${top}");j=s.index("function slotsHTML(str,n,pfx){")
s=s[:i]+r'''  if(!ui.num)setAskX(askMid(tv));
  const x=askX();
  return `<section class="askv">${top}
<div class="say"><span class="spk-bean jit-slow">${charSVG(pv(me),'talk')}</span>
<div class="speech big ${land?'pop':''}"><span>Is it</span> <button class="dirword ${ui.dir==='l'?'lo':'hi'} ${land?'land':''}" id="flipDir" aria-label="Switch to ${ui.dir==='l'?'higher':'lower'}">${word}</button> <span>than</span> <span class="numslot"><span class="bignum" id="bigNum">${fmt(x)}</span><span class="qm">?</span></span></div></div>
${sliderHTML(tv)}
${ui.err?`<p class="err">${esc(ui.err)}</p>`:''}
<div class="nudge"><button class="key nb" data-k="dec" aria-label="One lower">−</button><button class="key mid" data-k="mid">HALF</button><button class="key nb" data-k="inc" aria-label="One higher">+</button></div>
<button class="btn primary big full" id="askGo">Ask!</button>
</section>`;
}
'''+s[j:]
# key logic: mid / inc / dec for the slider
rep("""  else if(k==='mid'){sfx('pick');const t=curTarget();if(t){const tv=mv(t),ms=String(ui.dir==='l'?Math.ceil((tv.lo+tv.hi+1)/2):Math.floor((tv.lo+tv.hi-1)/2));v=sl.prefix&&ms.startsWith(sl.prefix)?ms.slice(sl.prefix.length):ms}}""",
"""  else if(k==='mid'||k==='inc'||k==='dec'){const t=curTarget();if(!t)return;sfx(k==='mid'?'pick':'tick');const cur=askX();setAskX(k==='mid'||cur===null?askMid(mv(t)):cur+(k==='inc'?1:-1));if($('#sldTrack')){sliderPaint();return}render(true);return}""")
rep("ui.dir=b.dataset.pickdir;ui.step='num';ui.num='';","ui.dir=b.dataset.pickdir;ui.step='num';ui.num='';")
rep("  on('askGo',doAsk);","  on('askGo',doAsk);sliderBind();\n  $$('.key.nb').forEach(b=>{let h=null,iv=null;const stop=()=>{clearTimeout(h);clearInterval(iv)};b.onpointerdown=()=>{stop();h=setTimeout(()=>{iv=setInterval(()=>padPress(b.dataset.k),60)},380)};b.onpointerup=stop;b.onpointerleave=stop;b.onpointercancel=stop});")
# ---- friends flow ----
rep("    on('friendsBtn',()=>{ui.friends=!ui.friends;render(true)});",
"""    on('friendsBtn',()=>{
      ui.homeErr='';if(!NAME)NAME=FILL_NAMES[rnd(0,FILL_NAMES.length-1)];
      if(roomState!=='ok'||!roomNS){track('practice');startSolo();return}
      let c='';for(let i=0;i<4;i++)c+=CODE_CHARS[rnd(0,CODE_CHARS.length-1)];track('host');startOnline(true,c)});""")
open(p,'w').write(s)
print('ok')
