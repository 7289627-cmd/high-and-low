/* Coins and powerups. Function declarations only at top level (this file is concatenated BEFORE main.js in one script). */

/* ---------- Data ---------- */
function pwDefs(){return [
  {id:'snap',icon:'🎯',name:'Instant Showdown',cost:8,desc:'Pulls everyone into the guess zone.'},
  {id:'peek',icon:'👀',name:'Peek',cost:2,desc:'Learn if a player’s number is odd or even.'},
  {id:'double',icon:'✌️',name:'Double Down',cost:3,desc:'Ask twice this turn'},
  {id:'shield',icon:'🛡️',name:'Shield',cost:3,desc:'Blocks the next question or guess at you.'},
  {id:'freeze',icon:'🧊',name:'Freeze',cost:4,desc:'The next player skips their turn.'}
]}
function pwDef(id){return pwDefs().find(d=>d.id===id)||null}
function myCoins(){const c=LS.get(LSK('hl-coins'));return Number.isInteger(c)&&c>0?c:0}
function pwCoins(p){if(!p||(p.bot&&!p.hb))return 0;if(p.pid===PID)return myCoins();const c=(getPres(p.pid)||{}).co;return Number.isInteger(c)&&c>0?c:0}
function pwEarn(){LS.set(LSK('hl-coins'),myCoins()+5);window.__pwWon=1}
function pwWinBlock(){
  if(!window.__pwWon)return '';
  window.__pwWon=0;sfx('lock',{delay:0.3});
  return `<div class="newhat pw-won">${pwCoinSVG(26)}<b>+5 coins</b></div>`;
}
function pwHomePill(){const c=myCoins();return c>0?`<div class="wins-pill coins-home">${pwCoinSVG(16)} Coins: ${c}</div>`:''}
function pwSpend(ev){
  if(!G||ev.a!==PID)return;
  const d=pwDef(ev.t);if(!d)return;
  const key=G.gid+':'+G.turnNo;
  if(LS.get(LSK('hl-pwspent'))===key)return;
  LS.set(LSK('hl-pwspent'),key);
  track('power',{k:ev.t});
  LS.set(LSK('hl-coins'),Math.max(0,myCoins()-d.cost));
}
function pwCoinSVG(s){return `<svg viewBox="0 0 16 16" width="${s||14}" height="${s||14}" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="#FFD23F" stroke="#1E2240" stroke-width="2"/><circle cx="8" cy="8" r="3" fill="none" stroke="#1E2240" stroke-width="1.5"/></svg>`}
function pwCoinPill(p){if(p&&p.bot&&!p.hb)return '';return `<span class="coin-pill" title="Coins">${pwCoinSVG(14)}<b>${pwCoins(p)}</b></span>`}

/* ---------- Shared validation (host and client). Returns '' when OK, else a short reason ---------- */
function pwCan(p,id,tg){
  const d=pwDef(id);if(!d||!p||!p.a)return 'Not available';
  if(G.pwTurn===G.turnNo)return 'Already used a power this turn';
  const alive=G.players.filter(x=>x.a);
  if(id==='double'&&!(G.sub&&G.sub[0]==='*'))return 'Use it before asking';
  if(id==='shield'&&p.sh)return 'Shield is already up';
  if(id==='freeze'&&alive.length<3)return 'Needs 3 or more players';
  if(id==='peek'){const t=byPid(tg);if(!t||!t.a||t.pid===p.pid)return 'Pick another player'}
  return '';
}

