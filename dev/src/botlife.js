/* ---------- Fill-in players: names, looks and a bit of life (host side) ---------- */
const NM_FIRST=['mia','leo','zoe','kai','ava','max','ivy','sam','noah','eli','luna','theo','ruby','finn','maya','jude','nova','otis','remy','cleo','jake','emma','liam','aria','josh','nina','owen','lily','ryan','tess','cole','jade','marco','sofia','diego','priya','omar','hana','luca','nora','ben','kate','dan','amy','tom','lexi','zane','bri','gus','meg','ty','jess','alex','chris','sara','matt','ella','nick','anna','drew','carlos','yuki','andre','lena','isaac','rosa','malik','tori','kev','dani'];
const NM_WORD=['frog','toast','noodle','pickle','goose','potato','waffle','ghost','panda','taco','pixel','sock','moth','gremlin','bagel','otter','cactus','muffin','yeti','pigeon','beans','pretzel','llama','turnip','raccoon'];
const NM_PRE=['sleepy','big','lil','sad','salty','angry','tiny','lucky','silly','sneaky','hungry','chill','mr','its','not','real','the','just','ok','king'];
function nmCap(s){return s[0].toUpperCase()+s.slice(1)}
function nmMake(){
  const f=NM_FIRST[rnd(0,NM_FIRST.length-1)],w=NM_WORD[rnd(0,NM_WORD.length-1)],p=NM_PRE[rnd(0,NM_PRE.length-1)];
  const d2=()=>String(rnd(1,99)).padStart(rnd(0,1)?2:1,'0'),L='abcdefghjklmnprstvw'[rnd(0,18)];
  switch(rnd(0,13)){
    case 0:case 1:return nmCap(f);
    case 2:return f;
    case 3:return f+d2();
    case 4:return nmCap(f)+'_'+d2();
    case 5:return 'x'+nmCap(f);
    case 6:return f+'.'+L;
    case 7:return nmCap(f)+L.toUpperCase();
    case 8:return f+f[f.length-1].repeat(rnd(1,2));
    case 9:return p+w;
    case 10:return nmCap(p)+nmCap(w);
    case 11:return p+'_'+f;
    case 12:return w+d2();
    default:return p+nmCap(f);
  }
}
/* A name this device has not shown before (remembers the last 500). */
function freshName(used){
  let seen=LS.get('hl-fill-seen');if(!Array.isArray(seen))seen=[];
  const taken=new Set([...used,...seen].map(s=>String(s).toLowerCase()));
  let n='Bean';
  for(let i=0;i<60;i++){const c=nmMake();if(c.length>=3&&c.length<=12&&!taken.has(c.toLowerCase())){n=c;break}}
  seen.push(n);LS.set('hl-fill-seen',seen.slice(-500));
  return n;
}
function fillLook(){
  const hats=typeof hatCount==='function'?hatCount():12;
  return rnd(0,99)<45?null:rnd(0,hats-1);
}

