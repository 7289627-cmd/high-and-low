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
  return `<div class="modes" role="radiogroup" aria-label="Range">${MODES.map(m=>`<button class="mode" role="radio" data-mode="${m.k}" aria-checked="${m.k===cur}">${m.icon}<b>1 – ${fmt(m.max)}</b>${m.mult>1?`<em>×${m.mult}</em>`:''}</button>`).join('')}</div>`;
}
const RANKS=[[0,'Rookie'],[1050,'Guesser'],[1150,'Sharp'],[1300,'Hunter'],[1450,'Mind Reader'],[1600,'Mastermind']];
function myElo(){const e=LS.get(LSK('hl-elo'));return Number.isInteger(e)?Math.min(3000,Math.max(100,e)):ELO0}
function rankName(e){let n=RANKS[0][1];for(const r of RANKS)if(e>=r[0])n=r[1];return n}
/* How sharp a fill-in opponent plays at a given rating. */
function eloSkill(e){return Math.max(0.1,Math.min(0.97,(e-720)/900))}
let eloLast=null,eloSkip=false;
function eloApply(won){
  try{
    if(!G||!G.pub||G.players.length!==2||!byPid(PID))return;
    if(LS.get(LSK('hl-elo-g'))===G.gid)return;
    const opp=G.players.find(p=>p.pid!==PID);if(!opp)return;
    LS.set(LSK('hl-elo-g'),G.gid);
    const me=myElo(),oe=Number.isInteger(opp.el)?opp.el:ELO0,ex=1/(1+Math.pow(10,(oe-me)/400));
    const played=(LS.get(LSK('hl-elo-n'))|0),k=played<10?40:28;
    let d=Math.round(k*((won?1:0)-ex)*(won?modeMult(G.max):1));if(won&&d<1)d=1;if(!won&&d>-1)d=-1;
    const to=Math.max(100,me+d);
    LS.set(LSK('hl-elo'),to);LS.set(LSK('hl-elo-n'),played+1);
    eloLast={gid:G.gid,d:to-me,from:me,to,up:rankName(to)!==rankName(me)&&to>me};
    track('rated',{won:won?1:0,elo:to});
  }catch(e){}
}
/* What a loss right now would cost, without applying it. 0 when the game is not rated. */
function eloAtStake(){
  try{
    if(!G||!G.pub||G.phase!=='play'||G.players.length!==2)return 0;
    const m=byPid(PID),opp=G.players.find(p=>p.pid!==PID);if(!m||!m.a||!opp)return 0;
    if(LS.get(LSK('hl-elo-g'))===G.gid)return 0;
    const me=myElo(),oe=Number.isInteger(opp.el)?opp.el:ELO0,ex=1/(1+Math.pow(10,(oe-me)/400));
    const k=(LS.get(LSK('hl-elo-n'))|0)<10?40:28;
    return Math.max(1,Math.min(me-100,-Math.round(k*(0-ex))));
  }catch(e){return 0}
}
function eloPill(){const e=myElo();return `<div class="wins-pill elo-pill"><b>${e}</b> ${rankName(e)}</div>`}
function eloResultHTML(){
  if(!G||!eloLast||eloLast.gid!==G.gid)return '';
  const r=eloLast;
  return `<div class="elo-res ${r.d>=0?'up':'down'}"><span class="d">${r.d>=0?'+':'−'}${Math.abs(r.d)}</span><b>${r.to}</b><span>${rankName(r.to)}</span></div>${r.up?`<div class="elo-rankup">New rank: ${rankName(r.to)}!</div>`:''}`;
}
