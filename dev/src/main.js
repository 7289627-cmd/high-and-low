
/* ---------- Storage + identity ---------- */
const LS={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},
  del(k){try{localStorage.removeItem(k)}catch(e){}}};
const uid=()=>Math.random().toString(36).slice(2,10);
const clean=s=>String(s||'').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g,'').trim().slice(0,12);
let PID=LS.get('hl-pid'); if(typeof PID!=='string'){PID='p'+uid();LS.set('hl-pid',PID)}
{const t=(location.hash.match(/player=(\w{1,8})/)||[])[1];if(t)PID+='-'+t;}
const LSTAG=(location.hash.match(/player=(\w{1,8})/)||[])[1]||'';const LSK=k=>LSTAG?k+'@'+LSTAG:k;
let NAME=clean(LS.get(LSK('hl-name')))||'';
const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ';
const ARROW_UP=`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2l6 8H10v4H6v-4H2z" fill="currentColor"/></svg>`;
const ARROW_DN=`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14l6-8H10V2H6v4H2z" fill="currentColor"/></svg>`;

/* ---------- App state ---------- */
let view='home', mode=null, code=null, isHost=false;
let isPub=false, roomNS=null, roomState='checking', R=null, connected=false, joinedAt=0;
let myPres={}, peerMap=new Map(), lastSeen={};
let G=null, botSecrets={}, mySecret=null;
let lastEv=null, evPrimed=null, winShown=null;
let ui={target:null,dir:'h',step:'dir',num:'',sec:'',land:false,err:'',show:false,bubble:null,seq:null,leaveArmed:false,homeErr:'',codeIn:'',inviteCopied:false,inviteUrl:'',timerSeq:null,timerStart:0,picker:false,pops:[],tauntUntil:0};
let discSince=0, timerSched='';
let sched=false, lastSig='', botSched=0, botAt=0, qSched=0, tickTimer=null, wheelSched=null;

function sfx(k,o){try{SFX.play(k,o)}catch(e){}}
const babRate=()=>{const me=G&&byPid(PID);return 0.9+((me?me.c:0)%6)*0.07};
const sfxSeen={hint:new Set(),seq:new Set(),go:new Set(),burst:new Set(),final:new Set(),hurry:new Set(),over:new Set(),lobby:{gid:null,n:0}};
let hbTimer=null,hbPeriod=0;
function hint(key,text){return '';if(LS.get('hl-hint-'+key))return '';if(!sfxSeen.hint.has(key)){sfxSeen.hint.add(key);sfx('hint')}return `<div class="hint-pop"><span>${text}</span></div>`}
function seen(key){LS.set('hl-hint-'+key,1)}
const hatCount=()=>typeof HAT_NAMES!=='undefined'?HAT_NAMES.length:ACC.length;
const hatName=i=>typeof HAT_NAMES!=='undefined'?HAT_NAMES[i]:'Hat '+(i+1);
const HAT_NEED=[0,0,0,0,0,0,1,2,3,5,8,12];
const winsN=()=>{const w=LS.get(LSK('hl-wins'));return Number.isInteger(w)&&w>0?w:0};
const hatUnlocked=i=>i<6||winsN()>=(HAT_NEED[i]||99);
const validLook=l=>l&&typeof l==='object'&&Number.isInteger(l.c)&&l.c>=0&&l.c<6&&Number.isInteger(l.k)&&l.k>=0&&l.k<hatCount()?{c:l.c,k:l.k}:null;
function myLook(){const l=validLook(LS.get(LSK('hl-look')));if(!l)return null;if(!hatUnlocked(l.k))l.k=l.c;return l}
const pv=p=>({color:COLORS[p.c%6],acc:(p.k!=null?p.k:p.c),id:p.c});
const TAUNTS=['😂','😱','🤔','😈','🙏','🔥'];
let tnN=Math.floor(Date.now()/1000),tnSeen={},popId=0,newHatIdx=null;
function addPop(pid,e){
  const id=++popId;ui.pops.push({pid,e,id,until:Date.now()+1600});
  later(()=>{ui.pops=ui.pops.filter(x=>x.until>Date.now());render(true)},1660);
}
function popHTML(pid){
  const now=Date.now();
  return ui.pops.filter(x=>x.pid===pid&&x.until>now).map(x=>`<span class="taunt-pop" style="animation-delay:-${((1600-(x.until-now))/1000).toFixed(2)}s">${x.e}</span>`).join('');
}
function trackTaunts(){
  if(G&&G.bt)for(const pid in G.bt){
    const tn=G.bt[pid],k='b:'+pid+':'+G.gid;
    if(!(k in tnSeen)){tnSeen[k]=view==='game'&&G.phase!=='lobby'?0:tn.n}
    if(tn.n>tnSeen[k]){tnSeen[k]=tn.n;addPop(pid,TAUNTS[tn.e]);const p=byPid(pid);sfx('babble'+rnd(1,3),{rate:0.9+((p?p.c:0)%6)*0.07})}
  }
  for(const [pid,v] of peerMap){
    const tn=v.pres.tn,n=tn&&Number.isInteger(tn.n)?tn.n:0;
    if(!(pid in tnSeen)){tnSeen[pid]=n;continue}
    if(n>tnSeen[pid]){
      tnSeen[pid]=n;
      if(Number.isInteger(tn.e)&&tn.e>=0&&tn.e<TAUNTS.length){
        addPop(pid,TAUNTS[tn.e]);botHear(pid,tn.e);
        const p=byPid(pid);sfx('babble'+rnd(1,3),{rate:0.9+((p?p.c:0)%6)*0.07});
      }
    }
  }
}
function tauntSend(e){
  if(Date.now()<ui.tauntUntil||!G)return;
  tnN++;setP({tn:{n:tnN,e}});addPop(PID,TAUNTS[e]);botHear(PID,e);
  sfx('babble'+rnd(1,3),{rate:babRate()});
  ui.tauntUntil=Date.now()+1500;later(()=>render(true),1530);render(true);
}
function tauntBar(){
  const dis=Date.now()<ui.tauntUntil;
  return `<div class="taunt-bar" role="group" aria-label="Taunts">${TAUNTS.map((e,i)=>`<button class="taunt-btn" data-tn="${i}" ${dis?'disabled':''}>${e}</button>`).join('')}</div>`;
}
function countWin(){
  const key=G.gid+':'+G.en;
  if(LS.get(LSK('hl-lastwin'))===key)return;
  LS.set(LSK('hl-lastwin'),key);
  pwEarn();
  const prev=winsN(),now=prev+1;LS.set(LSK('hl-wins'),now);
  newHatIdx=null;
  for(let i=6;i<hatCount();i++){const nd=HAT_NEED[i]||99;if(nd>prev&&nd<=now)newHatIdx=i}
}
const AWARD_DEFS=[['Most Deadly',1,'kills'],['Worst Guesser',2,'misses'],['Closest Call',3,'closest'],['Most Curious',0,'questions']];
function awardsHTML(){
  const st=G.st||{},rows=[];
  const best=(i,min)=>{let b=null,bv=null;for(const p of G.players){const a=st[p.pid];if(!a||a[i]==null)continue;const v=a[i];if(bv===null||(min?v<bv:v>bv)){b=p;bv=v}}return b?{p:b,v:bv}:null};
  const add=(name,r,txt)=>{if(r)rows.push(`<div class="award"><span class="aw-bean">${charSVG(pv(r.p),'idle')}</span><span class="aw-txt"><b>${name}</b><span>${esc(r.p.name)}</span></span><span class="aw-stat">${txt}</span></div>`)};
  let r=best(1);if(r&&r.v>0)add('Most Deadly',r,r.v+(r.v>1?' kills':' kill'));
  r=best(2);if(r&&r.v>0)add('Worst Guesser',r,r.v+(r.v>1?' misses':' miss'));
  r=best(3,true);if(r)add('Closest Call',r,'survived down to '+fmt(r.v)+(r.v===1?' number':' numbers'));
  r=best(0);if(r&&r.v>0)add('Most Curious',r,r.v+(r.v>1?' questions':' question'));
  return rows.length?`<div class="awards">${rows.slice(0,4).join('')}</div>`:'';
}
const byPid=pid=>G&&G.players.find(p=>p.pid===pid);
function kn(aPid,tPid){
  if(!G)return{lo:1,hi:10000,x:[]};
  const m=G.kn&&G.kn[aPid],k=m&&m[tPid];
  if(k)return k;
  const f={lo:1,hi:G.max,x:[]};
  if(isHost){if(!G.kn)G.kn={};if(!G.kn[aPid])G.kn[aPid]={};G.kn[aPid][tPid]=f}
  return f;
}
function vw(aPid,t){const k=kn(aPid,t.pid);return Object.assign({},t,{lo:k.lo,hi:k.hi,x:k.x})}
function mv(t){return vw(PID,t)}
function setDanger(){
  if(!G)return;
  const ls=Math.max(50,G.max*0.02);
  for(const p of G.players){
    if(!p.a){p.dg=0;continue}
    let m=Infinity;
    for(const o of G.players)if(o.a&&o.pid!==p.pid){const l=left(vw(o.pid,p));if(l<m)m=l}
    p.dg=m<=10?3:m<=ls?2:m<=G.max*0.2?1:0;
  }
}
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
let updBurst=0,updT=0;
/* Loop breaker: more than 120 updates in one second means something is feeding itself. Drop to a slow timer so the phone never freezes. */
function schedule(){
  if(sched)return;sched=true;
  const now=Date.now();if(now-updT>1000){updT=now;updBurst=0}
  if(++updBurst>120){setTimeout(()=>{sched=false;update()},250);return}
  queueMicrotask(()=>{sched=false;update()});
}
/* Never trust game state from the network: force every field to the type and range the screens expect. */
function cleanG(g){
  try{
    if(!g||typeof g!=='object'||!Array.isArray(g.players))return null;
    const int=(v,d,lo,hi)=>Number.isInteger(v)?Math.min(hi,Math.max(lo,v)):d;
    const str=(v,n)=>typeof v==='string'?v.slice(0,n):'';
    const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
    if(!['lobby','secrets','play','over'].includes(g.phase))return null;
    g.max=[100,1000,10000,100000].includes(g.max)?g.max:10000;g.pub=g.pub?1:0;
    const hats=typeof hatCount==='function'?hatCount():12;
    g.players=g.players.slice(0,6).filter(p=>p&&typeof p==='object'&&typeof p.pid==='string'&&p.pid).map(p=>{
      p.pid=p.pid.slice(0,40);p.name=clean(p.name)||'Player';p.c=int(p.c,0,0,5);p.k=p.k==null?null:int(p.k,0,0,hats-1);
      p.dg=int(p.dg,0,0,3);if('el' in p)p.el=int(p.el,ELO0,100,3000);
      p.a=p.a?1:0;p.bot=p.bot?1:0;p.hb=p.hb?1:0;p.ez=p.ez?1:0;p.sh=p.sh?1:0;p.fz=p.fz?1:0;p.d=DEATHS.includes(p.d)?p.d:'';
      if('co' in p)p.co=int(p.co,0,0,99999);return p});
    if(!g.players.length)return null;
    {const o={};
      for(const a in obj(g.kn)){
        if(a==='__proto__')continue;
        const m=obj(g.kn[a]),r={};
        for(const t in m){
          const k=m[t];if(t==='__proto__'||!k||typeof k!=='object'||!Number.isInteger(k.lo)||!Number.isInteger(k.hi))continue;
          const lo=int(k.lo,1,1,g.max);
          r[t.slice(0,40)]={lo,hi:int(k.hi,g.max,lo,g.max),x:Array.isArray(k.x)?k.x.filter(Number.isInteger).slice(0,40):[]};
        }
        o[a.slice(0,40)]=r;
      }
      g.kn=o}
    {const o={},b=obj(g.bt);let c=0;for(const k in b){const t=b[k];if(k==='__proto__'||c++>=6||!t||!Number.isInteger(t.n)||!Number.isInteger(t.e)||t.e<0||t.e>5)continue;o[k.slice(0,40)]={n:int(t.n,0,0,1e6),e:t.e}}g.bt=o}
    g.gid=str(g.gid,24);g.turn=int(g.turn,0,0,g.players.length-1);g.seq=int(g.seq,0,0,1e9);
    g.stage=['await','show','wheel','power'].includes(g.stage)?g.stage:'await';
    g.en=int(g.en,0,0,1e9);g.asked=int(g.asked,0,0,1e9);g.turnNo=int(g.turnNo,0,0,1e9);g.pwTurn=int(g.pwTurn,-1,-1,1e9);
    g.sub=Array.isArray(g.sub)?g.sub.filter(s=>typeof s==='string').slice(0,12):[];
    g.subN=int(g.subN,g.sub.length,0,12);g.timer=[0,20,40].includes(g.timer)?g.timer:0;
    g.win=typeof g.win==='string'?g.win.slice(0,40):null;g.bs=typeof g.bs==='number'?g.bs:0.5;
    if(g.q){const q=g.q;
      if(typeof q!=='object'||!['ask','guess','askall'].includes(q.t)||typeof q.a!=='string'||(q.t!=='askall'&&typeof q.tg!=='string'))g.q=null;
      else{q.dir=q.dir==='l'?'l':'h';q.x=int(q.x,1,0,g.max);q.n=int(q.n,1,0,g.max);q.seq=int(q.seq,0,0,1e9);
        if(q.t==='askall'){q.tg='';const xs={};for(const k in obj(q.xs)){if(k==='__proto__')continue;if(Number.isInteger(q.xs[k]))xs[k.slice(0,40)]=int(q.xs[k],1,1,g.max)}q.xs=xs}}}
    if(g.ev){const e=g.ev;
      if(typeof e!=='object'||typeof e.t!=='string')g.ev=null;
      else{e.id=int(e.id,0,0,1e9);e.t=e.t.replace(/[^a-z]/g,'').slice(0,12);e.a=str(e.a,40);e.tg=str(e.tg,40);
        e.n=int(e.n,0,0,g.max);e.x=int(e.x,0,0,g.max);e.k=DEATHS.includes(e.k)?e.k:'anvil';e.dir=e.dir==='l'?'l':'h';e.ans=e.ans?1:0;
        if(e.t==='askall'){const rs={};for(const k in obj(e.rs)){if(k==='__proto__')continue;const v=e.rs[k];if(v&&typeof v==='object'&&Number.isInteger(v.x))rs[k.slice(0,40)]={x:int(v.x,1,0,g.max),ans:v.ans?1:0}}e.rs=rs;e.bl=Array.isArray(e.bl)?e.bl.filter(z=>typeof z==='string').map(z=>z.slice(0,40)).slice(0,6):[]}}}
    const st={};for(const k in obj(g.st)){const v=g.st[k];if(Array.isArray(v))st[k.slice(0,40)]=v.slice(0,4).map(n=>Number.isInteger(n)?n:null)}g.st=st;
    const bx={};for(const k in obj(g.bx)){bx[k]={};for(const j in obj(g.bx[k]))if(Number.isInteger(g.bx[k][j]))bx[k][j]=g.bx[k][j]}g.bx=bx;
    const pk={};for(const k in obj(g.pk)){pk[k]={};for(const j in obj(g.pk[k]))if(g.pk[k][j]==='odd'||g.pk[k][j]==='even')pk[k][j]=g.pk[k][j]}g.pk=pk;
    if(g.pr){const r=g.pr;
      if(typeof r!=='object'||!['snap','peek'].includes(r.k))g.pr=null;
      else{r.id=str(String(r.id),24);r.by=str(r.by,40);r.need=Array.isArray(r.need)?r.need.filter(s=>typeof s==='string').slice(0,6):[];r.until=typeof r.until==='number'?r.until:0;if(r.tg!=null)r.tg=str(r.tg,40)}}
    return g;
  }catch(e){return null}
}
function update(){
  keepAwake();
  if(view==='game'){
    if(!isHost){
      let h=null;for(const v of peerMap.values())if(v.pres.role==='host'&&v.pres.game&&typeof v.pres.game==='object')h=v;
      if(h&&h.pres.gone){const wp=G&&G.pub;eloSkip=true;leaveGame().then(()=>{if(!wp)ui.homeErr='The host left.';render(true)});return}
      if(h){hostSeenAt=Date.now()}
      else if(hostSeenAt&&Date.now()-hostSeenAt>(window.HL_TEST_HOSTLOST_MS||60000)){hostSeenAt=0;const wp=G&&G.pub;eloSkip=true;leaveGame().then(()=>{if(!wp)ui.homeErr='Lost the host.';render(true)});return}
      G=h?cleanG(h.pres.game):null;
    } else hostTick();
    syncSecret();answerIfAsked();try{pwAnswer()}catch(e){}playNewEvent();stateSounds();if(window.showdownTick)try{showdownTick()}catch(e){}
    if(G&&G.phase==='play'&&G.stage==='await'){const k=G.gid+':'+G.seq;if(ui.timerSeq!==k){ui.timerSeq=k;ui.timerStart=Date.now()}}
    if(G&&G.seq!==ui.seq){ui.seq=G.seq;ui.target=null;ui.step='dir';ui.num='';ui.err=''}
    if(G&&G.phase==='play'&&G.stage==='wheel'&&ui.wheel!==G.gid){ui.wheel=G.gid;showWheel()}
    if(G&&G.phase==='over'&&G.win===PID)try{countWin()}catch(e){}
    if(G&&G.phase==='over'&&G.pub)eloApply(G.win===PID);
    if(G&&G.phase==='over')try{botGameDone()}catch(e){}
    try{trackTaunts()}catch(e){}
    trackTick();
    if(G&&G.phase==='over'&&winShown!==G.gid+G.en){winShown=G.gid+G.en;later(showWinner,900)}
  }
  render();
}

