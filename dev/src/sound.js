/* ---------- Sound (recorded sfx, lazy AudioContext) ---------- */
const SFX={
  KEYS:['key','del','pick','land','send','yes','nope','yourturn','tick','spin','wheelland','lock','join','leave','hint','error','bonk','sad','anvil','anvil2','zap','whoosh','chomp','melt','pop','pop2','heart','babble1','babble2','babble3','win','vo_ready','vo_go','vo_youwin','vo_gameover','vo_final','vo_hurry','vo_timeover','vo_wrong','vo_correct','d_piano','d_slip','d_buzz','d_slam'],
  muted:false,ctx:null,master:null,buf:{},
  play(key,opts){
    try{
      if(SFX.muted||!SFX.ctx||!SFX.buf[key])return;
      const o=opts||{},rate=o.rate||1,vol=o.vol==null?1:o.vol,delay=o.delay||0;
      const c=SFX.ctx,s=c.createBufferSource();s.buffer=SFX.buf[key];s.playbackRate.value=rate;
      const g=c.createGain();g.gain.value=vol;s.connect(g);g.connect(SFX.master);
      s.start(c.currentTime+delay);
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
    if(started)return;started=true;
    ['pointerdown','touchend','keydown'].forEach(t=>document.removeEventListener(t,init,true));
    try{
      try{if(navigator.audioSession)navigator.audioSession.type='ambient'}catch(e){}
      const ctx=new AC();SFX.ctx=ctx;
      try{ctx.resume()}catch(e){}
      const m=ctx.createGain();m.gain.value=0.8;m.connect(ctx.destination);SFX.master=m;
      SFX.KEYS.forEach(k=>{
        try{
          fetch('sfx/'+k+'.mp3').then(r=>{if(!r.ok)throw 0;return r.arrayBuffer()}).then(ab=>new Promise((res,rej)=>{
            const p=ctx.decodeAudioData(ab,res,rej);if(p&&p.catch)p.catch(rej);
          })).then(b=>{SFX.buf[k]=b}).catch(()=>{});
        }catch(e){}
      });
    }catch(e){}
  }
  ['pointerdown','touchend','keydown'].forEach(t=>document.addEventListener(t,init,{capture:true,passive:true}));
  // iOS: if the first tap didn't unlock audio, keep retrying on later taps until it is running
  function wakeAudio(){
    const c=SFX.ctx;if(!c)return;
    if(c.state==='running'){['touchend','click'].forEach(t=>document.removeEventListener(t,wakeAudio,true));return}
    try{c.resume()}catch(e){}
  }
  ['touchend','click'].forEach(t=>document.addEventListener(t,wakeAudio,{capture:true,passive:true}));
})();
