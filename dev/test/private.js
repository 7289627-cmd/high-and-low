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
const fail=m=>{console.log('FAIL private knowledge: '+m);process.exit(0)};
const txt=P=>P.$('#app').textContent+' '+P.$('#ov').textContent;
(async()=>{
  await wait(300);
  A.$('#nameIn').value='Dodgy';A.$('#nameIn').dispatchEvent(new A.Event('input'));
  A.$('#hostBtn').click();await wait(200);
  const code=A.$('.code').textContent;
  for(const [P,n] of [[B,'Jose'],[C,'Mia']]){
    P.$('#nameIn').value=n;P.$('#nameIn').dispatchEvent(new P.Event('input'));
    P.$('#codeIn').value=code;P.$('#joinBtn').click();await wait(400);
  }
  A.$('[data-max="10000"]').click();await wait(100);
  A.$('#startBtn').click();await wait(300);
  const sec=[['7','7','7'],['9','1','0','0'],['5','5','5']];
  [A,B,C].forEach((P,i)=>{sec[i].forEach(k=>P.$('.key[data-k="'+k+'"]').click());P.$('#lockBtn').click()});
  await wait(500);
  for(let i=0;i<100&&A.eval('G.phase')!=='play';i++)await wait(100);
  if(A.eval('G.phase')!=='play')fail('game did not start');
  // wait for wheel to finish and first asker to be ready
  const phones=[A,B,C];
  let X=null;
  for(let i=0;i<200&&!X;i++){
    await wait(100);
    for(const P of phones){if(P.$('[data-pickdir]')){X=P;break}}
  }
  if(!X)fail('no asker appeared');
  const pids=phones.map(P=>P.eval('PID'));
  const xi=phones.indexOf(X),xp=pids[xi];
  const yp=X.eval('G.sub[0]'),yi=pids.indexOf(yp);
  const Y=phones[yi],Z=phones.find((P,i)=>i!==xi&&i!==yi),zp=pids[phones.indexOf(Z)];
  // ask HIGHER than 4321 through the UI
  X.document.querySelector('[data-pickdir="h"]').click();await wait(100);
  const open=X.eval('askSlots(mv(curTarget())).open'),pre=X.eval('askSlots(mv(curTarget())).prefix');
  const need='4321'.slice(pre.length);
  if(pre&&!'4321'.startsWith(pre))fail('prefix '+pre);
  if(need.length!==open)fail('open digits '+open+' prefix '+pre);
  for(const d of need)X.$('.key[data-k="'+d+'"]').click();
  await wait(50);
  X.$('#askGo').click();
  let leaked=false,t0=Date.now();
  while(Date.now()-t0<1500){
    if(/4,321/.test(txt(Z)))leaked=true;
    await wait(100);
  }
  if(!/4,321/.test(txt(X)))fail('asker page lacks 4,321');
  if(leaked)fail('third phone saw 4,321');
  const kx=JSON.parse(A.eval('JSON.stringify([G.kn['+JSON.stringify(xp)+']['+JSON.stringify(yp)+'],G.kn['+JSON.stringify(zp)+']['+JSON.stringify(yp)+']])'));
  if(!(kx[0].lo>1||kx[0].hi<10000))fail('asker knowledge not narrowed '+JSON.stringify(kx[0]));
  if(kx[1].lo!==1||kx[1].hi!==10000)fail('third knowledge changed '+JSON.stringify(kx[1]));
  const card=(P)=>{const c=P.$('.card[data-pid="'+yp+'"]');return c?c.textContent:''};
  if(!card(Z).includes('1 – 10,000'))fail('Z card for Y not full range: '+card(Z));
  if(card(X).includes('1 – 10,000'))fail('X card for Y still full: '+card(X));
  // auto play to a winner
  let won=false;
  for(let t=0;t<3000&&!won;t++){
    for(const P of phones)act(P);
    await wait(120);
    if(/wins!|You win/.test(txt(A)))won=true;
  }
  if(!won)fail('no winner');
  const errs=[A.errs,B.errs,C.errs];
  if(errs.some(e=>e.length))fail('page errors '+JSON.stringify(errs));
  console.log('PASS private knowledge');
  process.exit(0);
})();
