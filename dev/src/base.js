const COLORS=['#EE4B3B','#3D7BFF','#2FA36B','#A35BFF','#FF8A2B','#FF5FA8'];
const BOT_NAMES=['Bean','Pickle','Noodle','Biscuit','Waffle','Turnip'];
const DEATHS=['anvil','zap','rocket','chomp','melt','pop'];
const CAPTION={anvil:'got flattened by a falling anvil.',zap:'got struck by lightning.',rocket:'rode a firework straight into space.',chomp:'got eaten by the number monster.',melt:'melted into a sad little puddle.',pop:'panicked so hard they popped.'};
const SHORT={anvil:'Flattened',zap:'Fried',rocket:'Launched',chomp:'Eaten',melt:'Melted',pop:'Popped'};
const INK='#1E2240';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const fmt=n=>Number(n).toLocaleString('en-US');
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let S, timers=[], sceneSeq=0, quitArmed=false;
function later(fn,ms){const t=setTimeout(fn,ms);timers.push(t);return t}
function clearTimers(){timers.forEach(clearTimeout);timers=[]}

/* ---------- Characters ---------- */
const ACC=[
 ()=>`<path d="M50 -11L37 17h26z" fill="#FFD23F" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M42 6h16" stroke="#EE4B3B" stroke-width="3"/><circle cx="50" cy="-11" r="4" fill="#fff" stroke="${INK}" stroke-width="2"/>`,
 ()=>`<path d="M50 14V-1" stroke="${INK}" stroke-width="3"/><circle cx="50" cy="-5" r="6" fill="#FFD23F" stroke="${INK}" stroke-width="2.5"/>`,
 ()=>`<path d="M24 27a26 23 0 0 1 52 0z" fill="${INK}"/><path d="M70 25h20" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><circle cx="50" cy="5" r="3" fill="#FFD23F"/>`,
 ()=>`<path d="M68 14l-12-9v18zM68 14l12-9v18z" fill="#FF5FA8" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="68" cy="14" r="4" fill="#FF5FA8" stroke="${INK}" stroke-width="2.5"/>`,
 ()=>`<path d="M44 16q-3-10 1-17M50 15q0-12 6-17M56 16q4-9 11-11" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
 ()=>`<g fill="none" stroke="${INK}" stroke-width="3"><circle cx="37" cy="47" r="14"/><circle cx="63" cy="47" r="14"/><path d="M49 46h2M23 44l-5-3M77 44l5-3"/></g>`
];
function charSVG(p,mood='idle',cls=''){
  const c=p.color, d=((p.id||0)*.43).toFixed(2);
  let eyes;
  if(mood==='dead'){
    eyes=`<g stroke="${INK}" stroke-width="5" stroke-linecap="round"><path d="M31 41l12 12M43 41l-12 12M57 41l12 12M69 41l-12 12"/></g>`;
  } else {
    const r=mood==='scared'?3.2:5.2, dy=mood==='happy'?-2:1, dx=mood==='scared'?0:2;
    eyes=`<g class="eyes" style="animation-delay:-${d}s"><circle cx="37" cy="47" r="11" fill="#fff"/><circle cx="63" cy="47" r="11" fill="#fff"/><circle cx="${37+dx}" cy="${47+dy}" r="${r}" fill="${INK}"/><circle cx="${63+dx}" cy="${47+dy}" r="${r}" fill="${INK}"/></g>`;
  }
  const mouth={
    idle:`<path d="M42 72q8 6 16 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
    scared:`<ellipse cx="50" cy="76" rx="5" ry="7" fill="${INK}"/>`,
    happy:`<path d="M37 68q13 17 26 0z" fill="${INK}"/>`,
    dead:`<path d="M40 76q5-4 10 0t10 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
    talk:`<ellipse class="yap" cx="50" cy="75" rx="7" ry="6" fill="${INK}"/>`
  }[mood];
  const sweat=mood==='scared'?`<path d="M82 28q6 9 0 13q-6-4 0-13z" fill="#BFE9FF" stroke="${INK}" stroke-width="1.5"/>`:'';
  return `<svg class="bean ${cls}" style="animation-delay:-${d}s" viewBox="0 -14 100 140" aria-hidden="true">
<g stroke="${c}" stroke-width="7" stroke-linecap="round" fill="none"><path d="M40 100l-3 18M60 100l3 18"/><path d="M19 66l-9 14M81 66l9 14"/></g>
<ellipse cx="35" cy="120" rx="8" ry="4" fill="${INK}"/><ellipse cx="65" cy="120" rx="8" ry="4" fill="${INK}"/>
<rect x="18" y="14" width="64" height="92" rx="32" fill="${c}" stroke="${INK}" stroke-width="2.5"/>
<ellipse cx="34" cy="32" rx="6" ry="11" fill="#fff" opacity=".25"/>
${eyes}${mouth}${sweat}${ACC[(p.acc||0)%ACC.length]()}</svg>`;
}
const TOMB=`<svg class="bean" viewBox="0 -14 100 140" aria-hidden="true"><path d="M22 120V42a28 28 0 0 1 56 0v78z" fill="#C9CCD8" stroke="${INK}" stroke-width="4"/><text x="50" y="66" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="20" fill="#545C7D">RIP</text><path d="M8 122h84" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M30 112q6-8 12 0M58 114q5-6 10 0" stroke="#2FA36B" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;

/* ---------- Scene props ---------- */
const ANVIL=`<svg viewBox="0 0 124 64"><path d="M6 8h80q24 0 34 14H90v10q-6 9-18 11v11h12v8H30v-8h12V43Q26 40 22 24H6z" fill="#3A3F5C" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><text x="44" y="22" font-family="Lilita One, sans-serif" font-size="12" fill="#fff">1 TON</text></svg>`;
const CLOUD=`<svg viewBox="0 0 150 70"><path d="M30 64a22 22 0 0 1 4-43a28 28 0 0 1 52-6a22 22 0 0 1 38 14a18 18 0 0 1-2 35z" fill="#5A6080" stroke="${INK}" stroke-width="3"/></svg>`;
const BOLT=`<svg viewBox="0 0 44 110"><path d="M26 2L4 58h16L10 108 40 44H24L34 2z" fill="#FFE14D" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></svg>`;
const ROCKET=`<svg class="rocket" viewBox="0 0 54 190"><g class="flame"><path d="M12 150q15 52 15 40q0 12 15-40z" fill="#FF8A2B" stroke="${INK}" stroke-width="2"/><path d="M20 150q7 26 7 20q0 6 7-20z" fill="#FFE14D"/></g><path d="M27 4q20 22 20 60v86H7V64Q7 26 27 4z" fill="#fff" stroke="${INK}" stroke-width="3"/><path d="M27 4q14 14 18 34H9Q13 18 27 4z" fill="#EE4B3B" stroke="${INK}" stroke-width="3"/><circle cx="27" cy="62" r="9" fill="#7FD0E4" stroke="${INK}" stroke-width="3"/><path d="M7 110L-4 150h11zM47 110l11 40H47z" fill="#EE4B3B" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M8 122h38M8 134h38" stroke="#EE4B3B" stroke-width="5"/></svg>`;
const POT=`<svg viewBox="0 0 56 64"><path d="M22 22q-8-14 4-22q0 12 4 22M30 22q4-14 18-14q-8 8-12 14" fill="#2FA36B" stroke="${INK}" stroke-width="2.5"/><path d="M6 22h44l-2 8H8z" fill="#E07A4F" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M10 30h36l-5 32H15z" fill="#E07A4F" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></svg>`;
const MON_EYES=`<svg class="mon-eyes" viewBox="0 0 120 40"><circle cx="30" cy="22" r="15" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="90" cy="22" r="15" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="34" cy="26" r="6" fill="${INK}"/><circle cx="86" cy="26" r="6" fill="${INK}"/><path d="M12 5l34 11M108 5L74 16" stroke="${INK}" stroke-width="5" stroke-linecap="round"/></svg>`;
function teeth(down){let d='';for(let i=0;i<10;i++){const x=i*20;d+=down?`M${x} 0L${x+10} 26L${x+20} 0z`:`M${x} 26L${x+10} 0L${x+20} 26z`}
  return `<svg class="teeth" viewBox="0 0 200 26" preserveAspectRatio="none"><path d="${d}" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/></svg>`}
function actor(p,deadAt,cls=''){
  return `<div class="actor ${cls}">${charSVG(p,'scared')}<div class="layer-dead" style="animation-delay:${deadAt}s">${charSVG(p,'dead')}</div></div>`;
}
const SCENES={
  anvil:p=>`${actor(p,.9,'a-squash')}<div class="anvil">${ANVIL}</div><div class="puff" style="left:22%;--dx:-34px"></div><div class="puff" style="left:62%;--dx:34px"></div>`,
  zap:p=>`<div class="cloud">${CLOUD}</div><div class="bolt">${BOLT}</div>${actor(p,.75,'a-zap')}<div class="ash"></div><div class="flash"></div>`,
  rocket:p=>`<div class="rig">${ROCKET}${actor(p,99,'')}</div><div class="puff big" style="left:18%;--dx:-40px;animation-delay:1.1s"></div><div class="puff big" style="left:56%;--dx:40px;animation-delay:1.15s"></div>`,
  chomp:p=>`${actor(p,99,'a-shiver')}<div class="jaw top">${MON_EYES}${teeth(true)}</div><div class="jaw bot">${teeth(false)}</div><div class="burp">*burp*</div>`,
  melt:p=>`<div class="sun"></div><div class="puddle" style="background:${p.color}"></div>${actor(p,2.2,'a-melt')}`,
  pop:p=>{let bits='';const cols=[p.color,'#FFD23F','#fff',p.color];
    for(let i=0;i<28;i++){const a=Math.random()*Math.PI*2,dist=110+Math.random()*110;
      bits+=`<i class="bit" style="--dx:${Math.round(Math.cos(a)*dist)}px;--dy:${Math.round(Math.sin(a)*dist)}px;--r:${rnd(-400,400)}deg;background:${cols[i%4]}"></i>`}
    return `${actor(p,99,'a-pop')}${bits}<div class="pow">POP!</div>`},
  bonk:p=>`${actor(p,99,'a-bonk')}<div class="pot">${POT}</div><div class="stars">★ ★ ★</div>`
};