function stateSounds(){
  try{
    if(!G)return;
    if(G.phase==='lobby'){
      const L=sfxSeen.lobby,n=G.players.length;
      if(L.gid===G.gid){if(n>L.n)sfx('join');else if(n<L.n)sfx('leave')}
      L.gid=G.gid;L.n=n;
    } else sfxSeen.lobby.gid=null;
    if(G.phase==='play'&&G.stage==='await'){
      const key=G.gid+':'+G.seq;
      if(!sfxSeen.seq.has(key)){
        sfxSeen.seq.add(key);
        const cur=G.players[G.turn];
        if(G.seq===1&&!sfxSeen.go.has(G.gid)){sfxSeen.go.add(G.gid);sfx('vo_go')}
        else if(cur&&cur.pid===PID&&G.sub&&G.sub.length===G.subN)sfx('yourturn');
      }
    }
    if(G.phase==='play'&&G.players.length>=3&&G.players.filter(p=>p.a).length===2&&!sfxSeen.final.has(G.gid)){sfxSeen.final.add(G.gid);sfx('vo_final',{delay:0.6})}
    heartCheck();
  }catch(e){}
}
function heartOn(){
  if(!G||G.phase!=='play'||G.stage!=='await'||!G.sub||!G.sub.length)return 0;
  const t=byPid(G.sub[0]),cur=G.players[G.turn];
  if(!t||!t.a||!cur||(cur.pid!==PID&&t.pid!==PID))return 0;
  const v=vw(cur.pid,t);
  if(!zone(v))return 0;
  return left(v)<=3?600:900;
}
function heartCheck(){
  const per=heartOn();
  if(!per){if(hbTimer){clearInterval(hbTimer);hbTimer=null;hbPeriod=0}return}
  if(hbTimer&&hbPeriod===per)return;
  clearInterval(hbTimer);hbPeriod=per;
  const beat=()=>{if(!heartOn()){clearInterval(hbTimer);hbTimer=null;hbPeriod=0;return}sfx('heart');sfx('heart',{delay:0.18})};
  hbTimer=setInterval(beat,per);beat();
}
function sceneMs(k){return (typeof SCENE_MS!=='undefined'&&SCENE_MS&&SCENE_MS[k])||3900}
function deathSfx(k){
  const d=(window.DEATH_SFX&&window.DEATH_SFX[k])||Object.assign({anvil:[['anvil',.88],['anvil2',.9]],zap:[['zap',.55],['zap',.65],['zap',.78]],rocket:[['whoosh',1.1,.8]],chomp:[['chomp',1.1],['chomp',1.5],['chomp',1.85]],melt:[['melt',.7]],pop:[['pop',1.55],['pop2',1.56]]},window.EXTRA_DEATH_SFX||{})[k]||[];
  d.forEach(x=>sfx(x[0],{delay:x[1],rate:x[2]||1,vol:x[3]==null?1:x[3]}));
}

