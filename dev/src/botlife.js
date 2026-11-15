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
    botTaunt(b.pid,rnd(0,99)<60?e:back[rnd(0,back.length-1)],rnd(900,3000));
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

/* ---------- Fill-in realism (host side, Play duels only) ----------
   Think times, round-ish questions, small slips, human-looking secrets and a slider-drag delay before the fill-in is "Ready".
   Tests: window.HL_TEST_BOT_K scales every wait here; with any other HL_TEST_* speed hook set the default is 0.2, so old tests stay as fast as before. */
function botK(){
  const k=window.HL_TEST_BOT_K;
  if(typeof k==='number'&&k>=0)return k;
  return(window.HL_TEST_Q_MS||window.HL_TEST_FILL_MS||window.HL_TEST_TIMER_MS)?0.2:1;
}
const isFill=p=>!!(p&&p.bot&&p.hb&&!p.ez&&G&&G.pub);
let botTempo={},botDirs={},botWait=1500;
/* ms before the fill-in asks or guesses: 1.4 s and up, usually 2 to 5 s, slower on the first move and at awkward sizes, quick on obvious last guesses, a rare long pause. Never above 9 s. */
function botThinkMs(me){
  if(!botTempo[me.pid])botTempo[me.pid]=0.8+Math.random()*0.5;
  const sub=G.sub&&G.sub[0],st=G.st&&G.st[me.pid],first=!(st&&st[0]);
  let s=1.4-Math.log(1-Math.random())*1.4,min=1.4;
  s*=botTempo[me.pid];
  let n=0;
  if(sub&&!isAsk(sub)){const t=byPid(sub);if(t)n=left(vw(me.pid,t))}
  else if(isAsk(sub)){const f=focusOf(me.pid);if(f){n=vw(me.pid,f);n=n.hi-n.lo+1}}
  if(sub&&!isAsk(sub)){
    if(n<=1){s=0.9+Math.random()*0.9;min=0.9}
    else if(n<=3){s*=0.6;min=1.1}
  } else {
    if(n>10&&n<=24)s+=0.8+Math.random()*1.4;
    s*=G.max>=100000?1.2:G.max>=10000?1.1:1;
  }
  if(first)s+=1.4+Math.random()*2.4;
  if(Math.random()<0.06)s+=2.5+Math.random()*2.5;
  return Math.round(Math.min(9000,Math.max(min*1000,s*1000))*botK());
}
function botWaitMs(me){return isFill(me)?botThinkMs(me):1500}
/* Habit: mostly the same direction as last time. */
function botDirFor(pid){
  let d=botDirs[pid];
  if(!d||Math.random()<0.3)d=Math.random()<.5?'h':'l';
  botDirs[pid]=d;return d;
}
const NICE=[5,10,25,50,100,250,500,1000,2500,5000,10000,25000];
/* The number the fill-in asks. The spot comes from botSplit (rating decides how far from the middle); then a human touch: a slider that lands on round numbers (50, 2500), now and then a slip. */
function botAskX(t,sk,dir,max){
  const n=t.hi-t.lo+1,mn=dir==='h'?t.lo:t.lo+1,mx=dir==='h'?t.hi-1:t.hi;
  let x=botSplit(t,Math.min(1,sk+0.04*(1-sk)),dir,Math.random(),Math.random());/* slips and rounding cost a little strength: give it back */
  if(n>12&&Math.random()<0.008+0.07*(1-sk)){
    const d=Math.round(n*(0.08+Math.random()*0.17))*(Math.random()<.5?-1:1);
    x=Math.max(mn,Math.min(mx,x+d));
  }
  let st=1;for(const v of NICE)if(v*6<=n)st=v;
  if(st>1){
    const r=Math.random(),big=n>=1000?0.8:0.62;
    const step=r<big?st:r<big+0.2?(st>=100?st/10:st>=10?5:1):1;
    if(step>1){const y=Math.round(x/step)*step;if(y>=mn&&y<=mx)x=y}
  }
  return x;
}
/* Secrets people really pick: lucky and funny numbers, round numbers, years, birthdays. Mixed into a uniform pick, so no number is likely enough to bet on. */
const BOT_FAV={
  100:[[7,5],[37,4],[69,4],[77,3],[42,4],[17,3],[13,2],[21,2],[23,2],[27,2],[33,2],[50,3],[100,2],[1,1],[99,2],[88,1],[11,2],[22,1],[73,2],[3,2],[10,1],[25,2],[66,1],[55,1],[12,1],[8,2],[5,1],[44,1],[64,1],[96,1],[18,1]]
};
let botFavCache={};
function botSecretDist(max){
  if(botFavCache[max])return botFavCache[max];
  let pool=[],q=0.3;
  if(BOT_FAV[max])pool=BOT_FAV[max];
  else if(max===10000){
    q=0.22;
    for(let v=500;v<=10000;v+=500)pool.push([v,v%1000?1:2]);
    for(let d=1;d<=9;d++)pool.push([d*1111,1.5]);
    for(const v of [1234,4321,6969,4200,1337,2468,1357,3141,2024,5678,7007,1000])pool.push([v,1]);
    for(let y=1950;y<=2012;y++)pool.push([y,0.5]);
    for(let m=1;m<=12;m++)for(let d=1;d<=[31,29,31,30,31,30,31,31,30,31,30,31][m-1];d++)pool.push([m*100+d,0.12]);
  } else {
    q=0.18;
    for(let v=5000;v<=100000;v+=5000)pool.push([v,v%10000?1:2.5]);
    for(let d=1;d<=9;d++)pool.push([d*11111,1.5]);
    for(const v of [12345,54321,69420,42069,31415,77777,13579,24680,10001,99999])pool.push([v,1]);
  }
  const m={};let W=0;
  for(const [v,w] of pool){if(v<1||v>max)continue;m[v]=(m[v]||0)+w;W+=w}
  const list=Object.keys(m).map(k=>[+k,m[k]]);
  return botFavCache[max]={q,list,W};
}
function botSecretPick(max){
  const d=botSecretDist(max);
  if(Math.random()>=d.q||!d.list.length)return rnd(1,max);
  let r=Math.random()*d.W;
  for(const [v,w] of d.list){r-=w;if(r<=0)return v}
  return d.list[d.list.length-1][0];
}
/* How long the fill-in "drags the slider" before it shows Ready: 2 to 6.5 s. */
function botLockMs(){return Math.round((2000+Math.pow(Math.random(),1.3)*4500)*botK())}
/* Fill-ins that are still "dragging the slider" (G.bw) show Picking... and hold the start of the game. */
function botLockInit(){
  G.bw={};const gid=G.gid;
  for(const p of G.players)if(isFill(p)){
    const pid=p.pid;G.bw[pid]=1;
    later(()=>{if(G&&G.gid===gid&&G.bw&&G.bw[pid]){delete G.bw[pid];publishG()}},botLockMs());
  }
}
