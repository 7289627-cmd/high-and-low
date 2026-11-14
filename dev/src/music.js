/* ---------- Music (recorded loops, gapless via Web Audio) ----------
   home: the menu tune.  play: a much quieter bed during a game.
   Tracks are decoded once, trimmed of encoder padding/silence, and looped with
   AudioBufferSourceNode.loop so the seam has no gap. Missing files are fine:
   the game just stays without music.
   MUSIC.src[name] may be a string or an array of candidates (first that decodes wins). */
const MUSIC={
  src:{home:'music/home.mp3',play:'music/play.mp3'},
  vol:{home:0.30,play:0.13},
  FADE:1.2,DUCK:0.5,SILENCE:0.001, // -60 dB
  T:{},want:'home',ok:false,out:null,duckG:null,ducked:0,duckTimer:null,susp:false,
  init(){
    if(MUSIC.ok)return;
    const c=SFX.ctx;
    if(!c||typeof fetch!=='function')return;
    try{
      MUSIC.out=c.createGain();MUSIC.out.gain.value=SFX.muted?0:1;MUSIC.out.connect(c.destination);
      MUSIC.duckG=c.createGain();MUSIC.duckG.gain.value=1;MUSIC.duckG.connect(MUSIC.out);
      MUSIC.ok=true;MUSIC.sync();
    }catch(e){}
  },
  set(name){if(MUSIC.want===name)return;MUSIC.want=name;MUSIC.sync()},
  // audible region of a decoded buffer: skips leading/trailing samples below -60 dB
  region(buf){
    try{
      const n=buf.length,sr=buf.sampleRate,th=MUSIC.SILENCE;let a=n,b=-1;
      for(let ch=0;ch<buf.numberOfChannels;ch++){
        const d=buf.getChannelData(ch);
        let i=0;while(i<n&&i<a&&Math.abs(d[i])<th)i++;if(i<a)a=i;
        let j=n-1;while(j>b&&j>=0&&Math.abs(d[j])<th)j--;if(j>b)b=j;
      }
      if(b<0||a>=b||(b-a)/sr<1)return{start:0,end:buf.duration};
      return{start:a/sr,end:(b+1)/sr};
    }catch(e){return{start:0,end:buf.duration}}
  },
  load(name){
    const t=MUSIC.T[name]||(MUSIC.T[name]={buf:null,loading:null,failed:false,tries:0,failAt:0,node:null,g:null,lvl:0,fadeT:0,fadeFrom:0,fadeTo:0,fadeDur:0});
    if(t.failed&&t.tries<3&&Date.now()-t.failAt>20000)t.failed=false; // retry later (network blips)
    if(t.buf||t.loading||t.failed)return t;
    const c=SFX.ctx;let list=MUSIC.src[name];if(!Array.isArray(list))list=[list];
    const tryOne=i=>{
      if(i>=list.length){t.failed=true;t.tries++;t.failAt=Date.now();t.loading=null;return}
      fetch(list[i]).then(r=>{if(!r.ok)throw 0;return r.arrayBuffer()}).then(ab=>new Promise((res,rej)=>{
        const p=c.decodeAudioData(ab,res,rej);if(p&&p.catch)p.catch(rej);
      })).then(b=>{
        t.buf=b;t.reg=MUSIC.region(b);t.loading=null;t.url=list[i];MUSIC.sync();
      }).catch(()=>tryOne(i+1));
    };
    t.loading=true;tryOne(0);
    return t;
  },
  level(t,now){
    if(!t.fadeDur)return t.lvl;
    const p=Math.min(1,Math.max(0,(now-t.fadeT)/t.fadeDur));
    return t.fadeFrom+(t.fadeTo-t.fadeFrom)*(t.fadeTo>=t.fadeFrom?Math.sin(p*Math.PI/2):1-Math.cos(p*Math.PI/2));
  },
  // equal-power fade of one track's gain to `to` over `dur` seconds
  fade(t,to,dur){
    const c=SFX.ctx,now=c.currentTime,g=t.g.gain,from=MUSIC.level(t,now);
    t.lvl=from;t.fadeT=now;t.fadeFrom=from;t.fadeTo=to;t.fadeDur=dur;
    g.cancelScheduledValues(now);g.setValueAtTime(from,now);
    if(!(dur>0)||from===to){g.setValueAtTime(to,now);t.lvl=to;t.fadeDur=0;return}
    const N=32,cv=new Float32Array(N);
    for(let i=0;i<N;i++){const p=i/(N-1);cv[i]=from+(to-from)*(to>=from?Math.sin(p*Math.PI/2):1-Math.cos(p*Math.PI/2))}
    g.setValueCurveAtTime(cv,now,dur);
  },
  start(name,t){
    const c=SFX.ctx;
    if(t.node||!t.buf)return;
    const s=c.createBufferSource();s.buffer=t.buf;s.loop=true;
    s.loopStart=t.reg.start;s.loopEnd=t.reg.end;
    const g=c.createGain();g.gain.value=0;s.connect(g);g.connect(MUSIC.duckG);
    t.node=s;t.g=g;t.lvl=0;t.fadeDur=0;t.fadeTo=0;
    s.onended=()=>{if(t.node===s){t.node=null;t.g=null}};
    s.start(0,t.reg.start);
  },
  stopLater(t,sec){
    const s=t.node;if(!s)return;
    t.stopAt=Date.now()+sec*1000;
    setTimeout(()=>{
      if(t.node!==s||t.want)return;
      try{s.stop();s.disconnect()}catch(e){}
      t.node=null;t.g=null;t.lvl=0;t.fadeDur=0;
    },sec*1000+60);
  },
  sync(){
    if(!MUSIC.ok)return;
    const c=SFX.ctx;if(!c)return;
    try{
      const hid=typeof document!=='undefined'&&document.hidden,mut=!!SFX.muted;
      const on=(!mut&&!hid)?MUSIC.want:null;
      if(!hid&&MUSIC.susp){MUSIC.susp=false;try{c.resume()}catch(e){}}
      const now=c.currentTime;
      MUSIC.out.gain.cancelScheduledValues(now);MUSIC.out.gain.setValueAtTime(MUSIC.out.gain.value,now);
      MUSIC.out.gain.linearRampToValueAtTime(mut?0:1,now+(mut?0.05:0.1));
      const names=Object.keys(MUSIC.src);
      for(const k of names){
        const t=MUSIC.T[k]||(k===on?MUSIC.load(k):null);if(!t)continue;
        if(k===on){
          t.want=true;
          if(!t.buf){MUSIC.load(k);continue}
          if(!t.node)MUSIC.start(k,t);
          if(t.node&&t.fadeTo!==MUSIC.vol[k]){MUSIC.fadeOnce(t,MUSIC.vol[k],MUSIC.FADE)}
        }else{
          t.want=false;
          if(t.node&&t.fadeTo!==0){MUSIC.fadeOnce(t,0,hid||mut?0.3:MUSIC.FADE);MUSIC.stopLater(t,hid||mut?0.3:MUSIC.FADE)}
        }
      }
      if(hid&&!MUSIC.susp){
        MUSIC.susp=true;
        setTimeout(()=>{if(MUSIC.susp&&document.hidden){try{c.suspend()}catch(e){}}},450);
      }
    }catch(e){}
  },
  fadeOnce(t,to,dur){
    if(t.fadeTo===to&&t.fadeDur)return;
    MUSIC.fade(t,to,dur);
  },
  // lower music ~6 dB for `ms` milliseconds (death scenes), then restore
  duck(ms){
    if(!MUSIC.ok)return;
    try{
      const c=SFX.ctx,g=MUSIC.duckG.gain,now=c.currentTime;
      g.cancelScheduledValues(now);g.setValueAtTime(g.value,now);g.linearRampToValueAtTime(MUSIC.DUCK,now+0.15);
      clearTimeout(MUSIC.duckTimer);
      MUSIC.duckTimer=setTimeout(()=>{
        try{const n=c.currentTime;g.cancelScheduledValues(n);g.setValueAtTime(g.value,n);g.linearRampToValueAtTime(1,n+0.6)}catch(e){}
      },Math.max(0,ms||0));
    }catch(e){}
  }
};
(function(){
  const go=()=>{
    ['pointerdown','touchend','keydown'].forEach(t=>document.removeEventListener(t,go,true));
    // run after sound.js has created SFX.ctx for this same gesture
    MUSIC.init();if(!MUSIC.ok)setTimeout(()=>MUSIC.init(),0);
  };
  ['pointerdown','touchend','keydown'].forEach(t=>document.addEventListener(t,go,{capture:true,passive:true}));
  document.addEventListener('visibilitychange',()=>MUSIC.sync());
  const sm=SFX.setMuted;SFX.setMuted=m=>{sm(m);MUSIC.sync()};
})();