/* ---------- Host engine ---------- */
function newLobby(){
  return{gid:uid(),phase:'lobby',max:1000,timer:0,players:[Object.assign({pid:PID,name:NAME||'Host',c:0,bot:0,a:1,d:'',dg:0},myLook()||{})],st:{},
    turn:0,seq:0,stage:'await',q:null,ev:null,en:0,asked:0,win:null};
}
function publishG(){
  if(isHost&&G&&G.phase==='play')try{setDanger()}catch(e){}
  setP({game:JSON.parse(JSON.stringify(G))});
  if(!G.pub)LS.set('hl-host-'+code,{G,botSecrets,at:Date.now()});
}
function applyLooks(){
  let ch=false;
  for(const p of G.players){
    if(p.bot)continue;
    const l=p.pid===PID?myLook():validLook((getPres(p.pid)||{}).look);
    if(!l)continue;
    if(p.k!==l.k){p.k=l.k;ch=true}
    if(p.c!==l.c&&!G.players.some(q=>q!==p&&q.c===l.c)){p.c=l.c;ch=true}
  }
  return ch;
}
function freeColor(){for(let c=0;c<6;c++)if(!G.players.some(p=>p.c===c))return c;return 0}
let wdSig='',wdAt=0,hostSeenAt=0,wakeLock=null;
/* Keep the screen on during a game so phones do not lock and drop out. */
function keepAwake(){
  const want=view==='game'&&document.visibilityState==='visible';
  try{
    if(want&&!wakeLock&&navigator.wakeLock){wakeLock=1;navigator.wakeLock.request('screen').then(l=>{wakeLock=l;l.addEventListener('release',()=>{wakeLock=null})}).catch(()=>{wakeLock=null})}
    else if(!want&&wakeLock&&wakeLock.release){wakeLock.release().catch(()=>{});wakeLock=null}
  }catch(e){wakeLock=null}
}
/* Watchdog: a state that should move by itself (showing a result, the wheel, a power, a pending question) may never sit longer than 25 s. */
function watchdog(){
  if(!G||G.phase!=='play'){wdSig='';return false}
  const sig=[G.gid,G.stage,G.seq,G.en,G.q?1:0,G.pr?1:0].join(':');
  if(sig!==wdSig){wdSig=sig;wdAt=Date.now();return false}
  const wc=G.players[G.turn];const selfMoving=G.stage!=='await'||!!G.q||!!(wc&&wc.bot);
  if(!selfMoving||Date.now()-wdAt<(window.HL_TEST_WD_MS||25000))return false;
  wdAt=Date.now();
  if(G.stage==='wheel'){beginTurn();return true}
  G.pr=null;
  if(G.q){G.q=null;if(G.sub&&G.sub.length)G.sub.shift()}
  G.stage='show';const s=G.seq;later(()=>advance(s),300);
  return true;
}
const FILL_NAMES=['Mia','Leo','Zoe','Kai','Ava','Max','Ivy','Sam','Noa','Eli','Luna','Theo','Ruby','Finn','Maya','Jude','Nova','Otis','Remy','Cleo'];
const BAD=['fuck','shit','bitch','cunt','nigg','fagg','whore','slut','bastard','dildo','penis','vagina','rapist','nazi','hitler','retard','twat','wank','porn','pussy','asshole','dickhead','blowjob','kike','chink'];
function tameName(n){const l=String(n||'').toLowerCase().replace(/[^a-z]/g,'');return BAD.some(w=>l.includes(w))?'Bean':n}
function addFillBot(){
  if(G.players.length>=6)return;
  const nm=freshName(G.players.map(p=>p.name));
  const np={pid:'bot-'+uid(),name:nm,c:freeColor(),bot:1,hb:1,a:1,d:'',dg:0};
  const k=fillLook();if(k!=null)np.k=k;
  np.el=Math.max(700,myElo()+rnd(-80,80));
  G.players.push(np);
}
/* Public room pacing (host side): fill bots at 1.5, 2.5, 3.5 steps, start 1.5 s after 4 players. Returns true when the game was started. */
let pubAt=0,pubFills=0,pubFullAt=0;
function pubTick(){
  const step=window.HL_TEST_FILL_MS||2000,now=Date.now();
  if(!pubAt){pubAt=now;pubFills=0;pubFullAt=0}
  if(G.max!==playMode().max)G.max=playMode().max;
  if(G.timer!==40)G.timer=40;
  if(G.players.length<PUB_N&&pubFills<PUB_N-1&&now-pubAt>=step*(2.5+pubFills)){pubFills++;addFillBot();publishG()}
  if(G.players.length>=PUB_N){
    if(!pubFullAt)pubFullAt=now;
    if(now-pubFullAt>=1500){pubFullAt=0;hostStart();return true}
  } else pubFullAt=0;
  return false;
}
function hostTick(){
  if(!G)return;
  botLifeTick();
  if(watchdog()){publishG();return}
  let ch=false;
  const me=byPid(PID);const myNm=G.pub?tameName(NAME||'Host'):(NAME||'Host');if(me&&me.name!==myNm){me.name=myNm;ch=true}
  if(me&&G.phase==='lobby'&&me.el!==myElo()){me.el=myElo();ch=true}
  if(G.phase==='lobby'&&mode==='online'){
    for(const [pid,v] of peerMap){
      if(v.pres.role!=='player'||v.pres.gone)continue;
      const nm0=clean(v.pres.name)||'Player',nm=G.pub?tameName(nm0):nm0;
      const p=byPid(pid);
      if(p){if(p.name!==nm){p.name=nm;ch=true}}
      else if(G.players.length<(G.pub?PUB_N:6)){const l=validLook(v.pres.look);const np={pid,name:nm,el:Number.isInteger(v.pres.el)?Math.min(3000,Math.max(100,v.pres.el)):ELO0,c:l&&!G.players.some(q=>q.c===l.c)?l.c:freeColor(),bot:0,a:1,d:'',dg:0};if(l)np.k=l.k;G.players.push(np);ch=true}
    }
    const before=G.players.length;
    G.players=G.players.filter(p=>p.bot||p.pid===PID||(peerMap.has(p.pid)&&!peerMap.get(p.pid).pres.gone));
    if(G.players.length!==before)ch=true;
  }
  if(G.phase==='lobby'&&applyLooks())ch=true;
  if(G.phase==='lobby'&&G.pub&&pubTick())return;
  if((G.phase==='secrets'||G.phase==='play')&&mode==='online'){
    for(const p of G.players){
      if(!p.a||p.bot||p.pid===PID)continue;
      const pp=peerMap.get(p.pid);
      if(pp&&pp.pres.gone){takeOver(p);ch=true}
      else if(pp)lastSeen[p.pid]=Date.now();
      else if(Date.now()-(lastSeen[p.pid]||Date.now())>90000){takeOver(p);ch=true}
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
  if(pwHostTick())ch=true;
  if(G.phase==='play'&&G.stage==='await'){
    const cur=G.players[G.turn];
    if(!cur.a&&!G.q){G.stage='show';const s0=G.seq;later(()=>advance(s0),600);publishG();return}
    if(!G.q){fixSub();if(!G.sub.length){G.stage='show';const s0=G.seq;later(()=>advance(s0),300);publishG();return}}
    if(!G.q){
      if(cur.bot){
        if(botSched!==G.seq||Date.now()-botAt>4000){const s=G.seq;botSched=s;botAt=Date.now();later(()=>{if(G&&G.seq===s&&G.stage==='await'&&!G.q&&G.phase==='play'){const c=G.players[G.turn];if(!c||!c.bot||!c.a)return;G.q=botChoose(c);if(!G.q){G.sub.shift();G.stage='show';later(()=>advance(s),300)}publishG()}},1500)}
      } else {
        const act=(getPres(cur.pid)||{}).act;
        if(act&&act.gid===G.gid&&act.seq===G.seq&&validAct(cur,act)){
          G.q=act.t==='askall'?buildAskAll(cur,act.dir==='l'?'l':'h',act.x):{seq:G.seq,a:cur.pid,tg:act.tg,t:'guess',n:act.n};ch=true;
        } else if(timerSched!==G.gid+':'+G.seq){
          const key=G.gid+':'+G.seq;timerSched=key;
          later(()=>{
            if(!G||G.gid+':'+G.seq!==key||G.phase!=='play'||G.stage!=='await'||G.q)return;
            const c=G.players[G.turn];if(!c||!G.sub||!G.sub.length)return;
            if(G.sub[0]==='*'){
              const f=focusOf(c.pid);if(!f)return;const v=vw(c.pid,f);
              G.q=buildAskAll(c,'h',Math.floor((v.lo+v.hi-1)/2));
            } else {
              const t=byPid(G.sub[0]);if(!t)return;
              const v=vw(c.pid,t),cl=candList(v);if(!cl.length){G.sub.shift();G.stage='show';const s1=G.seq;later(()=>advance(s1),300);publishG();return}
              G.q={seq:G.seq,a:c.pid,tg:t.pid,t:'guess',n:cl[rnd(0,cl.length-1)]};
            }
            publishG();
          },window.HL_TEST_TIMER_MS||(G.timer>0?G.timer:75)*1000);
        }
      }
    }
    if(G.q&&G.q.t==='askall'){
      if(hostAskAll())return;
    } else if(G.q){
      const tg=byPid(G.q.tg);
      if(!tg||!tg.a){G.q=null;ch=true}
      else if(tg.sh){resolve({blocked:1});return}
      else if(tg.bot){
        if(qSched!==G.seq){const s=G.seq;qSched=s;later(()=>{if(G&&G.q&&G.q.seq===s&&G.q.t==='guess'){const b=botSecrets[tg.pid];resolve({hit:b===G.q.n})}},800)}
      } else {
        const rep=(getPres(tg.pid)||{}).rep;
        if(rep&&rep.gid===G.gid&&rep.seq===G.seq){resolve(rep);return}
      }
    }
  }
  if(ch)publishG();
}
function validAct(cur,a){
  if(!G.sub||!G.sub.length)return false;
  if(a.t==='askall'){
    if(G.sub[0]!=='*')return false;
    const f=focusOf(cur.pid);
    if(!f||a.tg!==f.pid||!Number.isInteger(a.x))return false;
    const t=vw(cur.pid,f);
    return a.dir==='l'?(a.x>=t.lo+1&&a.x<=t.hi):(a.x>=t.lo&&a.x<=t.hi-1);
  }
  if(a.tg!==G.sub[0])return false;
  const t0=byPid(a.tg);
  if(!t0||!t0.a||t0.pid===cur.pid)return false;
  const t=vw(cur.pid,t0);
  if(a.t==='guess')return zone(t)&&Number.isInteger(a.n)&&a.n>=t.lo&&a.n<=t.hi&&!t.x.includes(a.n);
  return false;
}
function pickDeath(){const recent=G.players.map(p=>p.d).filter(Boolean).slice(-3);const pool=DEATHS.filter(k=>!recent.includes(k));return pool[rnd(0,pool.length-1)]}
/* alive opponents of pid in circle order; nzOpp = those NOT in the guess zone from pid's views */
function oppsOf(pid){
  const n=G.players.length,i0=G.players.findIndex(p=>p.pid===pid),o=[];
  for(let k=1;k<n;k++){const p=G.players[(i0+k)%n];if(p.a&&p.pid!==pid)o.push(p)}
  return o;
}
function nzOpp(pid){return oppsOf(pid).filter(o=>!zone(vw(pid,o)))}
function focusOf(pid){
  let best=null,bn=0;
  for(const o of nzOpp(pid)){const v=vw(pid,o),sz=v.hi-v.lo+1;if(sz>bn){bn=sz;best=o}}
  return best;
}
function buildAskAll(c,dir,x){
  const f=focusOf(c.pid),fv=vw(c.pid,f),xs={};
  for(const o of nzOpp(c.pid))xs[o.pid]=o.pid===f.pid?x:spreadX(x,fv,vw(c.pid,o),dir);
  return{seq:G.seq,a:c.pid,tg:'',t:'askall',dir,xs};
}
/* drop dead targets, drop '*' steps with nobody left to ask (then everyone in the zone gets a guess step) */
function fixSub(){
  const cur=G.players[G.turn];if(!cur||!Array.isArray(G.sub))return;
  const before=G.sub.length;
  G.sub=G.sub.filter(s=>s==='*'||(s!==cur.pid&&byPid(s)&&byPid(s).a));
  if(G.sub.includes('*')&&!nzOpp(cur.pid).length){
    G.sub=G.sub.filter(s=>s!=='*');
    for(const p of oppsOf(cur.pid))if(!G.sub.includes(p.pid))G.sub.push(p.pid);
  }
  G.subN=Math.max(G.sub.length,(G.subN||0)+G.sub.length-before);
}
let askAt={k:'',t:0};
function hostAskAll(){
  const q=G.q,k=G.gid+':'+q.seq;
  if(askAt.k!==k){askAt={k,t:Date.now()};later(()=>schedule(),650);later(()=>schedule(),6150)}
  const age=Date.now()-askAt.t;
  if(age<600)return false;
  const rep={};let wait=0;
  for(const pid in q.xs){
    const o=byPid(pid);if(!o||!o.a||o.sh||o.bot)continue;
    const r=(getPres(pid)||{}).rep;
    if(r&&r.gid===G.gid&&r.seq===q.seq&&typeof r.ans==='boolean')rep[pid]=r.ans;else wait++;
  }
  if(wait&&age<6000)return false;
  resolveAll(rep);return true;
}
function resolveAll(rep){
  const q=G.q,a=byPid(q.a);if(!a)return;
  G.asked++;const id=++G.en;
  if(!G.st)G.st={};
  const sa=G.st[a.pid]||(G.st[a.pid]=[0,0,0,null]);sa[0]++;
  const rs={},bl=[];
  for(const pid in q.xs){
    const o=byPid(pid);if(!o||!o.a)continue;
    const x=q.xs[pid];
    if(o.sh){o.sh=0;bl.push(pid);continue}
    let yes;
    if(o.bot){const b=botSecrets[pid];yes=q.dir==='h'?b>x:b<x}
    else if(pid in rep)yes=!!rep[pid];
    else continue;
    const k=kn(a.pid,pid);
    if(q.dir==='h'){if(yes)k.lo=x+1;else k.hi=x}
    else{if(yes)k.hi=x-1;else k.lo=x}
    rs[pid]={x,ans:yes?1:0};
    const st=G.st[pid]||(G.st[pid]=[0,0,0,null]),lf=left(vw(a.pid,o));st[3]=st[3]==null?lf:Math.min(st[3],lf);
  }
  G.ev={id,t:'askall',a:a.pid,dir:q.dir,rs,bl};
  const si=(G.sub||[]).indexOf('*');if(si>=0)G.sub.splice(si,1);
  G.q=null;G.stage='show';publishG();
  const s=G.seq;later(()=>advance(s),1500);
}
function resolve(res){
  const q=G.q;const a=byPid(q.a),t=byPid(q.tg);if(!a||!t)return;
  G.asked++;let delay=1900;const id=++G.en;
  if(!G.st)G.st={};
  const sa=G.st[a.pid]||(G.st[a.pid]=[0,0,0,null]),stt=G.st[t.pid]||(G.st[t.pid]=[0,0,0,null]);
  sa[0]++;
  if(res.blocked){
    t.sh=0;G.ev={id,t:'blocked',a:a.pid,tg:t.pid};
  } else if(res.hit){
    t.a=0;t.d=pickDeath();G.ev={id,t:'hit',a:a.pid,tg:t.pid,n:q.n,k:t.d};delay=sceneMs(t.d)+300;
  } else {
    kn(a.pid,t.pid).x.push(q.n);
    G.ev={id,t:'miss',a:a.pid,tg:t.pid,n:q.n};delay=1900;
  }
  if(G.ev.t==='hit')sa[1]++;else if(G.ev.t!=='blocked')sa[2]++;
  if(t.a){const lf=left(vw(a.pid,t));stt[3]=stt[3]==null?lf:Math.min(stt[3],lf)}
  {const si=(G.sub||[]).indexOf(q.tg);if(si>=0)G.sub.splice(si,1)}
  G.q=null;G.stage='show';publishG();
  const s=G.seq;later(()=>advance(s),delay);
}
function advance(s){
  if(!G||G.seq!==s||G.stage!=='show')return;
  const alive=G.players.filter(p=>p.a);
  if(alive.length<=1){G.phase='over';G.win=alive[0]?alive[0].pid:null;publishG();return}
  fixSub();
  if(!G.players[G.turn].a||!G.sub.length){pwPassTurn()}
  else{G.seq++;G.stage='await';G.q=null}
  publishG();
}
function nextAlive(i){const n=G.players.length;for(let k=0;k<n;k++){i=(i+1)%n;if(G.players[i].a)return i}return i}
function beginTurn(){
  if(!G.players[G.turn].a)G.turn=nextAlive(G.turn);
  const cur=G.players[G.turn],sub=[];
  if(nzOpp(cur.pid).length)sub.push('*');
  for(const o of oppsOf(cur.pid))if(zone(vw(cur.pid,o)))sub.push(o.pid);
  G.sub=sub;G.subN=sub.length;G.seq++;G.turnNo=(G.turnNo||0)+1;G.stage='await';G.q=null;
}
/* A leaver becomes a hidden easy bot with a fresh secret that contradicts nobody. */
function takeOver(p){
  p.bot=1;p.hb=1;p.ez=1;
  if(G.phase!=='play'){botSecrets[p.pid]=rnd(1,G.max);return}
  let lo=1,hi=G.max;
  const askers=G.players.filter(o=>o.a&&o.pid!==p.pid);
  for(const o of askers){const k=kn(o.pid,p.pid);lo=Math.max(lo,k.lo);hi=Math.min(hi,k.hi)}
  if(lo>hi){lo=1;hi=G.max}
  const par=[];for(const o of askers){const v=G.pk&&G.pk[o.pid]&&G.pk[o.pid][p.pid];if(v)par.push(v)}
  const ok=(n,par2)=>askers.every(o=>!kn(o.pid,p.pid).x.includes(n))&&(!par2||par.every(v=>(v==='odd')===(n%2===1)));
  let c=[];
  for(let n=lo;n<=hi;n++)if(ok(n,true))c.push(n);
  if(!c.length)for(let n=lo;n<=hi;n++)if(ok(n,false))c.push(n);
  botSecrets[p.pid]=c.length?c[rnd(0,c.length-1)]:rnd(lo,hi);
}
function botChoose(me){
  const base={seq:G.seq,a:me.pid};
  if(G.sub[0]==='*'){
    const dir=Math.random()<.5?'h':'l',xs={};
    for(const o of nzOpp(me.pid)){
      const t=vw(me.pid,o);
      const sk=me.ez?0.15:(G.pub&&me.hb&&Number.isInteger(me.el))?eloSkill(me.el):Math.max(0.1,Math.min(1,(G.bs==null?0.5:G.bs)+botLeaderBias(me.pid,o)));
      xs[o.pid]=botSplit(t,sk,dir,Math.random(),Math.random());
    }
    return{...base,tg:'',t:'askall',dir,xs};
  }
  const t0=byPid(G.sub[0]);if(!t0)return null;const t=vw(me.pid,t0);
  const c=candList(t);if(!c.length)return null;
  return{...base,tg:t.pid,t:'guess',n:c[rnd(0,c.length-1)]};
}
function hostStart(){
  G.gid=uid();G.phase='secrets';G.turn=rnd(0,G.players.length-1);G.seq=0;G.stage='await';G.q=null;G.sub=[];G.subN=0;G.ev=null;G.en=0;G.asked=0;G.win=null;G.st={};
  botSecrets={};
  {const hn=G.players.filter(p=>!p.bot).length;G.bs=hn===1?botSkillBase():0.5}
  G.kn={};
  for(const a of G.players){G.kn[a.pid]={};for(const t of G.players)if(t!==a)G.kn[a.pid][t.pid]={lo:1,hi:G.max,x:[]}}
  for(const p of G.players){Object.assign(p,{a:1,d:'',dg:0});lastSeen[p.pid]=Date.now();if(p.bot)botSecrets[p.pid]=rnd(1,G.max)}
  pwReset();
  publishG();
}

/* ---------- Every phone: secret, answering, events ---------- */
function syncSecret(){
  if(!G||!G.gid){mySecret=null;return}
  if(!mySecret||mySecret.gid!==G.gid){const s=LS.get('hl-sec-'+code+'-'+G.gid+'-'+PID);mySecret=s&&s.gid===G.gid?s:null}
}
function answerIfAsked(){
  if(!G||G.phase!=='play'||!G.q||!mySecret)return;
  const me=byPid(PID);if(!me||me.bot||!me.a)return;
  const q=G.q;
  if(q.t==='askall'){if(!q.xs||!Number.isInteger(q.xs[PID]))return}
  else if(q.tg!==PID)return;
  const r=myPres.rep;if(r&&r.gid===G.gid&&r.seq===q.seq)return;
  const s=mySecret.n;
  const rep={gid:G.gid,seq:q.seq};
  if(q.t==='askall')rep.ans=q.dir==='l'?s<q.xs[PID]:s>q.xs[PID];
  else if(q.t==='ask')rep.ans=q.dir==='l'?s<q.x:s>q.x;else rep.hit=s===q.n;
  setP({rep});
}
function bubOf(pid){const b=ui.bubble;if(!b)return null;if(b.items)return b.items[pid]||null;return b.pid===pid?b:null}
function askallBubbles(ev){
  const rs=ev.rs||{},bl=ev.bl||[],it={},ans=r=>({up:!!r.ans,text:r.ans?'Yes!':'Nope!'});
  if(ev.a===PID){
    for(const pid in rs)it[pid]=ans(rs[pid]);
    for(const pid of bl)it[pid]={up:false,text:'Blocked!'};
  } else if(rs[PID])it[PID]=ans(rs[PID]);
  else if(bl.includes(PID))it[PID]={up:false,text:'Blocked!'};
  else it[ev.a]={up:false,text:'…'};
  return it;
}
function playNewEvent(){
  if(!G)return;
  if(evPrimed!==G.gid){evPrimed=G.gid;lastEv=G.ev?G.ev.id:0;return}
  if(!G.ev||G.ev.id===lastEv)return;
  lastEv=G.ev.id;const ev=G.ev;
  const A=byPid(ev.a),T=byPid(ev.tg);
  try{pwEvent(ev)}catch(e){}
  const inv=ev.a===PID||ev.tg===PID;
  if(ev.t==='askall'){
    const rs=ev.rs||{},bl=ev.bl||[],mine=rs[PID];
    if(ev.a===PID)sfx(Object.values(rs).some(r=>r.ans)?'yes':'nope');
    else if(mine)sfx(mine.ans?'yes':'nope');
    else if(bl.includes(PID))sfx('bonk');
    else sfx('pick');
    ui.bubble={id:ev.id,items:askallBubbles(ev)};
    later(()=>{if(ui.bubble&&ui.bubble.id===ev.id){ui.bubble=null;render(true)}},1800);
    if(mine||bl.includes(PID)){seen('asked');if(navigator.vibrate)try{navigator.vibrate(30)}catch(e){}}
    return;
  }
  if(ev.t==='ask')sfx(inv?(ev.ans?'yes':'nope'):'pick');
  else if(ev.t==='miss')sfx(inv?'nope':'pick');
  else if(ev.t==='bonk'){sfx('bonk');sfx('vo_wrong',{delay:0.45})}
  else if(ev.t==='hit'||ev.t==='out')deathSfx(ev.k);
  if(ev.t==='ask'||ev.t==='miss'){
    ui.bubble=inv?{pid:ev.tg,id:ev.id,up:ev.t==='ask'&&!!ev.ans,text:ev.t==='miss'?'Wrong!':(ev.ans?'Yes!':'Nope!')}:{pid:ev.tg,id:ev.id,up:false,text:ev.t==='miss'?'Miss!':'…'};
    later(()=>{if(ui.bubble&&ui.bubble.id===ev.id){ui.bubble=null;render(true)}},1800);
    if(ev.t==='ask'&&ev.tg===PID)seen('asked');
    if(navigator.vibrate&&ev.tg===PID)try{navigator.vibrate(30)}catch(e){}
  }
  else if(ev.t==='hit'&&T)showScene(ev.k,T,`${A?A.name:'Someone'} guessed ${fmt(ev.n)}!`,`${T.pid===PID?'You':T.name} ${CAPTION[ev.k]}`,sceneMs(ev.k),A||null,ev.n);
  else if(ev.t==='out'&&A)showScene(ev.k,A,`It wasn't ${fmt(ev.n)}!`,`${A.pid===PID?'You':A.name} ran out of hearts and ${CAPTION[ev.k]}`,sceneMs(ev.k));
  else if(ev.t==='bonk'&&A)showScene('bonk',A,`It wasn't ${fmt(ev.n)}!`,`${A.pid===PID?'You':A.name} got bonked and lost a heart. ${A.h} left.`,2500);
}
function evText(ev){
  const A=byPid(ev.a),T=byPid(ev.tg);const a=A?(A.pid===PID?'You':A.name):'',t=T?(T.pid===PID?'you':T.name):'';
  {const pt=pwEvText(ev,a,t);if(pt)return pt}
  if(ev.t==='askall'){
    const r=(ev.rs||{})[PID];
    if(G.players.length===2)return ev.a===PID?'You asked.':`${(byPid(ev.a)||{}).name||'They'} asked.`;
    if(ev.a===PID)return 'You asked everyone.';
    if(r)return `${a} asked you: ${ev.dir==='l'?'lower':'higher'} than ${fmt(r.x)}? ${r.ans?'Yes.':'No.'}`;
    if((ev.bl||[]).includes(PID))return `Your shield blocked ${a}!`;
    return `${a} asked everyone.`;
  }
  const inv=ev.a===PID||ev.tg===PID;
  if(!inv&&ev.t==='ask')return `${a} asked ${t}.`;
  if(!inv&&ev.t==='miss')return `${a} guessed at ${t}. Miss.`;
  switch(ev.t){
    case 'ask':return `${a} asked ${t}: ${ev.dir==='l'?'lower':'higher'} than ${fmt(ev.x)}? ${ev.ans?'Yes.':'No.'}`;
    case 'hit':return `${a} guessed ${fmt(ev.n)}. ${T&&T.pid===PID?'You are':t+' is'} out.`;
    case 'miss':return `${a} guessed ${fmt(ev.n)} for ${t}. Wrong.`;
    case 'bonk':return `${a} missed with ${fmt(ev.n)} and lost a heart.`;
    case 'out':return `${a} missed with ${fmt(ev.n)} and ran out of hearts.`;
  }return '';
}
function qText(q){
  const A=byPid(q.a),T=byPid(q.tg);const a=A?(A.pid===PID?'You':A.name):'',t=T?(T.pid===PID?'you':T.name):'';
  if(q.t==='askall'){
    const x=q.xs&&q.xs[PID];
    if(q.a===PID)return 'You are asking everyone…';
    return Number.isInteger(x)?`${a} is asking you: ${q.dir==='l'?'lower':'higher'} than ${fmt(x)}?`:`${a} is asking everyone…`;
  }
  if(q.a!==PID&&q.tg!==PID)return q.t==='ask'?`${a} is asking ${t}…`:`${a} is guessing at ${t}…`;
  return q.t==='ask'?`${a} ${A&&A.pid===PID?'are':'is'} asking ${t}: ${q.dir==='l'?'lower':'higher'} than ${fmt(q.x)}?`:`${a} ${A&&A.pid===PID?'are':'is'} guessing ${t} picked ${fmt(q.n)}…`;
}

/* ---------- Overlays ---------- */
function openOv(html,onTap){const o=$('#ov');o.innerHTML=html;o.hidden=false;o.onclick=onTap||null}
function closeOv(){const o=$('#ov');o.hidden=true;o.innerHTML='';o.onclick=null}
function showScene(kind,p,title,text,ms,killer,n){
  const id=++sceneSeq;
  openOv(`<div class="sheet center"><div class="stage">${SCENES[kind](pv(p),killer?pv(killer):null,n!=null?fmt(n):'')}</div><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`,()=>{if(id===sceneSeq)closeOv()});
  later(()=>{if(id===sceneSeq)closeOv()},ms);
}
function showWinner(){
  if(!G||G.phase!=='over')return;
  ++sceneSeq;
  const w=byPid(G.win);
  let conf='';for(let i=0;i<26;i++)conf+=`<i class="fall" style="left:${rnd(0,96)}%;animation-delay:${(Math.random()*2.4).toFixed(2)}s;background:${COLORS[i%6]}"></i>`;
  sfx('win');sfx(w&&w.pid===PID?'vo_youwin':'vo_gameover',{delay:0.9});
  const name=w?(w.pid===PID?'You win!':esc(w.name)+' wins!'):'Nobody survived';
  let hatBlock='';const nh=newHatIdx;newHatIdx=null;
  if(nh!=null&&w&&w.pid===PID){hatBlock=`<div class="newhat"><span class="nh-bean">${charSVG({color:COLORS[w.c%6],acc:nh,id:w.c},'happy')}</span><b>New hat unlocked: ${esc(hatName(nh))}!</b></div>`;sfx('lock',{delay:0.5})}
  openOv(`<div class="sheet center has-x"><button class="ov-x" id="ovX" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/></svg></button><div class="stage">${conf}${w?`<div class="actor a-dance">${charSVG(pv(w),'happy')}</div>`:''}</div><h2>${name}</h2>${eloResultHTML()}${w&&w.pid===PID?pwWinBlock():''}${hatBlock}${G.players.length>2?awardsHTML():''}
<div class="btn-row">${G.pub?'<button class="btn primary" id="againBtn">Play again</button>':`${isHost?'<button class="btn primary" id="ovLobby">Play again</button>':''}<button class="btn" id="ovClose">Close</button>`}</div></div>`);
  {const c=$('#ovClose');if(c)c.onclick=()=>{closeOv();HLAds.between()}}
  {const x=$('#ovX');if(x)x.onclick=()=>{closeOv();if(G&&G.pub)HLAds.between().then(leaveGame);else HLAds.between()}}
  {const a=$('#againBtn');if(a)a.onclick=playAgain}
  const l=$('#ovLobby');if(l)l.onclick=()=>{closeOv();HLAds.between().then(toLobby)};
}
function toLobby(){if(!isHost||!G)return;G.players=G.players.filter(p=>!p.hb);G.phase='lobby';G.q=null;G.ev=null;G.gid=uid();publishG()}

/* ---------- Play (quick match) ---------- */
let qp=null,pubTimer=null;
function pubWake(){clearInterval(pubTimer);pubTimer=setInterval(schedule,250)}
function quickStop(){
  clearInterval(pubTimer);pubTimer=null;
  if(qp){clearInterval(qp.ann);try{qp.q&&qp.q.leave()}catch(e){}qp=null}
}
function playAgain(){closeOv();track('again');HLAds.between().then(leaveGame).then(quickPlay)}
function waitHTML(players){
  let list=players;
  if(!list){const l=myLook()||{};list=[{pid:PID,name:NAME||'You',c:l.c!=null?l.c:0,k:l.k!=null?l.k:null}]}
  const rows=list.map(p=>`<div class="prow2"><span class="lpic">${popHTML(p.pid)}${charSVG(pv(p),'idle','bob')}</span><span class="who"><b>${esc(p.name)}</b>${p.pid===PID?'<span class="tag up">YOU</span>':''}${p.bot&&!p.hb?'<span class="tag">BOT</span>':''}</span><span></span></div>`).join('');
  return `<main class="scroll waitv"><h1 class="logo small">High<span>&amp;</span>Low</h1><section class="panel"><div class="plist">${rows}</div></section>
<p class="finding">Finding a match<span class="dots"><i>.</i><i>.</i><i>.</i></span></p>
<button class="btn" id="leaveBtn">Leave</button></main>`;
}
async function quickPlay(){
  quickStop();
  if(!NAME)NAME=FILL_NAMES[rnd(0,FILL_NAMES.length-1)];
  if(offline()){render(true);return}
  if(roomState!=='ok'||!roomNS||!window.makeSupabaseQueue||!window.HL_CONFIG){startSolo(true);return}
  const my={q:null,ann:0};qp=my;
  mode='search';view='game';G=null;code=null;isHost=false;isPub=true;myPres={};peerMap=new Map();
  render(true);
  const opens=[];
  try{
    my.q=window.makeSupabaseQueue(window.HL_CONFIG);
    my.q.onOpen(m=>{if(m&&typeof m.code==='string'&&/^[A-Z]{4}$/.test(m.code)&&Number.isInteger(m.n)&&m.n<PUB_N&&m.n>=1&&m.max===playMode().max)opens.push({code:m.code,n:m.n,t:Date.now()})});
    my.q.join();
  }catch(e){my.q=null}
  const qms=window.HL_TEST_Q_MS||2000;
  await new Promise(r=>setTimeout(r,qms));
  if(qp!==my)return;
  const now=Date.now();
  const best=opens.filter(o=>now-o.t<5000).sort((a,b)=>b.n-a.n)[0];
  const host=()=>{
    if(qp!==my)return;
    let c='';for(let i=0;i<4;i++)c+=CODE_CHARS[rnd(0,CODE_CHARS.length-1)];
    pubAt=Date.now();pubFills=0;pubFullAt=0;
    startOnline(true,c,true);
    G.pub=1;publishG();pubWake();
    if(my.q){
      const ann=()=>{
        if(qp!==my)return;
        if(!G||!isHost||!G.pub||G.phase!=='lobby'){quickStop();return}
        if(G.players.length<PUB_N)my.q.announce({code,n:G.players.length,max:playMode().max,at:Date.now()});
      };
      my.ann=setInterval(ann,Math.min(1500,Math.round(qms*0.75)));ann();
    }
  };
  if(!best||!my.q){host();return}
  try{my.q.leave()}catch(e){}my.q=null;
  startOnline(false,best.code,true);
  await new Promise(r=>setTimeout(r,window.HL_TEST_QJOIN_MS||6000));
  if(qp!==my)return;
  if(G&&byPid(PID))return;
  await leaveGame();
  qp=my;mode='search';view='game';isPub=true;render(true);
  if(qp!==my)return;
  try{my.q=window.makeSupabaseQueue(window.HL_CONFIG);my.q.join()}catch(e){my.q=null}
  host();
}
/* ---------- Actions ---------- */
async function startOnline(asHost,c,pub){
  if(!roomNS)return;
  mode='online';isHost=asHost;code=c;view='game';tnSeen={};isPub=!!pub;
  myPres={pid:PID,name:NAME||'Player',code,role:asHost?'host':'player',el:myElo()};{const l=myLook();if(l)myPres.look=l}
  if(asHost){const saved=pub?null:LS.get('hl-host-'+code);if(saved&&saved.G&&Date.now()-saved.at<3*3600e3){G=saved.G;botSecrets=saved.botSecrets||{}}else G=newLobby();myPres.game=JSON.parse(JSON.stringify(G))}
  else G=null;
  if(!pub)LS.set(LSK('hl-session'),{code,host:asHost,at:Date.now()});
  render(true);
  try{await connectRoom()}catch(e){roomState='none'}
  schedule();
  clearInterval(tickTimer);tickTimer=setInterval(schedule,4000);
}
function startSolo(pub){
  mode='solo';isHost=true;code='solo';view='game';R=null;peerMap=new Map();isPub=!!pub;
  G=newLobby();
  if(pub){G.pub=1;pubAt=Date.now();pubFills=0;pubFullAt=0;pubWake()}
  else for(let i=0;i<2;i++)addBot();
  myPres={pid:PID,name:NAME||'You',code,role:'host'};tnSeen={};
  schedule();
}
function addBot(){
  if(G.players.length>=6)return;
  const used=G.players.map(p=>p.name);const nm=BOT_NAMES.find(n=>!used.includes(n))||'Bot';
  G.players.push({pid:'bot-'+uid(),name:nm,c:freeColor(),bot:1,a:1,d:'',dg:0});
}
async function leaveGame(){
  if(G&&G.pub&&G.phase==='play'&&!eloSkip){const m=byPid(PID);if(m&&m.a)eloApply(false)}eloSkip=false;
  trackLeave();hostSeenAt=0;quickStop();isPub=false;
  clearTimers();clearInterval(tickTimer);closeOv();
  try{if(R&&R!==roomNS&&R.leave)await R.leave();else if(R)await R.presence({code:null,role:null,game:null,act:null,rep:null,ready:null})}catch(e){}
  LS.del(LSK('hl-session'));if(isHost&&code)LS.del('hl-host-'+code);
  R=null;view='home';mode=null;G=null;code=null;pubAt=0;isHost=false;myPres={};peerMap=new Map();ui={...ui,target:null,leaveArmed:false,bubble:null};
  render(true);
}
function lockSecret(n){
  ui.sec='';mySecret={gid:G.gid,n};LS.set('hl-sec-'+code+'-'+G.gid+'-'+PID,mySecret);
  setP({ready:G.gid});
}
function sendAct(act){setP({act:{gid:G.gid,seq:G.seq,...act}})}
function doAsk(){
  const t=curTarget();if(!t||!askViewOn())return;
  const sl=askSlots(mv(t)),x=Number(sl.prefix+ui.num);
  const lo=sl.lo, hi=sl.hi;
  if(!Number.isInteger(x)||x<lo||x>hi){ui.err=`Pick a whole number from ${fmt(lo)} to ${fmt(hi)}.`;sfx('error');render(true);return}
  ui.err='';sfx('send');sendAct({tg:t.pid,t:'askall',dir:ui.dir,x});seen('num');ui.step='dir';ui.num='';
}

/* ---------- Render ---------- */
let nbTimer=null,nbIv=null,nbN=0;
function nbStop(){clearTimeout(nbTimer);clearInterval(nbIv);nbTimer=nbIv=null}
['pointerup','pointercancel','blur','contextmenu'].forEach(t=>window.addEventListener(t,nbStop,true));
document.addEventListener('visibilitychange',nbStop);
let sldDown=false,sldPend=false;
function render(force){
  if(sldDown&&view==='game'&&((askViewOn()&&ui.step==='num')||(G&&G.phase==='secrets'&&!mySecret&&!force))){sldPend=true;return}
  trackConn();
  if(ui.pops.length)ui.pops=ui.pops.filter(x=>x.until>Date.now());
  const sig=JSON.stringify([view,mode,roomState,connected,connBanner(),timerLeft()!==null,G,{...ui,land:0},mySecret,myPres.act,myPres.ready,
    G&&G.players.map(p=>[(getPres(p.pid)||{}).ready,peerMap.has(p.pid)]),NAME,!!(G||Date.now()-joinedAt>7000)]);
  if(!force&&sig===lastSig)return;lastSig=sig;
  const ae=document.activeElement,keepId=ae&&ae.id,selS=ae&&ae.selectionStart;
  const app=$('#app');
  // keep scroll position of scrollable areas across re-renders (taps used to jump back to the top)
  const SCROLLERS=['.scroll','.cast','.picker'];
  const keepScroll=SCROLLERS.map(s=>{const el=app.querySelector(s);return el?el.scrollTop:0});
  const winY=window.scrollY;
  app.innerHTML=view==='home'?homeHTML():gameHTML();
  SCROLLERS.forEach((s,i)=>{const el=app.querySelector(s);if(el&&keepScroll[i])el.scrollTop=keepScroll[i]});
  if(winY)window.scrollTo(0,winY);
  bind();
  kiteStart();
  try{MUSIC.set(view==='home'||!G||G.phase==='lobby'?'home':'play')}catch(e){}
  if(keepId){const el=document.getElementById(keepId);if(el&&el.tagName==='INPUT'){el.focus({preventScroll:true});try{if(selS!=null)el.setSelectionRange(selS,selS)}catch(e){}}}
}
const SCENE_T0=Date.now();
function ph(dur,off){return `animation-delay:-${(((Date.now()-SCENE_T0)/1000+(off||0))%dur).toFixed(2)}s`}
function homeSceneHTML(){
  const bean=(i,mood)=>charSVG({color:COLORS[i%COLORS.length],acc:i%COLORS.length,id:30+i},mood||'happy');
  const nums=['7','?','42','3','?','99'];
  const tree=(l,b,sc,d)=>`<span class="tree" style="left:${l}%;bottom:${b}px;--s:${sc};${ph(4.5,d)}"><i class="crown"></i><i class="crown c2"></i><i class="trunk"></i></span>`;
  const pine=(l,b,sc,d)=>`<span class="tree pine" style="left:${l}%;bottom:${b}px;--s:${sc};${ph(4.5,d)}"><svg viewBox="0 0 64 100"><rect x="26" y="70" width="12" height="28" rx="3" fill="#9A6442" stroke="#1E2240" stroke-width="4"/><path d="M32 44 56 78H8Z" fill="#2E9E68" stroke="#1E2240" stroke-width="4" stroke-linejoin="round"/><path d="M32 24 52 56H12Z" fill="#34AC72" stroke="#1E2240" stroke-width="4" stroke-linejoin="round"/><path d="M32 4 47 34H17Z" fill="#58C98D" stroke="#1E2240" stroke-width="4" stroke-linejoin="round"/></svg></span>`;
  const flower=(l,b,c,d)=>`<i class="flower" style="left:${l}%;bottom:${b}px;--c:${c};${ph(2.6,d)}"></i>`;
  const bird=(cls,dur,off)=>`<span class="bird ${cls}" style="${ph(dur,off)}"><svg viewBox="0 0 28 12"><path d="M2 9Q8 0 14 8Q20 0 26 9" fill="none" stroke="#1E2240" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
  return `<div class="hscene" aria-hidden="true">
<svg class="hsun" viewBox="-90 -90 180 180"><g class="rays" style="${ph(60,0)}" fill="#FFD23F" stroke="#1E2240" stroke-width="5" stroke-linejoin="round"><path d="M-9 -58L0 -84L9 -58Z" transform="rotate(0)"/><path d="M-9 -58L0 -84L9 -58Z" transform="rotate(30)"/><path d="M-9 -58L0 -84L9 -58Z" transform="rotate(60)"/><path d="M-9 -58L0 -84L9 -58Z" transform="rotate(90)"/><path d="M-9 -58L0 -84L9 -58Z" transform="rotate(120)"/><path d="M-9 -58L0 -84L9 -58Z" transform="rotate(150)"/><path d="M-9 -58L0 -84L9 -58Z" transform="rotate(180)"/><path d="M-9 -58L0 -84L9 -58Z" transform="rotate(210)"/><path d="M-9 -58L0 -84L9 -58Z" transform="rotate(240)"/><path d="M-9 -58L0 -84L9 -58Z" transform="rotate(270)"/><path d="M-9 -58L0 -84L9 -58Z" transform="rotate(300)"/><path d="M-9 -58L0 -84L9 -58Z" transform="rotate(330)"/></g><circle r="46" fill="#FFD23F" stroke="#1E2240" stroke-width="6"/><ellipse cx="-16" cy="-18" rx="13" ry="8" fill="#fff" opacity=".55" transform="rotate(-30 -16 -18)"/></svg>
<i class="cloud c1" style="${ph(70,10)}"></i><i class="cloud c2" style="${ph(95,50)}"></i><i class="cloud c3" style="${ph(120,90)}"></i><i class="cloud c4" style="${ph(84,30)}"></i>
${bird('b1',24,3)}${bird('b2',24,4.2)}${bird('b3',31,17)}
${nums.map((n,i)=>`<span class="fnum" style="left:${8+i*16}%;animation-duration:${16+(i*5)%9}s;${ph(16+(i*5)%9,i*3.7)}">${n}</span>`).join('')}
<svg class="hill far" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="M0 200V96C90 40 190 34 300 92S520 150 660 84S880 20 1000 78V200Z" fill="#7AD3A6"/><path d="M0 200V96C90 40 190 34 300 92S520 150 660 84S880 20 1000 78" fill="none" stroke="#1E2240" stroke-width="5" vector-effect="non-scaling-stroke"/></svg>
${tree(9,150,.8,0)}${tree(27,118,.6,1.2)}${tree(63,128,.72,2.1)}${tree(88,160,.9,3)}
<svg class="hill near" viewBox="0 0 1000 160" preserveAspectRatio="none"><path d="M0 160V70C140 16 260 30 400 74S640 120 800 60S940 40 1000 58V160Z" fill="#3FB67A"/><path d="M0 70C140 16 260 30 400 74S640 120 800 60S940 40 1000 58" fill="none" stroke="#1E2240" stroke-width="5" vector-effect="non-scaling-stroke"/></svg>
${pine(15,112,.85,.6)}${pine(46,74,1.05,1.7)}${pine(83,96,.9,2.6)}
${flower(4,84,'#F0503C',0)}${flower(15,98,'#FFD23F',.5)}${flower(33,82,'#fff',1.1)}${flower(57,70,'#FF8FC7',.2)}${flower(72,84,'#FFD23F',1.6)}${flower(83,98,'#F0503C',.9)}${flower(95,92,'#fff',2)}
<div class="path"></div>
<svg class="kitesvg" id="kiteSvg"><path id="kiteStr" fill="none" stroke="#1E2240" stroke-width="2" stroke-linecap="round"/><path id="kiteTail" fill="none" stroke="#1E2240" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><g id="kiteBows"></g><g id="kite"><path d="M0-30 20 0 0 38-20 0Z" fill="#F0503C" stroke="#1E2240" stroke-width="4" stroke-linejoin="round"/><path d="M0-30 20 0 0 0Z" fill="#FFD23F"/><path d="M0 0 0 38-20 0Z" fill="#4A7BF7"/><path d="M0-30V38M-20 0H20" stroke="#1E2240" stroke-width="3"/><path d="M0-30 20 0 0 38-20 0Z" fill="none" stroke="#1E2240" stroke-width="4" stroke-linejoin="round"/></g></svg>
<div class="hs-catch"><span class="hs-b a" style="${ph(2.8,0)}">${bean(1,'happy')}</span><span class="hs-ballx" style="${ph(2.8,0)}"><span class="hs-bally" style="${ph(1.4,0)}"></span></span><span class="hs-b b" style="${ph(2.8,1.4)}">${bean(3,'happy')}</span></div>
<span class="hs-walk" style="${ph(26,4)}"><span class="hs-waddle">${bean(4,'idle')}</span></span>
<span class="hs-kiter" id="kiteBean" style="${ph(3.4,0)}">${bean(0,'happy')}</span>
<span class="hs-chase" style="${ph(19,6)}"><span class="hs-run r1">${bean(2,'happy')}</span><span class="hs-run r2">${bean(3,'scared')}</span></span>
<span class="bfly" style="${ph(17,2)}"><i></i><i></i></span>
</div>`;
}
/* The kite: flown with a little physics-free maths so the string always reaches the bean's hand. */
let kiteOn=false;
function kiteFrame(now){
  const svg=document.getElementById('kiteSvg'),bn=document.getElementById('kiteBean');
  if(!svg||!bn||view!=='home'){kiteOn=false;return}
  const W=innerWidth,H=innerHeight,br=bn.getBoundingClientRect();
  const still=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t=still?2.2:now/1000;
  const hx=br.left+br.width*0.16,hy=br.top+br.height*0.52;
  const gap=document.querySelector('.skygap'),gr=gap?gap.getBoundingClientRect():{top:80,height:70};
  const cx=hx-Math.min(W*0.24,260),cy=gr.top+gr.height*0.5,ax=Math.min(W*0.2,200),ay=Math.max(8,gr.height*0.16);
  const kx=cx+ax*Math.sin(t*0.55)+6*Math.sin(t*2.3),ky=cy+ay*Math.sin(t*1.1+0.6)+4*Math.sin(t*3.1);
  const rot=-18+16*Math.cos(t*0.55)+5*Math.sin(t*2.3);
  const k=document.getElementById('kite');if(k)k.setAttribute('transform',`translate(${kx.toFixed(1)} ${ky.toFixed(1)}) rotate(${rot.toFixed(1)})`);
  const r=rot*Math.PI/180,tx=kx-38*Math.sin(r),ty=ky+38*Math.cos(r);
  const mx=(tx+hx)/2,my=(ty+hy)/2,d=Math.hypot(hx-tx,hy-ty);
  const st=document.getElementById('kiteStr');if(st)st.setAttribute('d',`M${hx.toFixed(1)} ${hy.toFixed(1)}Q${(mx+d*0.1).toFixed(1)} ${(my+d*0.16).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`);
  let dd=`M${tx.toFixed(1)} ${ty.toFixed(1)}`,bows='';
  for(let i=1;i<=6;i++){
    const lag=t-i*0.16,px=tx+i*9*Math.cos(r+1.25)+7*Math.sin(lag*3.2+i*0.9)+i*2.2*Math.cos(lag*0.55)*-3,py=ty+i*11+3*Math.cos(lag*3.2+i);
    dd+=`L${px.toFixed(1)} ${py.toFixed(1)}`;
    if(i%2===0)bows+=`<path d="M${(px-6).toFixed(1)} ${(py-4).toFixed(1)}l12 8v-8l-12 8z" fill="${i===4?'#FFD23F':'#4A7BF7'}" stroke="#1E2240" stroke-width="2" stroke-linejoin="round"/>`;
  }
  const tl=document.getElementById('kiteTail');if(tl)tl.setAttribute('d',dd);
  const bw=document.getElementById('kiteBows');if(bw)bw.innerHTML=bows;
  if(still){kiteOn=false;return}
  requestAnimationFrame(kiteFrame);
}
function kiteStart(){if(kiteOn||typeof requestAnimationFrame!=='function'||!document.getElementById('kiteSvg'))return;kiteOn=true;requestAnimationFrame(kiteFrame)}
function homeHTML(){
  const sess=LS.get(LSK('hl-session'));const canRejoin=sess&&sess.code&&Date.now()-sess.at<3*3600e3&&roomState==='ok';
  const lineup=COLORS.map((c,i)=>`<span class="lu">${charSVG({color:c,acc:i,id:i},'idle','bob')}</span>`).join('');
  const online=roomState==='ok';
  if(canRejoin||ui.codeIn||ui.homeErr){if(!ui.fAuto){ui.fAuto=true;ui.friends=true}}else ui.fAuto=false;
  return `<main class="scroll home">${homeSceneHTML()}
<section class="hero"><button class="info-btn" id="infoBtn" aria-label="About">i</button>${muteHTML()}<h1 class="logo big">High<span>&amp;</span>Low</h1><div class="skygap"></div>${eloPill()}${pwHomePill()}</section>
${offline()?offlineHTML():''}<section class="panel" ${offline()?'hidden':''}>
 <div class="field"><input id="nameIn" maxlength="12" autocomplete="nickname" aria-label="Your name" value="${esc(NAME)}" placeholder="Your name"></div>
 ${modesHTML()}
 <button id="playBtn" class="btn primary big full">Play</button>
 <button id="friendsBtn" class="btn full" aria-expanded="${!!ui.friends}">Play with friends</button>
 <div class="friends ${ui.friends?'':'closed'}">
  ${canRejoin?`<button class="btn go full" id="rejoinBtn">Rejoin room ${esc(sess.code)}</button>`:''}
  <button class="btn primary full" id="hostBtn" ${online?'':'disabled'}>Host a game</button>
  <div class="join-row"><input id="codeIn" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(ui.codeIn)}" placeholder="CODE" aria-label="Room code"><button class="btn" id="joinBtn" ${online?'':'disabled'}>Join</button></div>
  ${ui.homeErr?`<p class="err">${esc(ui.homeErr)}</p>`:''}
  <button class="btn full" id="soloBtn" ${NEED_NET?'hidden':''}>Practice</button>
 </div>
 ${roomState==='checking'?'<p class="tip">Connecting to rooms…</p>':''}
</section>
</main>`;
}
function inviteURL(){return location.origin+location.pathname+'#room='+code}
function qrHTML(){
  if(!window.qrcode||!code)return '';
  try{const q=window.qrcode(0,'M');q.addData(inviteURL());q.make();
    return `<div class="qr"><img src="${q.createDataURL(6,2)}" alt="QR code to join room ${esc(code)}"></div>`}catch(e){return ''}
}
function trackConn(){
  if(view!=='game'||mode!=='online'||connected){discSince=0;return}
  if(!discSince){discSince=Date.now();later(()=>render(),2100)}
}
function connBanner(){return view==='game'&&mode==='online'&&!connected&&discSince>0&&Date.now()-discSince>2000}
function timerLeft(){
  if(!G||G.phase!=='play'||G.stage!=='await'||G.q||!(G.timer>0))return null;
  const cur=G.players[G.turn];if(!cur||cur.bot||!cur.a)return null;
  if(ui.timerSeq!==G.gid+':'+G.seq)return null;
  return Math.max(0,Math.ceil(G.timer-(Date.now()-ui.timerStart)/1000));
}
function timerPill(){
  const v=timerLeft();if(v===null)return '';
  const f=Math.min(1,v/Math.max(1,G.timer));
  return `<span class="tclock ${v<6?'low':''}" style="--f:${f.toFixed(3)};${ph(v<6?0.28:3.6,0)}" role="timer" aria-label="${v} seconds left"><i class="bell l"></i><i class="bell r"></i><i class="foot l"></i><i class="foot r"></i><span class="face"><b>${v}</b></span></span>`;
}
const SPK='<path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>';
function muteHTML(){
  const m=SFX.muted;
  return `<button class="mute-btn" id="muteBtn" aria-label="${m?'Unmute sounds':'Mute sounds'}" aria-pressed="${m}"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none">${SPK}${m?'<path d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>':'<path d="M16 8.5q3 3.5 0 7M19 5.5q6 6.5 0 13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>'}</svg></button>`;
}
function headerHTML(){
  const st=mode==='solo'?'<span class="status solo"><i></i>Practice</span>':(connected?'<span class="status"><i></i>Live</span>':'<span class="status off"><i></i>Connecting</span>');
  const ban=connBanner()?'<div class="conn-banner">Reconnecting…</div>':'';
  return `<header class="bar"><h1 class="logo small">High<span>&amp;</span>Low</h1>${mode==='online'&&!isPub?`<span class="pill">${esc(code)}</span>`:''}${st}${muteHTML()}<button class="btn sm" id="leaveBtn">${ui.leaveArmed?'Tap to leave':'Leave'}</button></header>${ban}`;
}
function gameHTML(){
  if(mode==='search'||(isPub&&!G))return waitHTML(null);
  if(!G){
    const long=Date.now()-joinedAt>7000;
    return headerHTML()+`<main class="scroll"><section class="panel center"><div class="big-bean">${charSVG({color:COLORS[2],acc:4,id:2},'scared','bob')}</div><h2>Looking for room ${esc(code)}…</h2>
${long?'<p class="tip">Make sure the host has the game open on their phone and the code is right. The host may also need to share this game with you in Claude.</p>':'<p class="tip">Hang tight.</p>'}</section></main>`;
  }
  if(G.phase==='lobby')return G.pub?waitHTML(G.players):headerHTML()+lobbyHTML();
  if(G.phase==='secrets')return headerHTML()+secretsHTML();
  if(!byPid(PID)&&G.phase!=='over')return headerHTML()+`<main class="cast">${G.players.map(cardHTML).join('')}</main><section class="tray"><p class="hint">A round is already going. You're watching, and you'll be in the next one.</p></section>`;
  if(askViewOn())return headerHTML()+askViewHTML();
  if(guessViewOn())return headerHTML()+guessViewHTML();
  const duel=G.players.length===2,me0=G.players.findIndex(p=>p.pid===PID);
  const order=duel&&me0===0?[1,0]:G.players.map((_,i)=>i);
  return headerHTML()+`<main class="cast ${duel?'duel':''}"><div class="clock-corner">${timerPill()}</div>${order.map(i=>cardHTML(G.players[i],i)).join(duel?'<div class="vs">VS</div>':'')}</main><section class="tray" aria-live="polite">${trayHTML()}</section>`;
}
function canAct(){
  if(!G||G.phase!=='play')return false;
  const cur=G.players[G.turn];const sent=myPres.act&&myPres.act.gid===G.gid&&myPres.act.seq===G.seq;
  const me=byPid(PID);if(!me||me.bot||!me.a)return false;
  return cur&&cur.pid===PID&&G.stage==='await'&&!G.q&&!sent;
}
function curTarget(){
  if(!G||G.phase!=='play'||G.stage==='wheel'||!G.sub||!G.sub.length)return null;
  if(G.sub[0]==='*'){const c=G.players[G.turn];return c?focusOf(c.pid):null}
  return byPid(G.sub[0]);
}
function guessViewOn(){const t=curTarget();return canAct()&&G.sub[0]!=='*'&&!!t&&t.a}
function guessViewHTML(){
  const t=curTarget(),tv=mv(t),xs=myXs(tv),btns=[];
  for(let n=tv.lo;n<=tv.hi;n++){const x=xs.includes(n);btns.push(`<button class="g" ${x?'disabled':`data-n="${n}"`}>${fmt(n)}</button>`)}
  return `<main class="guessv"><div class="ask-top">${timerPill()}${pwBtnHTML()}</div>
<div class="ped"><div class="ped-bean jit">${popHTML(t.pid)}${charSVG(pv(t),'scared')}</div><div class="ped-base"><b>${esc(t.name)}</b></div></div>
<p class="ped-q">Which one is it?</p>
<div class="guess-grid big n${btns.length} ${fmt(tv.hi).length>=7?'c2':fmt(tv.hi).length>=5?'c3':''}">${btns.join('')}</div></main>`;
}
function askViewOn(){const t=curTarget();return canAct()&&G.sub[0]==='*'&&!!t&&t.a}
const BIG_UP=`<svg class="arrow" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8l40 46H66v38H34V54H10z" fill="#fff" stroke="#1E2240" stroke-width="6" stroke-linejoin="round"/></svg>`;
const BIG_DN=`<svg class="arrow" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 92l40-46H66V8H34v38H10z" fill="#fff" stroke="#1E2240" stroke-width="6" stroke-linejoin="round"/></svg>`;
const BKSP=`<svg viewBox="0 0 32 24" aria-hidden="true" width="30" height="22"><path d="M10 2h19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H10L1 12z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M15 8l8 8M23 8l-8 8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;
function padHTML(extra,rise){
  const k=n=>`<button class="key" data-k="${n}">${n}</button>`;
  return `<div class="pad ${rise?'rise':''}">${[1,2,3,4,5,6,7,8,9].map(k).join('')}<button class="key del" data-k="del" aria-label="Delete">${BKSP}</button>${k(0)}${extra}</div>`;
}
function askSlots(t){
  const lo=ui.dir==='l'?t.lo+1:t.lo,hi=ui.dir==='l'?t.hi:t.hi-1;
  const a=String(lo),b=String(hi),n=b.length;let prefix='';
  if(a.length===n){let i=0;while(i<n&&a[i]===b[i])i++;prefix=a.slice(0,i)}
  if(prefix.length>=n)prefix=prefix.slice(0,n-1);
  return{lo,hi,n,prefix,open:n-prefix.length};
}
/* The asking slider. x is always a whole number inside the allowed range for the chosen direction. */
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
function secPaint(){
  const tr=$('#secTrack');if(!tr)return false;
  const n=Math.min(G.max,Math.max(1,Number(ui.sec)||1)),f=G.max>1?(n-1)/(G.max-1):0,pc=(f*100).toFixed(3)+'%';
  $('#secFill').style.width=pc;$('#secThumb').style.left=pc;$('#secNum').textContent=fmt(n);
  const lb=$('#lockBtn');if(lb)lb.disabled=false;
  return true;
}
function secBind(){
  const sd=$('#secSld'),tr=$('#secTrack');if(!sd||!tr)return;
  const at=e=>{
    const r=tr.getBoundingClientRect(),f=Math.min(1,Math.max(0,((e.clientX-r.left)/Math.max(1,r.width)-0.04)/0.92));
    const n=String(1+Math.round(f*(G.max-1)));
    if(n!==ui.sec){ui.sec=n;ui.secTyped=false;ui.err='';secPaint();const now=Date.now();if(now-sldTickAt>70){sldTickAt=now;sfx('tick',{vol:0.5,rate:0.9+f*0.5})}}
  };
  let down=false;
  sd.onpointerdown=e=>{down=true;sldDown=true;try{sd.setPointerCapture(e.pointerId)}catch(_){}sd.classList.add('drag');at(e);e.preventDefault()};
  sd.onpointermove=e=>{if(down)at(e)};
  const up=()=>{if(down){down=false;sldDown=false;sd.classList.remove('drag');buzz(8);if(sldPend){sldPend=false;render(true)}}};
  sd.onpointerup=up;sd.onpointercancel=up;
}
let sldTickAt=0;
function sliderBind(){
  const sd=$('#sld'),tr=$('#sldTrack');if(!sd||!tr)return;
  const at=e=>{
    const t=curTarget();if(!t)return;
    const tv=mv(t),r=tr.getBoundingClientRect(),T=tv.hi-tv.lo+1;
    const f=Math.min(1,Math.max(0,((e.clientX-r.left)/Math.max(1,r.width)-0.04)/0.92));
    const leftN=Math.min(T-1,Math.max(1,Math.round(f*T)));
    const before=ui.num;setAskX(ui.dir!=='l'?tv.lo+leftN-1:tv.lo+leftN);
    if(ui.num!==before){sliderPaint();const now=Date.now();if(now-sldTickAt>70){sldTickAt=now;sfx('tick',{vol:0.5,rate:0.9+f*0.5})}}
  };
  let down=false;
  sd.onpointerdown=e=>{down=true;sldDown=true;try{sd.setPointerCapture(e.pointerId)}catch(_){}sd.classList.add('drag');at(e);e.preventDefault()};
  sd.onpointermove=e=>{if(down)at(e)};
  const up=()=>{if(down){down=false;sldDown=false;sd.classList.remove('drag');buzz(8);if(sldPend){sldPend=false;render(true)}}};
  sd.onpointerup=up;sd.onpointercancel=up;
}
function askRowHTML(f,fv){
  const o=nzOpp(PID).filter(x=>x.pid!==f.pid);
  return `<span class="ar f"><span class="ar-b">${charSVG(pv(f),'scared','bob')}</span><span class="ar-r">${fmt(fv.lo)} – ${fmt(fv.hi)}</span></span>`+o.map(x=>`<span class="ar"><span class="ar-b">${charSVG(pv(x),'scared','bob')}</span></span>`).join('');
}
function askViewHTML(){
  const t=curTarget(),me=byPid(PID),tv=mv(t);
  const k=(G.subN||1)-G.sub.length+1;
  const top=`<div class="ask-top">${ui.step==='num'?'<button class="btn sm" id="askBack">Back</button>':''}
${timerPill()}${ui.step==='num'?'':pwBtnHTML()}<div class="ask-row">${askRowHTML(t,tv)}</div></div>`;
  if(ui.step!=='num'){
    const bk=G.gid+':'+G.seq;
    if(!sfxSeen.burst.has(bk)){sfxSeen.burst.add(bk);[0,0.14,0.28,0.42].forEach(d=>sfx('babble'+rnd(1,3),{delay:d,rate:babRate()+(Math.random()-.5)*0.16}))}
    return `<section class="askv">${top}${hint('dir','Tap HIGHER or LOWER')}<div class="split">
<button class="half hi" data-pickdir="h">${BIG_UP}<span class="word">HIGHER</span></button>
<button class="half lo" data-pickdir="l"><span class="word">LOWER</span>${BIG_DN}</button>
<div class="speaker"><span class="spk-bean jit-slow">${charSVG(pv(me),'talk')}</span><div class="speech"><span class="jit">Is it…</span></div></div>
</div></section>`;
  }
  const land=ui.land;ui.land=false;
  const word=ui.dir==='l'?'LOWER':'HIGHER';
  if(!ui.num)setAskX(askMid(tv));
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
function slotsHTML(str,n,pfx){
  pfx=pfx||'';const pl=pfx.length,open=n-pl;
  const pad=pl?0:Math.max(0,n-str.length);let h='';
  for(let i=0;i<n;i++){
    if(i>0&&(n-i)%3===0)h+=`<i class="sep ${!pl&&i<=pad?'e':''}">,</i>`;
    if(i<pl){h+=`<span class="slot fixed">${pfx[i]}</span>`;continue}
    const ch=pl?str[i-pl]:(i<pad?'':str[i-pad]);
    h+=`<span class="slot ${ch?'':'e'}">${ch||'&nbsp;'}</span>`;
  }
  return `<span class="slots" aria-label="${str||pfx?fmt(pfx+str):'empty'}">${h}</span>`;
}
function wheelSVG(){
  const ps=G.players,n=ps.length,R=134,c=140;
  const pt=a=>{const r=a*Math.PI/180;return[(c+R*Math.sin(r)).toFixed(2),(c-R*Math.cos(r)).toFixed(2)]};
  let s='';
  ps.forEach((p,i)=>{
    const a0=i*360/n,a1=(i+1)*360/n,[x0,y0]=pt(a0),[x1,y1]=pt(a1),mid=(a0+a1)/2;
    s+=n===1?`<circle cx="${c}" cy="${c}" r="${R}" fill="#FFF8EC"/>`:`<path d="M${c} ${c}L${x0} ${y0}A${R} ${R} 0 ${a1-a0>180?1:0} 1 ${x1} ${y1}Z" fill="${i%2?'#F1E4CB':'#FFF8EC'}" stroke="#1E2240" stroke-width="3" stroke-linejoin="round"/>`;
    const bean=charSVG(pv(p),'idle').replace(/^<svg[^>]*>/,`<svg x="${c-24}" y="${c-R+16}" width="48" height="67" viewBox="0 -14 100 140">`);
    s+=`<g transform="rotate(${mid.toFixed(2)} ${c} ${c})">${bean}<text x="${c}" y="${c-R+100}" text-anchor="middle" font-family="Bagel Fat One, sans-serif" font-size="15" fill="#1E2240">${esc(p.name)}</text></g>`;
  });
  s+=`<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="#1E2240" stroke-width="6"/><circle cx="${c}" cy="${c}" r="20" fill="#1E2240"/><text x="${c}" y="${c+8}" text-anchor="middle" font-family="Bagel Fat One, sans-serif" font-size="22" fill="#FFD23F">?</text>`;
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
  sfx('spin');sfx('vo_ready',{delay:0.3});
  {let prev=null,cum=0,idx=0;
   const loop=()=>{
    if(id!==sceneSeq||!el||!el.isConnected)return;
    try{
      const tf=getComputedStyle(el).transform,m=tf&&tf.match(/matrix\(([^)]+)\)/);
      if(m){const v=m[1].split(',').map(Number),raw=Math.atan2(v[1],v[0])*180/Math.PI;
        if(prev!==null){let d=((raw-prev)%360+360)%360;if(d>180)d-=360;if(d>0)cum+=d}
        prev=raw;
        const ni=Math.floor(cum/w);let c=0;
        while(idx<ni){idx++;if(c++<3)sfx('tick')}
      }
    }catch(e){}
    requestAnimationFrame(loop);
   };
   requestAnimationFrame(loop);}
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(el)el.style.transform=`rotate(${final}deg)`}));
  later(()=>{if(id!==sceneSeq)return;const m=$('#wheelMsg');if(m){m.textContent=first.pid===PID?'You go first!':`${first.name} goes first!`;m.classList.add('win')}sfx('wheelland');buzz(40)},4300);
  later(()=>{if(id===sceneSeq)closeOv()},5800);
}
function padPress(k){
  const field=G.phase==='secrets'?'sec':'num';
  const sl=field==='num'?askSlots(mv(curTarget())):null;
  const maxLen=sl?sl.open:String(G.max).length;
  let v=ui[field];
  if(field==='sec'&&(k==='inc'||k==='dec')){sfx('tick');ui.sec=String(Math.min(G.max,Math.max(1,(Number(ui.sec)||1)+(k==='inc'?1:-1))));ui.secTyped=false;ui.err='';if(!secPaint())render(true);return}
  if(field==='sec'&&!ui.secTyped&&(/^\d$/.test(k)||k==='del')){v='';ui.secTyped=true}
  if(k==='del'){sfx('del');v=v.slice(0,-1)}
  else if(k==='mid'||k==='inc'||k==='dec'){const t=curTarget();if(!t)return;sfx(k==='mid'?'pick':'tick');const cur=askX();setAskX(k==='mid'||cur===null?askMid(mv(t)):cur+(k==='inc'?1:-1));if($('#sldTrack')){sliderPaint();return}render(true);return}
  else if(/^\d$/.test(k)){if(field==='sec')sfx('key');else sfx('babble'+(1+ui.num.length%3),{rate:babRate()+ui.num.length*0.04});if(v.length<maxLen&&!(v===''&&k==='0'&&!(sl&&sl.prefix)))v+=k}
  ui[field]=v;ui.err='';render(true);
}
function lobbyHTML(){
  const rows=G.players.map(p=>`<div class="prow2"><span class="lpic">${popHTML(p.pid)}${charSVG(pv(p),'idle','bob')}</span><span class="who"><b>${esc(p.name)}</b>${p.pid===PID?'<span class="tag up">YOU</span>':''}${p.bot&&!p.hb?'<span class="tag">BOT</span>':''}${p.pid===G.players[0].pid&&!p.bot&&mode==='online'?'<span class="tag">HOST</span>':''}</span>
${isHost&&p.bot?`<button class="x" data-rmbot="${esc(p.pid)}" aria-label="Remove ${esc(p.name)}">×</button>`:(p.pid===PID?`<button class="btn sm" id="lookBtn" aria-expanded="${!!ui.picker}">Change look</button>`:'<span></span>')}</div>`).join('');
  const full=!byPid(PID)&&G.players.length>=6;
  return `<main class="scroll">
${mode==='online'?`<section class="panel center"><div class="code">${esc(code)}</div>${qrHTML()}${isHost?`<button class="btn primary full" id="inviteBtn">${ui.inviteCopied?'Link copied!':'Send invite'}</button>${ui.inviteUrl?`<p class="tip invite-url" style="user-select:text;-webkit-user-select:text;word-break:break-all">${esc(ui.inviteUrl)}</p>`:''}`:''}${isHost&&G.players.filter(q=>!q.bot).length<2?`<div class="join-row lob-join"><input id="lobCode" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(ui.codeIn)}" placeholder="CODE" aria-label="Friend's room code"><button class="btn" id="lobJoin">Join a room</button></div>${ui.lobErr?`<p class="err">${esc(ui.lobErr)}</p>`:''}`:''}</section>`:''}
<section class="panel"><h2>Players <small>${G.players.length} of 6</small></h2><div class="plist">${rows}</div>
${ui.picker&&byPid(PID)?pickerHTML():''}
${isHost&&G.players.length<6?'<button class="btn sm" id="addBot" style="justify-self:start">+ Add a bot</button>':''}
${full?'<p class="err">This room is full.</p>':''}</section>
${byPid(PID)?`<div class="taunt-wrap">${tauntBar()}</div>`:''}
<section class="panel"><h2>Number range</h2>
${isHost?`<div class="chips">${[100,1000,10000,100000].map(m=>`<button class="chip-btn" data-max="${m}" aria-pressed="${G.max===m}">1 – ${fmt(m)}</button>`).join('')}</div>`:`<p class="tip">1 – ${fmt(G.max)}</p>`}
<h2>Turn timer</h2>
${isHost?`<div class="chips">${[[0,'Off'],[20,'20 sec'],[40,'40 sec']].map(([v,l])=>`<button class="chip-btn" data-timer="${v}" aria-pressed="${(G.timer||0)===v}">${l}</button>`).join('')}</div>`:`<p class="tip">${G.timer?G.timer+' seconds per question':'Off'}</p>`}</section>
${isHost?`<button class="btn primary big" id="startBtn" style="justify-self:center" ${G.players.length<2?'disabled':''}>${G.players.length<2?'Waiting for players…':'Start game'}</button>`:'<p class="hint" style="text-align:center">Waiting for the host to start…</p>'}
</main>`;
}
const LOCK_SVG='<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="2" fill="#1E2240"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="#1E2240" stroke-width="2"/></svg>';
function pickerHTML(){
  const me=byPid(PID),l=myLook();
  const curC=me.c%6,curK=l?l.k:(me.k!=null?me.k:me.c);
  const sw=COLORS.map((c,i)=>{const taken=G.players.some(q=>q.pid!==PID&&q.c===i);
    return `<button class="pk-sw ${i===curC?'sel':''}" data-lc="${i}" ${taken?'disabled':''} aria-label="Color ${i+1}" aria-pressed="${i===curC}">${charSVG({color:c,acc:curK,id:i},'idle')}</button>`}).join('');
  let hats='';
  for(let i=0;i<hatCount();i++){
    const ok=hatUnlocked(i);
    hats+=`<button class="pk-hat ${i===curK?'sel':''} ${ok?'':'locked'}" data-lk="${i}" ${ok?'':'disabled'} aria-pressed="${i===curK}">${ok?'':`<span class="lockb">${LOCK_SVG}</span>`}<span class="hb">${charSVG({color:COLORS[curC],acc:i,id:curC},'idle')}</span><span class="hn">${ok?esc(hatName(i)):'Win '+(HAT_NEED[i]||99)}</span></button>`;
  }
  return `<div class="picker"><div class="pk-row">${sw}</div><div class="pk-grid">${hats}</div></div>`;
}
function setLook(patch){
  const me=byPid(PID);if(!me)return;
  const cur=myLook()||{c:me.c%6,k:me.k!=null?me.k:me.c};
  const nl=validLook({...cur,...patch});if(!nl)return;
  LS.set(LSK('hl-look'),nl);setP({look:nl});sfx('pick');render(true);
}
function secretsHTML(){
  const me=byPid(PID);
  const list=G.players.map(p=>{const r=p.bot||(getPres(p.pid)||{}).ready===G.gid;return `<div class="prow2"><span>${charSVG(pv(p),r?'idle':'scared')}</span><span class="who"><b>${esc(p.name)}</b>${p.pid===PID?'<span class="tag up">YOU</span>':''}</span><span class="${r?'state-ok':'state-wait'}">${r?'Ready':'Picking…'}</span></div>`}).join('');
  if(me&&!mySecret){
    if(ui.secGid!==G.gid){ui.secGid=G.gid;ui.sec=String(rnd(1,G.max));ui.secTyped=false}
    const n=Math.min(G.max,Math.max(1,Number(ui.sec)||1)),f=G.max>1?(n-1)/(G.max-1):0;
    return `<main class="scroll"><section class="panel center secpick"><div class="big-bean">${charSVG(pv(me),'scared','bob')}</div><h2 style="font-family:var(--display);font-weight:400">Pick your number</h2>
<div class="secret-big entry" id="secNum">${ui.sec?fmt(n):'&nbsp;'}</div>
<div class="sld one" id="secSld" role="slider" tabindex="0" aria-label="Your number" aria-valuemin="1" aria-valuemax="${G.max}" aria-valuenow="${n}"><div class="sld-track" id="secTrack"><i class="pick" id="secFill" style="width:${(f*100).toFixed(3)}%"></i><b class="sld-thumb" id="secThumb" style="left:${(f*100).toFixed(3)}%"></b></div>
<div class="sld-ends"><span>1</span><span>${fmt(G.max)}</span></div></div>
${ui.err?`<p class="err">${esc(ui.err)}</p>`:''}
<div class="nudge"><button class="key nb" data-k="dec" aria-label="One lower">−</button><button class="key mid" data-k="rand">RANDOM</button><button class="key nb" data-k="inc" aria-label="One higher">+</button></div>
<div hidden>${padHTML('',false)}</div>
<button class="btn go big full" id="lockBtn" ${ui.sec?'':'disabled'}>Lock it in</button></section>
<section class="panel"><h2>Who's ready</h2><div class="ready-list">${list}</div></section></main>`;
  }
  return `<main class="scroll"><section class="panel center"><div class="secret-big">${ui.show&&mySecret?fmt(mySecret.n):'• • • •'}</div><button class="link" id="showBtn">${ui.show?'Hide':'Show'} it</button></section>
<section class="panel"><h2>Who's ready</h2><div class="ready-list">${list}</div></section></main>`;
}
let hpPrev={},hpGid='';
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
function cardHTML(p,i){
  if(!p.a)return `<div class="card dead"><span class="pic">${popHTML(p.pid)}${TOMB}</span><span class="info"><span class="nm"><b>${esc(p.name)}</b>${p.pid===PID?'<span class="tag up">YOU</span>':''}</span>${pwBits(p)}<span class="rip">${typeof DEATH_ICON!=='undefined'&&DEATH_ICON[p.d]?`<span class="dicon">${DEATH_ICON[p.d]}</span>`:''}${SHORT[p.d]||'Out'}</span></span></div>`;
  const cur=G.players[G.turn];
  const sent=myPres.act&&myPres.act.gid===G.gid&&myPres.act.seq===G.seq;
  const pick=false;
  const mine=p.pid===PID;
  const v=mv(p),total=G.max,lf=(v.lo-1)/total*100,w=Math.max((v.hi-v.lo+1)/total*100,2);
  const ct=curTarget(),z=!mine&&zone(v),isT=G.q?(G.q.t==='askall'?!!(G.q.xs&&p.pid in G.q.xs):G.q.tg===p.pid):!!(ct&&ct.pid===p.pid);
  const dg=mine?(p.dg|0):0;
  const bb=bubOf(p.pid),bub=bb?`<span class="bubble ${bb.up?'up':'down'}">${esc(bb.text)}</span>`:'';
  const turnTag='';
  const inner=`<span class="pic">${bub}${popHTML(p.pid)}${charSVG(pv(p),isT||z||dg>=2?'scared':'idle','bob')}</span>
<span class="info"><span class="nm"><b>${esc(p.name)}</b>${G.pub&&Number.isInteger(p.el)?`<span class="elo">${p.el}</span>`:''}${mine?'<span class="tag">YOU</span>':''}${p.bot&&!p.hb?'<span class="tag">BOT</span>':''}${turnTag}</span>${pwBits(p)}
${mine?`<span class="dg-dots" role="img" aria-label="Danger ${dg} of 3">${[1,2,3].map(n=>`<i class="${n<=dg?'on':''}"></i>`).join('')}</span>`:`${hpHTML(p.pid,v,z)}${z?`<span class="zone">${leftX(v)} LEFT</span>`:''}`}
${mine&&mySecret?`<span class="left">Yours: <b>${ui.show?fmt(mySecret.n):'••••'}</b> <button class="link reveal" id="showBtn">${ui.show?'hide':'show'}</button></span>`:''}</span>`;
  if(mine)return `<div class="card mine ${i===G.turn?'is-turn':''} ${isT?'is-target':''} ${dg>=3?'dg3':''}">${inner}</div>`;
  return `<button class="card ${i===G.turn&&G.phase==='play'?'is-turn':''} ${isT?'is-target':''} ${pick?'pick':''}" data-pid="${esc(p.pid)}" ${pick?'':'tabindex="-1"'} aria-label="${esc(p.name)}, between ${v.lo} and ${v.hi}">${inner}</button>`;
}
function trayHTML(){return trayInner()+(byPid(PID)?tauntBar():'')}
function trayInner(){
  if(G.phase==='over'){const w=byPid(G.win);return `<div class="turn-name">${w?(w.pid===PID?'You win!':esc(w.name)+' wins!'):'Game over'}</div>${G.pub?'':isHost?'<div class="btn-row"><button class="btn primary" id="toLobby">Play again</button></div>':'<p class="hint">Waiting for the host to start another round.</p>'}`}
  const cur=G.players[G.turn],me=byPid(PID),myTurn=cur.pid===PID&&!(me&&me.bot);
  const evLine=G.ev&&(myTurn||G.ev.a===cur.pid)?`<div class="msg">${esc(evText(G.ev))}</div>`:'';
  const head=`<div class="turn"><span>${charSVG(pv(cur),'idle')}</span><div><div class="turn-name">${myTurn?'Your turn':esc(cur.name)+"'s turn"}${''}</div>${evLine}</div></div>`;
  if(!myTurn){
    const ct=curTarget();
    let body=G.stage==='wheel'?'':G.q?`<p class="hint">${esc(qText(G.q))}</p>`:(ct?'':`<p class="hint">Waiting for ${esc(cur.name)}…</p>`);
    if((G.q&&G.q.tg===PID)||(!G.q&&ct&&ct.pid===PID))body+=hint('asked','Your phone answers for you. No lying!');
    if(me&&!me.a)body+=`<p class="sub">You're out.</p>`;
    return head+body;
  }
  const sent=myPres.act&&myPres.act.gid===G.gid&&myPres.act.seq===G.seq;
  if(G.stage!=='await'||G.q||sent)return head+`<p class="hint">${G.q?esc(qText(G.q)):(G.stage==='await'?'Sending…':(G.stage==='power'?'Using a power…':''))}</p>`;
  const t=curTarget();
  if(!t||!t.a)return head;
  const tv=mv(t),xs=myXs(tv),btns=[];for(let n=tv.lo;n<=tv.hi;n++){const x=xs.includes(n);btns.push(`<button class="g" ${x?'disabled':`data-n="${n}"`}>${fmt(n)}</button>`)}
  return head+hint('guess','Down to 10! Guess their exact number.')+`<div class="pw-row">${pwBtnHTML()}</div>`+`<p class="q">Guess <b>${esc(t.name)}</b>'s number</p><div class="guess-grid">${btns.join('')}</div>
`;
}

