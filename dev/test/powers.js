const {JSDOM}=require('jsdom');const act=require('./act.js');const fs=require('fs');
let html=fs.readFileSync('/home/claude/hl/site/index.html','utf8');
html=html.replace(/<script src="[^"]*"><\/script>/g,'').replace(/<link [^>]*>/g,'');
const hub={};
function makeFakeClient(){
  const myChans=[];
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
      myChans.push(ch);return ch;
    },
    removeChannel(ch){const subs=hub[ch._me.name];const i=subs.indexOf(ch._me);if(i>=0)subs.splice(i,1);return Promise.resolve('ok')}
  };
}
let pc=0;
function phone(name){
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'+name,
    beforeParse(w){const fc=makeFakeClient();w.supabase={createClient:()=>fc};w.HL_CONFIG={url:'x',key:'y'};}});
  const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));
  w.$=s=>w.document.querySelector(s);return w;
}
const A=phone('a'),B=phone('b');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const fail=m=>{console.log('FAIL powers: '+m);process.exit(1)};
const PLAN=['freeze','shield','double','peek','snap'];
(async()=>{
  await wait(300);
  A.$('#nameIn').value='Dodgy';A.$('#nameIn').dispatchEvent(new A.Event('input'));
  A.$('#hostBtn').click();await wait(200);
  const code=A.$('.code').textContent;
  B.$('#nameIn').value='Jose';B.$('#nameIn').dispatchEvent(new B.Event('input'));
  B.$('#codeIn').value=code;B.$('#joinBtn').click();await wait(400);
  A.$('#addBot').click();await wait(100);
  A.$('#startBtn').click();await wait(300);
  ['7','7','7'].forEach(k=>A.$('.key[data-k="'+k+'"]').click());A.$('#lockBtn').click();
  ['9','1','0','0'].forEach(k=>B.$('.key[data-k="'+k+'"]').click());B.$('#lockBtn').click();
  await wait(500);
  for(let i=0;i<100&&A.eval('G.phase')!=='play';i++)await wait(100);
  if(A.eval('G.phase')!=='play')fail('game did not start');
  A.eval("LS.set(LSK('hl-coins'),50)");B.eval("LS.set(LSK('hl-coins'),50)");
  await wait(300);
  const evs={},snapSeen={};let idx=0,sentTurn=-1,doneTurn=-1,snapChecked=false,peekChecked=false,userPid=null;
  let won=false,b0=null;
  const bad=[];
  const t0=Date.now();
  for(let t=0;t<3000&&Date.now()-t0<460000;t++){
    // record events seen by host
    const ev=A.eval('G.ev&&JSON.stringify(G.ev)');
    if(ev){const e=JSON.parse(ev);evs[e.t]=(evs[e.t]||0)+1;if(e.t==='snap'&&!snapChecked){
        snapChecked=true;
        const r=JSON.parse(A.eval('JSON.stringify({ps:G.players.filter(p=>p.a).flatMap(a=>G.players.filter(t=>t.a&&t.pid!==a.pid).map(t=>[a.pid+">"+t.pid,G.kn[a.pid][t.pid].hi-G.kn[a.pid][t.pid].lo+1])),bx:G.bx})'));
        if(r.ps.some(x=>x[1]>10))bad.push('range >10 after snap '+JSON.stringify(r.ps));
        const by=e.a,ent=r.bx[by]||{};
        if(Object.keys(ent).length<1)bad.push('no decoys in G.bx');
      }
      if(e.t==='peek'&&!peekChecked){peekChecked=true;const pk=A.eval('JSON.stringify(G.pk)');if(!pk||pk==='{}')bad.push('no G.pk entry')}
    }
    const full=A.eval('JSON.stringify({ph:G.phase,tn:G.turnNo,pt:G.pwTurn,st:G.stage})');
    const g=JSON.parse(full);
    if(g.ph==='over'){won=true;break}
    if(idx>=PLAN.length&&!b0){const now=[A,B].map(P=>P.eval("myCoins()"));if(!global.__t0)global.__t0=Date.now();if(now[0]+now[1]===80||Date.now()-global.__t0>3000)b0=now}
    for(const P of [A,B]){
      const ov=P.$('#ov');
      if(ov&&!ov.hidden&&ov.querySelector('.pw-sheet')){
        const pk=ov.querySelector('[data-pwtg]');
        if(pk){pk.click();continue}
        const b=ov.querySelector('[data-pw="'+PLAN[idx]+'"]');
        if(b&&!b.disabled){b.click();sentTurn=g.tn}else fail('cannot use '+PLAN[idx]+' '+(b?b.parentNode.textContent:'missing'));
        continue;
      }
      if(idx<PLAN.length&&sentTurn!==g.tn&&doneTurn!==g.tn&&g.st==='await'&&P.$('#pwBtn')){P.$('#pwBtn').click();continue}
      if(idx<PLAN.length&&sentTurn===g.tn&&g.pt===g.tn){idx++;doneTurn=g.tn;sentTurn=-1}
      act(P);
    }
    await wait(120);
  }
  if(won){
    await wait(2500);
    const b1=[A,B].map(P=>P.eval('myCoins()'));
    const wp=A.eval('G.win'),pids=[A.eval('PID'),B.eval('PID')];
    const bs=b0?b0[0]+b0[1]:0;
    if(!b0||bs!==80)bad.push('spend wrong, balances '+JSON.stringify(b0));
    else{
      const exp=b0.map((v,i)=>v+(pids[i]===wp?5:0));
      if(JSON.stringify(exp)!==JSON.stringify(b1))bad.push('winner coins wrong '+JSON.stringify([b0,b1,wp]));
    }
    console.log('coins',JSON.stringify(b0),JSON.stringify(b1),'winner',wp);
  }
  const need=['snap','peek','double','shield','blocked','freeze','frozen'];
  const miss=need.filter(k=>!evs[k]);
  console.log('events',JSON.stringify(evs),'idx',idx);
  const errs=A.errs.concat(B.errs);
  if(miss.length)bad.push('missing events '+miss);
  if(errs.length)bad.push('page errors '+JSON.stringify(errs));
  if(!won)bad.push('no winner');
  console.log(bad.length?'FAIL powers: '+bad.join('; '):'PASS powers');
  process.exit(0);
})();
