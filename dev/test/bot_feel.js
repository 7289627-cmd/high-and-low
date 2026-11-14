/* Measures how the hidden fill-in opponent behaves over whole duels, as a suspicious player would see it.
   node bot_feel.js [--site=path/to/index.html] [--k=0.25] [--n=30] [--real=3] [--sim=4000]
   - real duels (jsdom, fake hub, Play button): HL_TEST_BOT_K scales ONLY the fill-in's think and lock waits; every delay printed is divided by K
     (the old build has no such hook, so it runs at its real timing and K is ignored). --real=3 adds that many unscaled duels as a check.
   - win rate: pure simulation of the duel rules. "Human of matching skill" = the ORIGINAL botSplit engine (no rounding, no slips) at eloSkill(rating),
     random direction, uniform secret, guesses uniformly among candidates once 10 or fewer are left. The fill-in sits at max(700, rating+-80). */
const {JSDOM}=require('jsdom');const fs=require('fs'),path=require('path');
const arg=(k,d)=>{const a=process.argv.find(x=>x.startsWith('--'+k+'='));return a?a.slice(k.length+3):d};
const SITE=arg('site',path.join(__dirname,'../site/index.html'));
const K=Number(arg('k','0.25')),N=Number(arg('n','30')),REAL=Number(arg('real','3')),SIM=Number(arg('sim','4000')),BATCH=Number(arg('batch','10'));
const raw=fs.readFileSync(SITE,'utf8').replace(/<script src="[^"]*"><\/script>/g,'').replace(/<link [^>]*>/g,'');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const MODES={s:100,m:10000,l:100000};
function fakeClient(hub){return{channel(name){const subs=hub[name]||(hub[name]=[]);const me={handlers:[],name};
  const ch={on(t,f,cb){me.handlers.push({event:f.event,cb});return ch},subscribe(cb){subs.push(me);setTimeout(()=>cb&&cb('SUBSCRIBED'),10);return ch},
  send(m){subs.forEach(o=>{if(o===me)return;o.handlers.forEach(h=>{if(h.event===m.event)setTimeout(()=>h.cb({event:m.event,payload:JSON.parse(JSON.stringify(m.payload))}),5)})});return Promise.resolve('ok')},_me:me};return ch},
  removeChannel(ch){const s=hub[ch._me.name]||[];const i=s.indexOf(ch._me);if(i>=0)s.splice(i,1);return Promise.resolve('ok')}}}
function phone(url,k){const hub={};
  const dom=new JSDOM(raw,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'+url,beforeParse(w){const fc=fakeClient(hub);w.supabase={createClient:()=>fc};if(k!=null)w.HL_TEST_BOT_K=k}});
  const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));w.$=s=>w.document.querySelector(s);return w}
const STATE=`(()=>{if(!G)return null;const b=G.players.find(p=>p.bot),meI=G.players.findIndex(p=>p.pid===PID);
 let rdy=null;const rows=[...document.querySelectorAll('.ready-list .prow2')];const br=rows.find(r=>!r.querySelector('.tag'));if(br)rdy=!!br.querySelector('.state-ok');
 const kb=b&&G.kn&&G.kn[b.pid]&&G.kn[b.pid][PID],km=b&&G.kn&&G.kn[PID]&&G.kn[PID][b.pid];
 return JSON.stringify({ph:G.phase,st:G.stage,seq:G.seq,turn:G.turn,meI,bot:b&&b.pid,botI:b?G.players.indexOf(b):-1,el:b&&b.el,max:G.max,q:G.q,sub:G.sub,bt:G.bt||null,win:G.win,rdy,kb:kb&&{lo:kb.lo,hi:kb.hi},km:km&&{lo:km.lo,hi:km.hi,x:km.x},mySec:!!mySecret,gid:G.gid})})()`;
