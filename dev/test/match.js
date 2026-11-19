// Matchmaking robustness: dead adverts, simultaneous hosts, client/channel reuse, ad timeout.
const {JSDOM}=require('jsdom');const fs=require('fs');
const raw=fs.readFileSync(''+(process.env.HLDIR||'/home/claude/hl')+'/site/index.html','utf8').replace(/<script src="[^"]*"><\/script>/g,'').replace(/<link [^>]*>/g,'');
let hub={},created=0,checks=0,LAT=5;
const chCount=()=>Object.values(hub).reduce((n,a)=>n+a.length,0);
function makeFakeClient(){
  created++;
  return {
    channel(name){
      const subs=hub[name]||(hub[name]=[]);
      const me={handlers:[],name};
      const ch={
        on(type,filter,cb){me.handlers.push({event:filter.event,cb});return ch},
        subscribe(cb){subs.push(me);setTimeout(()=>cb&&cb('SUBSCRIBED'),10);return ch},
        send(m){subs.forEach(o=>{if(o===me)return;o.handlers.forEach(h=>{if(h.event===m.event)setTimeout(()=>h.cb({event:m.event,payload:JSON.parse(JSON.stringify(m.payload))}),LAT)})});return Promise.resolve('ok')},
        _me:me
      };
      return ch;
    },
    removeChannel(ch){const subs=hub[ch._me.name];const i=subs.indexOf(ch._me);if(i>=0)subs.splice(i,1);return Promise.resolve('ok')}
  };
}
function phone(name,ms,real){
  const dom=new JSDOM(raw,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'+name,
    beforeParse(w){
      w.supabase={createClient:()=>makeFakeClient()};
      if(!real){w.HL_TEST_Q_MS=300;w.HL_TEST_FILL_MS=900;w.HL_TEST_QJOIN_MS=ms||1500}
    }});
  const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));
  w.$=s=>w.document.querySelector(s);return w;
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const fail=m=>{console.log('FAIL match: '+m);process.exit(0)};
const ok=(c,m)=>{checks++;if(!c)fail(m)};
const st=P=>JSON.parse(P.eval('JSON.stringify({ph:G&&G.phase,n:G&&G.players.length,humans:G?G.players.filter(p=>!p.bot).length:0,host:isHost,code:code,view:view})'));
const started=s=>(s.ph==='secrets'||s.ph==='play')&&s.n===2;
async function until(P,f,ms){const t=Date.now();while(Date.now()-t<ms){let s=null;try{s=st(P)}catch(e){}if(s&&f(s))return s;await wait(50)}return null}
// a fake host that only advertises (nobody is behind the room)
function advertiser(codes,max){
  const fc=makeFakeClient(),ch=fc.channel('hl-queue-v1');ch.subscribe();
  const iv=setInterval(()=>codes.forEach(c=>ch.send({event:'open',payload:{code:c,n:1,max,at:Date.now()}})),150);
  return ()=>{clearInterval(iv);fc.removeChannel(ch)};
}
(async()=>{
  // 1) dead adverts: tried once each (max 2), remembered, then host. Second search skips them.
  {
    const A=phone('a',1200);await wait(400);
    const max=A.eval('playMode().max');
    const stop=advertiser(['ZZZZ','YYYY','XXXX'],max);
    const seen=[];const t0=Date.now();
    const iv=setInterval(()=>{try{const c=A.eval('code');if(c&&c!==seen[seen.length-1])seen.push(c)}catch(e){}},30);
    A.$('#playBtn').click();
    const s=await until(A,s=>started(s),9000);
    clearInterval(iv);
    ok(s,'(1) never started '+JSON.stringify(seen));
    const dt=Date.now()-t0;
    const deadTried=seen.filter(c=>/^(ZZZZ|YYYY|XXXX)$/.test(c));
    ok(deadTried.length===2,'(1) expected exactly 2 dead join attempts, saw '+JSON.stringify(seen));
    ok(s.host&&!/^(ZZZZ|YYYY|XXXX)$/.test(s.code),'(1) did not end up hosting');
    ok(A.eval('QFAIL.size')===2,'(1) QFAIL size '+A.eval('QFAIL.size'));
    console.log('info: 2 dead adverts then host, game started after '+dt+'ms (test timings: queue 300, join 1200 each, fill 900)');
    // Advertisements may arrive in any order. Mark the one not tried as failed, too.
    await A.eval('leaveGame()');await wait(300);
    const remaining = ['ZZZZ','YYYY','XXXX'].filter(code=>!deadTried.includes(code));
    ok(remaining.length===1,'(1b) expected one untried advertisement');
    A.eval(`QFAIL.set(${JSON.stringify(remaining[0])},Date.now())`);
    const seen2=[];const iv2=setInterval(()=>{try{const c=A.eval('code');if(c&&c!==seen2[seen2.length-1])seen2.push(c)}catch(e){}},30);
    const t1=Date.now();A.$('#playBtn').click();
    const s2=await until(A,s=>s.host&&s.code&&s.view==='game',2500);
    clearInterval(iv2);
    ok(s2&&!seen2.some(c=>/^(ZZZZ|YYYY|XXXX)$/.test(c)),'(1b) skipped codes were tried again '+JSON.stringify(seen2));
    ok(Date.now()-t1<1200,'(1b) hosting later than expected');
    ok(A.eval('(QFAIL.set("ZZZZ",Date.now()-121000),qFailed("ZZZZ"))')===false,'(1c) failed code not forgotten after 2 min');
    stop();await A.eval('leaveGame()');A.close();hub={};
  }
  // 2) two searchers press Play within 100 ms: they must meet (3 trials)
  LAT=120;
  for(let i=0;i<3;i++){
    const A=phone('r'+i+'a'),B=phone('r'+i+'b');await wait(400);
    A.$('#playBtn').click();await wait(i*40);B.$('#playBtn').click();
    const sa=await until(A,s=>started(s)&&s.humans===2,6000);
    ok(sa,'(2) trial '+i+' A not matched with a human '+JSON.stringify([(()=>{try{return st(A)}catch(e){}})(),(()=>{try{return st(B)}catch(e){}})()]));
    const sb=await until(B,s=>(s.ph==='secrets'||s.ph==='play')&&s.humans===2,3000);
    ok(sb&&sb.code===sa.code,'(2) trial '+i+' B is in another room '+JSON.stringify([sa,sb]));
    ok(sa.host!==sb.host,'(2) both or neither host');
    await wait(1200);
    ok(st(A).code===sa.code&&st(B).code===sa.code,'(2) rooms changed after the match (loop?)');
    ok(!A.errs.length&&!B.errs.length,'(2) page errors '+A.errs.concat(B.errs));
    await Promise.all([A.eval('leaveGame()'),B.eval('leaveGame()')]);
    await wait(LAT+25); // Let in-flight mock-network deliveries settle before closing jsdom.
    A.close();B.close();hub={};
  }
  LAT=5;
  // 3) one client, channels released
  {
    const base=created;
    const A=phone('c');await wait(400);
    const c0=created;
    let peak=0;
    for(let i=0;i<4;i++){
      A.$('#playBtn').click();await wait(900);peak=Math.max(peak,chCount());
      const b=A.$('#leaveBtn');ok(b,'(3) no Leave button on tap '+i);b.click();await wait(700);
    }
    const clients=created-c0,left=chCount();
    console.log('info: 4 Play taps + Leave: Supabase clients created '+clients+' (was 4+), open channels after leaving '+left+' (peak while searching '+peak+')');
    ok(clients<=1,'(3) clients created per tap: '+clients);
    ok(left===0,'(3) channels left open: '+left);
    ok(A.eval('hbTimer')===null,'(4) hbTimer left behind');
    A.close();hub={};
  }
  // 5) a hung native ad cannot block the result or navigate after the next round
  {
    const A=phone('d');await wait(300);
    let resolveAd,oldResult;
    A.HLNative={showInterstitial:current=>{oldResult=current;return new Promise(r=>{resolveAd=r})}};
    A.eval("startSolo();hostStart();G.phase='play';G.stage='show';update();G.players.slice(1).forEach(p=>{p.a=0});advance(G.seq);update()");
    await wait(1200);
    ok(typeof resolveAd==='function','(5) no automatic ad opportunity after a finished game');
    const again=A.$('#ovLobby');ok(again,'(5) a hung ad blocked results');again.click();
    ok(A.eval('G.phase')==='lobby'&&!oldResult(),'(5) a hung ad blocked Play again or retained a stale placement');
    resolveAd(false);await wait(40);
    ok(A.eval('G.phase')==='lobby','(5) a late ad result changed the screen');
    A.close();
  }
  // 6) real default timings, two dead adverts: worst case before a game starts
  {
    const A=phone('w',0,true);await wait(400);
    const stop=advertiser(['ZZZZ','YYYY'],A.eval('playMode().max'));
    const t0=Date.now();A.$('#playBtn').click();
    const s=await until(A,started,16000);const dt=Date.now()-t0;
    ok(s,'(6) not started in 16s');
    console.log('info: real defaults, 2 dead adverts then host: game started after '+dt+'ms');
    ok(dt<12000,'(6) worst case '+dt+'ms is over 12s');
    stop();A.close();
  }
  console.log('PASS match ('+checks+' checks)');process.exit(0);
})();
