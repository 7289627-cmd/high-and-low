/* ---------- Ads (app builds only) ----------
   The website never shows ads. A store build provides window.HLNative with any of:
     showInterstitial(current)     shows an already-loaded ad if current() still permits presentation
     showRewarded()                Promise<boolean>, true if the player watched to the end
     buyNoAds()                    Promise<boolean>, true once the purchase is owned
     ownsNoAds()                   boolean or Promise<boolean>
     restore()                     Promise<boolean>, asks the store to restore purchases (optional; shows the "Restore purchases" button when present)
     keepAwake(on)                 boolean, keeps the screen on while a game runs (optional; app WebViews have no navigator.wakeLock). main.js keepAwake() calls it on change and still tries the web API
     openRoom(urlOrHash)           boolean, bridge-internal: opens #room=CODE from an app link (sets location.hash, reloads once)
     haptic(kind), exit()          optional, see src/haptics.js and hlBack() in main.js
   The bridge (app/native/hlnative.js) also mirrors hl-* localStorage keys into Capacitor Preferences and restores them before the game boots.
   An active player gets one opportunity at the end of each finished round. */
const HLAds={
  attempted:new Set(),
  noAds(){try{return localStorage.getItem('hl-noads')==='1'}catch(e){return false}},
  setNoAds(v){try{localStorage.setItem('hl-noads',v?'1':'0')}catch(e){}},
  can(){return !!(window.HLNative&&window.HLNative.showInterstitial)&&!HLAds.noAds()},
  async finished(round,current){
    if(!HLAds.can()||HLAds.attempted.has(round))return;
    HLAds.attempted.add(round);
    if(HLAds.attempted.size>64)HLAds.attempted.delete(HLAds.attempted.values().next().value);
    if(!current())return;
    try{
      track('ad',{t:'inter',s:'show'});
      const shown=await window.HLNative.showInterstitial(current);
      track('ad',{t:'inter',s:shown?'close':'fail'});
    }catch(e){track('ad',{t:'inter',s:'fail'})}
  },
  canBuy(){return !!(window.HLNative&&window.HLNative.buyNoAds)&&!HLAds.noAds()},
  async buy(){try{const ok=await window.HLNative.buyNoAds();if(ok){HLAds.setNoAds(true);track('noads')}return !!ok}catch(e){return false}},
  async restore(){try{if(window.HLNative&&window.HLNative.restore)await window.HLNative.restore()}catch(e){}await HLAds.sync()},
  async sync(){try{if(window.HLNative&&window.HLNative.ownsNoAds){const o=await window.HLNative.ownsNoAds();if(o)HLAds.setNoAds(true)}}catch(e){}}
};
HLAds.sync();
