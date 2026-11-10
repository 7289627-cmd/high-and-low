const {JSDOM}=require('jsdom');const act=require('./act.js');const fs=require('fs');
const html=fs.readFileSync('/home/claude/high-and-low.html','utf8');
const dom=new JSDOM('<!doctype html><body>'+html+'</body>',{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/'});
const w=dom.window; const errs=[]; w.addEventListener('error',e=>errs.push(e.message));
const $=s=>w.document.querySelector(s);
setTimeout(()=>{
  $('#nameIn').value='Dodgy';$('#nameIn').dispatchEvent(new w.Event('input'));
  $('#soloBtn').click();
  setTimeout(()=>{
    console.log('lobby players', w.document.querySelectorAll('.prow2').length);
    $('#startBtn').click();
    setTimeout(()=>{
      ['4','2','4','2'].forEach(k=>$('.key[data-k="'+k+'"]').click()); console.log('entry',$('.secret-big').textContent); $('#lockBtn').click();
      let ticks=0;
      const iv=setInterval(()=>{
        ticks++;
        // if my turn, act
        const sigx=w.eval('JSON.stringify([G.seq,G.stage])'); if(sigx===w.__last){w.__n=(w.__n||0)+1}else{w.__n=0;w.__last=sigx}
        if(w.__n===40){console.log('STUCK', w.eval('JSON.stringify({act:myPres.act,seq:G.seq,stage:G.stage,q:G.q,ui,turn:G.players[G.turn].name,kn:G.kn,ps:G.players.map(p=>[p.name,p.a])})'), (w.document.querySelector('.askv,.tray')||{}).textContent.replace(/\s+/g,' ').slice(0,300)); process.exit(1)}
        act(w);
        const over=$('.tray .turn-name');
        const msg=$('.msg');
        const m2=msg&&msg.textContent; if(m2&&m2!==w.__lm){w.__lm=m2; if((w.__c=(w.__c||0)+1)<=14) console.log('ev:',m2)}
        if(($('#app').textContent+$('#ov').textContent).match(/wins!|Game over|You win/)){console.log('END', $('.tray').textContent.trim().slice(0,80)); clearInterval(iv); console.log('errors',errs); process.exit(0)}
        if(ticks>2600){console.log('timeout', w.eval('JSON.stringify({act:myPres.act,seq:G.seq,stage:G.stage,q:G.q,ui,turn:G.players[G.turn].name,kn:G.kn,ps:G.players.map(p=>[p.name,p.a])})'), w.document.querySelector('#app').innerHTML.slice(0,300));console.log('errors',errs);process.exit(1)}
      },300);
    },200);
  },200);
},500);