/* ---------- Host side ---------- */
function pwReset(){
  G.bx={};G.pk={};G.pr=null;G.turnNo=0;G.pwTurn=-1;
  for(const p of G.players){p.sh=0;p.fz=0}
}
function pwPassTurn(){
  G.turn=nextAlive(G.turn);
  const alive=G.players.filter(p=>p.a).length;
  for(let k=0;k<G.players.length;k++){
    const p=G.players[G.turn];
    if(!p.fz)break;
    p.fz=0;
    if(alive>=3){G.ev={id:++G.en,t:'frozen',tg:p.pid};G.turn=nextAlive(G.turn)}
  }
  beginTurn();
}
function pwHostTick(){
  if(!G||G.phase!=='play')return false;
  if(G.stage==='power')return pwFinish();
  if(G.stage!=='await'||G.q)return false;
  const cur=G.players[G.turn];
  if(!cur||!cur.a||cur.bot)return false;
  const r=(getPres(cur.pid)||{}).pw;
  if(!r||typeof r!=='object'||r.gid!==G.gid||r.turn!==G.turnNo)return false;
  if(pwCan(cur,r.id,r.tg))return false;
  return pwApply(cur,r.id,r.tg);
}
function pwWindow(p,secret,isUser,by){
  let lo=1,hi=G.max;
  for(const o of G.players)if(o.a&&o.pid!==p.pid){const k=kn(o.pid,p.pid);lo=Math.max(lo,k.lo);hi=Math.min(hi,k.hi)}
  if(lo>hi){lo=1;hi=G.max}
  if(hi-lo+1>10&&Number.isInteger(secret)){
    const a=Math.max(lo,secret-9),b=Math.min(secret,hi-9);
    if(b>=a){const s=a+Math.floor(Math.random()*(b-a+1));lo=s;hi=s+9}
  }
  let dec=null;
  if(!isUser&&Number.isInteger(secret)){
    const bk=by?kn(by,p.pid).x:[],c=[];for(let n=lo;n<=hi;n++)if(n!==secret&&!bk.includes(n))c.push(n);
    if(c.length)dec=c[Math.floor(Math.random()*c.length)];
  }
  return{lo,hi,dec};
}
function pwApply(cur,id,tg){
  G.pwTurn=G.turnNo;
  if(id==='double'){
    G.sub.splice(1,0,'*');G.subN=(G.subN||0)+1;
    G.ev={id:++G.en,t:'double',a:cur.pid};
  } else if(id==='shield'){
    cur.sh=1;G.ev={id:++G.en,t:'shield',a:cur.pid};
  } else if(id==='freeze'){
    const n=G.players[nextAlive(G.turn)];n.fz=1;
    G.ev={id:++G.en,t:'freeze',a:cur.pid,tg:n.pid};
  } else if(id==='peek'){
    const t=byPid(tg);
    if(t.bot){
      if(!G.pk[cur.pid])G.pk[cur.pid]={};
      G.pk[cur.pid][t.pid]=botSecrets[t.pid]%2===1?'odd':'even';
      G.ev={id:++G.en,t:'peek',a:cur.pid,tg:t.pid};
    } else {
      G.pr={id:uid(),k:'peek',by:cur.pid,tg:t.pid,need:[t.pid],until:Date.now()+8000};
      G.stage='power';pwWake();
    }
  } else if(id==='snap'){
    const need=[],res={};
    for(const p of G.players){
      if(!p.a)continue;
      if(p.bot)res[p.pid]=pwWindow(p,botSecrets[p.pid],p.pid===cur.pid,cur.pid);else need.push(p.pid);
    }
    G.pr={id:uid(),k:'snap',by:cur.pid,need,res,until:Date.now()+8000};
    G.stage='power';pwWake();
  }
  return true;
}
function pwWake(){later(()=>schedule(),8300)}
function pwAnswerOf(pid){
  const r=(getPres(pid)||{}).prr;
  return r&&typeof r==='object'&&r.gid===G.gid&&r.id===G.pr.id?r:null;
}
function pwFinish(){
  const pr=G.pr;
  if(!pr||!Array.isArray(pr.need)){G.pr=null;G.stage='await';return true}
  const waiting=pr.need.filter(pid=>{const p=byPid(pid);return p&&p.a&&!p.bot&&!pwAnswerOf(pid)});
  if(waiting.length&&Date.now()<pr.until)return false;
  if(pr.k==='snap'){
    const bx={};
    for(const p of G.players){
      if(!p.a)continue;
      const r=p.bot?(pr.res||{})[p.pid]:pwAnswerOf(p.pid);
      if(!r)continue;
      if(Number.isInteger(r.lo)&&Number.isInteger(r.hi)&&r.lo<=r.hi&&r.hi-r.lo<=9){
        for(const a of G.players){
          if(!a.a||a.pid===p.pid)continue;
          const k=kn(a.pid,p.pid),nl=Math.max(k.lo,r.lo),nh=Math.min(k.hi,r.hi);
          if(nl<=nh){k.lo=nl;k.hi=nh}
        }
      }
      if(p.pid!==pr.by){const uk=kn(pr.by,p.pid);if(Number.isInteger(r.dec)&&r.dec>=uk.lo&&r.dec<=uk.hi&&!uk.x.includes(r.dec))bx[p.pid]=r.dec}
    }
    G.bx[pr.by]=bx;
    G.ev={id:++G.en,t:'snap',a:pr.by};
  } else {
    const r=pwAnswerOf(pr.tg);
    if(r&&typeof r.odd==='boolean'){if(!G.pk[pr.by])G.pk[pr.by]={};G.pk[pr.by][pr.tg]=r.odd?'odd':'even'}
    G.ev={id:++G.en,t:'peek',a:pr.by,tg:pr.tg};
  }
  G.pr=null;G.stage='await';timerSched='';botSched=-1;
  try{fixSub()}catch(e){}
  return true;
}

