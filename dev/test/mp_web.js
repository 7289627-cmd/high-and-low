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
(async()=>{
  await wait(300);
  A.$('#nameIn').value='Dodgy';A.$('#nameIn').dispatchEvent(new A.Event('input'));
  A.$('#hostBtn').click();await wait(200);
  const code=A.$('.code').textContent;console.log('code',code);
  B.$('#nameIn').value='Jose';B.$('#nameIn').dispatchEvent(new B.Event('input'));
  B.$('#codeIn').value=code;B.$('#joinBtn').click();await wait(400);
  console.log('A lobby',A.$('.plist').textContent.replace(/\s+/g,' '));
  console.log('B lobby',B.$('.plist')&&B.$('.plist').textContent.replace(/\s+/g,' '));
  A.$('#addBot').click();await wait(100);
  A.$('#startBtn').click();await wait(300);
  ['7','7','7'].forEach(k=>A.$('.key[data-k="'+k+'"]').click());A.$('#lockBtn').click();
  ['9','1','0','0'].forEach(k=>B.$('.key[data-k="'+k+'"]').click());B.$('#lockBtn').click();
  await wait(500);
  for(let t=0;t<1600;t++){
    for(const P of [A,B]){
      act(P);
    }
    await wait(150);
    const txt=A.$('#app').textContent+A.$('#ov').textContent;
    if(t%25===0)console.log(t,(A.$('.msg')||{}).textContent,'| B sees:',(B.$('.msg')||{}).textContent);
    if(/wins!|You win/.test(txt)){console.log('END A:',A.$('.tray').textContent.trim().slice(0,60),'| B:',B.$('.tray').textContent.trim().slice(0,60));break}
  }
  console.log('errors',A.errs,B.errs);process.exit(0);
})();
