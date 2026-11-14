p='/home/claude/hl/src/main.js';s=open(p).read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n,(a[:60],s.count(a));s=s.replace(a,b)
rep("if(G.players.length<4&&pubFills<3&&now-pubAt>=step*(1.5+pubFills))","if(G.players.length<PUB_N&&pubFills<PUB_N-1&&now-pubAt>=step*(1.5+pubFills))")
rep("  if(G.players.length>=4){\n    if(!pubFullAt)pubFullAt=now;","  if(G.players.length>=PUB_N){\n    if(!pubFullAt)pubFullAt=now;")
rep("Number.isInteger(m.n)&&m.n<4&&m.n>=1","Number.isInteger(m.n)&&m.n<PUB_N&&m.n>=1")
rep("if(G.players.length<4)my.q.announce","if(G.players.length<PUB_N)my.q.announce")
rep("else if(G.players.length<6){const l=validLook(v.pres.look);const np={pid,name:nm,","else if(G.players.length<(G.pub?PUB_N:6)){const l=validLook(v.pres.look);const np={pid,name:nm,el:Number.isInteger(v.pres.el)?Math.min(3000,Math.max(100,v.pres.el)):ELO0,")
rep("if(me&&me.name!==myNm){me.name=myNm;ch=true}","if(me&&me.name!==myNm){me.name=myNm;ch=true}\n  if(me&&G.phase==='lobby'&&me.el!==myElo()){me.el=myElo();ch=true}")
rep("  const k=fillLook();if(k!=null)np.k=k;","  const k=fillLook();if(k!=null)np.k=k;\n  np.el=Math.max(700,myElo()+rnd(-80,80));")
rep("const sk=me.ez?0.15:Math.max","const sk=me.ez?0.15:(G.pub&&me.hb&&Number.isInteger(me.el))?eloSkill(me.el):Math.max")
rep("p.dg=int(p.dg,0,0,3);","p.dg=int(p.dg,0,0,3);if('el' in p)p.el=int(p.el,ELO0,100,3000);")
rep("  myPres={pid:PID,name:NAME||'Player',code,role:asHost?'host':'player'};","  myPres={pid:PID,name:NAME||'Player',code,role:asHost?'host':'player',el:myElo()};")
rep("    if(G&&G.phase==='over'&&G.win===PID)try{countWin()}catch(e){}","    if(G&&G.phase==='over'&&G.win===PID)try{countWin()}catch(e){}\n    if(G&&G.phase==='over'&&G.pub)eloApply(G.win===PID);")
rep("async function leaveGame(){\n  trackLeave();","async function leaveGame(){\n  if(G&&G.pub&&G.phase==='play'&&!eloSkip){const m=byPid(PID);if(m&&m.a)eloApply(false)}eloSkip=false;\n  trackLeave();")
rep("const wp=G&&G.pub;leaveGame().then(","const wp=G&&G.pub;eloSkip=true;leaveGame().then(",2)
rep("<h2>${name}</h2>${w&&w.pid===PID?pwWinBlock():''}","<h2>${name}</h2>${eloResultHTML()}${w&&w.pid===PID?pwWinBlock():''}")
rep("Finding players<span","Finding a match<span")
rep("${winsN()>0?`<div class=\"wins-pill\">Wins: ${winsN()}</div>`:''}","${eloPill()}")
rep("<span class=\"info\"><span class=\"nm\"><b>${esc(p.name)}</b>${mine?'<span class=\"tag\">YOU</span>':''}","<span class=\"info\"><span class=\"nm\"><b>${esc(p.name)}</b>${G.pub&&Number.isInteger(p.el)?`<span class=\"elo\">${p.el}</span>`:''}${mine?'<span class=\"tag\">YOU</span>':''}")
rep("""  if(askViewOn())return headerHTML()+askViewHTML();
  return headerHTML()+`<main class="cast">${G.players.map(cardHTML).join('')}</main>""","""  if(askViewOn())return headerHTML()+askViewHTML();
  if(guessViewOn())return headerHTML()+guessViewHTML();
  const duel=G.players.length===2,me0=G.players.findIndex(p=>p.pid===PID);
  const order=duel&&me0===0?[1,0]:G.players.map((_,i)=>i);
  return headerHTML()+`<main class="cast ${duel?'duel':''}">${order.map(i=>cardHTML(G.players[i],i)).join(duel?'<div class="vs">VS</div>':'')}</main>""")
