#!/usr/bin/env python3
"""Builds the two review pages: site/deaths.html and site/sounds.html."""
import pathlib,re,json,html
H=pathlib.Path('/home/claude/hl')
rd=lambda p:(H/p).read_text()
FONTS='<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=Baloo+2:wght@500;600;700;800&display=swap">'
WS_CSS='''
html,body{height:auto!important;overflow:auto!important;position:static!important}
body{margin:0;padding:16px 14px 60px!important;background:#7FD0E4!important;color:var(--ink);font-family:var(--body);font-size:16px;line-height:1.35;-webkit-user-select:auto;user-select:auto}
.ws{max-width:560px;margin:0 auto;display:grid;gap:12px}
.ws h1{font-family:var(--display);font-weight:400;font-size:34px;margin:0;color:#fff;-webkit-text-stroke:6px var(--ink);paint-order:stroke fill}
.ws h3{font-family:var(--display);font-weight:400;font-size:20px;margin:0 0 6px}
.box{background:var(--paper);border:3px solid var(--ink);border-radius:18px;padding:12px;box-shadow:0 4px 0 var(--ink)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{font-family:var(--display);font-size:15px;background:#fff;color:var(--ink);border:3px solid var(--ink);border-radius:99px;padding:4px 12px;box-shadow:0 3px 0 var(--ink);cursor:pointer}
.chip[aria-pressed=true]{background:var(--yellow)}
.chip.v-keep{border-color:#2FA36B}.chip.v-fix{border-color:#FF8A2B}.chip.v-redo{border-color:#EE4B3B}
.rowx{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}
.b{font-family:var(--display);font-size:16px;background:#fff;color:var(--ink);border:3px solid var(--ink);border-radius:12px;padding:6px 14px;box-shadow:0 3px 0 var(--ink);cursor:pointer}
.b.go{background:var(--red);color:#fff}.b[aria-pressed=true]{background:var(--yellow)}
.b:active,.chip:active{transform:translateY(2px);box-shadow:0 1px 0 var(--ink)}
.ws input[type=range]{flex:1;min-width:120px;accent-color:#EE4B3B}
.ws input[type=text],.ws textarea,.ws select{font:inherit;border:3px solid var(--ink);border-radius:12px;padding:6px 10px;background:#fff;color:var(--ink);min-width:0}
.ws textarea{width:100%;min-height:74px;resize:vertical}
.sw{width:30px;height:30px;border-radius:50%;border:3px solid var(--ink);cursor:pointer;padding:0}
.sw[aria-pressed=true]{outline:3px solid var(--ink);outline-offset:2px}
.cue{font-family:var(--body);font-weight:700;font-size:13px;background:#fff;border:2px solid var(--ink);border-radius:8px;padding:2px 7px;cursor:pointer}
.small{font-size:14px;font-weight:600;color:var(--muted)}
.ws .sheet{margin:0;max-width:none}
'''
def page(title,css,body,scripts):
    return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>{title}</title>{FONTS}<style>{css}</style></head><body>{body}{scripts}</body></html>\n'

