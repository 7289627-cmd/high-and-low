// Resume test: phones lock, switch apps and lose signal. Same jsdom + fake hub harness as leave.js / chaos.js.
// A "silent" phone has its hub traffic muted in both directions (what a locked or offline phone looks like).
// Pass = every scenario ends in a finished game or an explicitly asserted state, with no page errors.
const {JSDOM}=require('jsdom');const act=require('./act.js');const fs=require('fs');
let html=fs.readFileSync('/home/claude/hl/site/index.html','utf8');
html=html.replace(/<script src="[^"]*"><\/script>/g,'').replace(/<link [^>]*>/g,'').replace(/<meta http-equiv[^>]*>/,'');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const info=m=>console.error('  info: '+m);
const dbg=m=>{if(process.env.RDBG)console.error('    . '+m)};

function world(){
  const hub={},muted=new Set(),chans=[];
  function client(tag){return{
    channel(name){const subs=hub[name]||(hub[name]=[]);const me={handlers:[],name,tag,cb:null};chans.push(me);
      const ch={on(t,f,cb){me.handlers.push({event:f.event,cb});return ch},
        subscribe(cb){me.cb=cb;subs.push(me);setTimeout(()=>cb&&cb('SUBSCRIBED'),10);return ch},
        send(m){if(muted.has(tag))return Promise.resolve('ok');subs.forEach(o=>{if(o===me||muted.has(o.tag))return;o.handlers.forEach(h=>{if(h.event===m.event)setTimeout(()=>{if(!muted.has(o.tag))h.cb({event:m.event,payload:JSON.parse(JSON.stringify(m.payload))})},5)})});return Promise.resolve('ok')},_me:me};return ch},
    removeChannel(ch){const subs=hub[ch._me.name];const i=subs.indexOf(ch._me);if(i>=0)subs.splice(i,1);return Promise.resolve('ok')}}}
  const W={hub,muted,
    mute:t=>muted.add(t),unmute:t=>muted.delete(t),
    subs:(tag)=>Object.values(hub).reduce((n,s)=>n+s.filter(m=>m.tag===tag).length,0),
    // the socket dies without a goodbye (tunnel, lock screen): the app only learns through the status callback
    kill:(tag)=>{chans.filter(m=>m.tag===tag).forEach(m=>{const s=hub[m.name],i=s.indexOf(m);if(i>=0){s.splice(i,1);if(m.cb)m.cb('CLOSED')}})},
    phone(tag,hooks){
      const locks={n:0,active:0};
      const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'+tag+Math.random().toString(36).slice(2,6),
        beforeParse(w){const fc=client(tag);w.supabase={createClient:()=>fc};w.HL_CONFIG={url:'x',key:'y'};
          w.HL_TEST_TIMER_MS=1200;w.HL_TEST_WD_MS=3000;Object.assign(w,hooks||{});
          w._vis='visible';Object.defineProperty(w.document,'visibilityState',{get:()=>w._vis,configurable:true});
          Object.defineProperty(w.navigator,'wakeLock',{configurable:true,value:{request:()=>{
            const ls=[];const l={released:false,addEventListener:(e,f)=>ls.push(f),release(){if(!l.released){l.released=true;locks.active--;ls.forEach(f=>f())}return Promise.resolve()}};
            locks.n++;locks.active++;return Promise.resolve(l)}}});
        }});
      const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));w.$=q=>w.document.querySelector(q);w.tag=tag;w.locks=locks;
      w.setVis=v=>{w._vis=v;w.document.dispatchEvent(new w.Event('visibilitychange'))};
      return w;
    }};
  return W;
}
const type=(P,id,v)=>{P.$(id).value=v;P.$(id).dispatchEvent(new P.Event('input'))};
async function hostRoom(W,hooks){const A=W.phone('A',hooks);await wait(300);type(A,'#nameIn','Host');A.$('#hostBtn').click();await wait(250);return A}
async function joinRoom(P,name,code){type(P,'#nameIn',name);type(P,'#codeIn',code);P.$('#joinBtn').click();await wait(400)}
const lockNum=(P,n)=>{for(const k of String(n))P.$('.key[data-k="'+k+'"]').click();P.$('#lockBtn').click()};
// 3 friends in a room, max 100, secrets locked, game in play
async function friends(W,hooks){
  dbg('friends');const A=await hostRoom(W,hooks),code=A.$('.code').textContent;dbg('hosted');
  const B=W.phone('B',hooks),C=W.phone('C',hooks);await wait(300);
  await joinRoom(B,'Bee',code);await joinRoom(C,'Cee',code);
  for(let i=0;i<50&&A.eval('G.players.length')!==3;i++)await wait(100);
  if(A.eval('G.players.length')!==3)throw new Error('lobby did not fill');
  A.$('[data-max="100"]').click();await wait(100);A.$('#startBtn').click();await wait(500);
  for(const P of [A,B,C])for(let i=0;i<60&&!P.$('#lockBtn');i++)await wait(100);
  const sec={A:41,B:57,C:63};lockNum(A,41);lockNum(B,57);lockNum(C,63);
  for(let i=0;i<60&&A.eval('G.phase')!=='play';i++)await wait(100);
  if(A.eval('G.phase')!=='play')throw new Error('game did not start');
  dbg('started');return {A,B,C,code,sec};
}
async function drive(phones,pred,ms,each){
  const t0=Date.now();
  while(Date.now()-t0<ms){for(const P of phones)if(!W_muted(P))act(P);if(each)each();await wait(100);if(pred())return true}
  return pred();
}
let curW=null;const W_muted=P=>curW&&curW.muted.has(P.tag);
const js=(P,s)=>JSON.parse(P.eval('JSON.stringify('+s+')'));
const errsOf=ps=>ps.map(P=>[...new Set(P.errs)]).filter(e=>e.length);

