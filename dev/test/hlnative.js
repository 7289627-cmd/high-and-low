// Unit test for app/native/hlnative.js and its contract with src/ads.js. Run: cd test && node hlnative.js
const {JSDOM}=require('jsdom');const fs=require('fs');const path=require('path');
const ROOT=path.join(__dirname,'..');
const NATIVE=fs.readFileSync(path.join(ROOT,'app/native/hlnative.js'),'utf8');
const TRACK=fs.readFileSync(path.join(ROOT,'src/track.js'),'utf8');
const ADS=fs.readFileSync(path.join(ROOT,'src/ads.js'),'utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const fails=[];const ok=(c,m)=>{if(!c)fails.push(m)};

// Mock Capacitor plugins. All calls are recorded in log.
function mocks(o={}){
  const log=[];const L=new Map();
  const emit=(e,d)=>{(L.get(e)||[]).slice().forEach(f=>f(d))};
  const rec=(n,r)=>(...a)=>{log.push([n,...a]);return typeof r==='function'?r(...a):r};
  const AdMob={
    requestConsentInfo:rec('requestConsentInfo',()=>Promise.resolve(o.consent||{status:'NOT_REQUIRED',canRequestAds:true,isConsentFormAvailable:false})),
    showConsentForm:rec('showConsentForm',()=>Promise.resolve({status:'OBTAINED',canRequestAds:true})),
    initialize:rec('initialize',()=>Promise.resolve()),
    prepareInterstitial:rec('prepareInterstitial',()=>Promise.resolve({adUnitId:'x'})),
    prepareRewardVideoAd:rec('prepareRewardVideoAd',()=>Promise.resolve({adUnitId:'x'})),
    showInterstitial:rec('showInterstitial',()=>{const p=Promise.resolve();setTimeout(()=>{log.push(['closed']);emit('interstitialAdDismissed')},o.adMs||25);return p}),
    showRewardVideoAd:rec('showRewardVideoAd',()=>{setTimeout(()=>{if(o.reward){emit('onRewardedVideoAdReward',{amount:1,type:'x'})}log.push(['closed']);emit('onRewardedVideoAdDismissed')},25);return new Promise(()=>{})}),
    addListener:(e,f)=>{if(!L.has(e))L.set(e,[]);L.get(e).push(f);return Promise.resolve({remove:()=>{L.set(e,L.get(e).filter(x=>x!==f));log.push(['removed',e])}})}
  };
  const owned=[];
  const Purchases={
    configure:rec('configure',()=>Promise.resolve()),
    getProducts:rec('getProducts',()=>Promise.resolve({products:[{identifier:'remove_ads'}]})),
    purchaseStoreProduct:rec('purchaseStoreProduct',()=>o.cancel?Promise.reject({userCancelled:true}):(owned.push('remove_ads'),Promise.resolve({customerInfo:{allPurchasedProductIdentifiers:owned.slice()}}))),
    getCustomerInfo:rec('getCustomerInfo',()=>Promise.resolve({customerInfo:{allPurchasedProductIdentifiers:o.owned?['remove_ads']:owned.slice()}})),
    restorePurchases:rec('restorePurchases',()=>(owned.includes('remove_ads')||owned.push('remove_ads'),Promise.resolve({customerInfo:{allPurchasedProductIdentifiers:['remove_ads']}})))
  };
  const Haptics={impact:rec('impact',()=>Promise.resolve()),notification:rec('notification',()=>Promise.resolve()),selectionChanged:rec('selectionChanged',()=>Promise.resolve())};
  const App=Object.assign({addListener:(e,f)=>{L.set('app:'+e,[f]);return Promise.resolve({remove(){}})},getLaunchUrl:()=>Promise.resolve(o.launchUrl?{url:o.launchUrl}:undefined)});
  const store=new Map(Object.entries(o.prefs||{}));
  const Preferences={
    keys:rec('P.keys',()=>o.prefsFail?Promise.reject(new Error('x')):Promise.resolve({keys:[...store.keys()]})),
    get:rec('P.get',a=>Promise.resolve({value:store.has(a.key)?store.get(a.key):null})),
    set:rec('P.set',a=>{store.set(a.key,a.value);return Promise.resolve()}),
    remove:rec('P.remove',a=>{store.delete(a.key);return Promise.resolve()})};
  const KeepAwake={keepAwake:rec('keepAwake',()=>Promise.resolve()),allowSleep:rec('allowSleep',()=>Promise.resolve())};
  const StatusBar={setStyle:rec('setStyle',()=>Promise.resolve())};
  return{log,emit,L,Plugins:Object.assign({AdMob,Purchases,Haptics,App,StatusBar,Preferences,KeepAwake},o.drop?{}:{}),owned,store}
}
async function boot(o={}){
  const m=mocks(o);for(const d of (o.drop||[]))delete m.Plugins[d];
  const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'dangerously',pretendToBeVisual:true,url:'https://localhost/',virtualConsole:new (require('jsdom').VirtualConsole)(),
    beforeParse(w){
      w.require=require('node:module').createRequire(path.join(ROOT,'app/native/hlnative.js'));
      if(!o.noCapacitor)w.Capacitor={getPlatform:()=>o.platform||'android',Plugins:o.emptyPlugins?{}:m.Plugins};
      w.HL_NO_TRACK=true;w.HL_NATIVE_CONFIG=Object.assign({LOAD_TIMEOUT_MS:300,SHOW_TIMEOUT_MS:2000},o.cfg||{});
    }});
  const w=dom.window;w.errs=[];w.addEventListener('error',e=>w.errs.push(e.message));
  const run=code=>{const s=w.document.createElement('script');s.textContent=code;w.document.body.appendChild(s)};
  // audio doubles with the same shape as src/sound.js and src/music.js
  run(`var SFX={ctx:{state:'running',suspend(){this.state='suspended';window.__a.push('suspend');return Promise.resolve()},resume(){this.state='running';window.__a.push('resume');return Promise.resolve()}}};
       var MUSIC={el:{home:{pause(){window.__a.push('pause-home')}}},sync(){window.__a.push('sync')}};window.__a=[];`);
  if(o.before)run(o.before);
  if(!o.skipNative)run(NATIVE);
  if(o.after)run(o.after);
  if(o.loadAds){run(TRACK);run(ADS)}
  await wait(60);
  return{w,m,run};
}
const count=(m,n)=>m.log.filter(x=>x[0]===n).length;