/* Personalities. Kept on the host only, never sent to other phones. */
const PZ_POOL=['quiet','quiet','quiet','react','react','react','echo','echo','spam','spam'];
const TN={LOL:0,SCARED:1,HMM:2,EVIL:3,PRAY:4,FIRE:5};
let botPz={},botFav={},botTnAt={},botEchoAt={},lifeGid='',lifeEv='',lifeOver='';
function pzOf(p){
  if(!p||!p.bot||!p.hb||p.ez)return 'quiet';
  if(!botPz[p.pid]){botPz[p.pid]=PZ_POOL[rnd(0,PZ_POOL.length-1)];botFav[p.pid]=rnd(0,5)}
  return botPz[p.pid];
}
function lifeBots(){return G?G.players.filter(p=>p.bot&&p.hb&&!p.ez):[]}
function botTaunt(pid,e,delay,again){
  const gid=G&&G.gid;
  later(()=>{
    if(!G||!isHost||G.gid!==gid||G.phase==='lobby')return;
    const p=byPid(pid);if(!p||!p.bot)return;
    const now=Date.now(),gap=now-(botTnAt[pid]||0);
    if(gap<1600){if(!again)botTaunt(pid,e,1600-gap+rnd(80,500),1);return}
    botTnAt[pid]=now;
    if(!G.bt)G.bt={};
    const o=G.bt[pid];G.bt[pid]={n:(o?o.n:0)+1,e};
    publishG();
  },delay);
}
/* A real player sent a taunt: copycats answer it. */
function botHear(pid,e){
  if(!isHost||!G||G.phase==='lobby')return;
  const from=byPid(pid);if(!from||from.bot)return;
  const now=Date.now();
  for(const b of lifeBots()){
    const z=pzOf(b),chance=z==='echo'?78:z==='react'?14:z==='spam'?10:0;
    if(rnd(0,99)>=chance)continue;
    const h=(botEchoAt[b.pid]||[]).filter(t=>now-t<12000);
    if(h.length>=4)continue;h.push(now);botEchoAt[b.pid]=h;
    const back={0:[0,0,3],1:[0,1],2:[2,0],3:[1,3,3],4:[0,4],5:[5,5,0]}[e]||[e];
    botTaunt(b.pid,rnd(0,99)<60?e:back[rnd(0,back.length-1)],rnd(700,2000));
  }
}
function spamLoop(pid,gid){
  later(()=>{
    if(!G||!isHost||G.gid!==gid||G.phase!=='play')return;
    const n=rnd(1,4),fav=botFav[pid]||0;
    for(let i=0;i<n;i++)botTaunt(pid,rnd(0,99)<70?fav:rnd(0,5),i*rnd(1650,2200));
    spamLoop(pid,gid);
  },rnd(7000,24000));
}
/* Called from hostTick: reacts to knockouts and the end of the game. */
function botLifeTick(){
  if(!G||!isHost)return;
  if(G.phase==='play'&&lifeGid!==G.gid){
    lifeGid=G.gid;lifeEv='';lifeOver='';G.bt={};
    for(const b of lifeBots()){const z=pzOf(b);if(z==='spam')spamLoop(b.pid,G.gid);else if(z==='react'&&rnd(0,99)<35)botTaunt(b.pid,TN.FIRE,rnd(6500,9000))}
  }
  if(G.phase==='play'&&G.ev&&G.ev.t==='hit'){
    const sig=G.gid+':'+G.en+':'+G.ev.tg;
    if(sig!==lifeEv){
      lifeEv=sig;
      for(const b of lifeBots()){
        const z=pzOf(b),r=rnd(0,99),base=z==='react'?70:z==='quiet'?8:35;
        if(r>=base)continue;
        const e=b.pid===G.ev.a?[TN.EVIL,TN.FIRE,TN.LOL][rnd(0,2)]:b.pid===G.ev.tg?[TN.SCARED,TN.PRAY][rnd(0,1)]:[TN.LOL,TN.SCARED,TN.LOL][rnd(0,2)];
        botTaunt(b.pid,e,rnd(5200,7500));
      }
    }
  }
  if(G.phase==='over'&&lifeOver!==G.gid){
    lifeOver=G.gid;
    for(const b of lifeBots()){
      const z=pzOf(b);
      if(b.pid===G.win){if(z==='quiet'&&rnd(0,1))continue;const n=z==='spam'?4:rnd(2,3);for(let i=0;i<n;i++)botTaunt(b.pid,[TN.FIRE,TN.LOL,TN.EVIL][rnd(0,2)],1800+i*rnd(1650,2100))}
      else if(z!=='quiet'&&rnd(0,99)<55)botTaunt(b.pid,[TN.PRAY,TN.SCARED,TN.HMM][rnd(0,2)],rnd(2000,5000));
    }
  }
}
