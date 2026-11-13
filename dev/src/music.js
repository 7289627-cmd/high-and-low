/* ---------- Music (recorded loops, streamed) ----------
   home: the menu tune.  play: a much quieter bed during a game.
   Missing files are fine: the game just stays without music. */
const MUSIC={
  src:{home:'music/home.mp3',play:'music/play.mp3'},
  vol:{home:0.30,play:0.13},
  el:{},want:'home',ok:false,timer:null,
  init(){
    if(MUSIC.ok||typeof Audio!=='function')return;
    try{
      for(const k in MUSIC.src){const a=new Audio();a.src=MUSIC.src[k];a.loop=true;a.preload='auto';a.volume=0;MUSIC.el[k]=a}
      MUSIC.ok=true;MUSIC.sync();
    }catch(e){}
  },
  set(name){if(MUSIC.want===name)return;MUSIC.want=name;MUSIC.sync()},
  sync(){
    if(!MUSIC.ok)return;
    const on=!(SFX.muted||document.hidden)?MUSIC.want:null;
    for(const k in MUSIC.el){const a=MUSIC.el[k];if(k===on&&a.paused){try{const p=a.play();if(p&&p.catch)p.catch(()=>{})}catch(e){}}}
    clearInterval(MUSIC.timer);
    MUSIC.timer=setInterval(()=>{
      let moving=false;
      for(const k in MUSIC.el){
        const a=MUSIC.el[k],to=k===on?MUSIC.vol[k]:0,d=to-a.volume;
        if(Math.abs(d)<0.012){a.volume=to;if(to===0&&!a.paused){try{a.pause()}catch(e){}}}
        else{a.volume=Math.min(1,Math.max(0,a.volume+Math.sign(d)*0.012));moving=true}
      }
      if(!moving)clearInterval(MUSIC.timer);
    },60);
  }
};
(function(){
  const go=()=>{MUSIC.init();['pointerdown','touchend','keydown'].forEach(t=>document.removeEventListener(t,go,true))};
  ['pointerdown','touchend','keydown'].forEach(t=>document.addEventListener(t,go,{capture:true,passive:true}));
  document.addEventListener('visibilitychange',()=>MUSIC.sync());
  const sm=SFX.setMuted;SFX.setMuted=m=>{sm(m);MUSIC.sync()};
})();
