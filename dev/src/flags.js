/* Feature flags. Off by default. Turn on with #flags=name,name (kept on this device); #flags= turns all off. */
window.HL_FLAGS=Object.assign({streak:false,share:false},window.HL_FLAGS||{});
(function(){
  try{
    var m=/[#&]flags=([^&]*)/.exec(location.hash);
    if(m){var v=decodeURIComponent(m[1]).trim();if(v)localStorage.setItem('hl-flags',v);else localStorage.removeItem('hl-flags')}
    var s=localStorage.getItem('hl-flags')||'';
    s.split(',').forEach(function(n){n=n.trim();if(n in window.HL_FLAGS)window.HL_FLAGS[n]=true});
  }catch(e){}
})();
