/* ---------- Anonymous play stats ----------
   One row per event in the Supabase table "events". No names, no room codes, no free text.
   sid is a random id kept on this device so repeat visits can be counted. */
const TRACK_V=1;
let trackSid=null,trackT0=0,trackGame=null;
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
      body:JSON.stringify({ev,sid:trackId(),props:Object.assign({v:TRACK_V},props||{})})}).catch(()=>{});
  }catch(e){}
}
function trackKind(){return typeof isPub!=='undefined'&&isPub?'play':(mode==='solo'?'practice':'friends')}
function trackCounts(){const ps=(G&&G.players)||[];return{n:ps.length,bots:ps.filter(p=>p.bot).length}}
// called from update(): notices a game starting and ending on this phone
function trackTick(){
  try{
    if(!G){return}
    if(G.phase==='play'&&trackGame!==G.gid){trackGame=G.gid;trackT0=Date.now();track('game_start',Object.assign({kind:trackKind(),max:G.max},trackCounts()))}
    if(G.phase==='over'&&trackGame===G.gid){trackGame=G.gid+':done';track('game_end',Object.assign({kind:trackKind(),secs:Math.round((Date.now()-trackT0)/1000),won:G.win===PID?1:0},trackCounts()))}
  }catch(e){}
}
function trackLeave(){
  try{if(G&&trackGame===G.gid&&G.phase==='play')track('leave',{kind:trackKind(),secs:Math.round((Date.now()-trackT0)/1000)});trackGame=null}catch(e){}
}
