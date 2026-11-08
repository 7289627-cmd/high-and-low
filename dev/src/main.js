
/* ---------- Storage + identity ---------- */
const LS={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},
  del(k){try{localStorage.removeItem(k)}catch(e){}}};
const uid=()=>Math.random().toString(36).slice(2,10);
const clean=s=>String(s||'').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g,'').trim().slice(0,12);
let PID=LS.get('hl-pid'); if(typeof PID!=='string'){PID='p'+uid();LS.set('hl-pid',PID)}
{const t=(location.hash.match(/player=(\w{1,8})/)||[])[1];if(t)PID+='-'+t;}
let NAME=clean(LS.get('hl-name'))||'';
const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ';
const ARROW_UP=`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2l6 8H10v4H6v-4H2z" fill="currentColor"/></svg>`;
const ARROW_DN=`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14l6-8H10V2H6v4H2z" fill="currentColor"/></svg>`;

/* ---------- App state ---------- */
let view='home', mode=null, code=null, isHost=false;
let roomNS=null, roomState='checking', R=null, connected=false, joinedAt=0;
let myPres={}, peerMap=new Map(), lastSeen={};
let G=null, botSecrets={}, mySecret=null;
let lastEv=null, evPrimed=null, winShown=null;
let ui={target:null,dir:'h',step:'dir',num:'',sec:'',land:false,err:'',show:false,bubble:null,seq:null,leaveArmed:false,homeErr:''};
let sched=false, lastSig='', botSched=0, qSched=0, tickTimer=null, wheelSched=null;

const pv=p=>({color:COLORS[p.c%6],acc:p.c,id:p.c});
const byPid=pid=>G&&G.players.find(p=>p.pid===pid);
const zone=p=>p.hi-p.lo+1<=10;
const left=p=>{let n=p.hi-p.lo+1;if(n<=10)n-=p.x.filter(v=>v>=p.lo&&v<=p.hi).length;return n};
const candList=p=>{const o=[];for(let n=p.lo;n<=p.hi;n++)if(!p.x.includes(n))o.push(n);return o};
const getPres=pid=>pid===PID?myPres:(peerMap.get(pid)||{}).pres;

/* ---------- Network ---------- */
function setP(patch){
  for(const k in patch){if(patch[k]===null)delete myPres[k];else myPres[k]=patch[k]}
  if(R)R.presence(patch).catch(()=>{});
  schedule();
}
function rebuildPeers(list){
  peerMap=new Map();
  for(const p of list){
    if(p.isMe)continue;
    const pr=p.presence||{};
    if(pr.code!==code||typeof pr.pid!=='string'||pr.pid===PID)continue;
    const prev=peerMap.get(pr.pid);
    if(!prev||p.updatedAt>prev.updatedAt)peerMap.set(pr.pid,{pres:pr,updatedAt:p.updatedAt});
    lastSeen[pr.pid]=Date.now();
  }
}
async function connectRoom(){
  let r;
  try{r=await roomNS.join('hl-'+code.toLowerCase())}catch(e){r=roomNS}
  R=r;joinedAt=Date.now();
  R.onPeers(ch=>{rebuildPeers(ch.peers);schedule()},()=>{connected=false;schedule()});
  if(R.onConnection)R.onConnection(c=>{connected=c;schedule()},()=>{connected=false;schedule()});
  R.presence(myPres).catch(()=>{});
}
function schedule(){if(sched)return;sched=true;queueMicrotask(()=>{sched=false;update()})}
function update(){
  if(view==='game'){
    if(!isHost){
      let h=null;for(const v of peerMap.values())if(v.pres.role==='host'&&v.pres.game&&typeof v.pres.game==='object')h=v;
      G=h?h.pres.game:null;
      if(G&&!Array.isArray(G.players))G=null;
    } else hostTick();
    syncSecret();answerIfAsked();playNewEvent();
    if(G&&G.seq!==ui.seq){ui.seq=G.seq;ui.target=null;ui.step='dir';ui.num='';ui.err=''}
    if(G&&G.phase==='play'&&G.stage==='wheel'&&ui.wheel!==G.gid){ui.wheel=G.gid;showWheel()}
    if(G&&G.phase==='over'&&winShown!==G.gid+G.en){winShown=G.gid+G.en;later(showWinner,900)}
  }
  render();
}

