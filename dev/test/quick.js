const {JSDOM}=require('jsdom');const fs=require('fs');
const raw=fs.readFileSync('/home/claude/hl/site/index.html','utf8').replace(/<script src="[^"]*"><\/script>/g,'').replace(/<link [^>]*>/g,'');
const hub={};
function makeFakeClient(){
  return {
    channel(name,opts){
      const subs=hub[name]||(hub[name]=[]);
      const me={handlers:[],name};
      const ch={
        on(type,filter,cb){me.handlers.push({event:filter.event,cb});return ch},
        subscribe(cb){subs.push(me);setTimeout(()=>cb&&cb('SUBSCRIBED'),10);return ch},
        send(m){subs.forEach(o=>{if(o===me)return;o.handlers.forEach(h=>{if(h.event===m.event)setTimeout(()=>h.cb({event:m.event,payload:JSON.parse(JSON.stringify(m.payload))}),5)})});return Promise.resolve('ok')},
        _me:me
      };
      return ch;
    },
    removeChannel(ch){const subs=hub[ch._me.name];const i=subs.indexOf(ch._me);if(i>=0)subs.splice(i,1);return Promise.resolve('ok')}
  };
}
const all=[];
function phone(name,online){
  const html=online?raw:raw.replace(/<script>window\.HL_CONFIG=[^<]*<\/script>/,'');
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'+name,
    beforeParse(w){
      if(online){const fc=makeFakeClient();w.supabase={createClient:()=>fc}}
      w.HL_TEST_Q_MS=300;w.HL_TEST_FILL_MS=300;w.HL_TEST_QJOIN_MS=1500;
    }});
  const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));
  w.$=s=>w.document.querySelector(s);all.push(w);return w;
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const fail=m=>{console.log('FAIL quick play: '+m);process.exit(0)};
const st=P=>JSON.parse(P.eval('JSON.stringify({ph:G&&G.phase,n:G&&G.players.length,bots:G?G.players.filter(p=>p.bot===1&&p.hb===1).length:0,humans:G?G.players.filter(p=>!p.bot).map(p=>p.pid):[],host:isHost,code:code,pub:G&&G.pub})'));
async function until(P,f,ms){const t=Date.now();while(Date.now()-t<ms){let s;try{s=st(P)}catch(e){s=null}if(s&&f(s))return s;await wait(100)}return null}
const started=s=>(s.ph==='secrets'||s.ph==='play')&&s.n===4;
(async()=>{
  // a) one phone alone
  const A=phone('a',true);await wait(400);
  A.$('#playBtn').click();
  const sa=await until(A,started,5000);
  if(!sa)fail('(a) not started in 5s '+A.eval('JSON.stringify([view,mode,G&&G.phase,G&&G.players.length])'));
  if(sa.bots!==3)fail('(a) expected 3 hidden bots, got '+sa.bots);
  if(/BOT/.test(A.$('#app').textContent))fail('(a) BOT tag visible');
  if(A.errs.length)fail('(a) page errors '+A.errs.join('|'));
  if(A.eval('LS.get("hl-session")'))fail('(a) public room saved a rejoin session');
  A.close();for(const k in hub)delete hub[k];
  // b) two phones
  const P=phone('p',true),Q=phone('q',true);await wait(400);
  P.$('#playBtn').click();await wait(600);Q.$('#playBtn').click();
  const sp=await until(P,s=>started(s)&&s.humans.length===2,9000);
  if(!sp)fail('(b) not started with both humans '+JSON.stringify([st(P),(()=>{try{return st(Q)}catch(e){return 'noQ'}})()])+P.errs+Q.errs);
  const sq=await until(Q,s=>s.ph==='secrets'||s.ph==='play',4000);
  if(!sq)fail('(b) second phone not in the game');
  if(!sp.host)fail('(b) first phone is not host');
  if(sq.host||sq.code!==sp.code)fail('(b) not the same room '+sp.code+' vs '+sq.code);
  if(P.errs.length||Q.errs.length)fail('(b) page errors '+P.errs.concat(Q.errs).join('|'));
  P.close();Q.close();for(const k in hub)delete hub[k];
  // c) rooms not available
  const C=phone('c',false);await wait(400);
  if(C.eval('roomState')==='ok')fail('(c) roomState unexpectedly ok');
  C.$('#playBtn').click();
  const sc=await until(C,started,6000);
  if(!sc)fail('(c) solo not started '+C.eval('JSON.stringify([view,mode,G&&G.phase,G&&G.players.length])'));
  if(sc.bots!==3)fail('(c) expected 3 hidden bots');
  if(C.errs.length)fail('(c) page errors '+C.errs.join('|'));
  console.log('PASS quick play');process.exit(0);
})();