/* ---------- Bindings ---------- */
function on(id,fn){const el=document.getElementById(id);if(el)el.onclick=fn;return el}
function bind(){
  on('muteBtn',()=>{SFX.setMuted(!SFX.muted);if(!SFX.muted)sfx('pick');render(true)});
  if(view==='home'){
    const ni=$('#nameIn');ni.oninput=()=>{NAME=clean(ni.value);LS.set(LSK('hl-name'),NAME)};
    const ci=$('#codeIn');ci.oninput=()=>{ci.value=ci.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);ui.codeIn=ci.value};
    const need=()=>{if(!NAME){ui.homeErr='Type your name first.';render(true);$('#nameIn').focus();return false}ui.homeErr='';return true};
    on('hostBtn',()=>{if(!need())return;let c='';for(let i=0;i<4;i++)c+=CODE_CHARS[rnd(0,CODE_CHARS.length-1)];track('host');startOnline(true,c)});
    const join=()=>{if(!need())return;const c=ci.value;if(!/^[A-Z]{4}$/.test(c)){ui.homeErr='Room codes are 4 letters.';render(true);return}track('join');startOnline(false,c)};
    on('joinBtn',join);ci.onkeydown=e=>{if(e.key==='Enter')join()};
    on('rejoinBtn',()=>{const s=LS.get(LSK('hl-session'));if(s)startOnline(!!s.host,s.code)});
    on('soloBtn',()=>{if(!NAME){NAME='You'}track('practice');startSolo()});
    on('friendsBtn',()=>{
      ui.homeErr='';if(!NAME)NAME=FILL_NAMES[rnd(0,FILL_NAMES.length-1)];
      if(offline()){render(true);return}
      if(roomState!=='ok'||!roomNS){track('practice');startSolo();return}
      let c='';for(let i=0;i<4;i++)c+=CODE_CHARS[rnd(0,CODE_CHARS.length-1)];track('host');startOnline(true,c)});
    on('retryNet',()=>{sfx('pick');initRooms()});
    on('playBtn',()=>{ui.homeErr='';track('play_tap',{max:playMode().max});quickPlay()});
    $$('[data-mode]').forEach(b=>b.onclick=()=>{pmSel=b.dataset.mode;LS.set('hl-pm',pmSel);sfx('pick');render(true)});
    on('infoBtn',()=>{openOv(`<div class="sheet center"><h2>High &amp; Low</h2><p>Open seats in Play are filled by bots.</p><p>Sounds: Kenney (CC0)</p><p class="legal"><a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a></p><div class="btn-row">${HLAds.canBuy()?'<button class="btn primary" id="noAdsBtn">Remove ads</button>':''}<button class="btn" id="ovClose">Close</button></div></div>`);$('#ovClose').onclick=closeOv;const nb=$('#noAdsBtn');if(nb)nb.onclick=()=>{HLAds.buy().then(closeOv)}});
    return;
  }
  on('leaveBtn',()=>{const stake=eloAtStake();if(stake>0){openOv(`<div class="sheet center"><h2>Leave the duel?</h2><p class="stake">You'll lose <b>${stake}</b> rating.</p><div class="btn-row"><button class="btn primary" id="stayBtn">Keep playing</button><button class="btn" id="quitBtn">Leave</button></div></div>`);$('#stayBtn').onclick=closeOv;$('#quitBtn').onclick=()=>{closeOv();leaveGame()};return}
    if(ui.leaveArmed||mode==='search'||(G&&G.pub&&G.phase==='lobby')||(isPub&&!G)){leaveGame()}else{ui.leaveArmed=true;render(true);later(()=>{ui.leaveArmed=false;render(true)},2500)}});
  if(!G)return;
  on('inviteBtn',()=>{
    const url=inviteURL();
    if(navigator.share){try{const r=navigator.share({title:'High & Low',text:'Join my High & Low game! Room '+code,url});if(r&&r.catch)r.catch(()=>{})}catch(e){}return}
    const fail=()=>{ui.inviteUrl=url;render(true)};
    try{
      navigator.clipboard.writeText(url).then(()=>{ui.inviteCopied=true;ui.inviteUrl='';render(true);later(()=>{ui.inviteCopied=false;render(true)},2000)},fail);
    }catch(e){fail()}
  });
  on('lookBtn',()=>{sfx('pick');ui.picker=!ui.picker;render(true)});
  $$('[data-lc]').forEach(b=>b.onclick=()=>setLook({c:+b.dataset.lc}));
  $$('[data-lk]').forEach(b=>b.onclick=()=>setLook({k:+b.dataset.lk}));
  $$('[data-tn]').forEach(b=>b.onclick=()=>tauntSend(+b.dataset.tn));
  on('addBot',()=>{addBot();publishG()});
  $$('[data-rmbot]').forEach(b=>b.onclick=()=>{G.players=G.players.filter(p=>p.pid!==b.dataset.rmbot);publishG()});
  $$('[data-max]').forEach(b=>b.onclick=()=>{G.max=+b.dataset.max;publishG()});
  $$('[data-timer]').forEach(b=>b.onclick=()=>{G.timer=+b.dataset.timer;publishG()});
  on('startBtn',()=>{if(isHost&&G.players.length>=2)hostStart()});
  on('toLobby',toLobby);
  on('lockBtn',lockFromPad);
  on('showBtn',e=>{e.stopPropagation();ui.show=!ui.show;render(true)});
  $$('[data-pickdir]').forEach(b=>b.onclick=()=>{sfx('pick');sfx('land',{delay:0.18});seen('dir');ui.dir=b.dataset.pickdir;ui.step='num';ui.num='';ui.land=true;ui.err='';buzz(15);render(true)});
  on('flipDir',()=>{sfx('pick');sfx('land',{delay:0.18});ui.dir=ui.dir==='l'?'h':'l';ui.num='';ui.land=true;ui.err='';buzz(15);render(true)});
  on('askBack',()=>{ui.step='dir';ui.num='';ui.err='';render(true)});
  $$('.key').forEach(b=>b.onclick=()=>{if(b.dataset.k==='rand'){sfx('pick');ui.sec=String(rnd(1,G.max));ui.secTyped=false;ui.err='';render(true)}else padPress(b.dataset.k);buzz(8)});
  {const lc=$('#lobCode');if(lc){lc.oninput=()=>{lc.value=lc.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);ui.codeIn=lc.value;ui.lobErr=''};
    const go=()=>{const c=ui.codeIn;if(!/^[A-Z]{4}$/.test(c)){ui.lobErr='Room codes are 4 letters.';render(true);return}if(c===code){ui.lobErr='That is this room.';render(true);return}ui.lobErr='';track('join');leaveGame().then(()=>startOnline(false,c))};
    on('lobJoin',go);lc.onkeydown=e=>{if(e.key==='Enter')go()}}}
  on('askGo',doAsk);sliderBind();secBind();
  $$('.key.nb').forEach(b=>{b.onpointerdown=()=>{nbStop();const k=b.dataset.k;nbN=0;nbTimer=setTimeout(()=>{nbIv=setInterval(()=>{if(++nbN>300||!document.querySelector('.key.nb')){nbStop();return}padPress(k)},60)},380)};b.onpointerleave=nbStop});
  pwBind();
  $$('.g[data-n]').forEach(b=>b.onclick=()=>{const t=curTarget();if(t&&canAct()){sfx('send');sendAct({tg:t.pid,t:'guess',n:+b.dataset.n});seen('guess')}});
}