/* ---------- Host engine ---------- */
function newLobby(){
  return{gid:uid(),phase:'lobby',max:10000,lives:3,players:[{pid:PID,name:NAME||'Host',c:0,bot:0,lo:1,hi:10000,x:[],h:3,a:1,d:''}],
    turn:0,seq:0,stage:'await',q:null,ev:null,en:0,asked:0,win:null};
}
function publishG(){
  setP({game:JSON.parse(JSON.stringify(G))});
  LS.set('hl-host-'+code,{G,botSecrets,at:Date.now()});
}
function freeColor(){for(let c=0;c<6;c++)if(!G.players.some(p=>p.c===c))return c;return 0}
function hostTick(){
  if(!G)return;
  let ch=false;
  const me=byPid(PID);if(me&&me.name!==(NAME||'Host')){me.name=NAME||'Host';ch=true}
  if(G.phase==='lobby'&&mode==='online'){
    for(const [pid,v] of peerMap){
      if(v.pres.role!=='player')continue;
      const nm=clean(v.pres.name)||'Player';
      const p=byPid(pid);
      if(p){if(p.name!==nm){p.name=nm;ch=true}}
      else if(G.players.length<6){G.players.push({pid,name:nm,c:freeColor(),bot:0,lo:1,hi:G.max,x:[],h:G.lives,a:1,d:''});ch=true}
    }
    const before=G.players.length;
    G.players=G.players.filter(p=>p.bot||p.pid===PID||peerMap.has(p.pid));
    if(G.players.length!==before)ch=true;
  }
  if((G.phase==='secrets'||G.phase==='play')&&mode==='online'){
    for(const p of G.players){
      if(!p.a||p.bot||p.pid===PID)continue;
      if(peerMap.has(p.pid))lastSeen[p.pid]=Date.now();
      else if(Date.now()-(lastSeen[p.pid]||Date.now())>30000){markLeft(p);ch=true}
    }
  }
  if(G.phase==='secrets'){
    const ready=G.players.every(p=>!p.a||p.bot||(getPres(p.pid)||{}).ready===G.gid);
    if(ready){G.phase='play';G.stage='wheel';G.seq=0;G.q=null;G.sub=[];G.subN=0;ch=true}
  }
  if(G.phase==='play'&&G.stage==='wheel'&&wheelSched!==G.gid){
    const g=G.gid;wheelSched=g;
    later(()=>{if(G&&G.gid===g&&G.phase==='play'&&G.stage==='wheel'){beginTurn();publishG()}},6000);
  }
  if(G.phase==='play'&&G.stage==='await'){
    const cur=G.players[G.turn];
    if(!G.q){
      if(cur.bot){
        if(botSched!==G.seq){const s=G.seq;botSched=s;later(()=>{if(G&&G.seq===s&&G.stage==='await'&&!G.q&&G.phase==='play'){G.q=botChoose(cur);publishG()}},1500)}
      } else {
        const act=(getPres(cur.pid)||{}).act;
        if(act&&act.gid===G.gid&&act.seq===G.seq&&validAct(cur,act)){
          G.q={seq:G.seq,a:cur.pid,tg:act.tg,t:act.t,dir:act.dir==='l'?'l':'h',x:act.x,n:act.n};ch=true;
        }
      }
    }
    if(G.q){
      const tg=byPid(G.q.tg);
      if(!tg||!tg.a){G.q=null;ch=true}
      else if(tg.bot){
        if(qSched!==G.seq){const s=G.seq;qSched=s;later(()=>{if(G&&G.q&&G.q.seq===s){const b=botSecrets[tg.pid];resolve(G.q.t==='ask'?{ans:G.q.dir==='h'?b>G.q.x:b<G.q.x}:{hit:b===G.q.n})}},800)}
      } else {
        const rep=(getPres(tg.pid)||{}).rep;
        if(rep&&rep.gid===G.gid&&rep.seq===G.seq){resolve(rep);return}
      }
    }
  }
  if(ch)publishG();
}
function validAct(cur,a){
  if(!G.sub||a.tg!==G.sub[0])return false;
  const t=byPid(a.tg);
  if(!t||!t.a||t.pid===cur.pid)return false;
  if(a.t==='ask'){
    if(zone(t)||!Number.isInteger(a.x))return false;
    return a.dir==='l'?(a.x>=t.lo+1&&a.x<=t.hi):(a.x>=t.lo&&a.x<=t.hi-1);
  }
  if(a.t==='guess')return zone(t)&&Number.isInteger(a.n)&&a.n>=t.lo&&a.n<=t.hi&&!t.x.includes(a.n);
  return false;
}
function pickDeath(){const recent=G.players.map(p=>p.d).filter(Boolean).slice(-3);const pool=DEATHS.filter(k=>!recent.includes(k));return pool[rnd(0,pool.length-1)]}
function resolve(res){
  const q=G.q;const a=byPid(q.a),t=byPid(q.tg);if(!a||!t)return;
  G.asked++;let delay=1900;const id=++G.en;
  if(q.t==='ask'){
    const yes=!!res.ans;
    if(q.dir==='h'){if(yes)t.lo=q.x+1;else t.hi=q.x}
    else{if(yes)t.hi=q.x-1;else t.lo=q.x}
    G.ev={id,t:'ask',a:a.pid,tg:t.pid,dir:q.dir,x:q.x,ans:yes?1:0};
  } else if(res.hit){
    t.a=0;t.d=pickDeath();G.ev={id,t:'hit',a:a.pid,tg:t.pid,n:q.n,k:t.d};delay=4200;
  } else {
    t.x.push(q.n);
    if(G.lives>0){
      a.h--;
      if(a.h<=0){a.a=0;a.d=pickDeath();G.ev={id,t:'out',a:a.pid,tg:t.pid,n:q.n,k:a.d};delay=4200}
      else{G.ev={id,t:'bonk',a:a.pid,tg:t.pid,n:q.n};delay=2800}
    } else {G.ev={id,t:'miss',a:a.pid,tg:t.pid,n:q.n};delay=1900}
  }
  G.sub=(G.sub||[]).filter(pid=>pid!==q.tg);
  G.q=null;G.stage='show';publishG();
  const s=G.seq;later(()=>advance(s),delay);
}
function advance(s){
  if(!G||G.seq!==s||G.stage!=='show')return;
  const alive=G.players.filter(p=>p.a);
  if(alive.length<=1){G.phase='over';G.win=alive[0]?alive[0].pid:null;publishG();return}
  G.sub=(G.sub||[]).filter(pid=>{const p=byPid(pid);return p&&p.a});
  if(!G.players[G.turn].a||!G.sub.length){G.turn=nextAlive(G.turn);beginTurn()}
  else{G.seq++;G.stage='await';G.q=null}
  publishG();
}
function nextAlive(i){const n=G.players.length;for(let k=0;k<n;k++){i=(i+1)%n;if(G.players[i].a)return i}return i}
function beginTurn(){
  if(!G.players[G.turn].a)G.turn=nextAlive(G.turn);
  const n=G.players.length,o=[];
  for(let k=1;k<n;k++){const p=G.players[(G.turn+k)%n];if(p.a)o.push(p.pid)}
  G.sub=o;G.subN=o.length;G.seq++;G.stage='await';G.q=null;
}
function markLeft(p){
  p.a=0;p.d=pickDeath();G.ev={id:++G.en,t:'left',tg:p.pid,k:p.d};
  const alive=G.players.filter(x=>x.a);
  if(G.phase==='play'&&alive.length<=1){G.phase='over';G.win=alive[0]?alive[0].pid:null;return}
  if(G.phase==='play'){
    const cur=G.players[G.turn],wasNext=G.sub&&G.sub[0]===p.pid;
    G.sub=(G.sub||[]).filter(x=>x!==p.pid);
    if(G.stage==='await'&&(cur.pid===p.pid||wasNext||(G.q&&(G.q.tg===p.pid||G.q.a===p.pid)))){G.q=null;G.stage='show';const s=G.seq;later(()=>advance(s),3500)}
  }
}
function botChoose(me){
  const t=byPid(G.sub[0]);
  const base={seq:G.seq,a:me.pid};
  if(zone(t)){const c=candList(t);return{...base,tg:t.pid,t:'guess',n:c[rnd(0,c.length-1)]}}
  const span=t.hi-t.lo,j=Math.floor(span*.12),dir=Math.random()<.5?'h':'l';
  let x=Math.floor((t.lo+t.hi)/2)+rnd(-j,j);
  x=dir==='h'?Math.min(t.hi-1,Math.max(t.lo,x)):Math.min(t.hi,Math.max(t.lo+1,x));
  return{...base,tg:t.pid,t:'ask',dir,x};
}
function hostStart(){
  G.gid=uid();G.phase='secrets';G.turn=rnd(0,G.players.length-1);G.seq=0;G.stage='await';G.q=null;G.sub=[];G.subN=0;G.ev=null;G.en=0;G.asked=0;G.win=null;
  botSecrets={};
  for(const p of G.players){Object.assign(p,{lo:1,hi:G.max,x:[],h:G.lives,a:1,d:''});lastSeen[p.pid]=Date.now();if(p.bot)botSecrets[p.pid]=rnd(1,G.max)}
  publishG();
}

