/* ---------- Anonymous play stats ----------
   One row per event in the Supabase table "events". No names, no room codes, no free text.
   sid is a random id kept on this device so repeat visits can be counted. */
const TRACK_V=1;
/* Build code, sent as props.b on every event. Bump it on each release (one place). Short code: letters, digits, dot. */
const HL_VER='2611.1';
let trackSid=null,trackT0=0,trackGame=null,trackQ0=0,trackW=null;
function trackId(){
  if(trackSid)return trackSid;
  let s=null;try{s=localStorage.getItem('hl-sid')}catch(e){}
  if(!s||!/^[a-z0-9]{12}$/.test(s)){s='';const a='abcdefghijklmnopqrstuvwxyz0123456789';for(let i=0;i<12;i++)s+=a[Math.floor(Math.random()*36)];try{localStorage.setItem('hl-sid',s)}catch(e){}}
  return trackSid=s;
}
function track(ev,props){
  try{
    const c=window.HL_CONFIG;
    if(!c||!c.url||!/^https:\/\//.test(c.url)||typeof fetch!=='function'||window.HL_NO_TRACK)return;
    if(/[#&]player=/.test(location.hash))return; // test tabs
    fetch(c.url+'/rest/v1/events',{method:'POST',keepalive:true,
      headers:{'apikey':c.key,'Authorization':'Bearer '+c.key,'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify({ev,sid:trackId(),props:Object.assign({v:TRACK_V,b:HL_VER},props||{})})}).catch(()=>{});
  }catch(e){}
}
function trackKind(){return typeof isPub!=='undefined'&&isPub?'play':(mode==='solo'?'practice':'friends')}
// Play mode code s/m/l from the range (matches MODES in rating.js)
function trackMode(max){return max===100?'s':max===10000?'m':max===100000?'l':null}
// 'x' rounded to the nearest 100 (rating bucket)
function trackBucket(e){return Number.isInteger(e)?Math.round(e/100)*100:null}
// Play search started (quickPlay) or ended (leave/cancel)
function trackSearchStart(){trackQ0=Date.now();trackW=null}
function trackCounts(){const ps=(G&&G.players)||[];return{n:ps.length,bots:ps.filter(p=>p.bot).length}}
// called from update(): notices a game starting and ending on this phone
function trackTick(){
  try{
    if(!G){return}
    // seconds from tapping Play until a second player (real or fill-in) is in the room
    if(trackQ0&&G.pub&&G.players.length>=2){trackW=Math.min(999,Math.round((Date.now()-trackQ0)/1000));trackQ0=0}
    if(G.phase==='play'&&trackGame!==G.gid){trackGame=G.gid;trackT0=Date.now();
      const o=Object.assign({kind:trackKind(),m:trackMode(G.max)},trackCounts());if(G.pub&&trackW!==null)o.w=trackW;
      track('game_start',o)}
    if(G.phase==='over'&&trackGame===G.gid){trackGame=G.gid+':done';
      const o=Object.assign({kind:trackKind(),m:trackMode(G.max),secs:Math.round((Date.now()-trackT0)/1000),t:Math.min(999,G.turnNo||0),won:G.win===PID?1:0},trackCounts());
      track('game_end',o)}
  }catch(e){}
}
function trackLeave(){
  try{
    if(G&&trackGame===G.gid&&G.phase==='play')track('leave',{kind:trackKind(),m:trackMode(G.max),secs:Math.round((Date.now()-trackT0)/1000),t:Math.min(999,G.turnNo||0)});
    else if(trackQ0)track('qleave',{m:trackMode(playMode().max),w:Math.min(999,Math.round((Date.now()-trackQ0)/1000))}); // gave up while finding a match
    trackGame=null;trackQ0=0;trackW=null;
  }catch(e){}
}
