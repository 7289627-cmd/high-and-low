/* Worker A: final showdown. Defines window.showdownTick, called from update() in main.js */
window.showdownTick=function(){
  let on=false;
  try{on=view==='game'&&!!G&&G.phase==='play'&&G.players.length>=3&&G.players.filter(p=>p.a).length===2}catch(e){}
  document.body.classList.toggle('showdown',on);
};

/* ---------- Adaptive bots (push and pull) ---------- */
function botSkillBase(){
  let r=null;try{r=LS.get(LSK('hl-botrec'))}catch(e){}
  if(!Array.isArray(r)||!r.length)return 0.25;
  let w=0,l=0;
  for(let i=r.length-1;i>=0&&r[i]===1;i--)w++;
  for(let i=r.length-1;i>=0&&r[i]===0;i--)l++;
  return Math.max(0.15,Math.min(0.95,0.5+0.12*w-0.15*l));
}
function botRecord(won){
  let r=null;try{r=LS.get(LSK('hl-botrec'))}catch(e){}
  if(!Array.isArray(r))r=[];
  r.push(won?1:0);
  try{LS.set(LSK('hl-botrec'),r.slice(-5))}catch(e){}
}
function botGameDone(){
  if(!G||G.phase!=='over'||!Array.isArray(G.players))return;
  if(!G.players.some(p=>p.bot)||!G.players.some(p=>p.pid===PID))return;
  const key=G.gid+':'+G.en;
  if(LS.get(LSK('hl-botrec-last'))===key)return;
  LS.set(LSK('hl-botrec-last'),key);
  botRecord(G.win===PID);
}
function botLeaderBias(t){
  const al=G.players.filter(p=>p.a);
  if(al.length<3)return 0;
  const size=p=>p.hi-p.lo+1;
  let lead=al[0],tr=null;
  for(const p of al){if(size(p)>size(lead))lead=p}
  for(const p of al){if(size(p)<=10)continue;if(!tr||size(p)<size(tr))tr=p}
  if(t.pid===lead.pid)return 0.2;
  if(tr&&t.pid===tr.pid)return -0.2;
  return 0;
}
function botSplit(t,skill,dir,r1,r2){
  const n=t.hi-t.lo+1,s=Math.max(0,Math.min(1,skill));
  let f=0.5-(1-s)*0.33;
  f+=(r1-0.5)*0.1;
  if(r2>0.5)f=1-f;
  f=Math.max(0.05,Math.min(0.95,f));
  const x=t.lo+Math.floor(n*f);
  return dir==='h'?Math.min(t.hi-1,Math.max(t.lo,x)):Math.min(t.hi,Math.max(t.lo+1,x));
}