/* ---------- Every phone: secret, answering, events ---------- */
function syncSecret(){
  if(!G||!G.gid){mySecret=null;return}
  if(!mySecret||mySecret.gid!==G.gid){const s=LS.get('hl-sec-'+code+'-'+G.gid+'-'+PID);mySecret=s&&s.gid===G.gid?s:null}
}
function answerIfAsked(){
  if(!G||G.phase!=='play'||!G.q||G.q.tg!==PID||!mySecret)return;
  const r=myPres.rep;if(r&&r.gid===G.gid&&r.seq===G.q.seq)return;
  const s=mySecret.n,q=G.q;
  const rep={gid:G.gid,seq:q.seq};
  if(q.t==='ask')rep.ans=q.dir==='l'?s<q.x:s>q.x;else rep.hit=s===q.n;
  setP({rep});
}
function playNewEvent(){
  if(!G)return;
  if(evPrimed!==G.gid){evPrimed=G.gid;lastEv=G.ev?G.ev.id:0;return}
  if(!G.ev||G.ev.id===lastEv)return;
  lastEv=G.ev.id;const ev=G.ev;
  const A=byPid(ev.a),T=byPid(ev.tg);
  if(ev.t==='ask'||ev.t==='miss'){
    ui.bubble={pid:ev.tg,id:ev.id,up:ev.t==='ask'&&!!ev.ans,text:ev.t==='miss'?'Wrong!':(ev.ans?'Yes!':'Nope!')};
    later(()=>{if(ui.bubble&&ui.bubble.id===ev.id){ui.bubble=null;render(true)}},1800);
    if(navigator.vibrate&&ev.tg===PID)try{navigator.vibrate(30)}catch(e){}
  }
  else if(ev.t==='hit'&&T)showScene(ev.k,T,`${A?A.name:'Someone'} guessed ${fmt(ev.n)}!`,`${T.pid===PID?'You':T.name} ${CAPTION[ev.k]}`,3900);
  else if(ev.t==='out'&&A)showScene(ev.k,A,`It wasn't ${fmt(ev.n)}!`,`${A.pid===PID?'You':A.name} ran out of hearts and ${CAPTION[ev.k]}`,3900);
  else if(ev.t==='bonk'&&A)showScene('bonk',A,`It wasn't ${fmt(ev.n)}!`,`${A.pid===PID?'You':A.name} got bonked and lost a heart. ${A.h} left.`,2500);
  else if(ev.t==='left'&&T)showScene(ev.k,T,`${T.name} left the game`,`${T.name} wandered off and ${CAPTION[ev.k]}`,3200);
}
function evText(ev){
  const A=byPid(ev.a),T=byPid(ev.tg);const a=A?(A.pid===PID?'You':A.name):'',t=T?(T.pid===PID?'you':T.name):'';
  switch(ev.t){
    case 'ask':return `${a} asked ${t}: ${ev.dir==='l'?'lower':'higher'} than ${fmt(ev.x)}? ${ev.ans?'Yes.':'No.'}`;
    case 'hit':return `${a} guessed ${fmt(ev.n)}. ${T&&T.pid===PID?'You are':t+' is'} out.`;
    case 'miss':return `${a} guessed ${fmt(ev.n)} for ${t}. Wrong.`;
    case 'bonk':return `${a} missed with ${fmt(ev.n)} and lost a heart.`;
    case 'out':return `${a} missed with ${fmt(ev.n)} and ran out of hearts.`;
    case 'left':return `${T?T.name:'Someone'} left the game.`;
  }return '';
}
function qText(q){
  const A=byPid(q.a),T=byPid(q.tg);const a=A?(A.pid===PID?'You':A.name):'',t=T?(T.pid===PID?'you':T.name):'';
  return q.t==='ask'?`${a} ${A&&A.pid===PID?'are':'is'} asking ${t}: ${q.dir==='l'?'lower':'higher'} than ${fmt(q.x)}?`:`${a} ${A&&A.pid===PID?'are':'is'} guessing ${t} picked ${fmt(q.n)}…`;
}

