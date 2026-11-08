const {JSDOM}=require('jsdom');const act=require('./act.js');const fs=require('fs');
const html=fs.readFileSync('/home/claude/high-and-low.html','utf8');
// fake room hub
const rooms={};let pc=0;
function makeRoomNS(){
  const myPeer='peer'+(++pc); const handlers={};
  function api(name){
    const r=rooms[name]||(rooms[name]={members:{},subs:[]});
    const st={presence:{},updatedAt:Date.now()}; r.members[myPeer]=st;
    const notify=()=>setTimeout(()=>{r.subs.forEach(s=>s.fn({peers:Object.entries(r.members).map(([pk,m])=>({peer:pk,isMe:pk===s.me,sameTab:pk===s.me,presence:m.presence,updatedAt:m.updatedAt,kind:'viewer',guest:false,by:null}))}))},5);
    return {name,presence(patch){for(const k in patch){if(patch[k]===null)delete st.presence[k];else st.presence[k]=JSON.parse(JSON.stringify(patch[k]))}st.updatedAt=Date.now();notify();return Promise.resolve()},
      onPeers(fn){r.subs.push({fn,me:myPeer});notify();return()=>{}},
      onConnection(fn){setTimeout(()=>fn(true),5);return()=>{}},connected:()=>true,
      leave(){delete r.members[myPeer];notify();return Promise.resolve()}};
  }
  return {join:async n=>api(n),presence:()=>Promise.resolve(),onPeers:()=>()=>{}};
}
function phone(name){
  const dom=new JSDOM('<!doctype html><body>'+html+'</body>',{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'+name,
    beforeParse(w){const ns=makeRoomNS();w.claude={use:async n=>n==='room'?ns:null};}});
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
