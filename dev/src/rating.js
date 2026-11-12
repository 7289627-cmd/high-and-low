/* ---------- Rating (Play duels) ---------- */
const ELO0=1000,PUB_N=2;
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
    let d=Math.round(k*((won?1:0)-ex));if(won&&d<1)d=1;if(!won&&d>-1)d=-1;
    const to=Math.max(100,me+d);
    LS.set(LSK('hl-elo'),to);LS.set(LSK('hl-elo-n'),played+1);
    eloLast={gid:G.gid,d:to-me,from:me,to,up:rankName(to)!==rankName(me)&&to>me};
    track('rated',{won:won?1:0,elo:to});
  }catch(e){}
}
function eloPill(){const e=myElo();return `<div class="wins-pill elo-pill"><b>${e}</b> ${rankName(e)}</div>`}
function eloResultHTML(){
  if(!G||!eloLast||eloLast.gid!==G.gid)return '';
  const r=eloLast;
  return `<div class="elo-res ${r.d>=0?'up':'down'}"><span class="d">${r.d>=0?'+':'−'}${Math.abs(r.d)}</span><b>${r.to}</b><span>${rankName(r.to)}</span></div>${r.up?`<div class="elo-rankup">New rank: ${rankName(r.to)}!</div>`:''}`;
}