/* ---------- Every phone: answer power requests about my secret ---------- */
function pwAnswer(){
  if(G&&myPres.co!==myCoins())setP({co:myCoins()});
  if(!G||G.phase!=='play'||G.stage!=='power'||!G.pr||!mySecret||!Array.isArray(G.pr.need))return;
  if(!G.pr.need.includes(PID))return;
  {const m=byPid(PID);if(!m||m.bot)return}
  const r=myPres.prr;if(r&&r.gid===G.gid&&r.id===G.pr.id)return;
  const prr={gid:G.gid,id:G.pr.id};
  if(G.pr.k==='peek')prr.odd=mySecret.n%2===1;
  else{
    const me=byPid(PID);if(!me)return;
    const w=pwWindow(me,mySecret.n,G.pr.by===PID,G.pr.by);
    prr.lo=w.lo;prr.hi=w.hi;prr.dec=w.dec;
  }
  setP({prr});
}

/* ---------- Display helpers (my phone only) ---------- */
function myXs(t){
  const o=t.x.slice();
  const b=G&&G.bx&&G.bx[PID];
  if(b&&Number.isInteger(b[t.pid]))o.push(b[t.pid]);
  const pk=G&&G.pk&&G.pk[PID]&&G.pk[PID][t.pid];
  if(pk&&zone(t)){for(let n=t.lo;n<=t.hi;n++)if((pk==='odd')!==(n%2===1))o.push(n)}
  return o;
}
function leftX(p){
  if(!zone(p))return left(p);
  const xs=myXs(p);let n=0;
  for(let k=p.lo;k<=p.hi;k++)if(!xs.includes(k))n++;
  return n;
}
function pwBits(p){
  let h=pwCoinPill(p);
  if(p.a&&p.sh)h+='<span class="pw-ic-sm" title="Shield" aria-label="Shielded">🛡️</span>';
  if(p.a&&p.fz)h+='<span class="pw-ic-sm" title="Frozen" aria-label="Frozen">❄️</span>';
  const pk=G&&G.pk&&G.pk[PID]&&G.pk[PID][p.pid];
  if(p.a&&pk)h+=`<span class="pw-par ${pk}">${pk==='odd'?'ODD':'EVEN'}</span>`;
  return h?`<span class="pw-bits">${h}</span>`:'';
}
function pwBtnHTML(){
  const me=byPid(PID);
  return me&&me.a&&canAct()?'<button class="btn sm pw-btn" id="pwBtn">⚡ Powers</button>':'';
}