/* ---------- Overlays ---------- */
function openOv(html,onTap){const o=$('#ov');o.innerHTML=html;o.hidden=false;o.onclick=onTap||null}
function closeOv(){const o=$('#ov');o.hidden=true;o.innerHTML='';o.onclick=null}
function showScene(kind,p,title,text,ms){
  const id=++sceneSeq;
  openOv(`<div class="sheet center"><div class="stage">${SCENES[kind](pv(p))}</div><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`,()=>{if(id===sceneSeq)closeOv()});
  later(()=>{if(id===sceneSeq)closeOv()},ms);
}
function showWinner(){
  if(!G||G.phase!=='over')return;
  ++sceneSeq;
  const w=byPid(G.win);
  let conf='';for(let i=0;i<26;i++)conf+=`<i class="fall" style="left:${rnd(0,96)}%;animation-delay:${(Math.random()*2.4).toFixed(2)}s;background:${COLORS[i%6]}"></i>`;
  const name=w?(w.pid===PID?'You win!':esc(w.name)+' wins!'):'Nobody survived';
  openOv(`<div class="sheet center"><div class="stage">${conf}${w?`<div class="actor a-dance">${charSVG(pv(w),'happy')}</div>`:''}</div><h2>${name}</h2><p>Last bean standing after ${G.asked} questions and guesses.</p>
<div class="btn-row">${isHost?'<button class="btn primary" id="ovLobby">Play again</button>':''}<button class="btn" id="ovClose">Close</button></div></div>`);
  $('#ovClose').onclick=closeOv;
  const l=$('#ovLobby');if(l)l.onclick=()=>{closeOv();toLobby()};
}
function toLobby(){if(!isHost||!G)return;G.phase='lobby';G.q=null;G.ev=null;G.gid=uid();publishG()}

/* ---------- Actions ---------- */
async function startOnline(asHost,c){
  if(!roomNS)return;
  mode='online';isHost=asHost;code=c;view='game';
  myPres={pid:PID,name:NAME||'Player',code,role:asHost?'host':'player'};
  if(asHost){const saved=LS.get('hl-host-'+code);if(saved&&saved.G&&Date.now()-saved.at<3*3600e3){G=saved.G;botSecrets=saved.botSecrets||{}}else G=newLobby();myPres.game=JSON.parse(JSON.stringify(G))}
  else G=null;
  LS.set('hl-session',{code,host:asHost,at:Date.now()});
  render(true);
  try{await connectRoom()}catch(e){roomState='none'}
  schedule();
  clearInterval(tickTimer);tickTimer=setInterval(schedule,4000);
}
function startSolo(){
  mode='solo';isHost=true;code='solo';view='game';R=null;peerMap=new Map();
  G=newLobby();
  for(let i=0;i<2;i++)addBot();
  myPres={pid:PID,name:NAME||'You',code,role:'host'};
  schedule();
}
function addBot(){
  if(G.players.length>=6)return;
  const used=G.players.map(p=>p.name);const nm=BOT_NAMES.find(n=>!used.includes(n))||'Bot';
  G.players.push({pid:'bot-'+uid(),name:nm,c:freeColor(),bot:1,lo:1,hi:G.max,x:[],h:G.lives,a:1,d:''});
}
async function leaveGame(){
  clearTimers();clearInterval(tickTimer);closeOv();
  try{if(R&&R!==roomNS&&R.leave)await R.leave();else if(R)await R.presence({code:null,role:null,game:null,act:null,rep:null,ready:null})}catch(e){}
  LS.del('hl-session');if(isHost&&code)LS.del('hl-host-'+code);
  R=null;view='home';mode=null;G=null;code=null;isHost=false;myPres={};peerMap=new Map();ui={...ui,target:null,leaveArmed:false,bubble:null};
  render(true);
}
function lockSecret(n){
  ui.sec='';mySecret={gid:G.gid,n};LS.set('hl-sec-'+code+'-'+G.gid+'-'+PID,mySecret);
  setP({ready:G.gid});
}
function sendAct(act){setP({act:{gid:G.gid,seq:G.seq,...act}})}
function doAsk(){
  const t=curTarget();if(!t||!askViewOn())return;
  const x=Number(ui.num);
  const lo=ui.dir==='l'?t.lo+1:t.lo, hi=ui.dir==='l'?t.hi:t.hi-1;
  if(!Number.isInteger(x)||x<lo||x>hi){ui.err=`Pick a whole number from ${fmt(lo)} to ${fmt(hi)}.`;render(true);return}
  ui.err='';sendAct({tg:t.pid,t:'ask',dir:ui.dir,x});ui.step='dir';ui.num='';
}

