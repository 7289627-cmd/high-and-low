// Security check: a malicious player sends poisoned data as a fake host and as a joiner.
// Pass = no injected element ever appears in a victim's page and no page crashes into a blank screen.
const {JSDOM}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('/home/claude/hl/site/index.html','utf8');
html=html.replace(/<script src="[^"]*"><\/script>/g,'').replace(/<link [^>]*>/g,'');
const hub={};
function client(){return{channel(name){const subs=hub[name]||(hub[name]=[]);const me={handlers:[],name};const ch={on(t,f,cb){me.handlers.push({event:f.event,cb});return ch},subscribe(cb){subs.push(me);setTimeout(()=>cb&&cb('SUBSCRIBED'),10);return ch},send(m){subs.forEach(o=>{if(o===me)return;o.handlers.forEach(h=>{if(h.event===m.event)setTimeout(()=>h.cb({event:m.event,payload:JSON.parse(JSON.stringify(m.payload))}),5)})});return Promise.resolve('ok')},_me:me};return ch},removeChannel(){return Promise.resolve('ok')}}}
function phone(n){const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'+n,beforeParse(w){const fc=client();w.supabase={createClient:()=>fc};w.HL_CONFIG={url:'x',key:'y'}}});const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));w.$=s=>w.document.querySelector(s);return w}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const X='<img src=x class=xss onerror="window.__xss=1">"\'><svg class=xss onload="window.__xss=1">';
function raw(code){const subs=hub['hl-hl-'+code.toLowerCase()]||hub[Object.keys(hub).find(k=>k.toLowerCase().includes(code.toLowerCase()))];return m=>subs.forEach(o=>o.handlers.forEach(h=>{if(h.event===m.event)h.cb({event:m.event,payload:JSON.parse(JSON.stringify(m.payload))})}))}
function evil(phase,stage,victim){const P=(pid,extra)=>Object.assign({pid,name:X,c:X,k:X,bot:0,lo:1,hi:phase==='play'?8:10000,x:[X,3],a:1,d:X,co:X,sh:X,fz:X},extra);
  return{gid:'g'+phase+stage,phase,max:10000,players:[P('evil'),P(victim,{name:X}),P(X,{a:0,d:X})],turn:0,seq:3,stage,q:{seq:3,a:'evil',tg:victim,t:'ask',dir:X,x:X,n:X},ev:{id:Math.random(),t:['ask','hit','miss','snap','peek','blocked','frozen','left',X][Math.floor(Math.random()*9)],a:'evil',tg:victim,n:X,x:X,k:X,dir:X,ans:X},en:9,asked:X,win:X,sub:[victim,X],subN:X,timer:X,turnNo:X,st:{evil:[X,X,X,X],[victim]:[1,1,1,1]},bx:{[victim]:{evil:X}},pk:{[victim]:{evil:X}},pr:{id:X,k:X,by:'evil',need:[victim],until:Date.now()+9e9},bs:X}}
(async()=>{
  const fails=[];
  // 1) Victim joins a room; attacker pretends to be the host with poisoned state in every phase.
  const V=phone('v');await wait(300);
  V.$('#nameIn').value='Vic';V.$('#nameIn').dispatchEvent(new V.Event('input'));
  V.$('#codeIn').value='EVIL';V.$('#codeIn').dispatchEvent(new V.Event('input'));V.$('#joinBtn').click();await wait(400);
  const vpid=V.eval('PID');const send=raw('EVIL');
  for(const [ph,st] of [['lobby','await'],['secrets','await'],['play','wheel'],['play','await'],['play','show'],['play','power'],['over','await']]){
    for(let i=0;i<4;i++){send({event:'p',payload:{k:'atk',p:{pid:'evil',name:X,code:'EVIL',role:'host',look:X,tn:{n:Date.now()+i,e:X},co:X,game:evil(ph,st,vpid)}}});await wait(120);
      try{V.document.querySelectorAll('button').forEach((b,j)=>{if(j%3===i%3&&!/leave/i.test(b.id))b.click()})}catch(e){}
      await wait(120);
      if(V.document.querySelector('.xss')||V.__xss)fails.push('fake-host '+ph+'/'+st);
      if(V.$('#app').innerHTML.includes('&lt;img'))global.rendered=(global.rendered||0)+1;
    }
  }
  if(!V.$('#app').innerHTML.length)fails.push('victim page blank');
  if(!(global.rendered>10))fails.push('poisoned state never rendered, test proves nothing ('+(global.rendered||0)+')');
  if(V.errs.length)fails.push('victim page errors: '+[...new Set(V.errs)].slice(0,3).join(' / '));
  // 2) Real host; attacker joins the lobby with poisoned presence.
  const H=phone('h');await wait(300);
  H.$('#nameIn').value='Host';H.$('#nameIn').dispatchEvent(new H.Event('input'));H.$('#hostBtn').click();await wait(300);
  const code=H.$('.code').textContent;const send2=raw(code);
  for(let i=0;i<5;i++){send2({event:'p',payload:{k:'atk2',p:{pid:i%2?X:'evil2',name:X,code,role:'player',look:{c:X,k:X},tn:{n:Date.now()+i,e:X},co:X,ready:X,act:{gid:X,seq:X,tg:X,t:X,x:X,n:X,dir:X},rep:{gid:X,seq:X,ans:X},pw:{gid:X,turn:X,id:X,tg:X},prr:{gid:X,id:X,lo:X,hi:X,dec:X,odd:X}}}});await wait(200);
    if(H.document.querySelector('.xss')||H.__xss)fails.push('joiner lobby');}
  H.$('#startBtn')&&H.$('#startBtn').click();await wait(500);
  if(H.document.querySelector('.xss')||H.__xss)fails.push('joiner after start');
  console.log(fails.length?'FAIL security: '+[...new Set(fails)].join(', '):'PASS security (no injected markup)');
  console.log('victim errors:',[...new Set(V.errs)].slice(0,6));console.log('host errors:',[...new Set(H.errs)].slice(0,6));
  process.exit(0);
})();