const sd=a=>{if(a.length<2)return 0;const m=a.reduce((s,v)=>s+v,0)/a.length;return Math.sqrt(a.reduce((s,v)=>s+(v-m)*(v-m),0)/(a.length-1))};
const med=a=>{if(!a.length)return NaN;const b=[...a].sort((x,y)=>x-y),h=b.length>>1;return b.length%2?b[h]:(b[h-1]+b[h])/2};
async function duel(modeKey,R,k,scaled){
  const w=phone('d'+Math.random(),k);await wait(500);
  const rec={mode:modeKey,R,k:scaled?k:1,turns:[],asks:[],tf:[],lock:null,instant:null,taunts:[],win:null,err:null};
  try{
    w.eval(`LS.set(LSK('hl-elo'),${R})`);w.$('[data-mode="'+modeKey+'"]').click();w.$('#playBtn').click();
    const T0=Date.now(),sh=eval('(R)=>{const e=(R-720)/900;return Math.max(0.1,Math.min(0.97,e))}')(R);
    let tSec=0,tPlay=0,locked=false,lastAct=-1,botSeq=-1,tTurn=0,recQ=-1,lastBt={},overAt=0,prevTaunt=0,bi=-1,firstSeen=true;
    while(Date.now()-T0<(scaled?420000:900000)){
      await wait(25);let s;try{s=JSON.parse(w.eval(STATE))}catch(e){continue}
      if(!s)continue;const now=Date.now();
      if(s.ph==='secrets'){
        if(!tSec){tSec=now;rec.instant=s.rdy===true}
        if(rec.lock==null&&s.rdy===true)rec.lock=(now-tSec)/(scaled?k:1)/1000;
        if(!locked&&now-tSec>600){locked=true;w.eval(`lockSecret(${1+Math.floor(Math.random()*s.max)})`)}
      }
      if(s.ph==='play'&&!tPlay){tPlay=now;if(rec.lock==null)rec.lock=(now-tSec)/(scaled?k:1)/1000}
      if(s.ph==='play'&&s.st==='show'&&s.turn===s.botI&&botSeq===s.seq&&recQ!==s.seq&&s.sub&&s.sub.length===0){
        /* a guess is answered by the other phone within ~50 ms, so it can pass between two polls: log it from the 'show' stage */
        recQ=s.seq;rec.turns.push({d:(now-tTurn)/(scaled?k:1)/1000-0.05,ask:false,first:rec.turns.length===0,left:null,late:true});
      }
      if(s.ph==='play'&&s.st==='await'){
        if(s.turn===s.botI&&s.seq!==botSeq){botSeq=s.seq;tTurn=now}
        if(s.q&&s.q.a===s.bot&&recQ!==s.seq){
          recQ=s.seq;const d=(now-tTurn)/(scaled?k:1)/1000;
          const q=s.q,isAsk=q.t==='askall';
          const first=rec.turns.length===0;
          const t={d,ask:isAsk,first,left:isAsk?s.kb.hi-s.kb.lo+1:null};
          rec.turns.push(t);
          if(isAsk){const x=q.xs[Object.keys(q.xs)[0]],lo=s.kb.lo,hi=s.kb.hi,n=hi-lo+1;rec.asks.push({x,lo,hi,n,dir:q.dir,max:s.max})}
        }
        if(s.turn===s.meI&&!s.q&&lastAct!==s.seq&&s.km){
          lastAct=s.seq;await wait(150);
          const v=s.km;
          if(s.sub[0]==='*'){const dir=Math.random()<.5?'h':'l';
            const x=w.eval(`botSplit({lo:${v.lo},hi:${v.hi}},${sh},'${dir}',Math.random(),Math.random())`);
            w.eval(`sendAct({tg:'${s.bot}',t:'askall',dir:'${dir}',x:${x}})`)}
          else{const c=[];for(let n=v.lo;n<=v.hi;n++)if(!v.x.includes(n))c.push(n);
            w.eval(`sendAct({tg:'${s.bot}',t:'guess',n:${c[Math.floor(Math.random()*c.length)]}})`)}
        }
      }
      if(s.bt){for(const p in s.bt){const o=lastBt[p];if(!o||o.n!==s.bt[p].n){lastBt[p]=s.bt[p];const tt=(now-(tPlay||now))/1000;rec.taunts.push({t:tt,gap:prevTaunt?tt-prevTaunt:null,e:s.bt[p].e,over:s.ph==='over'});prevTaunt=tt}}}
      if(s.ph==='over'){if(!overAt){overAt=now;rec.win=s.win===undefined?null:(s.win===s.bot?'bot':'me');rec.el=s.el;rec.dur=(now-tPlay)/1000}
        if(now-overAt>7000)break}
    }
    if(!overAt)rec.err='timeout';
  }catch(e){rec.err=e.message}
  if(w.errs.length)rec.err=(rec.err||'')+' pageerr:'+w.errs[0];
  try{w.close()}catch(e){}
  return rec;
}
/* ---------- simulated duels for win rate and efficiency ---------- */
function simulate(W,max,R,count,useAsk){
  const split=W.eval('botSplit'),askX=useAsk?W.eval('botAskX'):null,sk=W.eval('eloSkill');
  let hw=0,botAsksToZone=[],huAsksToZone=[],turns=[];
  for(let g=0;g<count;g++){
    const bR=Math.max(700,R+Math.floor(Math.random()*161)-80),sh=sk(R),sb=sk(bR);
    const sec=[1+Math.floor(Math.random()*max),useAsk?null:null];sec[1]=1+Math.floor(Math.random()*max);
    const v=[{lo:1,hi:max,x:[]},{lo:1,hi:max,x:[]}],ask=[0,0];let who=Math.random()<.5?0:1,win=-1,t=0;
    // who 0 = human, 1 = bot. v[i] is i's view of the other
    while(win<0&&t<400){t++;const o=1-who,V=v[who],n=V.hi-V.lo+1;
      if(n<=10){const c=[];for(let q=V.lo;q<=V.hi;q++)if(!V.x.includes(q))c.push(q);const p=c[Math.floor(Math.random()*c.length)];if(p===sec[o])win=who;else V.x.push(p)}
      else{ask[who]++;const dir=Math.random()<.5?'h':'l',tt={lo:V.lo,hi:V.hi};
        const x=who===1&&askX?askX(tt,sb,dir,max):split(tt,who===1?sb:sh,dir,Math.random(),Math.random());
        const yes=dir==='h'?sec[o]>x:sec[o]<x;
        if(dir==='h'){if(yes)V.lo=x+1;else V.hi=x}else{if(yes)V.hi=x-1;else V.lo=x}}
      who=o}
    if(win===0)hw++;turns.push(t);botAsksToZone.push(ask[1]);huAsksToZone.push(ask[0]);
  }
  const m=a=>a.reduce((s,v)=>s+v,0)/a.length;
  return{humanWin:hw/count,turns:m(turns),botAsks:m(botAsksToZone),huAsks:m(huAsksToZone)};
}
const SIMONLY=arg('simonly','0')==='1';
const f=(v,d)=>Number.isFinite(v)?v.toFixed(d==null?1:d):'-';
(async()=>{
  console.log('site',SITE,'K',K,'duels',N,'real',REAL);
  // ---- simulation ----
  const sw=phone('sim');await wait(400);
  const hasAsk=sw.eval("typeof botAskX")==='function';
  console.log('\n== Simulated win rate of a human at their own rating (n='+SIM+' each), bot engine: '+(hasAsk?'botAskX (new)':'botSplit (old)')+' ==');
  console.log('mode   rating  humanWin  turns/duel  botAsks  humanAsks  optimum asks');
  const sim={};
  for(const [mk,mx] of Object.entries(MODES))for(const R of [300,1000,1700]){
    const r=simulate(sw,mx,R,SIM,hasAsk);sim[mk+R]=r;
    console.log(mk.padEnd(6),String(R).padEnd(7),f(r.humanWin*100)+'%'.padEnd(5),f(r.turns).padEnd(11),f(r.botAsks).padEnd(8),f(r.huAsks).padEnd(10),Math.ceil(Math.log2(mx/10)))}
  if(SIMONLY)process.exit(0);
  // ---- secrets entropy ----
  if(hasAsk){console.log('\n== Secret entropy (bits, exact) vs uniform ==');
    for(const [mk,mx] of Object.entries(MODES)){const d=JSON.parse(sw.eval(`JSON.stringify(botSecretDist(${mx}))`));
      const pm={};for(const [v,w] of d.list)pm[v]=d.q*w/d.W;const uni=(1-d.q)/mx;
      let H=0,pmax=0;const nfav=d.list.length;
      for(const [v] of d.list){const p=uni+pm[v];H-=p*Math.log2(p);pmax=Math.max(pmax,p)}
      const rest=mx-nfav;if(rest>0&&uni>0)H-=rest*uni*Math.log2(uni);
      console.log(mk,'uniform',f(Math.log2(mx),2),'kept',f(H,2),'('+f(H/Math.log2(mx)*100,1)+'%)  top number p='+f(pmax*100,2)+'% vs uniform '+f(100/mx,3)+'%  boosted numbers '+nfav+', mass on them '+f((d.q+uni*nfav*d.W/d.W)*100,1)+'%')}}
  // ---- real duels ----
  const plan=[];const rs=[300,1000,1700];
  for(const mk of Object.keys(MODES))for(let i=0;i<N/3;i++)plan.push([mk,rs[i%3],true]);
  for(let i=0;i<REAL;i++)plan.push([Object.keys(MODES)[i%3],[1000,300,1700][i%3],false]);
  const recs=[];
  const t0=Date.now();
  // scaled duels in batches; unscaled (real timing) ones all together at the end
  const sc=plan.filter(p=>p[2]),un=plan.filter(p=>!p[2]);
  for(let i=0;i<sc.length;i+=BATCH){const b=sc.slice(i,i+BATCH);recs.push(...await Promise.all(b.map(p=>duel(p[0],p[1],hasAsk?K:1,true))));console.error('batch done',i,Math.round((Date.now()-t0)/1000)+'s')}
  if(un.length){recs.push(...await Promise.all(un.map(p=>duel(p[0],p[1],hasAsk?1:null,false))));}
  const bad=recs.filter(r=>r.err);
  if(bad.length)console.log('ERRORS',bad.map(r=>r.mode+r.R+':'+r.err).join(' | '));
  const ok=recs.filter(r=>!r.err||r.turns.length);
  const S=ok.filter(r=>!hasAsk||r.k===K);
  const rep=(title,list)=>{
    console.log('\n== '+title+' ('+list.length+' duels) ==');
    const locks=list.map(r=>r.lock).filter(v=>v!=null);
    console.log('secret lock delay s: min',f(Math.min(...locks)),'med',f(med(locks)),'max',f(Math.max(...locks)),' | Ready already on first frame in',list.filter(r=>r.instant).length+'/'+list.length,'duels');
    const T=a=>a.length?`n=${a.length} min ${f(Math.min(...a))} med ${f(med(a))} max ${f(Math.max(...a))} sd ${f(sd(a))}`:'none';
    const all=list.flatMap(r=>r.turns);
    console.log('bot turn delay s (all):',T(all.map(t=>t.d)));
    console.log('  first turn:',T(all.filter(t=>t.first).map(t=>t.d)),'\n  asks after first:',T(all.filter(t=>t.ask&&!t.first).map(t=>t.d)),'\n  guesses:',T(all.filter(t=>!t.ask).map(t=>t.d)));
    const own=list.map(r=>sd(r.turns.map(t=>t.d))).filter(v=>v>0);
    console.log('  mean within-duel sd',f(own.reduce((s,v)=>s+v,0)/own.length,2),' | share of delays within 0.3 s of the median',f(100*all.filter(t=>Math.abs(t.d-med(all.map(u=>u.d)))<0.3).length/all.length,0)+'%');
    console.log('asked numbers by mode/rating: exact-midpoint% | round% (multiple of 10^(floor(log10 n)-1)) | mean |x-mid|/n | asks/duel | optimum');
    for(const mk of Object.keys(MODES))for(const R of rs){
      const rr=list.filter(r=>r.mode===mk&&r.R===R),a=rr.flatMap(r=>r.asks);if(!a.length)continue;
      const exact=a.filter(q=>Math.abs(q.x-Math.floor((q.lo+q.hi)/2))<=1).length/a.length;
      const rd=a.filter(q=>q.x%Math.max(1,Math.pow(10,Math.floor(Math.log10(q.n))-1))===0).length/a.length;
      const dev=a.reduce((s,q)=>s+Math.abs((q.x-q.lo)/q.n-0.5),0)/a.length;
      console.log(' ',mk,String(R).padEnd(5),f(exact*100,0).padStart(3)+'% |',f(rd*100,0).padStart(3)+'% |',f(dev,3),'|',f(a.length/rr.length),'|',Math.ceil(Math.log2(MODES[mk]/10)),'  (n='+a.length+' asks)')}
    const tn=list.flatMap(r=>r.taunts.map(t=>({...t,mode:r.mode})));
    console.log('taunts: duels with any',list.filter(r=>r.taunts.length).length+'/'+list.length,' total',tn.length,' first-taunt s after play start (med/min):',f(med(list.filter(r=>r.taunts.length).map(r=>r.taunts[0].t))),f(Math.min(...list.filter(r=>r.taunts.length).map(r=>r.taunts[0].t))),' min gap',f(Math.min(...tn.filter(t=>t.gap!=null).map(t=>t.gap))),' during-play',tn.filter(t=>!t.over).length,'after-game',tn.filter(t=>t.over).length);
    const done=list.filter(r=>r.win);console.log('real duels won by the fill-in:',done.filter(r=>r.win==='bot').length+'/'+done.length,' duel length s (med):',f(med(done.map(r=>r.dur))));
  };
  rep('Scaled run, K='+(hasAsk?K:'n/a (old build, real timing)'),S);
  const U=ok.filter(r=>hasAsk&&r.k===1&&!S.includes(r));
  if(U.length)rep('Real timing (K=1)',U);
  console.log('\nTOTAL wall',Math.round((Date.now()-t0)/1000)+'s');
  const fails=[];
  if(hasAsk){const locks=S.map(r=>r.lock).filter(v=>v!=null);if(Math.min(...locks)<1.8)fails.push('lock too quick '+Math.min(...locks));
    const all=S.flatMap(r=>r.turns).map(t=>t.d);if(Math.min(...all)<0.8)fails.push('think too quick '+Math.min(...all));if(Math.max(...all)>10.5)fails.push('think too slow '+Math.max(...all));
    for(const k in sim)if(sim[k].humanWin<0.4||sim[k].humanWin>0.6)fails.push('win rate '+k+' '+sim[k].humanWin)}
  if(bad.length)fails.push(bad.length+' duels errored');
  console.log(fails.length?'FAIL bot feel: '+fails.join('; '):'PASS bot feel ('+recs.length+' duels)');
  process.exit(0);
})();