function buzz(ms){if(navigator.vibrate)try{navigator.vibrate(ms)}catch(e){}}
function lockFromPad(){const n=Number(ui.sec);if(!Number.isInteger(n)||n<1||n>G.max){ui.err=`Pick a whole number from 1 to ${fmt(G.max)}.`;sfx('error');render(true);return}ui.err='';sfx('send');sfx('lock',{delay:0.15});lockSecret(n);seen('secret')}
document.addEventListener('keydown',e=>{
  if(view!=='game'||!G||e.target.tagName==='INPUT')return;
  if(askViewOn()&&ui.step==='dir'&&(e.key==='ArrowUp'||e.key==='ArrowDown')){const b=$('[data-pickdir="'+(e.key==='ArrowUp'?'h':'l')+'"]');if(b){e.preventDefault();b.click()}return}
  if(askViewOn()&&ui.step==='num'&&e.key==='Escape'){const b=$('#askBack');if(b)b.click();return}
  const onPad=(G.phase==='secrets'&&byPid(PID)&&!mySecret)||(askViewOn()&&ui.step==='num');
  if(!onPad)return;
  if(/^\d$/.test(e.key))padPress(e.key);
  else if(e.key==='Backspace')padPress('del');
  else if(e.key==='Enter'){if(G.phase==='secrets')lockFromPad();else doAsk()}
});
function wake(){
  if(document.visibilityState!=='visible')return;
  if(view==='game'&&R){
    try{R.presence(myPres).catch(()=>{})}catch(e){}
    try{if(R.connected&&!R.connected()&&R.reconnect)R.reconnect()}catch(e){}
    schedule();
  }
}
document.addEventListener('visibilitychange',wake);
window.addEventListener('pageshow',wake);
setInterval(()=>{
  const tv=timerLeft();
  if(tv!==null&&G&&G.players[G.turn]&&G.players[G.turn].pid===PID){
    const k=ui.timerSeq;
    if(tv<=5&&tv>0&&!sfxSeen.hurry.has('h'+k)){sfxSeen.hurry.add('h'+k);sfx('vo_hurry')}
    if(tv===0&&!sfxSeen.hurry.has('o'+k)){sfxSeen.hurry.add('o'+k);sfx('vo_timeover')}
  }
  if(tv===null)return;document.querySelectorAll('.tclock').forEach(el=>{const v=timerLeft();if(v===null)return;el.style.setProperty('--f',Math.min(1,v/Math.max(1,G.timer)).toFixed(3));const b=el.querySelector('b');if(b)b.textContent=v;el.classList.toggle('low',v<6)})},1000);
