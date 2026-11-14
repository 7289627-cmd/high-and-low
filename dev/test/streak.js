const {JSDOM}=require('jsdom');const fs=require('fs');
const raw=fs.readFileSync('/home/claude/hl/site/index.html','utf8').replace(/<script src="[^"]*"><\/script>/g,'').replace(/<link [^>]*>/g,'');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let bad=[];const ck=(c,m)=>{if(!c)bad.push(m)};
function phone(hash){
  const dom=new JSDOM(raw.replace(/<script>window\.HL_CONFIG=[^<]*<\/script>/,''),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/p'+hash,beforeParse(w){w.HL_NEED_NET=1}});
  const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));return w;
}
const keys=w=>{const o={};for(let i=0;i<w.localStorage.length;i++){const k=w.localStorage.key(i);o[k]=w.localStorage.getItem(k)}return o};
const stKeys=w=>Object.keys(keys(w)).filter(k=>k.startsWith('hl-st-'));
// one rated duel: play=true finishes it, false = leave mid-game
const game=(w,gid,won,done)=>w.eval(`G={pub:1,gid:${JSON.stringify(gid)},players:[{pid:PID},{pid:'o'}]};stGame(${won},${done});`);
const day=(w,iso)=>w.eval(`window.HL_TEST_NOW=new Date(${JSON.stringify(iso)}).getTime()`);
(async()=>{
  // 1) flag off: nothing stored, nothing drawn
  let A=phone('');await wait(300);
  const before=JSON.stringify(keys(A));const html0=A.document.querySelector('#app').innerHTML;
  ck(A.eval('window.HL_FLAGS.streak')===false,'flag default not false');
  game(A,'g1',true,true);game(A,'g2',false,false);
  A.eval('pwEarn()');ck(A.eval('myCoins()')===5&&A.eval('window.__pwWon')===5,'off: coins not 5');
  A.eval('render(true)');
  const after=keys(A);delete after['hl-coins'];const b2=JSON.parse(before);delete b2['hl-coins'];
  ck(stKeys(A).length===0,'off: hl-st- keys written '+stKeys(A));
  ck(JSON.stringify(after)===JSON.stringify(b2),'off: storage changed');
  ck(!A.document.querySelector('.st-row,.st-dots,.st-flame,.st-sheet'),'off: DOM has streak nodes');
  ck(A.eval('stPillRow("P")')==='P'&&A.eval('stSheet()')==='','off: helpers not inert');
  ck(!/st-sun|<circle cx="12" cy="12" r="5"/.test(A.eval('window.__pwWon=5,pwWinBlock()')),'off: sun shown');
  A.close();
  // 2) flag on via hash, persists, clears
  A=phone('#flags=streak');await wait(300);
  ck(A.eval('HL_FLAGS.streak')===true,'hash did not turn flag on');
  ck(A.localStorage.getItem('hl-flags')==='streak','flag not persisted');
  const A2=new (require('jsdom').JSDOM)(raw.replace(/<script>window\.HL_CONFIG=[^<]*<\/script>/,''),{runScripts:'dangerously',url:'https://x.test/p',beforeParse(w){w.HL_NEED_NET=1;w.localStorage.setItem('hl-flags','streak')}}).window;
  await wait(200);ck(A2.eval('HL_FLAGS.streak')===true,'stored flag not read');A2.close();
  const B=new (require('jsdom').JSDOM)(raw.replace(/<script>window\.HL_CONFIG=[^<]*<\/script>/,''),{runScripts:'dangerously',url:'https://x.test/p#flags=',beforeParse(w){w.HL_NEED_NET=1;w.localStorage.setItem('hl-flags','streak')}}).window;
  await wait(200);ck(B.eval('HL_FLAGS.streak')===false&&B.localStorage.getItem('hl-flags')===null,'#flags= did not clear');B.close();
  // 3) win/loss sequences
  day(A,'2026-03-10T10:00:00');
  game(A,'a',true,true);ck(A.eval('stWins()')===1,'w1');
  ck(!A.document.querySelector('.st-flame')&&A.eval('stSheet()')==='','badge shown at 1');
  game(A,'b',true,true);ck(A.eval('stWins()')===2,'w2');
  game(A,'b',true,true);ck(A.eval('stWins()')===2,'same gid counted twice');
  game(A,'b',false,true);ck(A.eval('stWins()')===2,'same gid loss counted after win');
  ck(/st-flame/.test(A.eval('stSheet()'))&&/<b>2<\/b>/.test(A.eval('stSheet()')),'badge missing at 2');
  game(A,'c',true,true);ck(A.eval('stWins()')===3,'w3');
  game(A,'d',false,true);ck(A.eval('stWins()')===0,'loss did not reset');
  game(A,'e',true,true);game(A,'f',true,true);ck(A.eval('stWins()')===2,'rebuild');
  game(A,'g',false,false);ck(A.eval('stWins()')===0,'leave did not reset');
  const dn=JSON.parse(A.localStorage.getItem('hl-st-days'));
  ck(dn.length===1&&dn[0]==='2026-03-10','leave/loss duplicated or day list wrong '+dn);
  // leave mid-game alone does not mark the day
  day(A,'2026-03-11T10:00:00');game(A,'h',false,false);
  ck(JSON.parse(A.localStorage.getItem('hl-st-days')).length===1,'a quit marked the day');
  // 4) day rollover
  A.localStorage.removeItem('hl-st-days');
  const plays=['2026-03-01T23:50:00','2026-03-02T00:10:00','2026-03-03T09:00:00','2026-03-03T21:00:00','2026-03-05T08:00:00','2026-03-06T08:00:00','2026-03-07T08:00:00','2026-03-08T08:00:00'];
  plays.forEach((t,i)=>{day(A,t);game(A,'r'+i,true,true)});
  day(A,'2026-03-08T20:00:00');ck(A.eval('stDayStreak()')===4,'day streak 4 expected got '+A.eval('stDayStreak()'));
  day(A,'2026-03-09T20:00:00');ck(A.eval('stDayStreak()')===4,'streak should still be alive the next day (not yet played) got '+A.eval('stDayStreak()'));
  day(A,'2026-03-10T20:00:00');ck(A.eval('stDayStreak()')===0,'streak should be broken after a skipped day');
  day(A,'2026-03-08T20:00:00');
  A.eval('render(true)');
  const on=[...A.document.querySelectorAll('.st-dots i')].map(i=>i.classList.contains('on')?1:0).join('');
  ck(A.document.querySelectorAll('.st-dots i').length===7,'7 dots expected');
  // last 7 days ending 03-08 are 02..08; 04 was skipped
  ck(on==='1101111','dot pattern '+on);
  // 5) double coins once per day
  A.localStorage.removeItem('hl-coins');A.localStorage.removeItem('hl-st-bd');
  day(A,'2026-04-01T09:00:00');A.eval('pwEarn()');ck(A.eval('myCoins()')===10,'first win not 10');
  ck(/\+10 coins/.test(A.eval('pwWinBlock()')),'sheet not +10');
  day(A,'2026-04-01T23:59:00');A.eval('pwEarn()');ck(A.eval('myCoins()')===15,'second win same day not 5');
  ck(/\+5 coins/.test(A.eval('pwWinBlock()')),'sheet not +5');
  day(A,'2026-04-02T00:01:00');A.eval('pwEarn()');ck(A.eval('myCoins()')===25,'next day not 10 again');
  // sheet shows sun only when doubled
  A.eval('window.__pwWon=10');ck(/<circle cx="12" cy="12" r="5"/.test(A.eval('pwWinBlock()')),'sun missing on double');
  A.eval('window.__pwWon=5');ck(!/<circle cx="12" cy="12" r="5"/.test(A.eval('pwWinBlock()')),'sun on normal');
  // coins via a real win: countWin once per game
  A.localStorage.removeItem('hl-coins');A.localStorage.removeItem('hl-st-bd');
  A.eval('G={pub:1,gid:"cw",en:1,win:PID,players:[{pid:PID},{pid:"o"}]};countWin();countWin()');
  ck(A.eval('myCoins()')===10,'countWin twice paid '+A.eval('myCoins()'));
  ck(A.errs.length===0,'page errors '+A.errs);
  A.close();
  console.log(bad.length?'FAIL streak: '+bad.join(' | '):'PASS streak');process.exit(0);
})();
