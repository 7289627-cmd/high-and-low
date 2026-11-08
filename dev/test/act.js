module.exports=function act(P){
  const q=s=>P.document.querySelector(s);
  const g=q('.g[data-n]');if(g){g.click();return}
  const d=q('[data-pickdir]');if(d){P.document.querySelectorAll('[data-pickdir]')[Math.random()<.5?0:1].click();return}
  const mid=q('.key[data-k="mid"]');if(mid&&q('#askGo')){mid.click();q('#askGo').click();return}
  const pick=q('.card.pick');if(pick){pick.click();return}
};
