/* Worker A: final showdown. Defines window.showdownTick, called from update() in main.js */
window.showdownTick=function(){
  let on=false;
  try{on=view==='game'&&!!G&&G.phase==='play'&&G.players.length>=3&&G.players.filter(p=>p.a).length===2}catch(e){}
  document.body.classList.toggle('showdown',on);
};
