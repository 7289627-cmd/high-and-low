/* ---------- Rating (Play duels) ---------- */
const ELO0=1000,PUB_N=2;
/* Play modes: bigger ranges take longer and pay more rating for a win. */
const MODES=[
  {k:'s',max:100,mult:1,icon:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M27 4 9 27h12l-3 17 20-25H25z" fill="#FFD23F" stroke="#1E2240" stroke-width="4" stroke-linejoin="round"/></svg>'},
  {k:'m',max:10000,mult:1.5,icon:'<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="#fff" stroke="#1E2240" stroke-width="4"/><circle cx="24" cy="24" r="11.5" fill="#F0503C" stroke="#1E2240" stroke-width="4"/><circle cx="24" cy="24" r="4" fill="#fff" stroke="#1E2240" stroke-width="3"/></svg>'},
  {k:'l',max:100000,mult:2,icon:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 37 4 14l11 9 9-15 9 15 11-9-2 23z" fill="#FFD23F" stroke="#1E2240" stroke-width="4" stroke-linejoin="round"/><circle cx="24" cy="29" r="3.5" fill="#F0503C" stroke="#1E2240" stroke-width="3"/></svg>'}
];
let pmSel=null;
function playMode(){const k=pmSel||LS.get('hl-pm');return MODES.find(m=>m.k===k)||MODES[0]}
function modeMult(max){const m=MODES.find(x=>x.max===max);return m?m.mult:1}
function modesHTML(){
  const cur=playMode().k;
  return `<div class="modes" role="radiogroup" aria-label="${uiHTML("Range")}" aria-describedby="homeRangeHint">${MODES.map(m=>`<button class="mode" role="radio" data-mode="${m.k}" aria-checked="${m.k===cur}">${m.icon}<b>${rangeHTML(1,m.max)}</b>${m.mult>1?`<em>×${m.mult}</em>`:''}</button>`).join('')}</div>
<p class="tip" id="homeRangeHint">${uiHTML("Bigger ranges mean more possible secret numbers.")}</p>`;
}
const RANKS=[[0,'Rookie'],[1050,'Guesser'],[1150,'Sharp'],[1300,'Hunter'],[1450,'Mind Reader'],[1600,'Mastermind']];
function myElo(){const e=LS.get(LSK('hl-elo'));return Number.isInteger(e)?Math.min(3000,Math.max(100,e)):ELO0}
function rankName(e){let n=RANKS[0][1];for(const r of RANKS)if(e>=r[0])n=r[1];return n}
/* How sharp a fill-in opponent plays at a given rating. */
function eloSkill(e){return Math.max(0.1,Math.min(0.97,(e-720)/900))}
let eloLast=null,eloSkip=false,eloPlayGid='',eloRoom='',eloFlash=0;
/* The opponent rating that counts in the maths: what they claim, kept within 300 of mine. */
function eloOpp(opp,me){const oe=Number.isInteger(opp.el)?opp.el:ELO0;return Math.min(me+300,Math.max(me-300,oe))}
/* Quit-dodge: a rated duel that reached play leaves a note on this phone. The note is removed when the game ends or the player leaves; if the app was killed in between, the loss is taken on the next launch. */
function pendClear(gid){try{const p=LS.get(LSK('hl-pend'));if(p&&(!gid||p.gid===gid))LS.del(LSK('hl-pend'))}catch(e){}}
function eloPend(){
  try{
    if(!G||!G.pub||G.phase!=='play')return;
    const m=byPid(PID);if(m&&!m.a){pendClear(G.gid);return}
    if(oppVanished()){pendClear(G.gid);return}/* the other phone dropped off: a kill now is not a dodge */
    const p=LS.get(LSK('hl-pend'));if(p&&p.gid===G.gid)return;
    if(G.max!==playMode().max||(eloRoom&&eloRoom===code))return;
    const st=eloAtStake();if(st>0)LS.set(LSK('hl-pend'),{gid:G.gid,stake:st,at:Date.now()});
  }catch(e){}
}
function eloPendBoot(){
  try{
    const p=LS.get(LSK('hl-pend'));if(!p)return;
    LS.del(LSK('hl-pend'));
    if(typeof p.gid!=='string'||p.gid.length>40||LS.get(LSK('hl-elo-g'))===p.gid)return;
    const me=myElo(),st=Number.isInteger(p.stake)?Math.min(80,Math.max(0,p.stake)):0,to=Math.max(100,me-st);
    LS.set(LSK('hl-elo'),to);LS.set(LSK('hl-elo-n'),(LS.get(LSK('hl-elo-n'))|0)+1);LS.set(LSK('hl-elo-g'),p.gid);
    track('rated',{won:0,elo:to});
    if(to<me)eloShow(to-me);
  }catch(e){}
}
function eloDeltaTxt(d){return (d>0?'+':d<0?'−':'')+Math.abs(d)}
/* Briefly shows a rating change next to the rating on the home screen. */
function eloShow(d){eloFlash=d;try{render(true)}catch(e){}setTimeout(()=>{eloFlash=0;try{if(view==='home')render(true)}catch(e){}},4000)}
function eloApply(won){
  try{
    if(!G||!G.pub||G.players.length!==2||!byPid(PID))return;
    if(LS.get(LSK('hl-elo-g'))===G.gid)return;
    /* The host phone decides what G says, so a hostile host could replay "finished games". Count a result only if this phone watched the game being played, at the range it asked for, and only once per room. */
    if(eloPlayGid!==G.gid||G.max!==playMode().max||(eloRoom&&eloRoom===code))return;
    eloRoom=code||'solo';
    const opp=G.players.find(p=>p.pid!==PID);if(!opp)return;
    LS.set(LSK('hl-elo-g'),G.gid);
    const me=myElo(),oe=eloOpp(opp,myElo()),ex=1/(1+Math.pow(10,(oe-me)/400));
    const played=(LS.get(LSK('hl-elo-n'))|0),k=played<10?40:28;
    let d=Math.round(k*((won?1:0)-ex)*(won?modeMult(G.max):1));if(won&&d<1)d=1;if(!won&&d>-1)d=-1;
    const to=Math.min(3000,Math.max(100,me+d));
    LS.set(LSK('hl-elo'),to);LS.set(LSK('hl-elo-n'),played+1);
    eloLast={gid:G.gid,d:to-me,from:me,to,up:rankName(to)!==rankName(me)&&to>me};
    track('rated',{won:won?1:0,elo:trackBucket(to),m:trackMode(G.max)});
  }catch(e){}
}
/* The other human of a rated duel dropped off the network and is not replaced yet: leaving then is not a forfeit. Only the host can tell, and only while its own connection is up. */
function oppVanished(){
  try{
    if(mode!=='online'||!isHost||!connected||!G||G.players.length!==2)return false;
    const o=G.players.find(p=>p.pid!==PID);
    return !!o&&!o.bot&&!peerMap.has(o.pid);
  }catch(e){return false}
}
/* What a loss right now would cost, without applying it. 0 when the game is not rated. */
function eloAtStake(){
  try{
    if(!G||!G.pub||G.phase!=='play'||G.players.length!==2)return 0;
    const m=byPid(PID),opp=G.players.find(p=>p.pid!==PID);if(!m||!m.a||!opp)return 0;
    if(LS.get(LSK('hl-elo-g'))===G.gid||oppVanished())return 0;
    const me=myElo();if(me<=100)return 0;
    const oe=eloOpp(opp,me),ex=1/(1+Math.pow(10,(oe-me)/400));
    const k=(LS.get(LSK('hl-elo-n'))|0)<10?40:28;
    return Math.max(1,Math.min(me-100,-Math.round(k*(0-ex))));
  }catch(e){return 0}
}
/* Rank badges: 48 px grid, 4 px ink outline, game palette. Index matches RANKS. */
const RANK_ART=[
  /* Rookie: sprout */'<path d="M24 40V24" stroke="#1E2240" stroke-width="4" stroke-linecap="round"/><path d="M6 44q18-17 36 0z" fill="#E07A4F" stroke="#1E2240" stroke-width="4" stroke-linejoin="round"/><path d="M24 28C10 30 5 21 6 10c13-1 19 5 18 18z" fill="#2FA36B" stroke="#1E2240" stroke-width="4" stroke-linejoin="round"/><path d="M24 24C23 12 30 6 42 7c1 13-6 20-18 17z" fill="#7AD3A6" stroke="#1E2240" stroke-width="4" stroke-linejoin="round"/>',
  /* Guesser: magnifier */'<path d="M30 30l11 11" stroke="#1E2240" stroke-width="11" stroke-linecap="round"/><path d="M30 30l11 11" stroke="#FFD23F" stroke-width="3.5" stroke-linecap="round"/><circle cx="20" cy="20" r="14" fill="#BFE9FF" stroke="#1E2240" stroke-width="4"/><path d="M12 19a9 9 0 0 1 7-7" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>',
  /* Sharp: arrowhead */'<path d="M24 24V41" stroke="#1E2240" stroke-width="4" stroke-linecap="round"/><path d="M24 33l-9 10h9zM24 33l9 10h-9z" fill="#fff" stroke="#1E2240" stroke-width="3" stroke-linejoin="round"/><path d="M24 4l16 29-16-6-16 6z" fill="#FF8A2B" stroke="#1E2240" stroke-width="4" stroke-linejoin="round"/><path d="M17 28l5-13" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>',
  /* Hunter: crosshair */'<circle cx="24" cy="24" r="15" fill="#EE4B3B" stroke="#1E2240" stroke-width="4"/><circle cx="24" cy="24" r="6" fill="#fff" stroke="#1E2240" stroke-width="3"/><path d="M24 3v13M24 32v13M3 24h13M32 24h13" stroke="#1E2240" stroke-width="4" stroke-linecap="round"/>',
  /* Mind Reader: eye */'<g transform="translate(0 4)"><path d="M24 2v6M9 8l3 5M39 8l-3 5" stroke="#1E2240" stroke-width="4" stroke-linecap="round"/><path d="M3 26Q24 6 45 26Q24 46 3 26z" fill="#fff" stroke="#1E2240" stroke-width="4" stroke-linejoin="round"/><circle cx="24" cy="26" r="9" fill="#A35BFF" stroke="#1E2240" stroke-width="3.5"/><circle cx="24" cy="26" r="3.6" fill="#1E2240"/><circle cx="27.5" cy="22.5" r="2" fill="#fff"/></g>',
  /* Mastermind: crown */'<path d="M7 38 5 18l10 8 9-14 9 14 10-8-2 20z" fill="#FFD23F" stroke="#1E2240" stroke-width="4" stroke-linejoin="round"/><rect x="7" y="34" width="34" height="9" rx="3" fill="#3D7BFF" stroke="#1E2240" stroke-width="4"/><circle cx="5" cy="14" r="3.6" fill="#EE4B3B" stroke="#1E2240" stroke-width="3"/><circle cx="24" cy="8" r="3.6" fill="#EE4B3B" stroke="#1E2240" stroke-width="3"/><circle cx="43" cy="14" r="3.6" fill="#EE4B3B" stroke="#1E2240" stroke-width="3"/><path d="M16 38.5h.1M24 38.5h.1M32 38.5h.1" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>'
];
function rankIdx(e){let n=0;RANKS.forEach((r,i)=>{if(e>=r[0])n=i});return n}
function rankBadge(e,cls){return `<svg class="rkb${cls?' '+cls:''}" viewBox="0 0 48 48" aria-hidden="true">${RANK_ART[rankIdx(e)]}</svg>`}
/* Where the rating sits between its rank's floor and the next rank's threshold, 0 to 1. The top rank is full. */
function rankFrac(e){const i=rankIdx(e);if(i>=RANKS.length-1)return 1;const a=i?RANKS[i][0]:100,b=RANKS[i+1][0];return Math.max(0,Math.min(1,(e-a)/(b-a)))}
function eloPill(){const e=myElo();return `<div class="wins-pill elo-pill"><b>${e}</b> ${rankBadge(e)}${uiHTML(rankName(e))}${eloFlash?`<span class="elo-fl ${eloFlash>0?'up':'down'}">${eloDeltaTxt(eloFlash)}</span>`:''}</div>`}
/* Paper confetti for a rank-up: beans and triangles in the game palette, one burst. */
function rankConfetti(){
  const cols=['#EE4B3B','#3D7BFF','#2FA36B','#A35BFF','#FF8A2B','#FF5FA8','#FFD23F'];
  const bean='<rect x="3" y="1.5" width="12" height="17" rx="6" fill="C" stroke="#1E2240" stroke-width="2.5"/>',tri='<path d="M10 2.5 18 17H2z" fill="C" stroke="#1E2240" stroke-width="2.5" stroke-linejoin="round"/>';
  let h='';const n=18;
  for(let i=0;i<n;i++){
    const a=-Math.PI/2+(i/n-0.5)*Math.PI*1.7+(Math.random()-0.5)*0.35,r=85+Math.random()*75;
    const x=Math.round(Math.cos(a)*r*1.1),y=Math.round(Math.sin(a)*r*0.9);
    h+=`<i style="--x:${x}px;--y:${y}px;--r:${Math.round((Math.random()-0.5)*720)}deg;--w:${(1.3+Math.random()*0.6).toFixed(2)}s;--dl:${(0.9+Math.random()*0.12).toFixed(2)}s"><svg viewBox="0 0 20 20" aria-hidden="true">${(i%2?bean:tri).replace('C',cols[i%cols.length])}</svg></i>`;
  }
  return `<div class="er-conf" aria-hidden="true">${h}</div>`;
}
function eloResultHTML(){
  if(!G||!eloLast||eloLast.gid!==G.gid)return '';
  const r=eloLast,i0=rankIdx(r.from),i1=rankIdx(r.to),ru=!!r.up,rd=i1<i0;
  const cu=typeof CSS!=='undefined'&&CSS.registerProperty?' cu':'';
  const a=Math.round(rankFrac(r.from)*100),b=Math.round(rankFrac(r.to)*100);
  return `<div class="er${ru?' ru':''}${i1===RANKS.length-1?' top':''}"><div class="elo-res ${r.d>0?'up':r.d<0?'down':''}${cu}" style="--f:${r.from};--t:${r.to}"><span class="d">${eloDeltaTxt(r.d)}</span><b>${r.to}</b><span class="rk"><span class="bd">${rankBadge(r.to,ru?'stamp':'')}${ru?'<u></u>':''}</span><span class="nm">${uiHTML(rankName(r.to))}</span></span></div><div class="er-bar${ru?' fu':rd?' fd':''}" style="--a:${a}%;--b:${b}%"><i></i></div>${ru?rankConfetti():''}</div>`;
}