/* ---------- Render ---------- */
function render(force){
  const sig=JSON.stringify([view,mode,roomState,connected,G,{...ui,land:0},mySecret,myPres.act,myPres.ready,
    G&&G.players.map(p=>[(getPres(p.pid)||{}).ready,peerMap.has(p.pid)]),NAME,!!(G||Date.now()-joinedAt>7000)]);
  if(!force&&sig===lastSig)return;lastSig=sig;
  const ae=document.activeElement,keepId=ae&&ae.id,selS=ae&&ae.selectionStart;
  const app=$('#app');
  app.innerHTML=view==='home'?homeHTML():gameHTML();
  bind();
  if(keepId){const el=document.getElementById(keepId);if(el&&el.tagName==='INPUT'){el.focus({preventScroll:true});try{if(selS!=null)el.setSelectionRange(selS,selS)}catch(e){}}}
}
function homeHTML(){
  const sess=LS.get('hl-session');const canRejoin=sess&&sess.code&&Date.now()-sess.at<3*3600e3&&roomState==='ok';
  const lineup=COLORS.map((c,i)=>`<span class="lu">${charSVG({color:c,acc:i,id:i},'idle','bob')}</span>`).join('');
  const online=roomState==='ok';
  return `<main class="scroll">
<section class="hero"><h1 class="logo big">High<span>&amp;</span>Low</h1><div class="lineup">${lineup}</div></section>
<section class="panel">
 <div class="field"><label for="nameIn">Your name</label><input id="nameIn" maxlength="12" autocomplete="nickname" value="${esc(NAME)}" placeholder="Type your name"></div>
 ${canRejoin?`<button class="btn go full" id="rejoinBtn">Rejoin room ${esc(sess.code)}</button>`:''}
 <div class="home-actions">
  <button class="btn primary big full" id="hostBtn" ${online?'':'disabled'}>Host a game</button>
  <div class="or">OR JOIN</div>
  <div class="join-row"><input id="codeIn" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="CODE" aria-label="Room code"><button class="btn" id="joinBtn" ${online?'':'disabled'}>Join</button></div>
  ${ui.homeErr?`<p class="err">${esc(ui.homeErr)}</p>`:''}
 </div>
 <div class="or">OR</div>
 <button class="btn full" id="soloBtn">Practice vs bots</button>
 ${roomState==='checking'?'<p class="tip">Connecting to rooms…</p>':''}
 ${roomState==='none'?'<div class="warn">Rooms only work when everyone opens this game in Claude while signed in, and the game has been shared with them. You can still practice against bots.</div>':''}
</section>
</main>`;
}
function headerHTML(){
  const st=mode==='solo'?'<span class="status solo"><i></i>Practice</span>':(connected?'<span class="status"><i></i>Live</span>':'<span class="status off"><i></i>Connecting</span>');
  return `<header class="bar"><h1 class="logo small">High<span>&amp;</span>Low</h1>${mode==='online'?`<span class="pill">${esc(code)}</span>`:''}${st}<button class="btn sm" id="leaveBtn">${ui.leaveArmed?'Tap to leave':'Leave'}</button></header>`;
}
function gameHTML(){
  if(!G){
    const long=Date.now()-joinedAt>7000;
    return headerHTML()+`<main class="scroll"><section class="panel center"><div class="big-bean">${charSVG({color:COLORS[2],acc:4,id:2},'scared','bob')}</div><h2>Looking for room ${esc(code)}…</h2>
${long?'<p class="tip">Make sure the host has the game open on their phone and the code is right. The host may also need to share this game with you in Claude.</p>':'<p class="tip">Hang tight.</p>'}</section></main>`;
  }
  if(G.phase==='lobby')return headerHTML()+lobbyHTML();
  if(G.phase==='secrets')return headerHTML()+secretsHTML();
  if(!byPid(PID)&&G.phase!=='over')return headerHTML()+`<main class="cast">${G.players.map(cardHTML).join('')}</main><section class="tray"><p class="hint">A round is already going. You're watching, and you'll be in the next one.</p></section>`;
  if(askViewOn())return headerHTML()+askViewHTML();
  return headerHTML()+`<main class="cast">${G.players.map(cardHTML).join('')}</main><section class="tray" aria-live="polite">${trayHTML()}</section>`;
}
function canAct(){
  if(!G||G.phase!=='play')return false;
  const cur=G.players[G.turn];const sent=myPres.act&&myPres.act.gid===G.gid&&myPres.act.seq===G.seq;
  return cur&&cur.pid===PID&&G.stage==='await'&&!G.q&&!sent;
}
function curTarget(){return G&&G.phase==='play'&&G.stage!=='wheel'&&G.sub&&G.sub.length?byPid(G.sub[0]):null}
function askViewOn(){const t=curTarget();return canAct()&&t&&t.a&&!zone(t)}
const BIG_UP=`<svg class="arrow" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8l40 46H66v38H34V54H10z" fill="#fff" stroke="#1E2240" stroke-width="6" stroke-linejoin="round"/></svg>`;
const BIG_DN=`<svg class="arrow" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 92l40-46H66V8H34v38H10z" fill="#fff" stroke="#1E2240" stroke-width="6" stroke-linejoin="round"/></svg>`;
const BKSP=`<svg viewBox="0 0 32 24" aria-hidden="true" width="30" height="22"><path d="M10 2h19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H10L1 12z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M15 8l8 8M23 8l-8 8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;
function padHTML(extra,rise){
  const k=n=>`<button class="key" data-k="${n}">${n}</button>`;
  return `<div class="pad ${rise?'rise':''}">${[1,2,3,4,5,6,7,8,9].map(k).join('')}<button class="key del" data-k="del" aria-label="Delete">${BKSP}</button>${k(0)}${extra}</div>`;
}
function askViewHTML(){
  const t=curTarget(),me=byPid(PID);
  const k=(G.subN||1)-G.sub.length+1;
  const top=`<div class="ask-top">${ui.step==='num'?'<button class="btn sm" id="askBack">Back</button>':`<span class="qcount">Question ${k} of ${G.subN}</span>`}
<div class="ask-who"><span class="mini">${charSVG(pv(t),'scared','bob')}</span><div><b>Asking ${esc(t.name)}</b><span>${fmt(t.lo)} – ${fmt(t.hi)}</span></div></div></div>`;
  if(ui.step!=='num'){
    return `<section class="askv">${top}<div class="split">
<button class="half hi" data-pickdir="h">${BIG_UP}<span class="word">HIGHER</span></button>
<button class="half lo" data-pickdir="l"><span class="word">LOWER</span>${BIG_DN}</button>
<div class="speaker"><span class="spk-bean jit-slow">${charSVG(pv(me),'talk')}</span><div class="speech"><span class="jit">Is it…</span></div></div>
</div></section>`;
  }
  const land=ui.land;ui.land=false;
  const word=ui.dir==='l'?'LOWER':'HIGHER';
  const lo=ui.dir==='l'?t.lo+1:t.lo,hi=ui.dir==='l'?t.hi:t.hi-1;
  const shown=ui.num?fmt(ui.num):'';
  return `<section class="askv">${top}