const results=[];
async function scenario(name,fn){
  if(process.argv[2]&&!name.includes(process.argv[2]))return;
  console.error('scenario '+name);
  curW=world();let r;const t00=Date.now();
  try{r=await fn(curW)}catch(e){r='threw '+(e&&e.stack||e).toString().slice(0,300)}
  console.error('  ('+Math.round((Date.now()-t00)/1000)+'s)');results.push([name,r||null]);
}

(async()=>{
  // (a) a joiner is silent for 8 s (under the 10 s peer timeout) and a second time for 14 s (past it on both sides), then returns
  for(const [tag,silentMs] of [['a1',8000],['a2',14000]])await scenario('('+tag+') joiner silent '+silentMs/1000+'s then back',async W=>{
    const {A,B,C,sec}=await friends(W,{HL_TEST_HOSTLOST_MS:40000});
    await drive([A,B,C],()=>A.eval('G.seq')>=2,15000);
    const bef=js(B,'mySecret');if(!bef||bef.n!==sec.B)return 'B has no secret before';
    const gid=A.eval('G.gid');
    dbg('muting');W.mute('B');const t0=Date.now();
    await drive([A,B,C],()=>Date.now()-t0>silentMs,silentMs+2000);
    const mid=js(A,'G.players.map(p=>[p.name,p.bot,p.a])');
    if(mid.find(p=>p[0]==='Bee')[1]!==0)return 'host replaced B after only '+silentMs/1000+'s';
    W.unmute('B');B.setVis('visible');
    for(let i=0;i<60&&!B.eval('!!G&&!!mySecret');i++)await wait(100);   // the host's next heartbeat (3 s) brings the game back
    if(B.eval('view')!=='game')return 'B left the game (view '+B.eval('view')+')';
    const aft=js(B,'mySecret');if(!aft||aft.n!==sec.B||aft.gid!==gid)return 'B lost its secret '+JSON.stringify(aft);
    const me=js(B,'(G&&byPid(PID))||null');if(!me||me.bot||!me.a)return 'B seat changed '+JSON.stringify(me);
    if(js(A,'G.players.filter(p=>p.name==="Bee").length')!==1)return 'duplicate Bee seat';
    const s0=A.eval('G.seq');
    const over=await drive([A,B,C],()=>A.eval('G.phase')==='over'||(tag==='a2'&&A.eval('G.seq')>=s0+3),90000);
    if(!over)return 'game never finished '+A.eval('JSON.stringify([G.phase,G.stage,G.seq,G.turn,G.sub,G.q])');
    const e=errsOf([A,B,C]);if(e.length)return 'page errors '+JSON.stringify(e);
    return null;
  });

  // (b1) a joiner is silent but its page keeps running for longer than the takeover time: replaced by a hidden easy bot
  await scenario('(b1) joiner silent past takeover, page alive, then back',async W=>{
    const {A,B,C}=await friends(W,{HL_TEST_GONE_MS:12000,HL_TEST_HOSTLOST_MS:60000});
    await drive([A,B,C],()=>A.eval('G.seq')>=2,15000);
    W.mute('B');const t0=Date.now();
    await drive([A,B,C],()=>js(A,'G.players.find(p=>p.name==="Bee").bot')===1,40000);
    const rep=js(A,'G.players.find(p=>p.name==="Bee")');
    if(rep.bot!==1||rep.hb!==1||rep.ez!==1)return 'B was not replaced by a hidden easy bot '+JSON.stringify(rep);
    info('B replaced after '+Math.round((Date.now()-t0)/1000)+'s (test GONE=12s, real 90s)');
    W.unmute('B');B.setVis('visible');await wait(2500);
    // what does the returning phone show?
    const st=js(B,'({view,hasG:!!G,me:G&&byPid(PID)&&{bot:byPid(PID).bot,a:byPid(PID).a},canAct:canAct(),txt:document.querySelector("#app").textContent.slice(0,200)})');
    info('B after return: '+JSON.stringify(st));
    if(st.view==='home')info('B went home');
    else if(!/watching/i.test(st.txt))return 'returning replaced player is on a dead screen (own card, no controls, no hint): '+JSON.stringify(st);
    if(B.$('[data-pickdir]')||B.$('.g[data-n]'))return 'replaced player can still act';
    const s0=A.eval('G.seq');
    const moved=await drive([A,C],()=>A.eval('G.phase')==='over'||A.eval('G.seq')>=s0+3,60000);
    if(!moved)return 'game stopped moving after takeover';
    // the bot kept B's pid: if it wins, B must not be credited (coins, "You win!"). Force that ending on the host.
    A.eval('G.phase="over";G.win='+JSON.stringify(B.eval('PID'))+';G.en++;publishG()');
    await wait(2500);
    if(B.eval('G.phase')!=='over')return 'test setup: B did not see the end';
    if((B.eval('LS.get(LSK("hl-wins"))')|0)>0)return 'replaced player was credited a win (coins)';
    if(/You win/i.test(B.$('#app').textContent+(B.$('.ov')?B.$('.ov').textContent:'')))return 'replaced player told "You win!"';
    if(B.$('.ov'))return 'replaced player got a winner sheet';
    const e=errsOf([A,B,C]);if(e.length)return 'page errors '+JSON.stringify(e);
    return null;
  });

  // (b2) the phone was frozen (iOS) for longer than the host-lost time: on return it must hear the host before giving up
  await scenario('(b2) frozen phone back after host-lost time',async W=>{
    const {A,B,C}=await friends(W,{HL_TEST_HOSTLOST_MS:30000});
    await drive([A,B,C],()=>A.eval('G.seq')>=1,10000);
    W.mute('B');await wait(12000);   // past the 10 s peer sweep: B's peer list is empty
    // JS was frozen: B's own clock says the host was last seen long ago
    B.eval('hostSeenAt=Date.now()-45000');
    W.unmute('B');B.setVis('visible');await wait(1500);
    for(let i=0;i<60&&B.eval('view')==='game'&&!B.eval('!!G&&!!byPid(PID)');i++)await wait(100);
    if(B.eval('view')!=='game')return 'frozen phone declared the host lost the moment it woke ('+B.eval('JSON.stringify(ui.homeErr||"")')+')';
    if(!B.eval('!!G&&!!byPid(PID)'))return 'B did not get its seat back';
    const s0=A.eval('G.seq');
    const moved=await drive([A,B,C],()=>A.eval('G.phase')==='over'||A.eval('G.seq')>=s0+3,60000);
    if(!moved)return 'game stopped moving';
    if(js(B,'G.players.find(p=>p.pid===PID).bot')!==0)return 'B was replaced';
    const e=errsOf([A,B,C]);if(e.length)return 'page errors '+JSON.stringify(e);
    return null;
  });

  // (c) the HOST is silent for 8 s, then returns: no duplicated turns
  await scenario('(c) host silent 8s then back',async W=>{
    const {A,B,C}=await friends(W,{HL_TEST_HOSTLOST_MS:40000});
    await drive([A,B,C],()=>A.eval('G.seq')>=2,15000);
    const seen=[];let bad=null,last={seq:-1,tn:-1};
    const watch=()=>{try{const g=js(A,'({gid:G.gid,seq:G.seq,tn:G.turnNo,turn:G.turn,en:G.en,ph:G.phase})');
      if(g.seq<last.seq&&g.tn<=last.tn)bad='host seq went backwards '+JSON.stringify([last,g]);
      if(g.tn<last.tn)bad='turnNo went backwards '+JSON.stringify([last,g]);
      const k=g.tn;const prev=seen[k];if(prev!==undefined&&prev!==g.turn)bad='turnNo '+k+' held two different turns';seen[k]=g.turn;
      if(g.tn>last.tn&&g.tn>last.tn+1)bad='turnNo skipped '+JSON.stringify([last,g]);
      last={seq:g.seq,tn:g.tn}}catch(e){}};
    last=js(A,'({seq:G.seq,tn:G.turnNo})');W.mute('A');const t0=Date.now();
    await drive([A,B,C],()=>Date.now()-t0>8000,10000,watch);
    W.unmute('A');A.setVis('visible');
    const over=await drive([A,B,C],()=>A.eval('G.phase')==='over',90000,watch);
    if(!over)return 'game never finished '+A.eval('JSON.stringify([G.phase,G.stage,G.seq,G.turn,G.sub,G.q])');
    if(bad)return bad;
    for(const P of [B,C])if(P.eval('view')!=='game'&&P.eval('view')!=='home')return 'odd view';
    if(js(A,'G.players.filter(p=>p.bot).length')!==0)return 'a player was replaced by a bot during a short host blip';
    const e=errsOf([A,B,C]);if(e.length)return 'page errors '+JSON.stringify(e);
    return null;
  });

  // (d) rated Play duel, the human opponent disappears for good: the host that stays must finish and be rated exactly once
  await scenario('(d1) rated duel: joiner vanishes, host finishes',async W=>{
    const hooks={HL_TEST_Q_MS:300,HL_TEST_FILL_MS:900,HL_TEST_QJOIN_MS:1500,HL_TEST_GONE_MS:4000,HL_TEST_HOSTLOST_MS:8000};
    const P=W.phone('P',hooks),Q=W.phone('Q',hooks);await wait(400);
    P.$('#playBtn').click();await wait(600);Q.$('#playBtn').click();
    for(let i=0;i<90&&!(P.eval('G&&G.phase')==='play'||P.eval('G&&G.phase')==='secrets');i++)await wait(100);
    for(let i=0;i<60&&js(P,'G.players.filter(p=>!p.bot).length')!==2;i++)await wait(100);
    if(js(P,'G.players.filter(p=>!p.bot).length')!==2)return 'duel did not pair two humans';
    for(const X of [P,Q])for(let i=0;i<60&&!X.$('#lockBtn');i++)await wait(100);
    const max=P.eval('G.max');lockNum(P,Math.min(max,37));lockNum(Q,Math.min(max,52));
    for(let i=0;i<60&&P.eval('G.phase')!=='play';i++)await wait(100);
    if(P.eval('G.phase')!=='play')return 'duel did not start';
    const n0=P.eval('LS.get(LSK("hl-elo-n"))|0'),e0=P.eval('myElo()');
    W.mute('Q');   // Q never comes back
    const qPid=Q.eval('PID');
    const over=await drive([P],()=>P.eval('G.phase')==='over',120000);
    if(!over)return 'host could not finish the duel '+P.eval('JSON.stringify([G.phase,G.stage,G.seq,G.turn,G.q,G.players.map(p=>[p.name,p.bot,p.a])])');
    await wait(1500);
    const opp=js(P,'G.players.find(p=>p.pid!==PID)');
    if(opp.bot!==1)return 'vanished opponent was not replaced '+JSON.stringify(opp);
    const n1=P.eval('LS.get(LSK("hl-elo-n"))|0'),e1=P.eval('myElo()'),won=P.eval('G.win')===P.eval('PID');
    if(n1!==n0+1)return 'rating applied '+(n1-n0)+' times, expected once';
    if(won&&e1<=e0)return 'host won but rating did not go up '+e0+'->'+e1;
    if(!won&&e1>=e0)return 'host lost but rating did not go down';
    // more ticks must not apply it again
    for(let i=0;i<8;i++){P.eval('schedule()');await wait(250)}
    if((P.eval('LS.get(LSK("hl-elo-n"))|0'))!==n1)return 'rating applied again after the result';
    // leaving after the game is over costs nothing more
    await P.eval('leaveGame()');await wait(300);
    if((P.eval('LS.get(LSK("hl-elo-n"))|0'))!==n1||P.eval('myElo()')!==e1)return 'leaving after the result changed the rating again';
    info('host '+(won?'won':'lost')+' vs replaced opponent: '+e0+' -> '+e1+', applied once');
    // Q (muted, its page keeps running) gives up on the host without any rating change
    await wait(9000);
    if(Q.eval('view')!=='home')return 'vanished joiner did not go home by itself';
    if(Q.eval('LS.get(LSK("hl-elo-n"))|0')!==0)return 'the vanished side was rated (it never saw a result)';
    const e=errsOf([P,Q]);if(e.length)return 'page errors '+JSON.stringify(e);
    return null;
  });

  // (d2) the other way round: the HOST vanishes. The joiner cannot finish (the game lives on the host phone) but must not lose rating.
  await scenario('(d2) rated duel: host vanishes, joiner goes home unrated',async W=>{
    const hooks={HL_TEST_Q_MS:300,HL_TEST_FILL_MS:900,HL_TEST_QJOIN_MS:1500,HL_TEST_GONE_MS:4000,HL_TEST_HOSTLOST_MS:8000};
    const P=W.phone('P',hooks),Q=W.phone('Q',hooks);await wait(400);
    P.$('#playBtn').click();await wait(600);Q.$('#playBtn').click();
    for(let i=0;i<150&&js(P,'G?G.players.filter(p=>!p.bot).length:0')!==2;i++)await wait(100);
    if(js(P,'G.players.filter(p=>!p.bot).length')!==2)return 'duel did not pair two humans';
    for(const X of [P,Q])for(let i=0;i<60&&!X.$('#lockBtn');i++)await wait(100);
    lockNum(P,37);lockNum(Q,52);
    for(let i=0;i<60&&Q.eval('G&&G.phase')!=='play';i++)await wait(100);
    if(Q.eval('G&&G.phase')!=='play')return 'duel did not start';
    const e0=Q.eval('myElo()');
    W.mute('P');
    // within the 10 s peer timeout the stake dialog still shows (host may be fine); after it, G is null
    await wait(12000);
    if(Q.eval('eloAtStake()')!==0)return 'stake still shown after host went silent';
    for(let i=0;i<50&&Q.eval('view')!=='home';i++)await wait(250);
    if(Q.eval('view')!=='home')return 'joiner did not go home after host vanished';
    if(Q.eval('myElo()')!==e0||Q.eval('LS.get(LSK("hl-elo-n"))|0')!==0)return 'joiner was rated for a host that vanished';
    const e=errsOf([P,Q]);if(e.length)return 'page errors '+JSON.stringify(e);
    return null;
  });

  // (d3) the opponent has vanished but is not replaced yet (10 s .. takeover time): leaving must not cost rating
  await scenario('(d3) rated duel: opponent gone, host leaves before takeover',async W=>{
    const hooks={HL_TEST_Q_MS:300,HL_TEST_FILL_MS:900,HL_TEST_QJOIN_MS:1500,HL_TEST_GONE_MS:60000,HL_TEST_HOSTLOST_MS:60000};
    const P=W.phone('P',hooks),Q=W.phone('Q',hooks);await wait(400);
    P.$('#playBtn').click();await wait(600);Q.$('#playBtn').click();
    for(let i=0;i<150&&js(P,'G?G.players.filter(p=>!p.bot).length:0')!==2;i++)await wait(100);
    if(js(P,'G.players.filter(p=>!p.bot).length')!==2)return 'duel did not pair two humans';
    for(const X of [P,Q])for(let i=0;i<60&&!X.$('#lockBtn');i++)await wait(100);
    lockNum(P,37);lockNum(Q,52);
    for(let i=0;i<60&&P.eval('G&&G.phase')!=='play';i++)await wait(100);
    const e0=P.eval('myElo()');
    W.mute('Q');await wait(13000);
    if(P.eval('G.players.some(p=>p.bot&&p.hb)'))return 'test setup: opponent already replaced';
    const stake=P.eval('eloAtStake()');
    P.$('#leaveBtn').click();await wait(300);
    if(P.$('.stake'))return 'rating warning appeared after the opponent vanished';
    P.$('#quitBtn')?.click();
    await wait(800);
    if(P.eval('view')!=='home')return 'host did not get home';
    const e1=P.eval('myElo()');
    if(stake>0||e1<e0)return 'host lost '+(e0-e1)+' rating (stake shown '+stake+') for leaving a duel whose opponent had vanished';
    return null;
  });

  // (e) the same phone joins twice quickly: one seat, one channel, no leaked heartbeat
  await scenario('(e) double join',async W=>{
    const A=await hostRoom(W,{}),code=A.$('.code').textContent;
    const B=W.phone('B',{});await wait(300);
    type(B,'#nameIn','Bee');type(B,'#codeIn',code);
    B.$('#joinBtn').click();
    B.eval('startOnline(false,"'+code+'")');B.eval('startOnline(false,"'+code+'")');   // a second tap / reconnect race
    await wait(1500);
    if(A.eval('G.players.length')!==2)return 'expected 2 seats, got '+A.eval('G.players.map(p=>p.name).join()');
    if(W.subs('B')!==1)return 'B holds '+W.subs('B')+' channels (leaked connection from the double join)';
    A.$('[data-max="100"]').click();await wait(100);A.$('#startBtn').click();await wait(500);
    lockNum(A,41);lockNum(B,57);
    for(let i=0;i<60&&A.eval('G.phase')!=='play';i++)await wait(100);
    if(A.eval('G.phase')!=='play')return 'game did not start';
    const s0=A.eval('G.seq');
    const moved=await drive([A,B],()=>A.eval('G.phase')==='over'||A.eval('G.seq')>=s0+3,60000);
    if(!moved)return 'game stopped moving';
    if(A.eval('G.players.length')!==2)return 'extra seat appeared';
    const e=errsOf([A,B]);if(e.length)return 'page errors '+JSON.stringify(e);
    return null;
  });

  // (f) hidden -> visible reconnects when the channel died while hidden; the screen lock is dropped and taken again
  await scenario('(f) visibility reconnect + wake lock',async W=>{
    const {A,B,C}=await friends(W,{HL_TEST_HOSTLOST_MS:40000});
    await wait(500);
    if(B.locks.active!==1)return 'wake lock not held in game ('+B.locks.active+')';
    // hidden: the OS drops the lock, then the socket dies
    B.setVis('hidden');await wait(200);
    W.kill('B');await wait(300);
    if(B.eval('R.connected()'))return 'test setup: channel still connected';
    const n0=B.locks.n;
    B.setVis('visible');
    let ok=false;for(let i=0;i<30&&!ok;i++){await wait(100);ok=B.eval('R.connected()')}
    if(!ok)return 'no reconnect after hidden->visible';
    if(W.subs('B')!==1)return 'B holds '+W.subs('B')+' channels after reconnect';
    if(B.locks.active!==1||B.locks.n!==n0+1)return 'wake lock not taken again after returning (active '+B.locks.active+', requests '+(B.locks.n-n0)+')';
    // the room still works after the reconnect
    const s0=A.eval('G.seq');
    const moved=await drive([A,B,C],()=>A.eval('G.phase')==='over'||A.eval('G.seq')>=s0+3,60000);
    if(!moved)return 'game stopped moving after reconnect';
    // leaving releases the lock, and no timer survives leaveGame
    B.$('#ovClose')&&B.$('#ovClose').click();
    B.$('#leaveBtn').click();B.$('#quitBtn')?.click();await wait(1500);
    if(B.eval('view')!=='home')return 'B did not get home';
    if(B.locks.active!==0)return 'wake lock still held on the home screen';
    const t=B.eval('timers.length');if(t!==0)return t+' later() timers survive leaveGame';
    const e=errsOf([A,B,C]);if(e.length)return 'page errors '+JSON.stringify(e);
    return null;
  });

  // (g) later() timers must not fire after leaveGame, host or joiner, mid-game
  await scenario('(g) no timers after leaveGame',async W=>{
    const {A,B,C}=await friends(W,{HL_TEST_HOSTLOST_MS:40000});
    await drive([A,B,C],()=>A.eval('G.seq')>=2,15000);
    for(const P of [C,A]){P.$('#leaveBtn').click();P.$('#quitBtn')?.click();await wait(80)}
    // everything that was pending must be gone, and nothing may come back
    for(let i=0;i<20;i++){await wait(150);for(const P of [A,C]){if(P.eval('timers.length')!==0&&i>8)return P.tag+' has '+P.eval('timers.length')+' timers pending after leaving'}}
    for(const P of [A,C])if(P.eval('view')!=='home')return P.tag+' not home';
    await wait(4000);
    const e=errsOf([A,B,C]);if(e.length)return 'page errors '+JSON.stringify(e);
    return null;
  });

  const bad=results.filter(r=>r[1]);
  for(const r of results)console.error((r[1]?'FAIL ':'ok   ')+r[0]+(r[1]?': '+r[1]:''));
  console.log(bad.length?'FAIL resume: '+bad.map(r=>r[0]+' '+r[1]).join(' | '):'PASS resume ('+results.length+' scenarios)');
  process.exit(0);
})();