# ---------------- deaths ----------------
game_css=rd('src/base.css')+rd('src/extra.css')+rd('src/deaths.css')+rd('src/ui2.css')
body='''<main class="ws">
<h1>Death workshop</h1>
<div class="chips" id="kinds"></div>
<div class="sheet center"><div class="stage" id="stage"></div><h2 id="capT"></h2><p id="capP"></p></div>
<div class="box">
 <div class="rowx" style="margin-top:0"><button class="b go" id="play">Play</button><button class="b" data-sp="1" aria-pressed="true">1×</button><button class="b" data-sp="0.5">½</button><button class="b" data-sp="0.25">¼</button><button class="b" id="loop" aria-pressed="false">Loop</button><button class="b" id="snd" aria-pressed="true">Sound</button></div>
 <div class="rowx"><input type="range" id="scrub" min="0" max="4800" step="20" value="0" aria-label="Scrub"><b id="tread" style="font-family:var(--display);font-weight:400;min-width:52px;text-align:right">0.00s</b></div>
 <div class="rowx"><span class="small">Victim</span><span id="vsw"></span><span class="small">Killer</span><span id="ksw"></span><input type="text" id="num" value="9,100" size="7" aria-label="Number shown"></div>
 <div class="rowx" id="cues"></div>
</div>
<div class="box">
 <h3 id="nt">Notes</h3>
 <div class="rowx" style="margin-top:0"><button class="b" data-v="keep">Keep</button><button class="b" data-v="fix">Needs work</button><button class="b" data-v="redo">Redo</button></div>
 <div class="rowx"><textarea id="note" placeholder="What should change? Mention the moment, like 2.1s."></textarea></div>
 <div class="rowx"><button class="b go" id="copy">Copy all notes</button><span class="small" id="copied"></span></div>
</div>
</main>'''
js=r'''
const st={kind:DEATHS[0],v:0,k:1,speed:1,loop:false,sound:true};
let notes={};try{notes=JSON.parse(localStorage.getItem('hl-deathlab')||'{}')}catch(e){}
const save=()=>{try{localStorage.setItem('hl-deathlab',JSON.stringify(notes))}catch(e){}};
const E=id=>document.getElementById(id);let wsT=[],raf=0,t0=0;
function anims(){return document.getAnimations().filter(a=>a.effect&&a.effect.target&&E('stage').contains(a.effect.target))}
function scene(){E('stage').innerHTML=SCENES[st.kind]({color:COLORS[st.v],acc:st.v,id:1},{color:COLORS[st.k],acc:st.k,id:2},E('num').value);}
function stopAll(){wsT.forEach(clearTimeout);wsT=[];cancelAnimationFrame(raf)}
function play(){
  stopAll();scene();const ms=SCENE_MS[st.kind]||4600;E('scrub').max=ms;
  anims().forEach(a=>a.playbackRate=st.speed);
  if(st.sound){(DEATH_SFX[st.kind]||[]).forEach(x=>wsT.push(setTimeout(()=>SFX.play(x[0],{rate:x[2]||1,vol:x[3]==null?1:x[3]}),x[1]*1000/st.speed)))}
  t0=performance.now();
  const tick=()=>{const t=Math.min(ms,(performance.now()-t0)*st.speed);E('scrub').value=t;E('tread').textContent=(t/1000).toFixed(2)+'s';if(t<ms)raf=requestAnimationFrame(tick);else if(st.loop)wsT.push(setTimeout(play,700))};
  raf=requestAnimationFrame(tick);
}
function scrubTo(t){stopAll();scene();anims().forEach(a=>{a.pause();a.currentTime=t});E('tread').textContent=(t/1000).toFixed(2)+'s'}
function ui(){
  E('kinds').innerHTML=DEATHS.map(k=>`<button class="chip ${notes[k]&&notes[k].v?'v-'+notes[k].v:''}" data-kind="${k}" aria-pressed="${k===st.kind}">${SHORT[k]}</button>`).join('');
  E('capT').textContent='Bean '+(CAPTION[st.kind]||'');E('capP').textContent='';
  const sw=(sel)=>COLORS.map((c,i)=>`<button class="sw" style="background:${c}" data-i="${i}" aria-pressed="${i===sel}" aria-label="Color ${i+1}"></button>`).join(' ');
  E('vsw').innerHTML=sw(st.v);E('ksw').innerHTML=sw(st.k);
  E('cues').innerHTML='<span class="small">Sounds</span>'+(DEATH_SFX[st.kind]||[]).map(x=>`<button class="cue" data-key="${x[0]}" data-rate="${x[2]||1}">${x[1].toFixed(2)}s ${x[0]}</button>`).join('');
  const n=notes[st.kind]||{};E('nt').textContent='Notes: '+SHORT[st.kind];E('note').value=n.t||'';
  document.querySelectorAll('[data-v]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===n.v));
  document.querySelectorAll('[data-sp]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.sp)===st.speed));
}
document.addEventListener('click',e=>{
  const t=e.target.closest('button');if(!t)return;
  if(t.dataset.kind){st.kind=t.dataset.kind;ui();play()}
  else if(t.id==='play')play();
  else if(t.dataset.sp){st.speed=Number(t.dataset.sp);ui();play()}
  else if(t.id==='loop'){st.loop=!st.loop;t.setAttribute('aria-pressed',st.loop)}
  else if(t.id==='snd'){st.sound=!st.sound;t.setAttribute('aria-pressed',st.sound)}
  else if(t.classList.contains('sw')){if(t.parentElement.id==='vsw')st.v=Number(t.dataset.i);else st.k=Number(t.dataset.i);ui();play()}
  else if(t.classList.contains('cue'))SFX.play(t.dataset.key,{rate:Number(t.dataset.rate)});
  else if(t.dataset.v){const n=notes[st.kind]||(notes[st.kind]={});n.v=n.v===t.dataset.v?'':t.dataset.v;save();ui()}
  else if(t.id==='copy'){
    const lines=DEATHS.map(k=>{const n=notes[k]||{};return SHORT[k]+' ('+k+'): '+({keep:'KEEP',fix:'NEEDS WORK',redo:'REDO'}[n.v]||'no verdict')+(n.t?' | '+n.t.replace(/\s+/g,' ').trim():'')});
    const txt='DEATH NOTES\n'+lines.join('\n');
    (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>{E('copied').textContent='Copied. Paste it to Claude.'},()=>{E('note').value=txt;E('note').select();E('copied').textContent='Select all and copy.'});
  }
});
E('note').addEventListener('input',()=>{const n=notes[st.kind]||(notes[st.kind]={});n.t=E('note').value;save()});
E('scrub').addEventListener('input',()=>scrubTo(Number(E('scrub').value)));
E('num').addEventListener('change',play);
ui();scene();
'''
(H/'site/deaths.html').write_text(page('High & Low death workshop',game_css+WS_CSS,body,f'<script>{rd("src/sound.js")}\n{rd("src/base.js")}</script><script>{js}</script>'))