<div class="say"><span class="spk-bean ${ui.num?'jit-slow':'jit'}">${charSVG(pv(me),'talk')}</span>
<div class="speech big ${land?'pop':''}"><span>Is it</span> <button class="dirword ${ui.dir==='l'?'lo':'hi'} ${land?'land':''}" id="flipDir" aria-label="Switch to ${ui.dir==='l'?'higher':'lower'}">${word}</button> <span>than</span> <span class="numslot ${ui.num?'jit':''}">${slotsHTML(ui.num,String(G.max).length)}<span class="qm">?</span></span></div></div>
<p class="sub ask-hint"><span>Pick from ${fmt(lo)} to ${fmt(hi)}.</span><span>Tap ${word.toLowerCase()} to flip it.</span></p>
${ui.err?`<p class="err">${esc(ui.err)}</p>`:''}
${padHTML(`<button class="key mid" data-k="mid">MID</button>`,land)}
<button class="btn primary big full" id="askGo" ${ui.num?'':'disabled'}>Ask ${esc(t.name)}!</button>
</section>`;
}
function slotsHTML(str,n){
  const pad=Math.max(0,n-str.length);let h='';
  for(let i=0;i<n;i++){
    if(i>0&&(n-i)%3===0)h+=`<i class="sep ${i<=pad?'e':''}">,</i>`;
    const ch=i<pad?'':str[i-pad];
    h+=`<span class="slot ${ch?'':'e'}">${ch||'&nbsp;'}</span>`;
  }
  return `<span class="slots" aria-label="${str?fmt(str):'empty'}">${h}</span>`;
}
function wheelSVG(){
  const ps=G.players,n=ps.length,R=134,c=140;
  const pt=a=>{const r=a*Math.PI/180;return[(c+R*Math.sin(r)).toFixed(2),(c-R*Math.cos(r)).toFixed(2)]};
  let s='';
  ps.forEach((p,i)=>{
    const a0=i*360/n,a1=(i+1)*360/n,[x0,y0]=pt(a0),[x1,y1]=pt(a1),mid=(a0+a1)/2;
    s+=n===1?`<circle cx="${c}" cy="${c}" r="${R}" fill="#FFF8EC"/>`:`<path d="M${c} ${c}L${x0} ${y0}A${R} ${R} 0 ${a1-a0>180?1:0} 1 ${x1} ${y1}Z" fill="${i%2?'#F1E4CB':'#FFF8EC'}" stroke="#1E2240" stroke-width="3" stroke-linejoin="round"/>`;
    const bean=charSVG(pv(p),'idle').replace(/^<svg[^>]*>/,`<svg x="${c-24}" y="${c-R+16}" width="48" height="67" viewBox="0 -14 100 140">`);
    s+=`<g transform="rotate(${mid.toFixed(2)} ${c} ${c})">${bean}<text x="${c}" y="${c-R+100}" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="15" fill="#1E2240">${esc(p.name)}</text></g>`;
  });
  s+=`<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="#1E2240" stroke-width="6"/><circle cx="${c}" cy="${c}" r="20" fill="#1E2240"/><text x="${c}" y="${c+8}" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="22" fill="#FFD23F">?</text>`;
  return `<svg viewBox="0 0 280 280" aria-hidden="true">${s}</svg>`;
}
function showWheel(){
  if(!G)return;
  const id=++sceneSeq,n=G.players.length,w=360/n,first=G.players[G.turn];
  const final=360*6-(G.turn+.5)*w+(Math.random()-.5)*w*.6;
  openOv(`<div class="sheet center"><h2>Who goes first?</h2><div class="wheel-wrap"><div class="wheel" id="wheel">${wheelSVG()}</div>
<svg class="pointer" viewBox="0 0 40 44" aria-hidden="true"><path d="M20 42L4 6h32z" fill="#EE4B3B" stroke="#1E2240" stroke-width="4" stroke-linejoin="round"/></svg></div>
<p id="wheelMsg" class="wheel-msg">Spinning…</p></div>`);
  const el=$('#wheel');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(el)el.style.transform=`rotate(${final}deg)`}));
  later(()=>{if(id!==sceneSeq)return;const m=$('#wheelMsg');if(m){m.textContent=first.pid===PID?'You go first!':`${first.name} goes first!`;m.classList.add('win')}buzz(40)},4300);
  later(()=>{if(id===sceneSeq)closeOv()},5800);
}
function padPress(k){
  const field=G.phase==='secrets'?'sec':'num';
  const maxLen=String(G.max).length;
  let v=ui[field];
  if(k==='del')v=v.slice(0,-1);
  else if(k==='mid'){const t=curTarget();if(t)v=String(ui.dir==='l'?Math.ceil((t.lo+t.hi+1)/2):Math.floor((t.lo+t.hi-1)/2))}
  else if(/^\d$/.test(k)){if(v.length<maxLen&&!(v===''&&k==='0'))v+=k}
  ui[field]=v;ui.err='';render(true);
}
function lobbyHTML(){
  const rows=G.players.map(p=>`<div class="prow2"><span>${charSVG(pv(p),'idle','bob')}</span><span class="who"><b>${esc(p.name)}</b>${p.pid===PID?'<span class="tag up">YOU</span>':''}${p.bot?'<span class="tag">BOT</span>':''}${p.pid===G.players[0].pid&&!p.bot&&mode==='online'?'<span class="tag">HOST</span>':''}</span>
${isHost&&p.bot?`<button class="x" data-rmbot="${esc(p.pid)}" aria-label="Remove ${esc(p.name)}">×</button>`:'<span></span>'}</div>`).join('');
  const full=!byPid(PID)&&G.players.length>=6;
  return `<main class="scroll">
