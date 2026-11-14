const {JSDOM}=require('jsdom');const fs=require('fs');
let html=fs.readFileSync('/home/claude/hl/site/index.html','utf8');
html=html.replace(/<script src="[^"]*"><\/script>/g,'').replace(/<link [^>]*>/g,'').replace(/<script>window\.HL_CONFIG=[^<]*<\/script>/,'');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const bad=[];const ok=(c,m)=>{if(!c)bad.push(m)};
function phone(o){
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/play/'+(o.hash||''),
    beforeParse(w){
      w.HL_NEED_NET=1;
      if(o.flag)w.HL_FLAGS={share:true};
      w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({measureText:()=>({width:100}),createLinearGradient:()=>({addColorStop(){}})},{get:(t,k)=>k in t?t[k]:()=>{},set:()=>true})};
      w.HTMLCanvasElement.prototype.toBlob=function(cb){cb(new w.Blob(['x'],{type:'image/png'}))};
      w.HTMLCanvasElement.prototype.toDataURL=()=>'data:image/png;base64,eA==';
      w.Image=class{set src(v){setTimeout(()=>this.onload&&this.onload(),0)}};
      w.File=w.File||class{};
    }});
  const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));w.$=s=>w.document.querySelector(s);return w;
}
function finish(w,won){
  w.eval(`G={phase:'over',win:${won?'PID':"'zz'"},max:10000,gid:'g1',pub:1,players:[{pid:PID,name:'Me',c:1},{pid:'zz',name:'Them',c:2}]};eloLast={gid:'g1',d:12,from:1000,to:1012,up:false};showWinner()`);
}
(async()=>{
  // flag off: no button even when winning
  let A=phone({flag:false});await wait(300);finish(A,true);ok(!A.$('#shareBtn'),'flag off shows button');
  // flag on, loser
  A=phone({flag:true});await wait(300);finish(A,false);ok(!A.$('#shareBtn'),'loser sees button');
  // flag on, winner
  A=phone({flag:true});await wait(300);finish(A,true);
  const b=A.$('#shareBtn');ok(!!b,'winner has no button');
  if(b){ok(b.getAttribute('aria-label')==='Share','aria-label');ok(b.textContent.trim()==='','button has text');ok(b.previousElementSibling&&b.previousElementSibling.id==='againBtn','not next to primary')}
  ok(A.eval('shareFacts()')==='1 – 10,000  ·  Mind Reader'.replace('Mind Reader','Rookie 1012')||/1 – 10,000/.test(A.eval('shareFacts()')),'facts');
  ok(/Rookie 1012|Guesser 1012/.test(A.eval('shareFacts()')),'facts rating: '+A.eval('shareFacts()'));
  // hash flag and persistence
  const H=phone({hash:'#flags=share'});await wait(100);ok(H.HL_FLAGS.share===true,'hash flag');
  ok(H.localStorage.getItem('hl-flags')==='share','flag persisted');
  const H2=phone({hash:'#flags='});ok(!H2.HL_FLAGS.share,'cleared flag');
  // files path
  let calls=[],tracks=[];
  A.eval('track=function(e,p){window.__t.push([e,p])}');A.__t=tracks;
  A.File=function(parts,name,o){this.name=name;this.type=o.type};
  Object.defineProperty(A.navigator,'canShare',{value:d=>!!d.files,configurable:true});
  Object.defineProperty(A.navigator,'share',{value:async d=>{calls.push(d)},configurable:true});
  A.$('#shareBtn').click();await wait(200);
  ok(calls.length===1&&calls[0].files&&calls[0].files.length===1,'files share');
  ok(calls[0]&&calls[0].url==='https://x.test/play/'&&/I won High & Low/.test(calls[0].text),'payload '+JSON.stringify(calls[0]&&[calls[0].url,calls[0].text]));
  ok(tracks[0]&&tracks[0][0]==='share'&&tracks[0][1].how==='files','track files');
  // link path
  calls=[];tracks.length=0;Object.defineProperty(A.navigator,'canShare',{value:()=>false,configurable:true});
  A.$('#shareBtn').click();await wait(200);
  ok(calls.length===1&&!calls[0].files&&calls[0].url==='https://x.test/play/','link share');ok(tracks[0]&&tracks[0][1].how==='link','track link');
  // cancelled share: no throw, no track
  calls=[];tracks.length=0;Object.defineProperty(A.navigator,'share',{value:async()=>{const e=new Error('x');e.name='AbortError';throw e},configurable:true});
  A.$('#shareBtn').click();await wait(200);ok(tracks.length===0,'cancel tracked');
  // copy fallback
  let copied=null;tracks.length=0;Object.defineProperty(A.navigator,'share',{value:undefined,configurable:true});
  Object.defineProperty(A.navigator,'clipboard',{value:{writeText:async t=>{copied=t}},configurable:true});
  A.$('#shareBtn').click();await wait(200);
  ok(copied==='https://x.test/play/','copy url '+copied);ok(tracks[0]&&tracks[0][1].how==='copy','track copy');
  ok(A.$('#shareBtn path').getAttribute('d').startsWith('m5 13'),'check icon');
  // native
  let nat=null;tracks.length=0;A.HLNative={share:async d=>{nat=d}};
  A.$('#shareBtn').click();await wait(200);
  ok(nat&&nat.dataUrl&&nat.url==='https://x.test/play/'&&nat.text,'native payload');ok(tracks[0]&&tracks[0][1].how==='native','track native');
  ok(A.errs.length===0,'errors '+A.errs);
  console.log(bad.length?'FAIL share: '+bad.join('; '):'PASS share');
  process.exit(0);
})();
