/* Play (rated 1v1 duel) tests. Prints one line: PASS duel (N checks) or FAIL duel: ...
   Phones are jsdom pages that share a fake realtime hub. Windows are never closed; games are left instead. */
const {JSDOM}=require('jsdom');const fs=require('fs');
const raw=fs.readFileSync(__dirname+'/../site/index.html','utf8').replace(/<script src="[^"]*"><\/script>/g,'').replace(/<link [^>]*>/g,'');
const hub={};
function makeFakeClient(){
  return {
    channel(name){
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
    removeChannel(ch){const subs=hub[ch._me.name]||[];const i=subs.indexOf(ch._me);if(i>=0)subs.splice(i,1);return Promise.resolve('ok')}
  };
}
let pc=0;
function phone(opts){
  opts=opts||{};
  const dom=new JSDOM(raw,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/p'+(pc++),
    beforeParse(w){const fc=makeFakeClient();w.supabase={createClient:()=>fc};
      w.HL_TEST_Q_MS=300;w.HL_TEST_FILL_MS=900;w.HL_TEST_QJOIN_MS=1500;if(opts.timerMs)w.HL_TEST_TIMER_MS=opts.timerMs}});
  const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));
  w.$=s=>w.document.querySelector(s);return w;
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let checks=0;
const fail=m=>{console.log('FAIL duel: '+m);process.exit(0)};
const chk=(c,m)=>{checks++;if(!c)fail(m)};
const J=(P,s)=>JSON.parse(P.eval('JSON.stringify('+s+')'));
async function until(f,ms){const t=Date.now();while(Date.now()-t<ms){let v=null;try{v=f()}catch(e){}if(v)return v;await wait(80)}return null}
const expDelta=(me,oe0,n,won,max)=>{const oe=Math.min(me+300,Math.max(me-300,oe0));const ex=1/(1+Math.pow(10,(oe-me)/400)),k=n<10?40:28,mult=max===10000?1.5:max===100000?2:1;
  let d=Math.round(k*((won?1:0)-ex)*(won?mult:1));if(won&&d<1)d=1;if(!won&&d>-1)d=-1;return d};

/* A page in a rated-duel state, then eloApply. Returns the stored rating change. */
function rate(P,o){
  P.eval(`(()=>{eloRoom='';pmSel=(MODES.find(m=>m.max===${o.max||100})||MODES[0]).k;LS.set(LSK('hl-elo'),${o.me});LS.set(LSK('hl-elo-n'),${o.n||0});LS.del(LSK('hl-elo-g'));eloLast=null;
    eloPlayGid=(G={gid:'${o.gid||'g'+Math.random()}',pub:${o.pub===0?0:1},phase:'over',max:${o.max||100},
    players:[{pid:PID,name:'Me',a:1,el:${o.me}},{pid:'opp',name:'Op',a:1,el:${o.oe}}${o.third?",{pid:'x3',name:'X',a:1,el:1000}":''}]}).gid})()`);
  const before=P.eval('myElo()');
  P.eval(`eloApply(${o.won?'true':'false'})`);
  return P.eval('myElo()')-before;
}