${mode==='online'?`<section class="panel center"><div class="code-label">Room code</div><div class="code">${esc(code)}</div><p class="tip">Friends open this game on their phones, tap Join and type this code.</p></section>`:''}
<section class="panel"><h2>Players <small>${G.players.length} of 6</small></h2><div class="plist">${rows}</div>
${isHost&&G.players.length<6?'<button class="btn sm" id="addBot" style="justify-self:start">+ Add a bot</button>':''}
${full?'<p class="err">This room is full.</p>':''}</section>
<section class="panel"><h2>Number range</h2>
${isHost?`<div class="chips">${[100,1000,10000,100000].map(m=>`<button class="chip-btn" data-max="${m}" aria-pressed="${G.max===m}">1 – ${fmt(m)}</button>`).join('')}</div>`:`<p class="tip">1 – ${fmt(G.max)}</p>`}
<h2>Wrong guesses</h2>
${isHost?`<div class="chips">${[[0,'No penalty'],[1,'1 heart'],[2,'2 hearts'],[3,'3 hearts']].map(([v,l])=>`<button class="chip-btn" data-lives="${v}" aria-pressed="${G.lives===v}">${l}</button>`).join('')}</div>`:''}
<p class="tip">${G.lives?`Everyone starts with ${G.lives} heart${G.lives>1?'s':''}. A wrong exact guess costs one, and running out takes you out too.`:'A wrong exact guess just crosses that number off.'}</p></section>
${isHost?`<button class="btn primary big" id="startBtn" style="justify-self:center" ${G.players.length<2?'disabled':''}>${G.players.length<2?'Waiting for players…':'Start game'}</button>`:'<p class="hint" style="text-align:center">Waiting for the host to start…</p>'}
</main>`;
}
function secretsHTML(){
  const me=byPid(PID);
  const list=G.players.map(p=>{const r=p.bot||(getPres(p.pid)||{}).ready===G.gid;return `<div class="prow2"><span>${charSVG(pv(p),r?'idle':'scared')}</span><span class="who"><b>${esc(p.name)}</b>${p.pid===PID?'<span class="tag up">YOU</span>':''}</span><span class="${r?'state-ok':'state-wait'}">${r?'Ready':'Picking…'}</span></div>`}).join('');
  if(me&&!mySecret)return `<main class="scroll"><section class="panel center"><div class="big-bean">${charSVG(pv(me),'scared','bob')}</div><h2 style="font-family:var(--display);font-weight:400">Pick your secret number</h2><p class="tip">Anything from 1 to ${fmt(G.max)}. Keep your screen to yourself.</p>
<div class="secret-big entry">${slotsHTML(ui.sec,String(G.max).length)}</div>
${ui.err?`<p class="err">${esc(ui.err)}</p>`:''}
${padHTML(`<button class="key mid" data-k="rand">RND</button>`,false)}
<button class="btn go big full" id="lockBtn" ${ui.sec?'':'disabled'}>Lock it in</button></section>
<section class="panel"><h2>Who's ready</h2><div class="ready-list">${list}</div></section></main>`;
  return `<main class="scroll"><section class="panel center"><div class="code-label">Your secret number</div><div class="secret-big">${ui.show&&mySecret?fmt(mySecret.n):'• • • •'}</div><button class="link" id="showBtn">${ui.show?'Hide':'Show'} it</button><p class="tip">Waiting for everyone to lock in.</p></section>
<section class="panel"><h2>Who's ready</h2><div class="ready-list">${list}</div></section></main>`;
}
function cardHTML(p,i){
  if(!p.a)return `<div class="card dead"><span class="pic">${TOMB}</span><span class="info"><span class="nm"><b>${esc(p.name)}</b>${p.pid===PID?'<span class="tag up">YOU</span>':''}</span><span class="rip">${SHORT[p.d]||'Out'}</span></span></div>`;
  const cur=G.players[G.turn];
  const sent=myPres.act&&myPres.act.gid===G.gid&&myPres.act.seq===G.seq;
  const pick=false;
  const total=G.max,lf=(p.lo-1)/total*100,w=Math.max((p.hi-p.lo+1)/total*100,2);
  const hearts=G.lives?`<span class="hearts" aria-label="${p.h} hearts">${'♥'.repeat(Math.max(0,p.h))}<span class="lost">${'♥'.repeat(Math.max(0,G.lives-p.h))}</span></span>`:'';
  const ct=curTarget(),z=zone(p),isT=(ct&&ct.pid===p.pid)||(G.q&&G.q.tg===p.pid);
  const bub=ui.bubble&&ui.bubble.pid===p.pid?`<span class="bubble ${ui.bubble.up?'up':'down'}">${esc(ui.bubble.text)}</span>`:'';
  const turnTag='';
  const mine=p.pid===PID;
  const inner=`<span class="pic">${bub}${charSVG(pv(p),isT||z?'scared':'idle','bob')}</span>
<span class="info"><span class="nm"><b>${esc(p.name)}</b>${mine?'<span class="tag">YOU</span>':''}${p.bot?'<span class="tag">BOT</span>':''}${turnTag}</span>${hearts}
<span class="rng">${fmt(p.lo)} – ${fmt(p.hi)}</span>
<span class="barline ${z?'hot':''}"><i style="left:${lf}%;width:${w}%"></i></span>
${z?`<span class="zone">GUESS ZONE · ${left(p)} LEFT</span>`:`<span class="left">${fmt(p.hi-p.lo+1)} possible</span>`}
${mine&&mySecret?`<span class="left">Yours: <b>${ui.show?fmt(mySecret.n):'••••'}</b> <button class="link reveal" id="showBtn">${ui.show?'hide':'show'}</button></span>`:''}</span>`;
  if(mine)return `<div class="card mine ${i===G.turn?'is-turn':''} ${isT?'is-target':''}">${inner}</div>`;
  return `<button class="card ${i===G.turn&&G.phase==='play'?'is-turn':''} ${isT?'is-target':''} ${pick?'pick':''}" data-pid="${esc(p.pid)}" ${pick?'':'tabindex="-1"'} aria-label="${esc(p.name)}, between ${p.lo} and ${p.hi}">${inner}</button>`;
}
function trayHTML(){
  if(G.phase==='over'){const w=byPid(G.win);return `<div class="turn-name">${w?(w.pid===PID?'You win!':esc(w.name)+' wins!'):'Game over'}</div>${isHost?'<div class="btn-row"><button class="btn primary" id="toLobby">Play again</button></div>':'<p class="hint">Waiting for the host to start another round.</p>'}`}
  const cur=G.players[G.turn],me=byPid(PID),myTurn=cur.pid===PID;
  const evLine=G.ev?`<div class="msg">${esc(evText(G.ev))}</div>`:'';
  const head=`<div class="turn"><span>${charSVG(pv(cur),'idle')}</span><div><div class="turn-name">${myTurn?'Your turn':esc(cur.name)+"'s turn"}</div>${evLine}</div></div>`;
  if(!myTurn){
    const ct=curTarget();
    let body=G.stage==='wheel'?'<p class="hint">Spinning for who goes first…</p>':G.q?`<p class="hint">${esc(qText(G.q))}</p>`:(ct?`<p class="hint">${esc(cur.name)} is about to question ${ct.pid===PID?'you':esc(ct.name)} (${(G.subN||1)-G.sub.length+1} of ${G.subN}).</p>`:`<p class="hint">Waiting for ${esc(cur.name)}…</p>`);
    if(G.q&&G.q.tg===PID)body+=`<p class="sub">Your phone answers for you, honestly.</p>`;
    if(me&&!me.a)body+=`<p class="sub">You're out. Enjoy the chaos.</p>`;
    return head+body;
  }
  const sent=myPres.act&&myPres.act.gid===G.gid&&myPres.act.seq===G.seq;
  if(G.stage!=='await'||G.q||sent)return head+`<p class="hint">${G.q?esc(qText(G.q)):(G.stage==='await'?'Sending…':'')}</p>`;
  const t=curTarget();
  if(!t||!t.a)return head;
  const btns=[];for(let n=t.lo;n<=t.hi;n++){const x=t.x.includes(n);btns.push(`<button class="g" ${x?'disabled':`data-n="${n}"`}>${fmt(n)}</button>`)}
  return head+`<p class="q"><b>${esc(t.name)}</b> is in the guess zone. Pick their exact number.</p><div class="guess-grid">${btns.join('')}</div>
<div class="sub"><span>${G.lives?'Miss and you lose a heart.':'Miss and it gets crossed off.'}</span><span>Question ${(G.subN||1)-G.sub.length+1} of ${G.subN}</span></div>`;
}

