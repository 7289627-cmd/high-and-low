/* ---------- Come-back loop (flag: streak). Win streak, 7-day dots, first win of the day pays double. ---------- */
const stOn=()=>!!(window.HL_FLAGS&&window.HL_FLAGS.streak);
function stDay(back){
  const d=new Date(window.HL_TEST_NOW||Date.now());d.setHours(12,0,0,0);d.setDate(d.getDate()-(back|0));
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function stWins(){const n=LS.get(LSK('hl-st-ws'));return Number.isInteger(n)&&n>0?n:0}
function stDays(){const a=LS.get(LSK('hl-st-days'));return Array.isArray(a)?a.filter(x=>typeof x==='string'):[]}
function stDayStreak(){const a=stDays();let n=0,i=a.includes(stDay(0))?0:1;while(a.includes(stDay(i))){n++;i++}return n}
/* Called once per finished or abandoned rated duel. done=true when the game was played to the end. */
function stGame(won,done){
  try{
    if(!stOn()||!G||!G.pub||G.players.length!==2||!byPid(PID))return;
    if(LS.get(LSK('hl-st-g'))===G.gid)return;
    LS.set(LSK('hl-st-g'),G.gid);
    LS.set(LSK('hl-st-ws'),won?stWins()+1:0);
    if(done){const a=stDays(),t=stDay(0);if(!a.includes(t)){a.push(t);LS.set(LSK('hl-st-days'),a.slice(-14))}}
  }catch(e){}
}
/* Coins for a win: 10 the first time each local day, else 5. Marks the day as used. */
function stWinCoins(){
  if(!stOn())return 5;
  const t=stDay(0);if(LS.get(LSK('hl-st-bd'))===t)return 5;
  LS.set(LSK('hl-st-bd'),t);return 10;
}
const stFlame=()=>{const n=stWins();return n>=2?`<span class="st-flame" aria-label="${uiHTML('{count} wins in a row',{count:fmt(n)})}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6.500 6 12.500A6 6 0 0 1 6 14.500c0-2.500 1.200-4 2.500-5 .2 1.800.9 2.800 1.800 3.200C9.500 8.500 10.500 5 12 2z" fill="#F0503C" stroke="#1E2240" stroke-width="2" stroke-linejoin="round"/><path d="M12 22a3.500 3.500 0 0 1-3.500-3.500c0-2 2-3 3.500-5 1.500 2 3.500 3 3.500 5A3.500 3.500 0 0 1 12 22z" fill="#FFD23F" stroke="#1E2240" stroke-width="1.500" stroke-linejoin="round"/></svg><b>${n}</b></span>`:''};
const stSunSVG=s=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><g stroke="#1E2240" stroke-width="2.500" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></g><circle cx="12" cy="12" r="5" fill="#fff" stroke="#1E2240" stroke-width="2.500"/></svg>`;
/* Home: wraps the rating pill with the flame beside it and the 7 dots under it. */
function stPillRow(pill){
  if(!stOn())return pill;
  const a=stDays();let dots='';
  for(let i=6;i>=0;i--)dots+=`<i class="${a.includes(stDay(i))?'on':''}"></i>`;
  return `<div class="st-row">${pill}${stFlame()}</div><div class="st-dots" aria-hidden="true">${dots}</div>`;
}
const stSheet=()=>stOn()&&stFlame()?`<div class="st-sheet">${stFlame()}</div>`:'';
