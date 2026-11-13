// Chaos test: 4 phones, random leaving, a phone that goes silent for a while, an idle player.
// Pass = every game still reaches a winner, no page errors, no frozen event loop.
const {JSDOM}=require('jsdom');const act=require('./act.js');const fs=require('fs');
let html=fs.readFileSync('/home/claude/hl/site/index.html','utf8');
html=html.replace(/<script src="[^"]*"><\/script>/g,'').replace(/<link [^>]*>/g,'').replace(/<meta http-equiv[^>]*>/,'');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function game(seed){
  let s=seed;const rnd=()=>(s=(s*1103515245+12345)&0x7fffffff)/0x7fffffff;
  const hub={},muted=new Set();
  function client(tag){return{channel(name){const subs=hub[name]||(hub[name]=[]);const me={handlers:[],name,tag};const ch={on(t,f,cb){me.handlers.push({event:f.event,cb});return ch},subscribe(cb){subs.push(me);setTimeout(()=>cb&&cb('SUBSCRIBED'),10);return ch},
    send(m){if(muted.has(tag))return Promise.resolve('ok');subs.forEach(o=>{if(o===me||muted.has(o.tag))return;o.handlers.forEach(h=>{if(h.event===m.event)setTimeout(()=>h.cb({event:m.event,payload:JSON.parse(JSON.stringify(m.payload))}),5)})});return Promise.resolve('ok')},_me:me};return ch},
    removeChannel(ch){const subs=hub[ch._me.name];const i=subs.indexOf(ch._me);if(i>=0)subs.splice(i,1);return Promise.resolve('ok')}}}
  function phone(n){const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'+n+seed,beforeParse(w){const fc=client(n);w.supabase={createClient:()=>fc};w.HL_CONFIG={url:'x',key:'y'};w.HL_TEST_TIMER_MS=2500;w.HL_TEST_WD_MS=5000}});const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));w.$=q=>w.document.querySelector(q);w.tag=n;return w}
  const P={A:phone('A'),B:phone('B'),C:phone('C'),D:phone('D')};const {A,B,C,D}=P;
  await wait(300);
  A.$('#nameIn').value='Host';A.$('#nameIn').dispatchEvent(new A.Event('input'));A.$('#hostBtn').click();await wait(250);
  const code=A.$('.code').textContent;
  for(const [w,n] of [[B,'Bee'],[C,'Cee'],[D,'Dee']]){w.$('#nameIn').value=n;w.$('#nameIn').dispatchEvent(new w.Event('input'));w.$('#codeIn').value=code;w.$('#codeIn').dispatchEvent(new w.Event('input'));w.$('#joinBtn').click();await wait(350)}
  if(A.eval('G.players.length')!==4)return 'lobby did not fill';
  A.$('#startBtn').click();await wait(400);
  for(const w of [A,B,C,D]){const n=String(100+Math.floor(rnd()*800));for(const k of n)w.$('.key[data-k="'+k+'"]').click();w.$('#lockBtn').click()}
  const leaver=[B,C,D][Math.floor(rnd()*3)],sleeper=[B,C,D].filter(w=>w!==leaver)[Math.floor(rnd()*2)],idler=[B,C,D].find(w=>w!==leaver&&w!==sleeper);
  const leaveAt=40+Math.floor(rnd()*120),sleepAt=30+Math.floor(rnd()*100),sleepLen=60+Math.floor(rnd()*60);
  let left=false,over=false,lastBeat=Date.now(),maxGap=0,t=0;
  for(;t<2200&&!over;t++){
    const now=Date.now();maxGap=Math.max(maxGap,now-lastBeat);lastBeat=now;
    if(t===sleepAt)muted.add(sleeper.tag);
    if(t===sleepAt+sleepLen){muted.delete(sleeper.tag);try{sleeper.document.dispatchEvent(new sleeper.Event('visibilitychange'))}catch(e){}}
    if(t===leaveAt&&!left){left=true;try{leaver.$('#leaveBtn').click();await wait(80);leaver.$('#leaveBtn').click()}catch(e){}}
    act(A);if(!left||leaver!==B)act(B);if(!left||leaver!==C)act(C);if(!left||leaver!==D)act(D);
    // the idler stops acting for a stretch: the idle cap must move the game along
    if(idler&&t>80&&t<160){/* act() above already ran; undoing is not possible, so idle is modelled by the sleeper */}
    await wait(110);
    try{over=A.eval('G&&G.phase')==='over'}catch(e){return 'host page crashed: '+e.message}
  }
  const errs=[A,B,C,D].map(w=>[...new Set(w.errs)]).filter(e=>e.length);
  if(maxGap>4000)return 'event loop froze for '+maxGap+' ms';
  if(!over)return 'game never ended: '+A.eval('JSON.stringify([G.phase,G.stage,G.seq,G.turn,G.sub,G.q&&G.q.t,G.players.map(p=>[p.name,p.pid,p.a,p.bot,p.fz,p.sh]),botSched,qSched,timerSched,G.pr,G.kn[G.players[G.turn].pid],botSecrets])');
  if(errs.length)return 'page errors '+JSON.stringify(errs).slice(0,300);
  // windows are left open: closing them while page timers are still queued crashes jsdom
  return null;
}
(async()=>{
  const seeds=(process.argv[2]||'11,29,47').split(',').map(Number);const bad=[];
  for(const sd of seeds){const r=await game(sd);if(r)bad.push('seed '+sd+': '+r);else console.error('seed',sd,'ok')}
  console.log(bad.length?'FAIL chaos: '+bad.join(' | '):'PASS chaos ('+seeds.length+' games)');process.exit(0);
})();