/* ---------- Bindings ---------- */
function on(id,fn){const el=document.getElementById(id);if(el)el.onclick=fn;return el}
function bind(){
  if(view==='home'){
    const ni=$('#nameIn');ni.oninput=()=>{NAME=clean(ni.value);LS.set('hl-name',NAME)};
    const ci=$('#codeIn');ci.oninput=()=>{ci.value=ci.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,4)};
    const need=()=>{if(!NAME){ui.homeErr='Type your name first.';render(true);$('#nameIn').focus();return false}ui.homeErr='';return true};
    on('hostBtn',()=>{if(!need())return;let c='';for(let i=0;i<4;i++)c+=CODE_CHARS[rnd(0,CODE_CHARS.length-1)];startOnline(true,c)});
    const join=()=>{if(!need())return;const c=ci.value;if(!/^[A-Z]{4}$/.test(c)){ui.homeErr='Room codes are 4 letters.';render(true);return}startOnline(false,c)};
    on('joinBtn',join);ci.onkeydown=e=>{if(e.key==='Enter')join()};
    on('rejoinBtn',()=>{const s=LS.get('hl-session');if(s)startOnline(!!s.host,s.code)});
    on('soloBtn',()=>{if(!NAME){NAME='You'}startSolo()});
    return;
  }
  on('leaveBtn',()=>{if(ui.leaveArmed){leaveGame()}else{ui.leaveArmed=true;render(true);later(()=>{ui.leaveArmed=false;render(true)},2500)}});
  if(!G)return;
  on('addBot',()=>{addBot();publishG()});
  $$('[data-rmbot]').forEach(b=>b.onclick=()=>{G.players=G.players.filter(p=>p.pid!==b.dataset.rmbot);publishG()});
  $$('[data-max]').forEach(b=>b.onclick=()=>{G.max=+b.dataset.max;publishG()});
  $$('[data-lives]').forEach(b=>b.onclick=()=>{G.lives=+b.dataset.lives;publishG()});
  on('startBtn',()=>{if(isHost&&G.players.length>=2)hostStart()});
  on('toLobby',toLobby);
  on('lockBtn',lockFromPad);
  on('showBtn',e=>{e.stopPropagation();ui.show=!ui.show;render(true)});
  $$('[data-pickdir]').forEach(b=>b.onclick=()=>{ui.dir=b.dataset.pickdir;ui.step='num';ui.num='';ui.land=true;ui.err='';buzz(15);render(true)});
  on('flipDir',()=>{ui.dir=ui.dir==='l'?'h':'l';ui.land=true;ui.err='';buzz(15);render(true)});
  on('askBack',()=>{ui.step='dir';ui.num='';ui.err='';render(true)});
  $$('.key').forEach(b=>b.onclick=()=>{if(b.dataset.k==='rand'){ui.sec=String(rnd(1,G.max));ui.err='';render(true)}else padPress(b.dataset.k);buzz(8)});
  on('askGo',doAsk);
  $$('.g[data-n]').forEach(b=>b.onclick=()=>{const t=curTarget();if(t&&canAct())sendAct({tg:t.pid,t:'guess',n:+b.dataset.n})});
}

function buzz(ms){if(navigator.vibrate)try{navigator.vibrate(ms)}catch(e){}}
function lockFromPad(){const n=Number(ui.sec);if(!Number.isInteger(n)||n<1||n>G.max){ui.err=`Pick a whole number from 1 to ${fmt(G.max)}.`;render(true);return}ui.err='';lockSecret(n)}
document.addEventListener('keydown',e=>{
  if(view!=='game'||!G||e.target.tagName==='INPUT')return;
  const onPad=(G.phase==='secrets'&&byPid(PID)&&!mySecret)||(askViewOn()&&ui.step==='num');
  if(!onPad)return;
  if(/^\d$/.test(e.key))padPress(e.key);
  else if(e.key==='Backspace')padPress('del');
  else if(e.key==='Enter'){if(G.phase==='secrets')lockFromPad();else doAsk()}
});
/* ---------- Boot ---------- */
render(true);
(async()=>{
  try{if(window.HL_CONFIG&&window.makeSupabaseRoom)roomNS=window.makeSupabaseRoom(window.HL_CONFIG);else roomNS=window.claude&&window.claude.use?await window.claude.use('room'):null}catch(e){roomNS=null}
  roomState=roomNS?'ok':'none';render(true);
})();