# ---------------- sounds ----------------
old=(H/'site/sounds.html').read_text() if (H/'tools/sound_rows.json').exists()==False else ''
rows_file=H/'tools/sound_rows.json'
if not rows_file.exists():
    rows=[];g=''
    for m in re.finditer(r'<h2>(.*?)</h2>|<div class="row"><div class="txt"><b>(.*?)</b><span>(.*?)</span>',old):
        if m.group(1):g=html.unescape(m.group(1))
        else:rows.append({'g':g,'k':m.group(2),'d':html.unescape(m.group(3))})
    rows_file.write_text(json.dumps(rows,indent=1))
rows=json.loads(rows_file.read_text())
lib=json.loads((H/'site/lab/index.json').read_text())
cur={}
for line in rd('sounds-src/map.txt').splitlines():
    p=line.split(None,1)
    if len(p)==2:cur[p[0]]=p[1].strip()
bysrc={x['src']:x['f'] for x in lib}
keys=re.search(r"KEYS:\[(.*?)\]",rd('src/sound.js')).group(1).replace("'",'').split(',')
known={r['k'] for r in rows}
for k in keys:
    if k not in known:rows.append({'g':'Deaths' if k.startswith('d_') else 'Other','k':k,'d':''})
data={'rows':rows,'lib':[{'c':x['c'],'n':x['n'],'f':x['f']} for x in lib],'cur':{k:bysrc.get(v,'') for k,v in cur.items()}}
css=''':root{--ink:#1E2240;--paper:#FFF8EC;--paper-2:#F1E4CB;--red:#EE4B3B;--green:#2FA36B;--yellow:#FFD23F;--muted:#545C7D;--display:"Bagel Fat One",system-ui,sans-serif;--body:"Baloo 2",system-ui,sans-serif}
*{box-sizing:border-box}'''+WS_CSS+'''
.m{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 8px;align-items:center}
.m b{font-family:var(--display);font-weight:400;font-size:18px}
.m .pk{grid-column:1/-1;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.tag{font-size:12px;font-weight:800;background:var(--green);color:#fff;border-radius:99px;padding:1px 8px}
.liblist{display:flex;flex-wrap:wrap;gap:5px;max-height:190px;overflow:auto;padding:6px;background:#fff;border:3px solid var(--ink);border-radius:12px;grid-column:1/-1}
.lb{font:700 12px var(--body);background:var(--paper-2);border:2px solid var(--ink);border-radius:8px;padding:3px 7px;cursor:pointer}
.lb[aria-pressed=true]{background:var(--yellow)}
.picker{grid-column:1/-1;display:grid;gap:6px}
.sticky{position:sticky;top:8px;z-index:5}
a{color:var(--ink);font-weight:800}
'''
body='''<main class="ws">
<h1>Sound workshop</h1>
<div class="box sticky"><div class="rowx" style="margin-top:0"><button class="b go" id="copy">Copy my picks</button><button class="b" data-seq="turn">Hear a turn</button><button class="b" data-seq="miss">Wrong guess</button><button class="b" data-seq="win">Win</button><span class="small" id="copied"></span></div></div>
<div class="box"><h3>Music</h3>
<p class="small" style="margin:0 0 8px">Listen: <a href="https://opengameart.org/content/happy-clappy-loop" target="_blank" rel="noopener">Happy Clappy</a> · <a href="https://opengameart.org/content/flowerbed-fields-loop" target="_blank" rel="noopener">Flowerbed Fields</a> · <a href="https://opengameart.org/content/calm-track" target="_blank" rel="noopener">Calm Track</a> · <a href="https://opengameart.org/content/snow-theme" target="_blank" rel="noopener">Snow Theme</a>. Download any track, then load it here to hear it under the game sounds.</p>
<div class="rowx"><b style="font-family:var(--display);font-weight:400;min-width:74px">Menu</b><input type="file" accept="audio/*" data-mus="home"><button class="b" data-mp="home">Play</button><input type="range" min="0" max="1" step="0.01" value="0.30" data-mv="home" aria-label="Menu volume"></div>
<div class="rowx"><b style="font-family:var(--display);font-weight:400;min-width:74px">In game</b><input type="file" accept="audio/*" data-mus="play"><button class="b" data-mp="play">Play</button><input type="range" min="0" max="1" step="0.01" value="0.13" data-mv="play" aria-label="In-game volume"></div>
</div>
<div id="list"></div>
</main>'''
js=r'''
const D=__DATA__;let picks={};try{picks=JSON.parse(localStorage.getItem('hl-soundlab')||'{}')}catch(e){}
const save=()=>{try{localStorage.setItem('hl-soundlab',JSON.stringify(picks))}catch(e){}};
const cats=[...new Set(D.lib.map(x=>x.c))];let open=null,cat=cats[0],q='';
function fileFor(k){const p=picks[k];return p&&p.f?p.f:'sfx/'+k+'.mp3'}
function play(f,rate){try{const a=new Audio(f);a.preservesPitch=false;a.playbackRate=rate||1;a.play().catch(()=>{})}catch(e){}}
function playKey(k){const p=picks[k]||{};play(fileFor(k),p.r||1)}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function render(){
  let h='',g='';
  for(const r of D.rows){
    if(r.g!==g){g=r.g;h+=`<h3 style="margin:14px 0 6px;color:#fff;-webkit-text-stroke:5px var(--ink);paint-order:stroke fill;font-size:24px">${esc(g)}</h3>`}
    const p=picks[r.k];
    h+=`<div class="box" style="margin-bottom:8px"><div class="m"><div><b>${esc(r.k)}</b> ${p&&p.f?'<span class="tag">changed</span>':''}<div class="small">${esc(r.d)}</div></div><div><button class="b" data-now="${r.k}">Now</button> <button class="b" data-open="${r.k}" aria-pressed="${open===r.k}">Swap</button></div>`;
    if(p&&p.f)h+=`<div class="pk"><button class="b" data-pick="${r.k}">Play pick</button><span class="small">${esc(p.f.replace('lab/','').replace('.mp3',''))}</span><button class="b" data-clear="${r.k}">Undo</button></div>`;
    if(open===r.k){
      const list=D.lib.filter(x=>(q?x.n.toLowerCase().includes(q):x.c===cat));
      h+=`<div class="picker"><div class="rowx" style="margin-top:0"><select id="cat">${cats.map(c=>`<option ${c===cat?'selected':''}>${esc(c)}</option>`).join('')}</select><input type="text" id="q" placeholder="search all" value="${esc(q)}" size="10"><span class="small">Pitch</span><input type="range" id="rate" min="0.5" max="1.6" step="0.05" value="${(p&&p.r)||1}"></div>
<div class="liblist">${list.slice(0,220).map(x=>`<button class="lb" data-f="${x.f}" aria-pressed="${p&&p.f===x.f}">${esc(x.n)}</button>`).join('')||'<span class="small">Nothing found.</span>'}</div></div>`;
    }
    h+='</div></div>';
  }
  document.getElementById('list').innerHTML=h;
}
const SEQ={turn:[['yourturn',0],['pick',900],['land',1000],['tick',1500],['tick',1620],['tick',1740],['send',2300],['yes',3100]],miss:[['send',0],['nope',700],['bonk',760]],win:[['send',0],['anvil',900],['anvil2',940],['sad',2600],['win',3600],['vo_youwin',4500]]};
const mus={home:new Audio(),play:new Audio()};for(const k in mus){mus[k].loop=true}
document.addEventListener('click',e=>{
  const t=e.target.closest('button');if(!t)return;const d=t.dataset;
  if(d.now)play('sfx/'+d.now+'.mp3');
  else if(d.pick)playKey(d.pick);
  else if(d.open){open=open===d.open?null:d.open;q='';render()}
  else if(d.clear){delete picks[d.clear];save();render()}
  else if(d.f&&open){const p=picks[open]||(picks[open]={});p.f=d.f;save();playKey(open);render()}
  else if(d.seq)SEQ[d.seq].forEach(x=>setTimeout(()=>playKey(x[0]),x[1]));
  else if(d.mp){const a=mus[d.mp];if(!a.src){document.getElementById('copied').textContent='Load a file first.';return}if(a.paused){a.volume=Number(document.querySelector(`[data-mv=${d.mp}]`).value);a.play();t.textContent='Stop'}else{a.pause();t.textContent='Play'}}
  else if(t.id==='copy'){
    const lines=Object.keys(picks).filter(k=>picks[k]&&(picks[k].f||picks[k].r&&picks[k].r!==1)).map(k=>k+' = '+(picks[k].f||'(same sound)')+(picks[k].r&&picks[k].r!==1?' pitch '+picks[k].r:''));
    const txt='SOUND PICKS\n'+(lines.join('\n')||'(none yet)')+'\nmusic volumes: menu '+document.querySelector('[data-mv=home]').value+', in game '+document.querySelector('[data-mv=play]').value;
    (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>{document.getElementById('copied').textContent='Copied. Paste it to Claude.'},()=>{prompt('Copy this:',txt)});
  }
});
document.addEventListener('change',e=>{const t=e.target;
  if(t.id==='cat'){cat=t.value;q='';render()}
  else if(t.dataset.mus){const f=t.files[0];if(f)mus[t.dataset.mus].src=URL.createObjectURL(f)}
});
document.addEventListener('input',e=>{const t=e.target;
  if(t.id==='q'){q=t.value.trim().toLowerCase();const pos=t.selectionStart;render();const n=document.getElementById('q');if(n){n.focus();n.setSelectionRange(pos,pos)}}
  else if(t.id==='rate'&&open){const p=picks[open]||(picks[open]={});p.r=Number(t.value);save()}
  else if(t.dataset.mv)mus[t.dataset.mv].volume=Number(t.value);
});
document.addEventListener('change',e=>{if(e.target.id==='rate'&&open)playKey(open)});
render();
'''.replace('__DATA__',json.dumps(data,separators=(',',':')))
(H/'site/sounds.html').write_text(page('High & Low sound workshop',css,body,f'<script>{js}</script>'))
print('deaths.html',(H/'site/deaths.html').stat().st_size,'sounds.html',(H/'site/sounds.html').stat().st_size,'rows',len(rows),'mapped',sum(1 for v in data['cur'].values() if v))