rep("function askViewOn(){","""function guessViewOn(){const t=curTarget();return canAct()&&G.sub[0]!=='*'&&!!t&&t.a}
function guessViewHTML(){
  const t=curTarget(),tv=mv(t),xs=myXs(tv),btns=[];
  for(let n=tv.lo;n<=tv.hi;n++){const x=xs.includes(n);btns.push(`<button class="g" ${x?'disabled':`data-n="${n}"`}>${fmt(n)}</button>`)}
  return `<main class="guessv"><div class="ask-top">${timerPill()}${pwBtnHTML()}</div>
<div class="ped"><div class="ped-bean jit">${popHTML(t.pid)}${charSVG(pv(t),'scared')}</div><div class="ped-base"><b>${esc(t.name)}</b></div></div>
<p class="ped-q">Which one is it?</p>
<div class="guess-grid big n${btns.length}">${btns.join('')}</div></main>`;
}
function askViewOn(){""")
open(p,'w').write(s)
p='/home/claude/hl/build.py';s=open(p).read()
a="+(H/'src/botlife.js').read_text()";assert s.count(a)==1
s=s.replace(a,"+(H/'src/rating.js').read_text()+(H/'src/botlife.js').read_text()");open(p,'w').write(s)
open('/home/claude/hl/src/ui2.css','a').write('''
/* ---- duel ---- */
.elo{font-family:var(--body);font-weight:800;font-size:12px;background:var(--ink);color:var(--white);border-radius:99px;padding:1px 7px;margin-left:6px;vertical-align:middle;font-variant-numeric:tabular-nums}
.elo-pill b{font-family:var(--display);font-weight:400;font-size:18px;margin-right:4px}
.elo-res{display:flex;align-items:baseline;justify-content:center;gap:10px;margin:6px 0 2px;font-family:var(--display)}
.elo-res .d{font-size:30px;line-height:1}.elo-res.up .d{color:var(--green)}.elo-res.down .d{color:var(--red)}
.elo-res b{font-size:22px;font-weight:400}.elo-res span:last-child{font-family:var(--body);font-weight:800;font-size:14px}
.elo-rankup{font-family:var(--display);font-size:20px;color:var(--ink);background:var(--yellow);border:3px solid var(--ink);border-radius:12px;padding:4px 12px;display:inline-block;margin:4px 0}
.cast.duel{grid-template-columns:minmax(0,1fr)!important;gap:6px;padding-top:34px;align-content:center}
.cast.duel .vs{justify-self:center;font-family:var(--display);font-size:26px;color:var(--white);-webkit-text-stroke:5px var(--ink);paint-order:stroke fill;line-height:1}
.cast.duel .card{grid-template-columns:104px minmax(0,1fr);gap:14px;padding:14px 16px;border-radius:22px;overflow:visible}
.cast.duel .card .pic{width:104px}
.cast.duel .card .nm{font-size:22px}
.cast.duel .card .rng{font-size:24px}
.cast.duel .card .hp{height:22px}
.cast.duel .card .left b,.cast.duel .card .zone{font-size:16px}
.cast.duel .card.mine{grid-template-columns:64px minmax(0,1fr);padding:10px 14px}
.cast.duel .card.mine .pic{width:64px}
.cast.duel .card.mine .nm{font-size:18px}
.cast.duel .card .bubble{font-size:18px;padding:2px 10px}
.guessv{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;overflow:auto;padding:2px 3px 10px}
.ped{display:flex;flex-direction:column;align-items:center;margin-top:auto}
.ped-bean{width:min(38vw,150px);position:relative;z-index:1;margin-bottom:-10px}
.ped-bean svg{width:100%;height:auto;display:block;overflow:visible}
.ped-base{width:min(62vw,240px);background:var(--paper);border:4px solid var(--ink);border-radius:16px 16px 6px 6px;box-shadow:0 6px 0 var(--ink);text-align:center;padding:14px 8px 8px;position:relative}
.ped-base:before{content:"";position:absolute;left:-10px;right:-10px;top:-8px;height:14px;background:var(--yellow);border:4px solid var(--ink);border-radius:10px}
.ped-base b{font-family:var(--display);font-weight:400;font-size:22px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ped-q{font-family:var(--display);font-size:26px;text-align:center;margin:14px 0 2px;color:var(--white);-webkit-text-stroke:5px var(--ink);paint-order:stroke fill}
.guess-grid.big{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-bottom:auto}
.guess-grid.big.n1,.guess-grid.big.n2,.guess-grid.big.n3,.guess-grid.big.n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.guess-grid.big.n5,.guess-grid.big.n6{grid-template-columns:repeat(3,minmax(0,1fr))}
.guess-grid.big .g{min-height:64px;font-family:var(--display);font-size:clamp(17px,5.2vw,26px);padding:4px 2px;border:3px solid var(--ink);border-radius:14px;background:var(--white);box-shadow:0 4px 0 var(--ink);color:var(--ink)}
.guess-grid.big .g:disabled{opacity:.35;text-decoration:line-through;box-shadow:none;transform:translateY(4px)}
.guess-grid.big .g:active{transform:translateY(4px);box-shadow:none}
''')
print('patched')