(async()=>{
  // 1) contract and test ids
  {const {w,m}=await boot();const N=w.HLNative;
   ok(N,'HLNative missing');
   for(const k of ['showInterstitial','showRewarded','haptic'])ok(N&&typeof N[k]==='function','contract method missing: '+k);
   for(const k of ['buyNoAds','ownsNoAds','restore','restorePurchases'])ok(N[k]===undefined,'purchase contract must be absent: '+k);
   ok(count(m,'configure')===0,'purchases must not initialize');
   ok(count(m,'requestConsentInfo')===1&&count(m,'initialize')===1,'consent then initialize not run once at startup');
   ok(m.log.findIndex(x=>x[0]==='requestConsentInfo')<m.log.findIndex(x=>x[0]==='initialize'),'consent must come before initialize');
   const prep=m.log.find(x=>x[0]==='prepareInterstitial');
   ok(prep&&prep[1].adId==='ca-app-pub-3940256099942544/1033173712'&&prep[1].npa===true&&prep[1].isTesting===true,'interstitial should use Google android test id, npa and isTesting: '+JSON.stringify(prep));
   ok(w.errs.length===0,'page errors '+w.errs);}
  // 1b) iOS ids
  {const {m}=await boot({platform:'ios'});const prep=m.log.find(x=>x[0]==='prepareInterstitial');ok(prep&&/4411468910$/.test(prep[1].adId)&&prep[1].isTesting===undefined,'iOS demo id must not be replaced by isTesting');}
  // 2) interstitial resolves only after the ad closes, and cleans up listeners
  {const {w,m}=await boot();const t0=Date.now();const r=await w.HLNative.showInterstitial();
   const ci=m.log.findIndex(x=>x[0]==='closed'),si=m.log.findIndex(x=>x[0]==='showInterstitial');
   ok(r===true,'interstitial should resolve true, got '+r);ok(si>=0&&ci>si,'interstitial resolved before ad closed');
   ok(Date.now()-t0>=20,'resolved too fast');
   ok(m.log.filter(x=>x[0]==='removed').length>=2,'listeners not removed');
   ok(w.__a.includes('suspend')&&w.__a.includes('resume')&&w.__a.includes('sync'),'audio not paused/resumed around ad: '+w.__a);
   await wait(40);ok(count(m,'prepareInterstitial')>=2,'next interstitial not preloaded');}
  // 3) rewarded: only true when the reward event fired
  {const a=await boot({reward:true});ok((await a.w.HLNative.showRewarded())===true,'rewarded with reward should be true');
   const b=await boot({reward:false});ok((await b.w.HLNative.showRewarded())===false,'rewarded closed early should be false');}
  // 4) missing plugins never throw and resolve false
  for(const [name,o] of [['no Capacitor',{noCapacitor:true}],['empty Plugins',{emptyPlugins:true}],['drop AdMob',{drop:['AdMob']}],['drop Purchases',{drop:['Purchases']}]]){
    const {w}=await boot(o);const N=w.HLNative;let res;
    try{res=[await N.showInterstitial(),await N.showRewarded(),N.haptic('light')]}catch(e){fails.push(name+' threw '+e.message);continue}
    if(name==='drop AdMob')ok(res[0]===false&&res[1]===false,name+' got '+res);
    else if(name==='drop Purchases')ok(res[0]===true&&res[1]===false,name+' got '+res);
    else ok(res.every(x=>x===false),name+' should be all false, got '+res);
  }
  // 5) real ids not filled in: refuse, never call the plugin
  {const {w,m}=await boot({cfg:{TEST_MODE:false}});ok((await w.HLNative.showInterstitial())===false,'placeholder id must resolve false');ok(count(m,'prepareInterstitial')===0&&count(m,'showInterstitial')===0,'placeholder id reached plugin');
   ok(w.HLNative.buyNoAds===undefined&&count(m,'configure')===0,'purchases must not be exposed or initialized');}
  // 6) consent: form shown when required, no ads when consent denies
  {const {w,m}=await boot({consent:{status:'REQUIRED',isConsentFormAvailable:true,canRequestAds:false}});ok(count(m,'showConsentForm')===1,'consent form not shown when required');
   // mock form returns canRequestAds:true -> ads allowed
   ok(count(m,'initialize')===1,'initialize after consent form');}
  {const {w,m}=await boot({consent:{status:'REQUIRED',isConsentFormAvailable:false,canRequestAds:false}});ok(count(m,'initialize')===0,'must not initialize without consent');ok((await w.HLNative.showInterstitial())===false,'no ad without consent');}
  // 7) even a legacy override must not re-enable the removed purchase bridge.
  {const {w,m}=await boot({loadAds:true,cfg:{PURCHASES_ENABLED:true,IAP:{productId:'remove_ads',apiKey:{ios:'k',android:'k'}}}});
   const A=w.eval('HLAds');for(const k of ['buyNoAds','ownsNoAds','restore','restorePurchases'])ok(w.HLNative[k]===undefined,'purchase method exposed: '+k);
   ok(count(m,'configure')===0&&!A.canBuy(),'purchase initialization or UI exposed');ok((await A.buy())===false,'legacy buy must safely return false');}
  {const {w,m}=await boot({cfg:{ADS_ENABLED:false}});for(const k of ['showInterstitial','showRewarded','buyNoAds','ownsNoAds','restore'])ok(w.HLNative[k]===undefined,'ad-free contract exposed: '+k);
   ok(count(m,'initialize')===0&&count(m,'configure')===0,'ad-free build initialized ads or purchases');}
  // 8) haptics, vibrate shim, lifecycle
  {const {w,m}=await boot();w.navigator.vibrate(8);w.navigator.vibrate(15);w.navigator.vibrate(40);
   const imp=m.log.filter(x=>x[0]==='impact').map(x=>x[1].style);ok(imp.join()==='LIGHT,MEDIUM,HEAVY','vibrate shim styles '+imp);
   w.HLNative.haptic('success');ok(count(m,'notification')===1,'notification haptic');
   const f=m.L.get('app:appStateChange')[0];w.__a.length=0;f({isActive:false});ok(w.__a.includes('suspend')&&w.__a.includes('pause-home'),'pause hook '+w.__a);
   w.__a.length=0;f({isActive:true});ok(w.__a.includes('resume')&&w.__a.includes('sync'),'resume hook '+w.__a);}
  // 9) HLAds.between from src/ads.js: ad on the 2nd, 4th, 6th finished game only, never when noAds
  {const {w,m}=await boot({loadAds:true});const A=w.eval('HLAds');const shownAfter=[];
   for(let i=1;i<=6;i++){const before=count(m,'showInterstitial');await A.between();shownAfter.push(count(m,'showInterstitial')>before)}
   ok(shownAfter.join()==='false,true,false,true,false,true','between() pattern '+shownAfter);
   ok(A.canBuy()===true||A.canBuy()===false,'canBuy callable');}
  {const {w,m}=await boot({loadAds:true});const A=w.eval('HLAds');A.setNoAds(true);for(let i=0;i<6;i++)await A.between();ok(count(m,'showInterstitial')===0,'ads shown although noAds is set');}
  {const {w,m}=await boot({loadAds:true,skipNative:true});const A=w.eval('HLAds');for(let i=0;i<6;i++)await A.between();ok(count(m,'showInterstitial')===0,'web build (no HLNative) must never show ads');}
  // 12) f02 durable storage mirror (Capacitor Preferences <-> localStorage)
  {// 12a) evicted localStorage: durable keys come back, game defaults written during boot do not win, transient keys stay out, one reload
   const prefs={'hl-elo':'1500','hl-coins':'7','hl-noads':'"1"','hl-pid':'"old"','hl-host-ABCD':'{"G":1}','hl-sec-ABCD-g-p':'5','hl-session':'{}','other':'x'};
   const {w,m,run}=await boot({prefs,after:`localStorage.setItem('hl-pid','"new"')`});await w.HLNative.mirror.done;await wait(30);
   const g=k=>w.localStorage.getItem(k);
   ok(g('hl-elo')==='1500'&&g('hl-coins')==='7'&&g('hl-noads')==='"1"','durable keys not restored');
   ok(g('hl-pid')==='"old"','restore must beat the default the game wrote during boot, got '+g('hl-pid'));
   ok(g('hl-host-ABCD')===null&&g('hl-sec-ABCD-g-p')===null&&g('hl-session')===null&&g('other')===null,'transient or foreign keys restored');
   ok(w.HLNative.mirror.state.reloaded===true&&w.sessionStorage.getItem('hl-mirror-reload')==='1','should reload once after restoring');
   ok(!m.log.some(x=>x[0]==='P.set'&&x[1].key==='hl-pid'&&x[1].value==='"new"'),'default pid was written over the backup');}
  {// 12b) loop guard: reload already done this session, restore again but do not reload
   const {w}=await boot({prefs:{'hl-elo':'1500'},before:`sessionStorage.setItem('hl-mirror-reload','1')`});await w.HLNative.mirror.done;
   ok(w.localStorage.getItem('hl-elo')==='1500'&&w.HLNative.mirror.state.reloaded===false,'loop guard failed');}
  {// 12c) nothing to restore: no reload; local value wins and goes to Preferences; writes are debounced and removals mirrored
   const {w,m,run}=await boot({prefs:{'hl-elo':'1500'},before:`localStorage.setItem('hl-elo','1600');localStorage.setItem('hl-sid','abc')`});await w.HLNative.mirror.done;await wait(500);
   ok(w.HLNative.mirror.state.reloaded===false&&w.localStorage.getItem('hl-elo')==='1600','local key must win');
   ok(m.store.get('hl-elo')==='1600'&&!m.store.has('hl-sid'),'backup not brought up to date / hl-sid mirrored');
   m.log.length=0;run(`for(let i=0;i<5;i++)localStorage.setItem('hl-name','"Bo'+i+'"');localStorage.setItem('hl-sec-X-g-p','1');localStorage.setItem('zzz','1')`);await wait(500);
   ok(m.log.filter(x=>x[0]==='P.set'&&x[1].key==='hl-name').length===1&&m.store.get('hl-name')==='"Bo4"','writes should be debounced to the last value');
   ok(!m.store.has('hl-sec-X-g-p')&&!m.store.has('zzz'),'transient or foreign key written through');
   run(`localStorage.removeItem('hl-name')`);await wait(500);ok(!m.store.has('hl-name'),'removeItem not mirrored');
   ok(typeof w.localStorage.setItem==='function'&&w.localStorage.getItem('setItem')===null,'setItem wrapper must live on the prototype');}
  {// 12d) Preferences unreadable: never write through. Missing plugin: harmless
   const {w,m,run}=await boot({prefsFail:true});await w.HLNative.mirror.done;run(`localStorage.setItem('hl-elo','1')`);await wait(500);
   ok(count(m,'P.set')===0&&w.localStorage.getItem('hl-elo')==='1','write-through must stay off after a failed restore');
   const b=await boot({drop:['Preferences']});b.run(`localStorage.setItem('hl-elo','2')`);await wait(50);ok(b.w.localStorage.getItem('hl-elo')==='2'&&b.w.errs.length===0,'no Preferences plugin must be harmless');}
  // 13) keepAwake bridge
  {const {w,m}=await boot();ok(w.HLNative.keepAwake(true)===true&&count(m,'keepAwake')===1,'keepAwake(true) must call the plugin');
   ok(w.HLNative.keepAwake(false)===true&&count(m,'allowSleep')===1,'keepAwake(false) must call allowSleep');
   const b=await boot({drop:['KeepAwake']});ok(b.w.HLNative.keepAwake(true)===false,'missing plugin must return false');}
  // 14) invite links: appUrlOpen and launch URL forward the room code, a live game is left alone
  {const {w,m}=await boot();const f=m.L.get('app:appUrlOpen')[0];
   f({url:'https://example.github.io/high-and-low/#room=abcd'});ok(w.location.hash==='#room=ABCD','appUrlOpen did not set the room hash: '+w.location.hash);
   w.location.hash='';f({url:'https://example.github.io/high-and-low/'});ok(w.location.hash==='','link without a room must be ignored');
   f({url:'https://x/#room=abcde'});ok(w.location.hash==='','5 letter code must be ignored');
   const {w:w2,m:m2,run}=await boot({before:`var view='game'`});m2.L.get('app:appUrlOpen')[0]({url:'https://x/#room=WXYZ'});ok(w2.location.hash==='','a running game must not be interrupted');}
  {const {w}=await boot({launchUrl:'https://x/#room=QRST'});await wait(30);ok(w.location.hash==='#room=QRST','launch URL not handled');
   w.location.hash='';ok(w.HLNative.openRoom('https://x/#room=QRST',true)===false&&w.location.hash==='','launch URL must be handled once per session (reload loop guard)');}
  // 15) app CSP rewrite (app/scripts/app_csp.py): own origins added to file-loading directives only, idempotent, nothing else widened
  {const cp=require('child_process');const tmp=path.join(require('os').tmpdir(),'hl-csp-'+process.pid+'.html');
   const csp="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; media-src 'self'; manifest-src 'self'; connect-src 'self' https://a.supabase.co wss://a.supabase.co; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";
   const real=fs.existsSync(path.join(ROOT,'site/index.html'))?(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(fs.readFileSync(path.join(ROOT,'site/index.html'),'utf8'))||[])[1]:null;
   for(const c of [csp,real].filter(Boolean)){
     fs.writeFileSync(tmp,'<html><head><meta http-equiv="Content-Security-Policy" content="'+c+'"></head><body></body></html>');
     const run=()=>cp.execFileSync(process.env.HL_TEST_PYTHON||'python3',['-I',path.join(ROOT,'app/scripts/app_csp.py'),tmp]);run();const once=fs.readFileSync(tmp,'utf8');run();ok(fs.readFileSync(tmp,'utf8')===once,'app_csp not idempotent');
     const out=/content="([^"]*)"/.exec(once)[1];const d={};out.split(';').forEach(x=>{const a=x.trim().split(/\s+/);d[a[0]]=a.slice(1)});
     for(const k of ['script-src','style-src','font-src','img-src','media-src','connect-src','manifest-src'])ok(d[k]&&d[k].includes('capacitor://localhost')&&d[k].includes('https://localhost')&&d[k].includes("'self'"),'origins missing in '+k);
     for(const k of ['default-src','frame-src','object-src','base-uri','form-action'])ok(!(d[k]||[]).some(v=>/localhost/.test(v)),k+' must not be widened');
     ok(!/unsafe-eval|\*\s|;\s*\*/.test(out.replace(/\*\.supabase\.co/g,'')),'rewrite must not add wildcards or unsafe-eval');
     const strip=x=>x.replace(/ capacitor:\/\/localhost https:\/\/localhost/g,'');ok(strip(out)===c,'rewrite changed something besides the two origins');}
   fs.writeFileSync(tmp,'<html><head></head></html>');let threw=false;try{cp.execFileSync(process.env.HL_TEST_PYTHON||'python3',['-I',path.join(ROOT,'app/scripts/app_csp.py'),tmp],{stdio:'pipe'})}catch(e){threw=true}ok(threw,'missing CSP meta must fail the sync');fs.unlinkSync(tmp);}
  // 11) the real bundle (app/native/entry.js via esbuild) on a fake native bridge: proves the plugins get registered
  //     on Capacitor.Plugins (they do not without the plugin JS imports) and calls reach nativePromise.
  const esb=path.join(ROOT,'app/node_modules/esbuild/bin/esbuild');
  if(!fs.existsSync(esb)){console.log('SKIP bundle smoke test (run npm install in app/)')}
  else{
    const out=path.join(require('os').tmpdir(),'hl-bundle-'+process.pid+'.js');
    require('child_process').execFileSync(process.execPath,[esb,path.join(ROOT,'app/native/entry.js'),'--bundle','--format=iife','--target=es2019','--outfile='+out,'--log-level=error'],{cwd:path.join(ROOT,'app')});
    const code=fs.readFileSync(out,'utf8');fs.unlinkSync(out);
    const calls=[],cbs={};
    const P=(n,...m)=>({name:n,methods:m.map(x=>({name:x,rtype:'promise'})).concat([{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}])});
    const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'dangerously',pretendToBeVisual:true,url:'https://localhost/',beforeParse(w){
      w.androidBridge={};w.HL_NO_TRACK=true;
      w.Capacitor={PluginHeaders:[P('AdMob','requestConsentInfo','showConsentForm','initialize','prepareInterstitial','showInterstitial','prepareRewardVideoAd','showRewardVideoAd'),P('Haptics','impact','notification'),P('App'),P('StatusBar','setStyle'),P('Purchases','configure','getProducts','purchaseStoreProduct','getCustomerInfo','restorePurchases'),P('SplashScreen','hide')],
        nativePromise(pl,me,o){calls.push(pl+'.'+me);
          if(me==='requestConsentInfo')return Promise.resolve({status:'NOT_REQUIRED',canRequestAds:true});
          if(me==='showInterstitial'){setTimeout(()=>(cbs['interstitialAdDismissed']||[]).forEach(f=>f()),20);return Promise.resolve()}
          return Promise.resolve({});},
        nativeCallback(pl,me,o,cb){if(me==='addListener'){(cbs[o.eventName]=cbs[o.eventName]||[]).push(cb)}return Promise.resolve('id')}};
    }});
    const w=dom.window;const errs=[];w.addEventListener('error',e=>errs.push(e.message));
    const s=w.document.createElement('script');s.textContent=code;w.document.body.appendChild(s);await wait(80);
    ok(errs.length===0,'bundle errors '+errs);
    ok(w.Capacitor.Plugins&&w.Capacitor.Plugins.AdMob&&w.Capacitor.Plugins.Haptics&&w.Capacitor.Plugins.App&&w.Capacitor.Plugins.Preferences&&w.Capacitor.Plugins.KeepAwake,'plugins not registered on Capacitor.Plugins by the bundle');
    ok(!w.Capacitor.Plugins.Purchases&&!calls.some(x=>x.startsWith('Purchases.')),'bundle must not register or initialize purchases');
    ok(w.HLNative&&typeof w.HLNative.showInterstitial==='function','bundle did not define HLNative');
    const r=await w.HLNative.showInterstitial();
    ok(r===true,'bundle: interstitial should resolve true, got '+r+' calls='+calls);
    ok(calls.indexOf('AdMob.requestConsentInfo')<calls.indexOf('AdMob.initialize')&&calls.includes('AdMob.prepareInterstitial')&&calls.includes('AdMob.showInterstitial'),'bundle: native call order '+calls);
    w.navigator.vibrate(8);await wait(5);ok(calls.includes('Haptics.impact'),'bundle: vibrate shim did not reach Haptics');
  }
  if(fails.length){console.log('FAIL hlnative');fails.forEach(f=>console.log('  - '+f));process.exit(1)}
  console.log('PASS hlnative');
})().catch(e=>{console.log('FAIL hlnative',e);process.exit(1)});
