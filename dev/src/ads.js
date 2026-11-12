/* ---------- Ads (app builds only) ----------
   The website never shows ads. A store build provides window.HLNative with any of:
     showInterstitial()            full-screen ad, returns a Promise that resolves when it closes
     showRewarded()                Promise<boolean>, true if the player watched to the end
     buyNoAds()                    Promise<boolean>, true once the purchase is owned
     ownsNoAds()                   boolean or Promise<boolean>
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
    try{track('ad',{t:'inter'});await window.HLNative.showInterstitial()}catch(e){}
  },
  canBuy(){return !!(window.HLNative&&window.HLNative.buyNoAds)&&!HLAds.noAds()},
  async buy(){try{const ok=await window.HLNative.buyNoAds();if(ok){HLAds.setNoAds(true);track('noads')}return !!ok}catch(e){return false}},
  async sync(){try{if(window.HLNative&&window.HLNative.ownsNoAds){const o=await window.HLNative.ownsNoAds();if(o)HLAds.setNoAds(true)}}catch(e){}}
};
HLAds.sync();