/* ---------- Powers sheet ---------- */
function pwClose(){ui.pwOpen=false;closeOv()}
function pwSheetHTML(){
  const me=byPid(PID);
  const cards=pwDefs().map(d=>{
    let why=pwCan(me,d.id,d.id==='peek'?'x':null);
    if(!why&&myCoins()<d.cost)why='Not enough coins';
    if(why==='Pick another player')why=G.players.some(p=>p.a&&p.pid!==PID)?'':'Nobody to peek at';
    return `<div class="pw-card ${why?'off':''}"><span class="pw-ic">${d.icon}</span><span class="pw-tx"><span class="pw-nm"><b>${d.name}</b><span class="pw-cost">${pwCoinSVG(13)}${d.cost}</span></span><span class="pw-ds">${d.desc}</span>${why?`<em class="pw-why">${esc(why)}</em>`:''}</span><button class="btn sm go" data-pw="${d.id}" ${why?'disabled':''}>Use</button></div>`;
  }).join('');
  return `<div class="sheet pw-sheet"><h2>⚡ Powers</h2><div class="pw-have">${pwCoinPill(me)}</div><div class="pw-list">${cards}</div><div class="btn-row"><button class="btn" id="pwClose">Close</button></div></div>`;
}
function pwPeekHTML(){
  const others=G.players.filter(p=>p.a&&p.pid!==PID);
  return `<div class="sheet pw-sheet"><h2>👀 Peek at who?</h2><div class="pw-targets">${others.map(p=>`<button class="pw-tg" data-pwtg="${esc(p.pid)}"><span class="mini">${charSVG(pv(p),'idle')}</span><b>${esc(p.name)}</b></button>`).join('')}</div><div class="btn-row"><button class="btn" id="pwBack">Back</button><button class="btn" id="pwClose">Close</button></div></div>`;
}
function pwShow(html){
  openOv(html,e=>{if(e.target===document.getElementById('ov'))pwClose()});
  const g=id=>document.getElementById(id);
  if(g('pwClose'))g('pwClose').onclick=()=>{sfx('pick');pwClose()};
  if(g('pwBack'))g('pwBack').onclick=()=>{sfx('pick');pwShow(pwSheetHTML())};
  document.querySelectorAll('[data-pw]').forEach(b=>b.onclick=()=>{
    sfx('pick');
    if(b.dataset.pw==='peek')pwShow(pwPeekHTML());else pwSend(b.dataset.pw,null);
  });
  document.querySelectorAll('[data-pwtg]').forEach(b=>b.onclick=()=>{sfx('pick');pwSend('peek',b.dataset.pwtg)});
}
function pwOpen(){
  if(!G||!canAct())return;
  sfx('pick');ui.pwOpen=true;pwShow(pwSheetHTML());
}
function pwSend(id,tg){
  if(!G||!canAct())return;
  const d=pwDef(id);if(!d||myCoins()<d.cost)return;
  setP({pw:{gid:G.gid,turn:G.turnNo,id,tg:tg||null}});
  pwClose();
}
function pwBind(){
  const b=document.getElementById('pwBtn');if(b)b.onclick=pwOpen;
  if(ui.pwOpen){
    const ov=document.getElementById('ov');
    if(!ov||ov.hidden||!ov.querySelector('.pw-sheet'))ui.pwOpen=false;
    else if(!G||!canAct())pwClose();
  }
}

/* ---------- Events ---------- */
function pwBubble(ev,pid,text){
  ui.bubble={pid,id:ev.id,up:true,text};
  later(()=>{if(ui.bubble&&ui.bubble.id===ev.id){ui.bubble=null;render(true)}},1800);
  render(true);
}
function pwEvent(ev){
  const A=byPid(ev.a);
  pwSpend(ev);
  if(ev.t==='snap'){
    const id=++sceneSeq,t0=Date.now();
    const who=A?(A.pid===PID?'You':esc(A.name)):'Someone';
    openOv(`<div class="sheet center"><div class="stage pw-stage">${A?`<div class="actor a-dance">${charSVG(pv(A),'happy')}</div>`:''}</div><h2>INSTANT SHOWDOWN!</h2><p>${who} pulled everyone into the guess zone!</p></div>`,()=>{if(id===sceneSeq&&Date.now()-t0>500)closeOv()});
    later(()=>{if(id===sceneSeq)closeOv()},2600);
    sfx('vo_final');sfx('wheelland',{delay:0.2});
  }
  else if(ev.t==='peek'){pwBubble(ev,ev.tg,'👀');sfx('pick')}
  else if(ev.t==='double')sfx('land');
  else if(ev.t==='shield'){pwBubble(ev,ev.a,'🛡️');sfx('lock')}
  else if(ev.t==='blocked'){pwBubble(ev,ev.tg,'Blocked!');sfx('bonk')}
  else if(ev.t==='freeze'||ev.t==='frozen'){pwBubble(ev,ev.tg,'❄️');sfx('zap')}
}
function pwEvText(ev,a,t){
  const T=byPid(ev.tg);
  switch(ev.t){
    case 'snap':return `${a} pulled everyone into the guess zone!`;
    case 'peek':return `${a} peeked at ${t}.`;
    case 'double':return `${a} doubled down.`;
    case 'shield':return `${a} raised a shield.`;
    case 'blocked':return `${T&&T.pid===PID?'Your':t+'’s'} shield blocked ${a==='You'?'you':a}!`;
    case 'freeze':return `${a} froze ${t}.`;
    case 'frozen':return `${T&&T.pid===PID?'You are':t+' is'} frozen and ${T&&T.pid===PID?'skip':'skips'} a turn.`;
  }
  return '';
}
