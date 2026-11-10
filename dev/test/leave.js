const {JSDOM}=require('jsdom');const act=require('./act.js');const fs=require('fs');
let html=fs.readFileSync('/home/claude/hl/site/index.html','utf8');
html=html.replace(/<script src="[^"]*"><\/script>/g,'').replace(/<link [^>]*>/g,'');
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
function phone(name){
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'+name,
    beforeParse(w){const fc=makeFakeClient();w.supabase={createClient:()=>fc};w.HL_CONFIG={url:'x',key:'y'};}});
  const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));
  w.$=s=>w.document.querySelector(s);return w;
}
const A=phone('a'),B=phone('b'),C=phone('c');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const fail=m=>{console.log('FAIL leave: '+m);process.exit(0)};
const tapLeave=async P=>{P.$('#leaveBtn').click();await wait(100);P.$('#leaveBtn').click();await wait(100)};
const join=async(P,n,code)=>{P.$('#nameIn').value=n;P.$('#nameIn').dispatchEvent(new P.Event('input'));P.$('#codeIn').value=code;P.$('#codeIn').dispatchEvent(new P.Event('input'));P.$('#joinBtn').click();await wait(500)};
const names=()=>A.eval('G.players.map(p=>p.name).join(",")');
(async()=>{
  await wait(300);
  A.$('#nameIn').value='Dodgy';A.$('#nameIn').dispatchEvent(new A.Event('input'));
  A.$('#hostBtn').click();await wait(200);
  const code=A.$('.code').textContent;
  await join(B,'Jose',code);await join(C,'Mia',code);
  if(names()!=='Dodgy,Jose,Mia')fail('lobby did not fill: '+names());
  console.error('lobby ok');
  // 1) Leave in the lobby removes the player within 2 s
  await tapLeave(C);await wait(1500);
  if(names()!=='Dodgy,Jose')fail('lobby leave not removed: '+names());
  if(C.eval('view')!=='home')fail('leaver not back home');
  await join(C,'Mia',code);
  if(names()!=='Dodgy,Jose,Mia')fail('rejoin failed: '+names());
  console.error('rejoin ok');
  // 2) Leave mid-game knocks the player out within 3 s and the game goes on
  A.$('#startBtn').click();await wait(400);
  for(const P of [A,B,C]){for(const k of '4321')P.$('.key[data-k="'+k+'"]').click();P.$('#lockBtn').click()}
  for(let i=0;i<100&&!(A.eval('G.phase')==='play'&&A.eval('G.stage')==='await');i++)await wait(200);
  if(A.eval('G.phase')!=='play')fail('game did not start '+A.eval('JSON.stringify([G.phase,G.stage,G.players.map(p=>[p.name,p.a,(getPres(p.pid)||{}).ready===G.gid])])')+' APEERS:'+A.eval('JSON.stringify([...peerMap.entries()].map(([k,v])=>[k.slice(0,6),v.pres.name,v.pres.ready,v.pres.gone,v.pres.code]))')+' UPD:'+B.eval('(()=>{try{update();return "ok"}catch(e){return String(e.stack).slice(0,300)}})()')+' BNET:'+B.eval('JSON.stringify([!!R,R&&R.connected&&R.connected(),[...peerMap.values()].map(v=>[v.pres.name,v.pres.role,v.pres.gone,!!v.pres.game])])')+' ERR:'+JSON.stringify([A.errs,B.errs,C.errs]).slice(0,300)+' B:'+B.eval('JSON.stringify([view,!!mySecret,myPres.ready,G&&G.gid,G&&G.phase])')+' C:'+C.eval('JSON.stringify([view,!!mySecret,!!G,G&&G.phase,myPres.ready])')+C.$('#app').textContent.slice(0,80));
  await tapLeave(C);await wait(2500);
  const mia=JSON.parse(A.eval('JSON.stringify(G.players.find(p=>p.name==="Mia"))'));
  if(mia.a!==0)fail('mid-game leaver still alive');
  console.error('midgame leave ok',A.eval('JSON.stringify([G.stage,G.turn,G.sub,G.q,G.players.map(p=>p.a)])'));
  let over=false;
  for(let t=0;t<1500&&!over;t++){act(A);act(B);await wait(120);if(t%100===99)console.error(t,A.eval('JSON.stringify([G.stage,G.seq,G.turn,G.sub,G.q,G.players.map(p=>p.a)])'));over=A.eval('G.phase')==='over'}
  if(!over)fail('game stuck after a player left: '+A.eval('JSON.stringify([G.stage,G.turn,G.sub,G.q])'));
  // 3) Host leaves: joiner goes home with a short message
  A.$('#ovClose')&&A.$('#ovClose').click();
  await tapLeave(A);await wait(1500);
  if(B.eval('view')!=='home')fail('joiner not sent home after host left');
  if(!/host left/i.test(B.$('#app').textContent))fail('no host-left message');
  const errs=[A,B,C].map(P=>[...new Set(P.errs)]);
  if(errs.some(e=>e.length))fail('page errors '+JSON.stringify(errs));
  console.log('PASS leave');process.exit(0);
})();
