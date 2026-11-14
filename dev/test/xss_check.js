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
  // 3) Newer surfaces: cleanG on poisoned bt / el / max / timer / pub / pids / key floods (unit level, victim window).
  {
    const bad=(m)=>fails.push(m);
    const clean=(o)=>V.eval('cleanG(JSON.parse('+JSON.stringify(JSON.stringify(o))+'))');
    const base=()=>({gid:'gx',phase:'play',max:100,pub:1,timer:20,players:[{pid:'pa',name:'A',c:0,a:1},{pid:'pb',name:'B',c:1,a:1}],turn:0,seq:1,stage:'await'});
    for(const mx of [X,1e9,-1,'100000',100001,1.5,null,[100],{a:1},0,'<b>']){const g=base();g.max=mx;const c=clean(g);if(!c||![100,1000,10000,100000].includes(c.max))bad('max '+JSON.stringify(mx))}
    for(const tm of [X,1e9,-1,'40',41,1.5,null,[20]]){const g=base();g.timer=tm;const c=clean(g);if(!c||![0,20,40].includes(c.timer))bad('timer '+JSON.stringify(tm))}
    for(const pb of [X,{a:1},[1],'yes',7]){const g=base();g.pub=pb;const c=clean(g);if(!c||(c.pub!==0&&c.pub!==1))bad('pub')}
    for(const el of [X,1e9,-5,1.5,null,'1500',[1],{a:1}]){const g=base();g.players[0].el=el;g.players[1].el=el;const c=clean(g);if(!c||c.players.some(p=>'el' in p&&!(Number.isInteger(p.el)&&p.el>=100&&p.el<=3000)))bad('el '+JSON.stringify(el))}
    {const g=base();const o=JSON.parse('{"__proto__":{"n":1,"e":1},"pa":{"n":'+JSON.stringify(X)+',"e":1},"pb":{"n":5,"e":9}}');for(let i=0;i<500;i++)o['k'+i]={n:i,e:i%6};o.pa={n:3,e:2};o.pb={n:4,e:5};g.bt=o;const c=clean(g);
      if(!c)bad('bt dropped state');else{const ks=Object.keys(c.bt);if(ks.length>6)bad('bt not capped '+ks.length);if(ks.some(k=>!c.players.some(p=>p.pid===k)))bad('bt keys for non-players');if(ks.some(k=>!(Number.isInteger(c.bt[k].e)&&c.bt[k].e>=0&&c.bt[k].e<=5&&Number.isInteger(c.bt[k].n))))bad('bt values')}}
    {const g=base();g.bt={pa:{n:'<img src=x onerror=1>',e:X},pb:{n:1.5,e:'3'}};const c=clean(g);if(!c||Object.keys(c.bt).length)bad('bt markup kept')}
    {const g=base();g.players=Array.from({length:5000},(_,i)=>({pid:'p'+i,name:X,c:1,a:1}));const c=clean(g);if(!c||c.players.length>6)bad('players not capped')}
    {const g=base();g.players=[{pid:'__proto__',name:'A',c:0,a:1},{pid:'constructor',name:'B',c:1,a:1},{pid:'toString',name:'C',c:1,a:1},{pid:'ok1',name:'D',c:2,a:1}];const c=clean(g);if(!c||c.players.some(p=>p.pid in {}))bad('prototype-named pid kept in players')}
    {const g=base();const big='y'.repeat(200000);g.players[0].extra=big;g.players[0].nest={a:[big]};g.players[0].name=big;const c=clean(g);if(!c||JSON.stringify(c).length>20000)bad('player extras/oversize name kept ('+(c?JSON.stringify(c).length:0)+')')}
    {const g=base();const huge={};for(let i=0;i<5000;i++)huge['k'+i]={lo:1,hi:5,x:[]};g.kn={pa:huge};g.st=huge;g.bx={pa:huge};g.pk={pa:huge};const c=clean(g);if(!c||JSON.stringify(c).length>4000)bad('key floods kept ('+(c?JSON.stringify(c).length:0)+')');}
    {const g=base();g.st=JSON.parse('{"__proto__":[1,2,3,4],"pa":[1,1,1,1]}');g.bx=JSON.parse('{"__proto__":{"x":1}}');g.pk=JSON.parse('{"__proto__":{"x":"odd"}}');const c=clean(g);if(!c||(c.st&&Array.isArray(Object.getPrototypeOf(c.st)))||({}).x!==undefined)bad('__proto__ key in st/bx/pk')}
    {const g=base();g.sub=['y'.repeat(100000),'pb'];g.pr={id:1,k:'peek',by:'pa',need:['z'.repeat(100000)]};const c=clean(g);if(!c||JSON.stringify(c).length>5000)bad('sub/need strings uncapped')}
    if(Object.keys(V.Object.prototype).length||({})[0]!==undefined)bad('victim Object.prototype polluted');
  }
  // 4) Public matchmaking: bad queue messages are ignored, fake host cannot drain rating or fake "rated", names with markup are safe.
  {
    const bad=(m)=>fails.push(m);
    const qraw=()=>{const subs=hub['hl-queue-v1'];return m=>subs&&subs.forEach(o=>o.handlers.forEach(h=>{if(h.event===m.event)h.cb({event:m.event,payload:JSON.parse(JSON.stringify(m.payload))})}))};
    // 4a) a searching phone ignores malformed adverts and hosts its own room
    const Q=phone('q');await wait(300);Q.eval('NAME="Quin"');Q.$('#playBtn').click();await wait(400);
    const mx=Q.eval('playMode().max'),qs=qraw();
    const junk=[{code:X,n:1,max:mx},{code:'abcd',n:1,max:mx},{code:'ABCDE',n:1,max:mx},{code:'ABC',n:1,max:mx},{code:'ABCD',n:1e9,max:mx},{code:'ABCD',n:1.5,max:mx},{code:'ABCD',n:0,max:mx},{code:'ABCD',n:2,max:mx},{code:'ABCD',n:1,max:1e12},{code:'ABCD',n:1,max:X},{code:['ABCD'],n:1,max:mx},{code:'ABCD',n:'1',max:mx},null,'str',7,[1,2],{code:{toString:'x'},n:1,max:mx}];
    for(let i=0;i<4000;i++)junk.push({code:'WXYZ',n:1,max:mx===100?5:100});
    junk.forEach(m=>{try{qs({event:'open',payload:m})}catch(e){}});
    await wait(2800);
    if(Q.eval('G&&G.pub&&isHost')!==true)bad('searching phone did not host after junk adverts');
    if(Q.eval('code')==='ABCD'||Q.eval('code')==='WXYZ')bad('searching phone joined a junk room');
    if(Q.errs.length)bad('queue junk errors: '+[...new Set(Q.errs)].slice(0,2).join('/'));
    // 4b) attacker joins that public room with markup name, bad el, then the game starts
    const pcode=Q.eval('code'),sp=raw(pcode);
    for(let i=0;i<4;i++){sp({event:'p',payload:{k:'atkp',p:{pid:'atkpub',name:X,code:pcode,role:'player',el:[1e9,X,-3,1.5][i],look:{c:X,k:X},tn:{n:i+1,e:X}}}});await wait(200)}
    const el=Q.eval('(G.players.find(p=>p.pid==="atkpub")||{}).el');
    if(el!==undefined&&!(Number.isInteger(el)&&el>=100&&el<=3000))bad('host kept bad el '+el);
    await wait(3500);
    if(Q.document.querySelector('.xss')||Q.__xss)bad('public room name markup');
    if(Q.errs.length)bad('public room errors: '+[...new Set(Q.errs)].slice(0,2).join('/'));
    Q.close();
    // 4c) a phone joins a fake public room whose "host" cycles through many finished games
    const R=phone('r');await wait(300);R.eval('NAME="Rae"');R.$('#playBtn').click();await wait(300);
    const rpid=R.eval('PID'),rmx=R.eval('playMode().max'),qs2=qraw();
    qs2({event:'open',payload:{code:'FAKE',n:1,max:rmx,at:Date.now()}});
    await wait(2300);
    const fp=raw('FAKE');
    const fg=(gid,phase,win)=>({gid,phase,max:rmx,pub:1,timer:40,players:[{pid:rpid,name:'Rae',c:0,a:1,bot:0,el:1000},{pid:'atkh',name:'Atk',c:1,a:1,bot:0,el:100}],turn:0,seq:1,stage:'await',win:win||null,en:0,asked:0,turnNo:0});
    const fpres=g=>({event:'p',payload:{k:'atkh',p:{pid:'atkh',name:'Atk',code:'FAKE',role:'host',el:100,game:g}}});
    for(let i=0;i<8;i++){fp(fpres(fg('gg'+i,'play')));await wait(250);fp(fpres(fg('gg'+i,'over','atkh')));await wait(250)}
    const e0=R.eval('myElo()'),n0=R.eval('(LS.get(LSK("hl-elo-n"))|0)');
    if(R.eval('G&&G.pub')!==1)bad('rating test: phone never joined the fake room (test proves nothing)');
    if(e0<1000-45||n0>1)bad('fake host drained rating: elo '+e0+' games '+n0);
    // a room that was not made through Play cannot switch on rating from the host side
    R.close();
    const F=phone('f');await wait(300);
    F.$('#nameIn').value='Fay';F.$('#nameIn').dispatchEvent(new F.Event('input'));F.$('#codeIn').value='FRND';F.$('#codeIn').dispatchEvent(new F.Event('input'));F.$('#joinBtn').click();await wait(400);
    const fpid=F.eval('PID'),ff=raw('FRND');
    const fg2=(gid,phase,win)=>Object.assign(fg(gid,phase,win),{players:[{pid:fpid,name:'Fay',c:0,a:1,bot:0,el:1000},{pid:'atkh',name:'Atk',c:1,a:1,bot:0,el:100}]});
    for(let i=0;i<3;i++){const pr=g=>({event:'p',payload:{k:'atkh',p:{pid:'atkh',name:'Atk',code:'FRND',role:'host',game:g}}});ff(pr(fg2('ff'+i,'play')));await wait(250);ff(pr(fg2('ff'+i,'over','atkh')));await wait(250)}
    if(F.eval('myElo()')!==1000)bad('friend-room host switched on rating: elo '+F.eval('myElo()'));
    F.close();
  }
  // 5) Prototype-named player ids must not pollute the host.
  {
    const bad=(m)=>fails.push(m);
    const P=phone('pp');await wait(300);P.$('#nameIn').value='Pol';P.$('#nameIn').dispatchEvent(new P.Event('input'));P.$('#hostBtn').click();await wait(300);
    const pc=P.$('.code').textContent,pr=raw(pc);
    for(const id of ['__proto__','constructor','okjoin1']){for(let i=0;i<2;i++){pr({event:'p',payload:{k:'k'+id,p:{pid:id,name:'Z'+id.slice(0,3),code:pc,role:'player'}}});await wait(150)}}
    P.$('#startBtn')&&P.$('#startBtn').click();await wait(900);
    if(Object.keys(P.Object.prototype).length||({})[0]!==undefined||({})[1]!==undefined)bad('host Object.prototype polluted via pid');
    if(P.eval('G.players.some(p=>p.pid in {})'))bad('host accepted a prototype-named pid');
    if(!P.eval('G.players.some(p=>p.pid==="okjoin1")'))bad('pid test: normal joiner missing (test proves nothing)');
    if(P.errs.length)bad('pid test errors: '+[...new Set(P.errs)].slice(0,2).join('/'));
    P.close();
  }
  console.log(fails.length?'FAIL security: '+[...new Set(fails)].join(', '):'PASS security (no injected markup)');
  console.log('victim errors:',[...new Set(V.errs)].slice(0,6));console.log('host errors:',[...new Set(H.errs)].slice(0,6));
  process.exit(0);
})();