(async()=>{
  /* ---------- (a) rating maths ---------- */
  const U=phone();await wait(400);
  chk(U.eval('ELO0')===1000,'ELO0 is not 1000');
  chk(JSON.stringify(U.eval('MODES.map(m=>[m.k,m.max,m.mult])'))===JSON.stringify([['s',100,1],['m',10000,1.5],['l',100000,2]]),'MODES table changed');
  // equal opponent, first games (K 40): win +20 / +30 / +40, loss -20
  chk(rate(U,{me:1000,oe:1000,won:true,max:100})===20,'win vs equal, max 100, first game not +20');
  chk(rate(U,{me:1000,oe:1000,won:true,max:10000})===30,'win vs equal, max 10,000 not +30 (x1.5)');
  chk(rate(U,{me:1000,oe:1000,won:true,max:100000})===40,'win vs equal, max 100,000 not +40 (x2)');
  for(const mx of [100,10000,100000])chk(rate(U,{me:1000,oe:1000,won:false,max:mx})===-20,'loss vs equal in mode '+mx+' is not -20 (losses must not be multiplied)');
  // settled players (K 28): +14 / +21 / +28, loss -14. Game number 10 (n=10) is the first with the small K, n=9 still the big K.
  chk(rate(U,{me:1000,oe:1000,won:true,max:100,n:9})===20,'10th game must still use K 40');
  chk(rate(U,{me:1000,oe:1000,won:true,max:100,n:10})===14,'11th game must use K 28');
  chk(rate(U,{me:1000,oe:1000,won:true,max:10000,n:10})===21,'settled win x1.5');
  chk(rate(U,{me:1000,oe:1000,won:true,max:100000,n:10})===28,'settled win x2');
  chk(rate(U,{me:1000,oe:1000,won:false,max:100000,n:10})===-14,'settled loss');
  chk(rate(U,{me:1000,oe:1000,won:false,max:100,n:9})===-20,'10th game loss must use K 40');
  // unequal opponents, compared with the Elo formula
  for(const [me,oe] of [[1000,1400],[1400,1000],[800,1500],[2000,900],[1200,1210]])for(const won of [true,false])for(const mx of [100,10000,100000]){
    const n=(me+oe)%20,d=rate(U,{me,oe,won,max:mx,n});
    chk(d===expDelta(me,oe,n,won,mx),`delta ${me} vs ${oe} won=${won} max=${mx} n=${n}: got ${d} want ${expDelta(me,oe,n,won,mx)}`);
    chk(won?d>0:d<0,'win must raise and loss must lower the rating');
  }
  chk(rate(U,{me:1000,oe:1400,won:true,max:100})>rate(U,{me:1000,oe:1000,won:true,max:100}),'beating a stronger opponent must pay more');
  // a win always pays at least +1, a loss always costs at least 1 (above the floor)
  chk(rate(U,{me:1500,oe:100,won:true,max:100,n:20})===expDelta(1500,1200,20,true,100)&&expDelta(1500,1200,20,true,100)>=1,'win against a far weaker claim not clamped to 300 below');
  chk(rate(U,{me:2000,oe:100,won:false,max:100,n:20})===expDelta(2000,1700,20,false,100)&&expDelta(2000,1700,20,false,100)<=-24,'big upset loss too small');
  // floor of 100
  chk(rate(U,{me:100,oe:100,won:false})===0&&U.eval('myElo()')===100,'rating dropped below 100 at the floor');
  chk(rate(U,{me:105,oe:100,won:false})===-5&&U.eval('myElo()')===100,'loss from 105 must stop at 100');
  chk(rate(U,{me:110,oe:100,won:false,n:30})>=-10,'loss from 110 below the floor');
  // ceiling of 3000 (myElo clamps it, so the sheet must not show more)
  rate(U,{me:2995,oe:3000,won:true,max:100000});chk(U.eval('myElo()')===3000&&U.eval('eloLast.to')===3000,'rating above 3000: sheet shows '+U.eval('eloLast.to'));
  // an id is rated only once
  {rate(U,{me:1000,oe:1000,won:true,gid:'once'});const r=U.eval('myElo()');
    for(let i=0;i<5;i++){U.eval('eloApply(true)');U.eval('eloApply(false)')}
    chk(U.eval('myElo()')===r,'a repeated eloApply changed the rating again');
    chk(U.eval('LS.get(LSK("hl-elo-n"))')===1,'games played counter counted a game twice');
    chk(U.eval('LS.get(LSK("hl-elo-g"))')==='once','rated game id not stored');
    chk(U.eval('eloAtStake()')===0,'stake must be 0 once the game is rated');
    U.eval('G.gid="twice";eloPlayGid="twice";eloRoom=""');U.eval('eloApply(true)');
    chk(U.eval('myElo()')>r,'a new game id must be rated');}
  // not rated: friends room, three players, me not in the game
  chk(rate(U,{me:1000,oe:1000,won:true,pub:0})===0&&U.eval('LS.get(LSK("hl-elo-g"))')===null,'friends room (no G.pub) changed the rating');
  chk(rate(U,{me:1000,oe:1000,won:true,third:1})===0,'3 player game was rated');
  chk(rate(U,{me:1000,oe:1000,won:false,third:1})===0,'3 player game loss was rated');
  U.eval('LS.set(LSK("hl-elo"),1000);G={gid:"nm",pub:1,phase:"over",max:100,players:[{pid:"a",a:1},{pid:"b",a:1}]};eloApply(false)');
  chk(U.eval('myElo()')===1000,'game without me was rated');
  U.eval('G=null;eloApply(true)');chk(U.eval('myElo()')===1000,'eloApply with no game changed rating');
  // garbage stored values never crash myElo
  for(const bad of ['"x"','null','12.5','-5','99999']){U.eval(`localStorage.setItem(LSK('hl-elo'),'${bad}')`);const v=U.eval('myElo()');chk(Number.isInteger(v)&&v>=100&&v<=3000,'myElo not sane for stored '+bad+' got '+v)}
  // stake equals what a loss costs
  for(const [me,oe,n] of [[1000,1000,0],[1000,1300,12],[1300,900,3],[105,100,0],[100,100,0],[101,100,40]]){
    U.eval(`eloRoom='';pmSel='s';LS.set(LSK('hl-elo'),${me});LS.set(LSK('hl-elo-n'),${n});LS.del(LSK('hl-elo-g'));eloPlayGid='st${me}${oe}';G={gid:'st${me}${oe}',pub:1,phase:'play',max:100,players:[{pid:PID,a:1,el:${me}},{pid:'opp',a:1,el:${oe}}]}`);
    const s=U.eval('eloAtStake()');U.eval('eloApply(false)');const lost=me-U.eval('myElo()');
    chk(s===lost&&(me>100?s>0:s===0),`stake ${s} != loss ${lost} for ${me} vs ${oe} n=${n}`);
  }
  U.eval('G.phase="lobby"');chk(U.eval('eloAtStake()')===0,'stake in lobby');
  U.eval('G.phase="secrets"');chk(U.eval('eloAtStake()')===0,'stake in secrets phase');
  U.eval('G.phase="play";G.pub=0');chk(U.eval('eloAtStake()')===0,'stake in friends room');
  U.eval('G.pub=1;G.players.push({pid:"z",a:1})');chk(U.eval('eloAtStake()')===0,'stake with 3 players');
  U.eval('G.players.pop();byPid(PID).a=0');chk(U.eval('eloAtStake()')===0,'stake after being knocked out');
  U.eval('G=null');chk(U.eval('eloAtStake()')===0,'stake with no game');

    /* ---------- (b) rank names ---------- */
  for(const [e,n] of [[0,'Rookie'],[100,'Rookie'],[1049,'Rookie'],[1050,'Guesser'],[1149,'Guesser'],[1150,'Sharp'],[1299,'Sharp'],[1300,'Hunter'],[1449,'Hunter'],[1450,'Mind Reader'],[1599,'Mind Reader'],[1600,'Mastermind'],[3000,'Mastermind']])
    chk(U.eval(`rankName(${e})`)===n,`rankName(${e}) should be ${n} got ${U.eval(`rankName(${e})`)}`);
  // rank-up flag
  rate(U,{me:1045,oe:1045,won:true,max:100});chk(U.eval('eloLast.up')===true&&U.eval('eloLast.to')>=1050,'rank up not flagged');
  rate(U,{me:1100,oe:1100,won:true,max:100});chk(U.eval('eloLast.up')===false,'rank up flagged inside a rank');
  rate(U,{me:1052,oe:1052,won:false,max:100});chk(U.eval('eloLast.up')===false,'rank up flagged on a loss');

  /* ---------- (g) slider maths ---------- */
  {
    const rr=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
    const nums=s=>(s.match(/\d[\d,]*/g)||[]).map(x=>Number(x.replace(/,/g,'')));
    let tested=0;
    const ranges=[[1,2],[1,3],[1,100],[1,10000],[1,100000],[9,11],[95,105],[999,1001],[1000,1099],[9990,10010],[2,99999],[500,501]];
    for(let i=0;i<150;i++){const mx=[100,10000,100000][i%3],a=rr(1,mx-1),b=rr(a+1,mx);ranges.push([a,b])}
    for(const [lo,hi] of ranges)for(const dir of ['h','l']){
      U.eval(`G={gid:'sl',pub:1,phase:'play',stage:'await',max:100000,turn:0,sub:['opp'],q:null,seq:1,players:[{pid:PID,a:1},{pid:'opp',a:1}],kn:{[PID]:{opp:{lo:${lo},hi:${hi},x:[]}}}};ui.dir='${dir}';ui.num='';ui.step='num'`);
      const L=dir==='l'?lo+1:lo,H=dir==='l'?hi:hi-1;
      const probes=[L,H,L-1,H+1,L-1000,H+1000,-5,0,1e9,NaN===1?0:(L+H)/2+0.5,rr(L,H),rr(L,H),rr(L,H),rr(L,H)];
      for(const p of probes){
        U.eval(`setAskX(${p})`);const x=U.eval('askX()');
        chk(Number.isInteger(x)&&x>=L&&x<=H,`setAskX(${p}) range ${lo}-${hi} dir ${dir}: askX=${x} outside ${L}-${H}`);
        if(p>=L&&p<=H&&Number.isInteger(p))chk(x===p,`setAskX(${p}) did not round trip, got ${x} (range ${lo}-${hi} dir ${dir})`);
        const q=J(U,`sliderParts(mv(curTarget()),${x})`),T=hi-lo+1;
        chk(q.T===T,'T wrong');
        chk(q.leftN>=1&&q.leftN<=T-1,`a side is empty: leftN ${q.leftN} of ${T} (range ${lo}-${hi} x ${x} dir ${dir})`);
        chk(q.f>0&&q.f<1,'thumb fraction not strictly inside 0..1');
        // captions partition lo..hi: left = lo..cut-1, right = cut..hi
        const l=nums(q.lt),r=nums(q.rt),lL=l[0],lH=l[l.length-1],rL=r[0],rH=r[r.length-1];
        chk(lL===lo&&rH===hi&&rL===lH+1&&lL<=lH&&rL<=rH,`captions do not partition ${lo}-${hi}: "${q.lt}" | "${q.rt}" (x ${x} dir ${dir})`);
        chk((lH-lL+1)===q.leftN&&(rH-rL+1)===T-q.leftN,'caption sizes disagree with segment sizes');
        // meaning: higher than x => YES is above x; lower than x => YES is below x
        if(dir==='h')chk(q.lc==='no'&&q.rc==='yes'&&lH===x&&rL===x+1,`HIGHER than ${x}: NO must end at x, YES start at x+1 ("${q.lt}"|"${q.rt}")`);
        else chk(q.lc==='yes'&&q.rc==='no'&&lH===x-1&&rL===x,`LOWER than ${x}: YES must end at x-1, NO start at x ("${q.lt}"|"${q.rt}")`);
        tested++;
      }
      // rendered HTML agrees
      const h=U.eval('sliderHTML(mv(curTarget()))'),m=h.match(/flex:(\d+) 1 0/g)||[];
      chk(m.length===2&&m.every(s=>Number(s.match(/\d+/)[0])>0),'slider html has an empty side '+m);
      chk(Number(m[0].match(/\d+/)[0])+Number(m[1].match(/\d+/)[0])===hi-lo+1,'slider html segments do not add up to the range');
      chk(/class="yes/.test(h)&&/class="no/.test(h),'slider html misses YES or NO');
    }
    chk(tested>1000,'too few slider probes');
    // the +/- buttons and middle: askMid is legal
    for(const [lo,hi] of [[1,2],[1,3],[1,100],[7,8],[1,100000]])for(const dir of ['h','l']){
      U.eval(`G.kn[PID].opp={lo:${lo},hi:${hi},x:[]};ui.dir='${dir}';ui.num=''`);
      U.eval('setAskX(askMid(mv(curTarget())))');const x=U.eval('askX()'),L=dir==='l'?lo+1:lo,H=dir==='l'?hi:hi-1;
      chk(x>=L&&x<=H,`askMid out of range ${lo}-${hi} ${dir}: ${x}`);
    }
  }

  /* ---------- (h) fill-in opponent ---------- */
  {
    let prev=-1;
    for(let e=0;e<=3200;e+=10){const s=U.eval(`eloSkill(${e})`);chk(s>=0.1&&s<=0.97,'eloSkill out of bounds at '+e+': '+s);chk(s>=prev,'eloSkill not monotonic at '+e);prev=s}
    chk(U.eval('eloSkill(700)')===0.1&&U.eval('eloSkill(1000)')>U.eval('eloSkill(800)')&&U.eval('eloSkill(1600)')>U.eval('eloSkill(1000)'),'eloSkill does not rise with rating');
    chk(U.eval('eloSkill(1600)')===0.97,'top skill not capped at .97');
    for(const me of [100,130,250,500,780,900,1000,1234,1600,2500,3000])for(let i=0;i<40;i++){
      U.eval(`LS.set(LSK('hl-elo'),${me});G={gid:'fb',pub:1,phase:'lobby',max:100,players:[{pid:PID,a:1}]};addFillBot()`);
      const bot=J(U,'G.players[1]');
      chk(bot.hb===1&&bot.bot===1&&Number.isInteger(bot.el),'fill bot not hidden or without rating');
      chk(Math.abs(bot.el-me)<=80&&bot.el>=100&&bot.el<=3000,`fill bot rating ${bot.el} not within 80 of ${me} (floor 100)`);
      if(me<=300)chk(U.eval(`eloSkill(${bot.el})`)===0.1,'fill bot for a low rated player is not at the weakest skill');
    }
  }
  // botChoose uses the rating: a stronger fill bot splits closer to the middle
  {
    U.eval(`LS.set(LSK('hl-elo'),1000);G={gid:'bc',pub:1,phase:'play',stage:'await',max:100000,turn:1,sub:['*'],q:null,seq:3,bs:0.5,
      players:[{pid:PID,a:1,el:1000},{pid:'bot1',a:1,bot:1,hb:1,el:700},{pid:'bot2',a:1,bot:1,hb:1,el:1700}],kn:{}}`);
    const dev=(who)=>{U.eval(`G.players[${who}].el=${who===1?700:1700}`);let s=0;const N=300;
      for(let i=0;i<N;i++){const q=J(U,`botChoose(G.players[${who}])`);const xs=q.xs;const k=Object.keys(xs);const x=xs[pidU],n=100000;s+=Math.abs((x-1)/n-0.5)}return s/N};
    const pidU=U.eval('PID');const weak=dev(1),strong=dev(2);
    chk(weak>strong+0.05,`weak fill bot (700) splits as centrally (${weak.toFixed(3)}) as strong one (1700: ${strong.toFixed(3)})`);
    chk(strong<0.1,'strong fill bot not close to the middle: '+strong.toFixed(3));
    // a bot without a rating (friends room bots) ignores el
    U.eval('G.pub=0');const q=J(U,'botChoose(G.players[1])');chk(q&&q.xs&&Number.isInteger(q.xs[pidU]),'friends room bot cannot choose');
  }

    /* ---------- (c) matching by mode ---------- */
  const startedH=P=>{try{const s=J(P,'({ph:G&&G.phase,n:G&&G.players.length,h:G?G.players.filter(p=>!p.bot).length:0,code:code,max:G&&G.max,host:isHost,pub:G&&G.pub})');return(s.ph==='secrets'||s.ph==='play')&&s.n===2?s:null}catch(e){return null}};
  async function pair(mA,mB,gap){
    for(const k in hub)delete hub[k];
    const P=phone(),Q=phone();await wait(350);
    P.$('[data-mode="'+mA+'"]').click();Q.$('[data-mode="'+mB+'"]').click();
    P.$('#playBtn').click();await wait(gap||600);Q.$('#playBtn').click();
    const sp=await until(()=>startedH(P),9000),sq=await until(()=>startedH(Q),9000);
    chk(sp&&sq,`pair ${mA}/${mB}: a phone did not start a game ${JSON.stringify([sp,sq])}`);
    chk(!P.errs.length&&!Q.errs.length,`pair ${mA}/${mB} page errors ${P.errs.concat(Q.errs)}`);
    const out={sp,sq};
    await P.eval('leaveGame()');await Q.eval('leaveGame()');
    return out;
  }
  const MAXOF={s:100,m:10000,l:100000};
  for(const m of ['s','m','l']){
    const r=await pair(m,m);
    chk(r.sp.h===2&&r.sq.h===2&&r.sp.code===r.sq.code,`same mode ${m}: phones were not matched together ${JSON.stringify(r)}`);
    chk(r.sp.max===MAXOF[m]&&r.sq.max===MAXOF[m],`same mode ${m}: G.max ${r.sp.max}/${r.sq.max} is not ${MAXOF[m]}`);
    chk(r.sp.pub&&r.sq.pub,'matched game is not public');
  }
  for(const [a,b] of [['s','m'],['m','s'],['m','l'],['s','l']]){
    const r=await pair(a,b);
    chk(r.sp.h===1&&r.sq.h===1&&r.sp.code!==r.sq.code,`different modes ${a}/${b} were matched together ${JSON.stringify(r)}`);
    chk(r.sp.max===MAXOF[a]&&r.sq.max===MAXOF[b],`different modes ${a}/${b}: wrong G.max ${r.sp.max}/${r.sq.max}`);
  }

    /* ---------- (d)(e)(f) a duel against the fill-in opponent ---------- */
  const A=phone({timerMs:1500});await wait(400);
  A.eval("LS.set(LSK('hl-elo'),1200);LS.set(LSK('hl-elo-n'),12)");
  const elo=()=>A.eval('myElo()');
  const lockIn=async()=>{
    for(let i=0;i<40&&!A.$('#lockBtn');i++)await wait(100);
    A.$('#lockBtn')&&A.$('#lockBtn').click();
    return until(()=>A.eval('G&&G.phase')==='play'&&A.eval('G.stage')!=='wheel',15000);
  };
  const startDuel=async()=>{
    A.$('#playBtn').click();
    const ok=await until(()=>A.eval('G&&G.phase')==='secrets'&&A.eval('G.players.length')===2,12000);
    chk(ok,'duel did not start '+A.errs);
    chk(A.eval('G.pub')===1&&A.eval('G.timer')===40,'duel is not public with a 40 s timer');
  };
  A.$('[data-mode="s"]').click();
  // (e1) leaving before play starts costs nothing
  await startDuel();
  let r0=elo(),n0=A.eval('LS.get(LSK("hl-elo-n"))|0');
  A.$('#leaveBtn').click();await wait(150);
  chk(A.eval('view')==='home'&&elo()===r0&&(A.eval('LS.get(LSK("hl-elo-n"))|0'))===n0,'leaving during secrets cost rating '+elo());
  // (e2) mid-game: sheet, keep playing, then leave
  await startDuel();
  chk(await lockIn(),'game did not reach play');
  const opp=J(A,'G.players.find(p=>p.pid!==PID)');
  const wantStake=-expDelta(1200,opp.el,12,false,100);
  chk(A.eval('eloAtStake()')===wantStake&&wantStake>0,`stake ${A.eval('eloAtStake()')} != expected ${wantStake}`);
  // the 40 s clock on my turn
  const mine=await until(()=>A.eval('G.phase==="play"&&G.stage==="await"&&!G.q&&G.players[G.turn].pid===PID'),20000);
  if(mine){await wait(300);const tl=A.eval('timerLeft()');chk(tl!==null&&tl>=38&&tl<=40,'timer pill on my turn should read about 40, got '+tl);
    chk(A.$('.tclock b')&&Number(A.$('.tclock b').textContent)>=38,'timer clock not shown');
    const sq0=A.eval('G.seq');
    const auto=await until(()=>A.eval('(G.q&&G.q.a===PID)||G.seq>'+sq0),6000);chk(auto,'timeout did not ask for the slow player')}
  else console.error('NOTE never got a turn to check the clock');
  const gid=A.eval('G.gid'),stake=A.eval('eloAtStake()');
  {const pd=A.eval("LS.get(LSK('hl-pend'))");chk(pd&&pd.gid===gid&&pd.stake===stake,'no pending record while a rated duel is in play '+JSON.stringify(pd))}
  A.$('#leaveBtn').click();await wait(200);
  chk(A.$('#stayBtn')&&A.$('#quitBtn'),'no confirmation sheet when leaving a rated duel');
  chk(Number(A.$('.stake b').textContent)===stake,'sheet shows '+A.$('.stake b').textContent+' but the stake is '+stake);
  chk(!/-|−/.test(A.$('.stake').textContent),'stake text should be a positive amount');
  r0=elo();
  A.$('#stayBtn').click();await wait(200);
  chk(!A.$('#stayBtn')&&A.eval('G&&G.gid')===gid&&A.eval('view')==='game'&&elo()===r0,'Keep playing did not keep the game');
  A.$('#leaveBtn').click();await wait(200);A.$('#quitBtn').click();await wait(500);
  chk(A.eval('view')==='home'&&A.eval('G')===null,'Leave did not go home');
  chk(elo()===r0-stake,`leaving cost ${r0-elo()} but the sheet said ${stake}`);
  chk(A.eval('LS.get(LSK("hl-elo-n"))')===n0+1&&A.eval('LS.get(LSK("hl-elo-g"))')===gid,'leaving did not count exactly one game');
  chk(A.eval('eloLast.d')===-stake,'eloLast mismatch');
  chk(A.eval("LS.get(LSK('hl-pend'))")===null,'Leave sheet did not clear the pending record');
  // (e3) knocked out: no stake, no loss
  await startDuel();chk(await lockIn(),'game 3 did not reach play');
  r0=elo();A.eval('byPid(PID).a=0');
  chk(A.eval('eloAtStake()')===0,'stake while knocked out');
  A.$('#leaveBtn').click();await wait(200);
  chk(A.$('#quitBtn')&&!A.$('.stake'),'leaving after being knocked out should show confirmation without a rating warning');
  A.$('#quitBtn').click();await wait(400);
  chk(A.eval('view')==='home'&&elo()===r0,'leaving after knock out cost rating '+(r0-elo()));
  // (d)(f) forced results: win
  async function finish(win){
    await startDuel();chk(await lockIn(),'result game did not reach play');
    const before=elo(),op=J(A,'G.players.find(p=>p.pid!==PID)'),n=A.eval('LS.get(LSK("hl-elo-n"))|0');
    A.eval(`G.phase='over';G.win=${win?'PID':'G.players.find(p=>p.pid!==PID).pid'};publishG()`);
    const sheet=await until(()=>A.$('.elo-res'),6000);
    chk(sheet,'result sheet shows no rating change');
    const want=expDelta(before,op.el,n,win,100);
    chk(elo()===before+want,`rated ${elo()-before} want ${want}`);
    const txt=A.$('.elo-res .d').textContent;
    chk(txt===(want>=0?'+':'−')+Math.abs(want),`sheet shows "${txt}" for a change of ${want}`);
    chk(A.$('.elo-res b').textContent===String(elo()),'sheet shows the wrong new rating');
    chk(A.$('.elo-res').classList.contains(want>=0?'up':'down'),'sheet colour class wrong');
    chk(A.$('#againBtn')&&A.$('#ovX'),'result sheet misses Play again or X');
    await wait(1200);chk(elo()===before+want,'rating changed again while the sheet is open');
    return {before,want};
  }
  let f=await finish(true);
  A.$('#ovX').click();await wait(800);
  chk(A.eval('view')==='home'&&elo()===f.before+f.want,'X did not return home with the rating kept');
  chk(!A.$('#ov').innerHTML.trim()||A.$('#ov').hidden,'sheet still open after X');
  f=await finish(false);
  chk(f.want<0,'loss gave a non negative change');
  // Play again: leaves, starts a new game with a new id, no extra change
  const gidOld=A.eval('G.gid'),rAfter=elo();
  A.$('#againBtn').click();
  const again=await until(()=>A.eval('G&&G.pub===1&&G.phase')==='secrets'&&A.eval('G.gid')!==gidOld,12000);
  chk(again,'Play again did not start a new duel');
  chk(elo()===rAfter,'Play again changed the rating');
  chk(A.eval('G.max')===100,'Play again changed the mode');
  await A.eval('leaveGame()');
  chk(elo()===rAfter,'leaving the second game before play cost rating');
  chk(!A.errs.length,'page errors in duel phone '+A.errs.join('|'));

    /* ---------- (d) a friends room game never changes rating ---------- */
  const B=phone();await wait(400);
  B.eval("LS.set(LSK('hl-elo'),1200);LS.set(LSK('hl-elo-n'),12)");
  B.eval('startSolo(false)');await wait(300);
  B.eval('G.players.pop()');// two players, but not public
  chk(B.eval('G.players.length')===2&&!B.eval('G.pub'),'friends game set up');
  B.eval('hostStart()');
  B.eval('for(const p of G.players)if(p.bot)botSecrets[p.pid]=5;mySecret={gid:G.gid,n:7};G.phase="play";G.stage="await"');
  chk(B.eval('eloAtStake()')===0,'friends room has a stake');
  B.eval('G.phase="over";G.win=PID;publishG()');await wait(600);
  chk(B.eval('myElo()')===1200&&B.eval('LS.get(LSK("hl-elo-g"))')===null,'friends game result changed the rating');
  B.eval('G.phase="over";G.win="x"');await wait(300);
  chk(B.eval('myElo()')===1200,'friends game loss changed the rating');
  B.eval('G.phase="play"');B.$('#leaveBtn')&&B.$('#leaveBtn').click();await wait(200);
  chk(B.$('#quitBtn')&&!B.$('.stake'),'friends room should show confirmation without a rating warning');
  B.$('#quitBtn').click();await wait(200);
  chk(B.eval('view')==='home'&&B.eval('myElo()')===1200,'leaving a friends game should return home without changing rating');
  chk(!B.errs.length,'page errors in friends phone '+B.errs.join('|'));

  /* ---------- (i) quit-dodge, opponent leaves, floor, clamp ---------- */
  {
    const play=`G={gid:'pg1',pub:1,phase:'play',stage:'await',max:100,turn:0,sub:[],q:null,seq:1,players:[{pid:PID,a:1,el:1000},{pid:'opp',a:1,el:1000}],kn:{}};eloPlayGid='pg1';eloRoom='';`;
    U.eval(`LS.set(LSK('hl-elo'),1000);LS.set(LSK('hl-elo-n'),12);LS.del(LSK('hl-elo-g'));LS.del(LSK('hl-pend'));${play}`);
    U.eval('eloPend()');
    const pd=J(U,"LS.get(LSK('hl-pend'))");
    chk(pd&&pd.gid==='pg1'&&pd.stake===14,'pending record not written for a rated duel in play '+JSON.stringify(pd));
    // killed app: a fresh launch with the record present takes the loss once and flashes it
    U.eval('G=null;view="home";mode=null');U.eval('eloPendBoot()');
    chk(U.eval('myElo()')===986&&U.eval("LS.get(LSK('hl-elo-n'))")===13&&U.eval("LS.get(LSK('hl-elo-g'))")==='pg1','quit-dodge loss not applied once');
    chk(U.eval("LS.get(LSK('hl-pend'))")===null,'pending record kept after launch');
    chk(U.eval('eloFlash')===-14&&/elo-fl down">−14</.test(U.eval('eloPill()')),'home pill does not show −14');
    U.eval('eloPendBoot()');chk(U.eval('myElo()')===986,'second launch applied again');
    U.eval("LS.set(LSK('hl-pend'),{gid:'pg1',stake:14,at:1})");U.eval('eloPendBoot()');chk(U.eval('myElo()')===986,'same game id applied twice');
    // already applied through the Leave sheet: nothing left behind to apply
    U.eval(`LS.set(LSK('hl-elo'),1000);LS.del(LSK('hl-elo-g'));${play.replace(/pg1/g,'pg2')}eloPend();eloApply(false);G.phase='over';pendClear(G.gid)`);
    chk(U.eval("LS.get(LSK('hl-pend'))")===null,'pending record survives a normal result');
    // never for friends rooms, games that ended, knocked out players, or the other room
    for(const [lab,patch] of [['friends room','G.pub=0'],['ended game',"G.phase='over'"],['knocked out','byPid(PID).a=0'],['practice 3 players',"G.players.push({pid:'x',a:1})"]]){
      U.eval(`LS.set(LSK('hl-elo'),1000);LS.del(LSK('hl-elo-g'));LS.del(LSK('hl-pend'));${play.replace(/pg1/g,'pg3')}${patch};eloPend()`);
      chk(U.eval("LS.get(LSK('hl-pend'))")===null,'pending record written for '+lab);
    }
    U.eval(`${play.replace(/pg1/g,'pg4')}eloPend();byPid(PID).a=0;eloPend()`);
    chk(U.eval("LS.get(LSK('hl-pend'))")===null,'knocked out player keeps a pending record');
    // host lost / host left: leaveGame clears it without a cost
    U.eval(`LS.set(LSK('hl-elo'),1000);LS.del(LSK('hl-elo-g'));${play.replace(/pg1/g,'pg5')}eloPend();eloSkip=true`);
    await U.eval('leaveGame()');
    chk(U.eval("LS.get(LSK('hl-pend'))")===null&&U.eval('myElo()')===1000,'host-lost path kept the record or cost rating');
    // junk record
    U.eval("LS.set(LSK('hl-pend'),{gid:{},stake:1e9})");U.eval('eloPendBoot()');chk(U.eval('myElo()')===1000&&U.eval("LS.get(LSK('hl-pend'))")===null,'junk record applied');
    U.eval("LS.set(LSK('hl-pend'),{gid:'pg9',stake:9999})");U.eval('eloPendBoot()');chk(U.eval('myElo()')>=920,'stake not capped at 80');
    // floor: a loss at 100 shows a neutral 0
    rate(U,{me:100,oe:100,won:false,max:100,gid:'fl'});
    chk(U.eval('myElo()')===100&&U.eval('eloLast.d')===0,'floor loss changed rating');
    const fh=U.eval('eloResultHTML()');
    chk(/class="d">0</.test(fh)&&!/elo-res (up|down)/.test(fh)&&!/\+0|−0/.test(fh),'floor loss does not show a plain 0: '+fh);
    // opponent claim clamped to +-300
    chk(rate(U,{me:1000,oe:100,won:true,max:100,n:20})===expDelta(1000,700,20,true,100)&&expDelta(1000,700,20,true,100)===Math.round(28*(1-1/(1+Math.pow(10,-300/400)))),'claimed 100 rating not clamped in a win');
    chk(rate(U,{me:1000,oe:100,won:false,max:100,n:20})===-1||rate(U,{me:1000,oe:100,won:false,max:100,n:20})===expDelta(1000,700,20,false,100),'loss vs claimed 100 not clamped');
    chk(rate(U,{me:1000,oe:3000,won:false,max:100,n:20})===expDelta(1000,1300,20,false,100),'claimed 3000 rating not clamped');
    U.eval(`LS.set(LSK('hl-elo'),1000);LS.set(LSK('hl-elo-n'),20);LS.del(LSK('hl-elo-g'));${play.replace(/pg1/g,'pg6').replace("el:1000},{pid:'opp',a:1,el:1000}","el:1000},{pid:'opp',a:1,el:100}")}`);
    chk(U.eval('eloAtStake()')===-expDelta(1000,100,20,false,100),'stake does not use the clamped rating');
  }
  // opponent leaves mid-duel: the one who stays wins, the one who leaves loses, once each
  for(const leaverHost of [false,true]){
    for(const k in hub)delete hub[k];
    const P=phone(),Q=phone();await wait(350);
    for(const W of [P,Q]){W.eval("LS.set(LSK('hl-elo'),1000);LS.set(LSK('hl-elo-n'),0);eloLast=null");W.$('[data-mode="s"]').click()}
    P.$('#playBtn').click();await wait(600);Q.$('#playBtn').click();
    const both=await until(()=>[P,Q].every(W=>W.eval('G&&G.phase')==='secrets'&&W.eval('G.players.length')===2),10000);
    chk(both,'leave test: pair did not start');
    for(const W of [P,Q]){for(let i=0;i<40&&!W.$('#lockBtn');i++)await wait(100);W.$('#lockBtn')&&W.$('#lockBtn').click()}
    const inPlay=await until(()=>[P,Q].every(W=>W.eval("!!(G&&G.phase==='play'&&G.stage!=='wheel')")),20000);
    chk(inPlay,'leave test: duel did not reach play');
    const L=P.eval('isHost')===leaverHost?P:Q,S=L===P?Q:P;
    chk(L.eval('isHost')===leaverHost,'leave test: roles');
    await wait(300);
    chk(L.eval("LS.get(LSK('hl-pend'))!==null")&&S.eval("LS.get(LSK('hl-pend'))!==null"),'leave test: both phones should hold a pending record');
    const stayerGame=S.eval('G.gid');
    L.$('#leaveBtn').click();await wait(200);L.$('#quitBtn')&&L.$('#quitBtn').click();
    await until(()=>L.eval('view')==='home',4000);
    const won=await until(()=>S.eval('myElo()')>1000,8000);
    chk(won,'the player who stayed got no win credit (leaver was '+(leaverHost?'host':'joiner')+')');
    chk(S.eval('myElo()')===1020&&L.eval('myElo()')===980,`ratings after leave: stayer ${S.eval('myElo()')} leaver ${L.eval('myElo()')}`);
    chk(S.eval("LS.get(LSK('hl-elo-g'))")===stayerGame&&S.eval("LS.get(LSK('hl-pend'))")===null&&L.eval("LS.get(LSK('hl-pend'))")===null,'leave test: game id or pending record wrong');
    if(leaverHost)chk(S.eval('eloFlash')===20||S.eval('myElo()')===1020,'joiner got no win');
    else chk(await until(()=>S.$('.elo-res .d')&&S.$('.elo-res .d').textContent==='+20',6000),'host stayer sees no win sheet');
    await wait(1500);
    chk(S.eval('myElo()')===1020&&L.eval('myElo()')===980&&S.eval("LS.get(LSK('hl-elo-n'))")===1&&L.eval("LS.get(LSK('hl-elo-n'))")===1,'leave test: rating applied more than once');
    await S.eval('leaveGame()');chk(S.eval('myElo()')===1020,'stayer leaving afterwards changed the rating');
    chk(!P.errs.length&&!Q.errs.length,'leave test page errors '+P.errs.concat(Q.errs));
  }

  /* e01: integration guards (single page, no network) */
  {
    const U2=phone();await wait(400);
    const setG=(me)=>U2.eval(`(()=>{LS.set(LSK('hl-elo'),1000);LS.set(LSK('hl-elo-n'),0);LS.del(LSK('hl-elo-g'));LS.del(LSK('hl-pend'));eloRoom='';pmSel='s';view='game';mode='online';isPub=true;
      G={gid:'e01g',pub:1,phase:'play',max:100,stage:'await',seq:1,turn:0,players:[{pid:PID,name:'Me',a:1,el:1000${me},c:0},{pid:'opp',name:'Op',a:1,el:1000,c:1}]};eloPlayGid='e01g'})()`);
    // the other phone dropped off the network, host side: an earlier pending record must go, a kill now is not a dodge
    setG('');U2.eval("isHost=true;connected=true;peerMap=new Map();LS.set(LSK('hl-pend'),{gid:'e01g',stake:10,at:1});eloPend()");
    chk(U2.eval("LS.get(LSK('hl-pend'))")===null,'pending-loss record kept while the opponent is vanished');
    // my seat was taken over by a bot while I was away, then the host leaves: no win for me
    setG(',bot:1');U2.eval("isHost=false;peerMap=new Map([['h',{pres:{role:'host',gone:1,game:{}},updatedAt:1}]]);update()");
    chk(U2.eval('myElo()')===1000&&U2.eval("LS.get(LSK('hl-elo-g'))")===null,'a replaced player got win credit when the host left');
    // A queued rematch must not start if an independent leave superseded it.
    await wait(300);
    await U2.eval("(async()=>{G={gid:'e01h',pub:1,phase:'over',max:100,players:[{pid:PID,name:'Me',a:1},{pid:'opp',name:'Op',a:1}]};view='game';mode='online';let finish;R={leave(){if(finish)return Promise.resolve();return new Promise(r=>{finish=r})}};const rematch=playAgain();await leaveGame();finish();await rematch})()");
    chk(U2.eval("mode")!=='search'&&U2.eval("view")==='home','Play again searched after an independent leave superseded the rematch');
    chk(!U2.errs.length,'integration guard page errors '+U2.errs);
  }
  console.log(`PASS duel (${checks} checks)`);process.exit(0);
})().catch(e=>{console.log('FAIL duel: exception '+(e&&e.stack||e));process.exit(0)});
