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
A.HL_TEST_TIMER_MS=1500;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await wait(300);
  A.$('#nameIn').value='Dodgy';A.$('#nameIn').dispatchEvent(new A.Event('input'));
  A.$('#hostBtn').click();await wait(200);
  const code=A.$('.code').textContent;
  A.$('[data-timer="20"]').click();await wait(100);
  B.$('#nameIn').value='Jose';B.$('#nameIn').dispatchEvent(new B.Event('input'));
  B.$('#codeIn').value=code;B.$('#joinBtn').click();await wait(400);
  A.$('#startBtn').click();await wait(300);
  ['7','7','7'].forEach(k=>A.$('.key[data-k="'+k+'"]').click());A.$('#lockBtn').click();
  ['9','1','0','0'].forEach(k=>B.$('.key[data-k="'+k+'"]').click());B.$('#lockBtn').click();
  await wait(500);
  let n=0,last='',res='FAIL timer auto-ask: only '+0+' events';
  const t0=Date.now();
  while(Date.now()-t0<40000){
    await wait(100);
    const m=(A.$('.msg')||{}).textContent||'';
    if(m!==last){last=m;if(/^(You|Jose) (asked|guessed|missed)/.test(m))n++}
    if(n>=3)break;
  }
  const errs=A.errs.concat(B.errs);
  if(n>=3&&!errs.length)console.log('PASS timer auto-ask');
  else console.log('FAIL timer auto-ask: events='+n+' errors='+JSON.stringify(errs));
  process.exit(0);
})();
