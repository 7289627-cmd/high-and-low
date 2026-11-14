/* Analytics check: plays real games in jsdom with fetch stubbed and checks every event sent to the
   "events" table against the allowed list parsed out of supabase/events_v2.sql, so code and SQL cannot drift.
   Run: node track.js  (about 1-2 minutes, needs site/index.html from `python3 build.py web`) */
const {JSDOM}=require('jsdom');const act=require('./act.js');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const raw=fs.readFileSync(path.join(root,'site/index.html'),'utf8').replace(/<script src="[^"]*"><\/script>/g,'').replace(/<link [^>]*>/g,'');
let checks=0;const fail=m=>{console.log('FAIL track: '+m);process.exit(0)};
const ok=(c,m)=>{checks++;if(!c)fail(m)};
// ---- allowed names from the SQL migration (the add constraint ... check (ev in (...)) block)
const sql=fs.readFileSync(path.join(root,'supabase/events_v2.sql'),'utf8');
const mm=sql.match(/add constraint events_ev_check check \(ev in \(([^)]*)\)\)/);
if(!mm)fail('could not find the CHECK list in events_v2.sql');
const ALLOWED=new Set([...mm[1].matchAll(/'([a-z_]+)'/g)].map(x=>x[1]));
ok(ALLOWED.size>=16,'CHECK list parsed: '+ALLOWED.size);
const SID=/^[a-z0-9]{12}$/;
// ---- allowed props per event: integers and short codes only
const I=(lo,hi)=>v=>Number.isInteger(v)&&v>=lo&&v<=hi, C=(...a)=>v=>a.includes(v), B=C(0,1);
const COMMON={v:I(1,99),b:v=>typeof v==='string'&&/^[0-9a-z.]{1,12}$/.test(v)};
const MODE=C('s','m','l'),KIND=C('play','practice','friends'),COUNTS={n:I(1,12),bots:I(0,12)};
const SPEC={
  open:{inv:B,wide:B,app:B},play_tap:{m:MODE},host:{},join:{},practice:{},
  game_start:{kind:KIND,m:MODE,w:I(0,999),...COUNTS},
  game_end:{kind:KIND,m:MODE,secs:I(0,99999),t:I(0,999),won:B,...COUNTS},
  leave:{kind:KIND,m:MODE,secs:I(0,99999),t:I(0,999)},qleave:{m:MODE,w:I(0,999)},
  power:{k:C('snap','peek','double','shield','freeze')},again:{m:MODE},
  ad:{t:C('inter','reward'),s:C('show','close','fail')},noads:{},noads_tap:{},
  rated:{won:B,elo:v=>Number.isInteger(v)&&v%100===0&&v>=100&&v<=3000,m:MODE},share:null
};
const sent=[];
function stubFetch(w){w.fetch=(url,o)=>{
  if(/\/rest\/v1\/events$/.test(url)&&o&&o.method==='POST'){sent.push(JSON.parse(o.body));return Promise.resolve({ok:true,status:201})}
  return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve([])})}}
const hub={};
function makeFakeClient(){return{channel(name){const subs=hub[name]||(hub[name]=[]);const me={handlers:[],name};
  const ch={on(t,f,cb){me.handlers.push({event:f.event,cb});return ch},subscribe(cb){subs.push(me);setTimeout(()=>cb&&cb('SUBSCRIBED'),10);return ch},
  send(m){subs.forEach(o=>{if(o===me)return;o.handlers.forEach(h=>{if(h.event===m.event)setTimeout(()=>h.cb({event:m.event,payload:JSON.parse(JSON.stringify(m.payload))}),5)})});return Promise.resolve('ok')},_me:me};return ch},
  removeChannel(ch){const s=hub[ch._me.name];const i=s.indexOf(ch._me);if(i>=0)s.splice(i,1);return Promise.resolve('ok')}}}