/* ---------- Internet required (web and app builds) ---------- */
const NEED_NET=!!window.HL_NEED_NET;
function offline(){return NEED_NET&&(navigator.onLine===false||roomState==='none')}
function offlineHTML(){return `<section class="panel center nonet"><svg viewBox="0 0 64 56" aria-hidden="true"><path d="M6 22a38 38 0 0 1 52 0M15 32a25 25 0 0 1 34 0M24 42a12 12 0 0 1 16 0" fill="none" stroke="#1E2240" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="50" r="4" fill="#1E2240"/><path d="M10 6 54 52" stroke="#F0503C" stroke-width="7" stroke-linecap="round"/></svg><h2>No internet</h2><p>Connect to play.</p><button class="btn primary full" id="retryNet">Try again</button></section>`}
async function initRooms(){
  roomState='checking';render(true);
  try{if(navigator.onLine===false&&NEED_NET)roomNS=null;else if(window.HL_CONFIG&&window.makeSupabaseRoom)roomNS=window.makeSupabaseRoom(window.HL_CONFIG);else roomNS=window.claude&&window.claude.use?await window.claude.use('room'):null}catch(e){roomNS=null}
  roomState=roomNS?'ok':'none';render(true);
}
window.addEventListener('offline',()=>render(true));
window.addEventListener('online',()=>{if(roomState==='none')initRooms();else render(true)});
/* ---------- Boot ---------- */
const DEEP=(()=>{
  const m=location.hash.match(/room=([A-Za-z]{4})/);if(!m)return null;
  try{let h=location.hash.replace(/room=[A-Za-z]{4}&?/,'').replace(/&$/,'');if(h==='#')h='';history.replaceState(null,'',location.pathname+location.search+h)}catch(e){}
  return m[1].toUpperCase();
})();
render(true);
(async()=>{
  await initRooms();
track('open',{inv:/[#&]room=/.test(location.hash)?1:0,wide:innerWidth>=820?1:0,app:window.HLNative?1:0});
  if(DEEP){
    if(roomState==='ok'&&NAME)startOnline(false,DEEP);
    else{ui.codeIn=DEEP;ui.friends=true;if(!NAME)ui.homeErr='Type your name, then tap Join.';render(true);if(!NAME){const ni=$('#nameIn');if(ni)ni.focus()}}
  }else{
    const s=LS.get(LSK('hl-session'));
    if(s&&s.code&&Date.now()-s.at<3*3600e3&&roomState==='ok')startOnline(!!s.host,s.code);
  }
})();
