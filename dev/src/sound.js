/* ---------- Sound (recorded sfx, lazy AudioContext) ---------- */
const SFX={
  KEYS:['key','del','pick','land','send','yes','nope','yourturn','tick','spin','wheelland','lock','join','leave','hint','error','bonk','zap','pop','heart','babble1','babble2','babble3','win','vo_ready','vo_go','vo_youwin','vo_gameover','vo_final','vo_hurry','vo_timeover','vo_wrong','d_piano','d_slam','d_ding','d_fuse','k_clang','k_ring','k_slam','k_rattle','k_boing','k_boing2','k_yelp','k_eat1','k_eat2','k_eat3','k_burp','k_boom','k_crack','k_explode','k_launch','k_crackle','k_popbang','k_zap','k_splash','k_gloop','k_gloop2','k_bubble','k_plop','k_squeak','k_crunch','k_paper','k_woosh','k_whoop','k_sizzle'],
  muted:false,ctx:null,master:null,buf:{},
  GAIN:{
    /* TAP -28 LUFS */key:0.33,del:0.41,tick:0.44,pick:1.12,babble1:0.62,babble2:0.75,babble3:0.25,heart:0.31,hint:0.45,lock:0.54,
    /* UI -25 LUFS */join:0.34,leave:0.36,yourturn:0.21,send:0.37,land:0.60,spin:0.79,
    /* FOLEY -23 LUFS */k_squeak:0.97,k_plop:0.88,k_paper:0.69,k_gloop:0.60,k_gloop2:0.86,k_bubble:0.65,k_splash:0.66,k_woosh:0.99,k_whoop:0.90,k_sizzle:0.60,k_rattle:0.29,k_boing:0.39,k_boing2:1.27,k_ring:0.66,k_crackle:1.26,k_launch:0.86,k_zap:0.90,d_fuse:0.43,d_ding:0.33,d_piano:1.27,k_eat1:0.71,k_eat2:0.63,k_eat3:0.67,k_burp:0.33,
    /* ANSWER -22 LUFS */yes:0.50,nope:0.78,error:0.80,wheelland:0.42,
    /* CREATURE -21 LUFS */k_yelp:0.45,
    /* STING -21 LUFS */win:0.41,
    /* VO -20 LUFS */vo_ready:0.59,vo_go:0.58,vo_youwin:0.62,vo_gameover:0.60,vo_final:0.78,vo_hurry:0.59,vo_timeover:0.54,vo_wrong:0.56,
    /* IMPACT -19 LUFS */bonk:0.94,pop:0.94,zap:1.27,d_slam:1.30,k_clang:0.47,k_slam:1.27,k_boom:1.01,k_crack:0.98,k_explode:0.92,k_popbang:1.26,k_crunch:0.90
  },
  MAXVOICES:10,DEDUPE:0.035,voices:[],starts:{},
  // iOS Capacitor serves local MP3s with a non-HTTP URLResponse. WebKit can
  // report status 0 / ok false for that readable response, despite its data.
  readAsset(r,path){
    if(!r||r.type==='opaque'||r.type==='opaqueredirect')throw new Error('unreadable audio response');
    let local=false;
    try{
      const loc=window.location, requested=new URL(path,loc.href), delivered=new URL(r.url||path,loc.href);
      local=loc.protocol==='capacitor:'&&loc.hostname==='localhost'&&
        requested.protocol==='capacitor:'&&requested.host===loc.host&&delivered.href===requested.href;
    }catch(e){}
    if(!r.ok&&!(r.status===0&&local))throw new Error('audio request failed');
    return r.arrayBuffer().then(b=>{if(!b||!b.byteLength)throw new Error('empty audio');return b});
  },
  play(key,opts){
    try{
      if(SFX.muted||!SFX.ctx||!SFX.buf[key])return;
      const o=opts||{},rate=o.rate||1,vol=o.vol==null?1:o.vol,delay=o.delay||0;
      const c=SFX.ctx,now=c.currentTime,t=now+delay,buf=SFX.buf[key];
      // anti-stacking 1: the same key starting within 35 ms of one already scheduled is dropped
      const st=(SFX.starts[key]||[]).filter(x=>x>now-0.1);
      if(st.some(x=>Math.abs(x-t)<SFX.DEDUPE)){SFX.starts[key]=st;return}
      st.push(t);SFX.starts[key]=st;
      // anti-stacking 2: at most MAXVOICES sounding at the same moment, the oldest is faded out
      const vs=SFX.voices=SFX.voices.filter(v=>v.t1>now);
      let live=vs.filter(v=>v.t0<=t&&v.t1>t);
      while(live.length>=SFX.MAXVOICES){
        const old=live.reduce((a,b)=>b.t0<a.t0?b:a);
        try{old.g.gain.setTargetAtTime(0,t,0.008);old.s.stop(t+0.06)}catch(e){}
        old.t1=t;live=live.filter(v=>v!==old);
      }
      const s=c.createBufferSource();s.buffer=buf;s.playbackRate.value=rate;
      const gk=SFX.GAIN[key],g=c.createGain();g.gain.value=vol*(gk==null?1:gk);
      s.connect(g);g.connect(SFX.master);
      s.start(t);
      vs.push({s,g,t0:t,t1:t+buf.duration/rate});
    }catch(e){}
  },
  setMuted(m){
    SFX.muted=!!m;
    try{localStorage.setItem('hl-mute',SFX.muted?'1':'0')}catch(e){}
  }
};
try{SFX.muted=localStorage.getItem('hl-mute')==='1'}catch(e){}
(function(){
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return;
  let started=false;
  function init(){
    if(started)return;
    let ctx=null;
    try{
      try{if(navigator.audioSession)navigator.audioSession.type='ambient'}catch(e){}
      ctx=new AC();
      const m=ctx.createGain();m.gain.value=0.8;
      // gentle master limiter so layered cues cannot clip the output
      let out=ctx.destination;
      try{const lim=ctx.createDynamicsCompressor();lim.threshold.value=-3;lim.knee.value=3;lim.ratio.value=12;lim.attack.value=0.002;lim.release.value=0.15;lim.connect(ctx.destination);out=lim}catch(e){}
      m.connect(out);
      SFX.ctx=ctx;SFX.master=m;started=true;
      ['pointerdown','touchend','keydown'].forEach(t=>document.removeEventListener(t,init,true));
      try{const p=ctx.resume();if(p&&p.catch)p.catch(()=>{})}catch(e){}
      SFX.KEYS.forEach(k=>{
        try{
          const url='sfx/'+k+'.mp3';
          fetch(url).then(r=>SFX.readAsset(r,url)).then(ab=>new Promise((res,rej)=>{
            const p=ctx.decodeAudioData(ab,res,rej);if(p&&p.catch)p.catch(rej);
          })).then(b=>{SFX.buf[k]=b}).catch(()=>{});
        }catch(e){}
      });
    }catch(e){try{if(ctx&&ctx.close){const p=ctx.close();if(p&&p.catch)p.catch(()=>{})}}catch(x){}}
  }
  ['pointerdown','touchend','keydown'].forEach(t=>document.addEventListener(t,init,{capture:true,passive:true}));
  // Retry on later gestures as well: iOS may interrupt audio after an earlier successful unlock.
  function wakeAudio(){
    const c=SFX.ctx;if(!c||c.state==='running'||document.hidden)return;
    try{const p=c.resume();if(p&&p.catch)p.catch(()=>{})}catch(e){}
  }
  ['pointerdown','touchend','click','keydown'].forEach(t=>document.addEventListener(t,wakeAudio,{capture:true,passive:true}));
  // e04: after a phone call, Siri or the app switcher the context can be 'interrupted' or 'suspended'; try to bring it back as soon as the page is visible again
  function backAudio(){const c=SFX.ctx;if(!c||c.state==='running'||document.hidden)return;try{const p=c.resume();if(p&&p.catch)p.catch(()=>{})}catch(e){}}
  document.addEventListener('visibilitychange',backAudio);window.addEventListener('pageshow',backAudio);
})();
