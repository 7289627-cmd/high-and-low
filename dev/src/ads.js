/* ---------- Ads (app builds only) ----------
   The website never shows ads. A store build provides window.HLNative with any of:
     showInterstitial()            full-screen ad, returns a Promise that resolves when it closes
     showRewarded()                Promise<boolean>, true if the player watched to the end
     buyNoAds()                    Promise<boolean>, true once the purchase is owned
     ownsNoAds()                   boolean or Promise<boolean>
     restore()                     Promise<boolean>, asks the store to restore purchases (optional; shows the "Restore purchases" button when present)
     keepAwake(on)                 boolean, keeps the screen on while a game runs (optional; app WebViews have no navigator.wakeLock). main.js keepAwake() calls it on change and still tries the web API
     openRoom(urlOrHash)           boolean, bridge-internal: opens #room=CODE from an app link (sets location.hash, reloads once)
     haptic(kind), exit()          optional, see src/haptics.js and hlBack() in main.js
   The bridge (app/native/hlnative.js) also mirrors hl-* localStorage keys into Capacitor Preferences and restores them before the game boots.
   Rules kept here so every build behaves the same:
   never during a game, first ad no earlier than after the 2nd finished game, then every 2nd game. */
const HLAds={
  games:0,
  noAds(){try{return localStorage.getItem('hl-noads')==='1'}catch(e){return false}},
  setNoAds(v){try{localStorage.setItem('hl-noads',v?'1':'0')}catch(e){}},
  can(){return !!(window.HLNative&&window.HLNative.showInterstitial)&&!HLAds.noAds()},
  // call when a finished game is being left (Play again, Close, back to lobby)
  async between(){
    HLAds.games++;
    if(!HLAds.can()||HLAds.games<2||HLAds.games%2)return;
    try{
      track('ad',{t:'inter',s:'show'});
      let tm,st='close';
      // a hung ad must not block the caller; a late ad result is ignored (the race settles once)
      await Promise.race([Promise.resolve(window.HLNative.showInterstitial()).catch(()=>{st='fail'}),new Promise(r=>{tm=setTimeout(()=>{st='fail';r()},window.HL_TEST_AD_MS||15000)})]);
      clearTimeout(tm);track('ad',{t:'inter',s:st});
    }catch(e){track('ad',{t:'inter',s:'fail'})}
  },
  canBuy(){return !!(window.HLNative&&window.HLNative.buyNoAds)&&!HLAds.noAds()},
  async buy(){try{const ok=await window.HLNative.buyNoAds();if(ok){HLAds.setNoAds(true);track('noads')}return !!ok}catch(e){return false}},
  async restore(){try{if(window.HLNative&&window.HLNative.restore)await window.HLNative.restore()}catch(e){}await HLAds.sync()},
  async sync(){try{if(window.HLNative&&window.HLNative.ownsNoAds){const o=await window.HLNative.ownsNoAds();if(o)HLAds.setNoAds(true)}}catch(e){}}
};
HLAds.sync();