const dom=new JSDOM(raw,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',beforeParse(w){
  const fc=makeFakeClient();w.supabase={createClient:()=>fc};stubFetch(w);
  w.HL_TEST_Q_MS=300;w.HL_TEST_FILL_MS=900;w.HL_TEST_QJOIN_MS=1500;
  w.HLNative={showInterstitial:()=>new Promise(r=>setTimeout(r,50)),buyNoAds:()=>Promise.resolve(true),ownsNoAds:()=>false};
}});
const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));
const $=s=>w.document.querySelector(s);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,ms,what){const t=Date.now();while(Date.now()-t<ms){let v=false;try{v=f()}catch(e){}if(v)return v;await wait(100)}fail('timeout waiting for '+what+' '+JSON.stringify(sent.map(s=>s.ev)))}
const count=ev=>sent.filter(s=>s.ev===ev).length;
const phase=()=>w.eval('G&&G.phase');
async function lockSecret(){
  await until(()=>$('.key[data-k="4"]')||phase()==='play','10000'*1&&15000,'secret pad');
  if(!$('.key[data-k="4"]'))return;
  for(const k of '42')$('.key[data-k="'+k+'"]').click();$('#lockBtn').click();
}
async function playOut(){
  await until(()=>phase()==='play'||$('.key[data-k="4"]'),20000,'game to start');
  await lockSecret();
  const t=Date.now();
  while(phase()!=='over'){if(Date.now()-t>240000)fail('game did not finish');act(w);await wait(150)}
  await wait(600);
}
(async()=>{
  await wait(500);
  // ---- first open
  ok(count('open')===1,'open fires once');
  const o=sent.find(s=>s.ev==='open');
  ok(o.props.app===1,'app flag true when HLNative exists');ok(o.props.inv===0,'inv 0 without a room link');
  // ---- practice game
  $('#nameIn').value='Tester';$('#nameIn').dispatchEvent(new w.Event('input'));
  $('#soloBtn').click();ok(count('practice')===1,'practice fires once');
  await until(()=>$('#startBtn'),5000,'start button');{const m=$('[data-max="100"]');if(m)m.click()}w.eval('G.players.pop();publishG()');await wait(200);$('#startBtn').click();
  await playOut();
  ok(count('game_start')===1&&count('game_end')===1,'practice: one game_start and one game_end');
  const pe=sent.find(s=>s.ev==='game_end');ok(pe.props.kind==='practice'&&pe.props.t>0,'practice game_end has kind and turns');
  w.eval('closeOv();leaveGame()');await until(()=>w.eval('view')==='home',5000,'home');
  // ---- Play duel with a fill-in opponent, then Play again, ad after the 2nd finished game
  w.eval('pmSel="s"');w.eval('render(true)');
  $('#playBtn').click();
  ok(count('play_tap')===1&&sent.find(s=>s.ev==='play_tap').props.m==='s','play_tap carries the mode code');
  await playOut();
  const gs=sent.filter(s=>s.ev==='game_start'&&s.props.kind==='play');
  ok(gs.length===1,'Play: one game_start');
  ok(Number.isInteger(gs[0].props.w)&&gs[0].props.w>=0,'Play: wait seconds recorded');
  ok(gs[0].props.bots===1&&gs[0].props.n===2&&gs[0].props.m==='s','Play: fill-in opponent shows as bots=1 in mode s');
  const ge=sent.filter(s=>s.ev==='game_end'&&s.props.kind==='play');
  ok(ge.length===1&&ge[0].props.t>0&&(ge[0].props.won===0||ge[0].props.won===1),'Play: game_end has turns and won');
  ok(count('rated')===1,'rated fires once per rated game');
  await until(()=>$('#againBtn'),8000,'Play again button');$('#againBtn').click();
  ok(count('again')===1,'again fires once');ok(count('ad')===0,'no ad after the first game');
  await playOut();
  ok(count('rated')===2,'second rated');
  await until(()=>$('#ovX'),8000,'result sheet');$('#ovX').click();
  await until(()=>count('ad')>=2,5000,'ad show and close');
  const ads=sent.filter(s=>s.ev==='ad').map(s=>s.props.s);
  ok(ads.join()==='show,close','ad shown then closed, once each');
  await until(()=>w.eval('view')==='home',5000,'home');
  // ---- leave in the middle of a duel
  $('#playBtn').click();await until(()=>phase()==='play'||$('.key[data-k="4"]'),20000,'3rd game');await lockSecret();
  await until(()=>phase()==='play',10000,'3rd game play');await wait(300);
  const before=count('rated');
  w.eval('leaveGame()');await until(()=>count('leave')===1,5000,'leave event');
  ok(count('rated')===before+1,'leaving a rated game is a rated loss');
  const lv=sent.find(s=>s.ev==='leave');ok(lv.props.kind==='play'&&lv.props.m==='s'&&Number.isInteger(lv.props.t),'leave has kind, mode, turns');
  // ---- give up while finding a match
  await until(()=>w.eval('view')==='home',5000,'home');
  $('#playBtn').click();await wait(100);w.eval('leaveGame()');
  await until(()=>count('qleave')===1,3000,'qleave');
  // ---- Remove ads
  $('#infoBtn').click();await wait(100);ok(!!$('#noAdsBtn'),'Remove ads shown in the app');
  $('#noAdsBtn').click();await until(()=>count('noads')===1,3000,'noads bought');
  ok(count('noads_tap')===1,'noads_tap fires once');
  // ---- every event: name in CHECK list, sid shape, props whitelist, size limit
  for(const s of sent){
    ok(ALLOWED.has(s.ev),'event "'+s.ev+'" is in the SQL CHECK list');
    ok(SID.test(s.sid),'sid shape');
    ok(JSON.stringify(s.props).length<400,'props under 400 bytes for '+s.ev);
    const spec=SPEC[s.ev];if(!spec)continue;
    for(const [k,v] of Object.entries(s.props)){
      const f=spec[k]||COMMON[k];ok(!!f&&f(v),'prop '+s.ev+'.'+k+'='+JSON.stringify(v)+' is whitelisted');
    }
  }
  for(const ev of new Set(sent.map(s=>s.ev)))ok(Object.prototype.hasOwnProperty.call(SPEC,ev),'event "'+ev+'" has a prop spec in this test');
  ok(new Set(sent.map(s=>s.sid)).size===1,'one sid for the whole session');
  ok(sent.every(s=>s.props.b===w.eval('HL_VER')),'build code on every event');
  ok(w.errs.length===0,'page errors '+w.errs.join('|'));
  // ---- #player= tabs send nothing
  const n=sent.length;w.location.hash='#player=1';w.eval('track("open",{})');ok(sent.length===n,'#player= skips tracking');
  console.log('events seen: '+[...new Set(sent.map(s=>s.ev))].join(','));
  console.log('PASS track ('+checks+' checks)');process.exit(0);
})();
