// Unit test for src/haptics.js. Run: cd test && node haptics.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const SRC=fs.readFileSync(path.join(__dirname,'../src/haptics.js'),'utf8');
let n=0;const fails=[];const ok=(c,m)=>{n++;if(!c)fails.push(m)};
function load(win,nav){
  const ctx={window:win,navigator:nav,Date};ctx.globalThis=ctx;vm.createContext(ctx);
  vm.runInContext(SRC+';this.haptic=haptic;this.impactAt=hapticImpactAt;this.setNow=f=>{hapticNow=f};',ctx);return ctx;
}
// kinds on the web: vibrate patterns
{const calls=[];const c=load({}, {vibrate:p=>{calls.push(p);return true}});
 for(const k of ['tap','thud','win','lose','tick'])ok(c.haptic(k)===true,'kind '+k);
 ok(calls.length===5&&calls.every(Array.isArray),'vibrate got patterns');
 ok(c.haptic('nope')===false&&c.haptic()===false&&calls.length===5,'unknown kind ignored');
 ok(JSON.stringify(calls[3])==='[70,60,130]','lose pattern');}
// rate limit: tick once per 40 ms
{const calls=[];const c=load({}, {vibrate:p=>calls.push(p)});let t=1000;c.setNow(()=>t);
 ok(c.haptic('tick')===true,'first tick');
 t=1010;ok(c.haptic('tick')===false,'tick at +10 blocked');
 t=1039;ok(c.haptic('tick')===false,'tick at +39 blocked');
 t=1040;ok(c.haptic('tick')===true,'tick at +40 allowed');
 ok(calls.length===2,'two vibrations');
 t=1041;ok(c.haptic('tap')===true&&c.haptic('thud')===true,'other kinds not rate limited');}
// app bridge wins over vibrate
{const nat=[],vib=[];const c=load({HLNative:{haptic:k=>nat.push(k)}},{vibrate:p=>vib.push(p)});
 c.haptic('win');c.haptic('lose');ok(nat.join()==='win,lose'&&vib.length===0,'HLNative preferred');}
// nothing available, or throwing, never throws
{const c=load({}, {});ok(c.haptic('tap')===false,'no vibrate returns false');
 const c2=load({}, {vibrate:()=>{throw new Error('x')}});let thr=false;try{c2.haptic('thud')}catch(e){thr=true}ok(!thr,'throwing vibrate swallowed');
 const c3=load({HLNative:{haptic:()=>{throw new Error('y')}}}, {});thr=false;try{c3.haptic('tap')}catch(e){thr=true}ok(!thr,'throwing bridge swallowed');
 const c4=load(undefined,undefined);thr=false;try{c4.haptic('tap')}catch(e){thr=true}ok(!thr,'no window or navigator');}
// impact time from DEATH_SFX
{const c=load({DEATH_SFX:{a:[['k_squeak',.36],['k_clang',1.36],['k_slam',1.36]],b:[['d_fuse',.55],['k_launch',1.5]],z:[]}},{});
 ok(c.impactAt('a')===1.36,'first impact cue skips squeaks');ok(c.impactAt('b')===.55,'no impact name falls back to first cue');
 ok(c.impactAt('z')===.9&&c.impactAt('missing')===.9,'fallback .9');}
// real table from base.js
{const base=fs.readFileSync(path.join(__dirname,'../src/base.js'),'utf8');const m=/const DEATH_SFX=\{[\s\S]*?\n\};/.exec(base);
 const w={};vm.runInNewContext(m[0]+';w.D=DEATH_SFX',{w});const c=load({DEATH_SFX:w.D},{});
 const exp={anvil:1.36,zap:1.5,rocket:2.3,chomp:1.42,melt:1.6,pop:2.05,piano:1.42,banana:2.1,calc:2.05};
 for(const k in exp)ok(c.impactAt(k)===exp[k],'impact '+k+' '+c.impactAt(k));}
if(fails.length){console.log('FAIL haptics',fails);process.exit(1)}console.log('PASS haptics ('+n+' checks)');
