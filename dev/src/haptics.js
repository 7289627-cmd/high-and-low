/* ---------- Haptics (c10) ----------
   haptic(kind): 'tap' | 'tick' | 'thud' | 'win' | 'lose'. No setting, it follows the OS.
   App: HLNative.haptic(kind). Web: navigator.vibrate patterns. Otherwise silent. Never throws. */
const HAPTIC_PAT={tap:[10],tick:[5],thud:[45],win:[20,40,20,40,70],lose:[70,60,130]};
const HAPTIC_TICK_GAP=40;
let hapticLast=0;
function hapticNow(){return Date.now()}
function haptic(kind){
  try{
    if(!HAPTIC_PAT[kind])return false;
    if(kind==='tick'){const t=hapticNow();if(t-hapticLast<HAPTIC_TICK_GAP)return false;hapticLast=t}
    const N=typeof window!=='undefined'?window.HLNative:null;
    if(N&&typeof N.haptic==='function'){N.haptic(kind);return true}
    if(typeof navigator!=='undefined'&&typeof navigator.vibrate==='function'){navigator.vibrate(HAPTIC_PAT[kind]);return true}
  }catch(e){}
  return false;
}
/* Seconds into a death scene when the first impact lands (first cue that is an impact sound, else the first cue, else 0.9). */
const HAPTIC_IMPACT=/^(k_clang|k_slam|k_crack|k_explode|k_popbang|k_crunch|k_eat1|k_gloop2|d_piano|d_slam|anvil|anvil2|zap|chomp|melt|pop|bonk)$/;
function hapticImpactAt(kind){
  try{
    const d=window.DEATH_SFX&&window.DEATH_SFX[kind];
    if(d&&d.length){const c=d.find(x=>HAPTIC_IMPACT.test(x[0]))||d[0];if(typeof c[1]==='number')return c[1]}
  }catch(e){}
  return 0.9;
}
