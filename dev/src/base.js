const COLORS=['#EE4B3B','#3D7BFF','#2FA36B','#A35BFF','#FF8A2B','#FF5FA8'];
const BOT_NAMES=['Bean','Pickle','Noodle','Biscuit','Waffle','Turnip'];
const DEATHS=['anvil','zap','rocket','chomp','melt','pop','piano','banana','bees','calc'];
const CAPTION={anvil:'got flattened by a falling anvil.',zap:'got struck by lightning.',rocket:'rode a firework straight into space.',chomp:'got eaten by the number monster.',melt:'melted into a sad little puddle.',pop:'panicked so hard they popped.',piano:'got flattened by a falling grand piano.',banana:'slipped on a banana peel into the void.',bees:'got chased off by angry bees.',calc:'got crushed by a giant calculator. ERROR.'};
const SHORT={anvil:'Flattened',zap:'Fried',rocket:'Launched',chomp:'Eaten',melt:'Melted',pop:'Popped',piano:'Pianoed',banana:'Slipped',bees:'Stung',calc:'Calculated'};
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
 ()=>`<g fill="none" stroke="${INK}" stroke-width="3"><circle cx="37" cy="47" r="14"/><circle cx="63" cy="47" r="14"/><path d="M49 46h2M23 44l-5-3M77 44l5-3"/></g>`,
 ()=>`<path d="M24 16L26 -4L38 7L50 -8L62 7L74 -4L76 16z" fill="#FFD23F" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M25 10h50" stroke="${INK}" stroke-width="2"/><circle cx="50" cy="3" r="3.5" fill="#EE4B3B" stroke="${INK}" stroke-width="1.5"/><circle cx="26" cy="-4" r="3" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="74" cy="-4" r="3" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="50" cy="-8" r="3" fill="#fff" stroke="${INK}" stroke-width="2"/>`,
 ()=>`<rect x="30" y="-12" width="40" height="26" rx="4" fill="#2B2F4A" stroke="${INK}" stroke-width="2.5"/><rect x="30" y="3" width="40" height="7" fill="#EE4B3B" stroke="${INK}" stroke-width="2"/><rect x="17" y="11" width="66" height="8" rx="4" fill="#2B2F4A" stroke="${INK}" stroke-width="2.5"/>`,
 ()=>`<path d="M26 20a24 22 0 0 1 48 0z" fill="#3D7BFF" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M50 -2v22M38 2q-4 8-5 16M62 2q4 8 5 16" stroke="${INK}" stroke-width="2" fill="none"/><path d="M50 -2V-8" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><ellipse cx="36" cy="-10" rx="13" ry="3.2" fill="#FFD23F" stroke="${INK}" stroke-width="2"/><ellipse cx="64" cy="-10" rx="13" ry="3.2" fill="#EE4B3B" stroke="${INK}" stroke-width="2"/><circle cx="50" cy="-9" r="3.5" fill="#fff" stroke="${INK}" stroke-width="2"/>`,
 ()=>`<circle cx="35" cy="0" r="12" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="65" cy="0" r="12" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="50" cy="-1" r="13" fill="#fff" stroke="${INK}" stroke-width="2.5"/><rect x="29" y="5" width="42" height="14" rx="3" fill="#fff" stroke="${INK}" stroke-width="2.5"/><path d="M38 9v7M50 9v7M62 9v7" stroke="#C9CCD8" stroke-width="2.5" stroke-linecap="round"/>`,
 ()=>`<path d="M28 14Q8 14 5 -8Q20 0 36 2z" fill="#F6EBD0" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M72 14Q92 14 95 -8Q80 0 64 2z" fill="#F6EBD0" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M22 24a28 22 0 0 1 56 0z" fill="#9AA0B8" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M21 24h58" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M38 8q-2 6 0 12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>`,
 ()=>`<ellipse cx="50" cy="0" rx="27" ry="7" fill="none" stroke="${INK}" stroke-width="9"/><ellipse cx="50" cy="0" rx="27" ry="7" fill="none" stroke="#FFD23F" stroke-width="4.5"/>`
];
const HAT_NAMES=['Party hat','Antenna','Cap','Bow','Hair tuft','Glasses','Crown','Top hat','Propeller','Chef hat','Viking horns','Halo'];
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

const PIANO=`<svg viewBox="0 0 160 104"><path d="M8 34Q8 12 34 12H112Q152 12 156 44L152 66H8z" fill="#2B2F4A" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M20 22H108" stroke="#fff" stroke-width="3" opacity=".25" stroke-linecap="round"/><rect x="10" y="62" width="142" height="14" rx="2" fill="#fff" stroke="${INK}" stroke-width="3"/><path d="M26 62v14M42 62v14M58 62v14M74 62v14M90 62v14M106 62v14M122 62v14M138 62v14" stroke="${INK}" stroke-width="2"/><path d="M22 62v8M38 62v8M62 62v8M78 62v8M94 62v8M110 62v8M126 62v8" stroke="${INK}" stroke-width="5"/><rect x="16" y="76" width="9" height="24" rx="2" fill="#2B2F4A" stroke="${INK}" stroke-width="3"/><rect x="136" y="76" width="9" height="24" rx="2" fill="#2B2F4A" stroke="${INK}" stroke-width="3"/></svg>`;
const PKEY=`<svg viewBox="0 0 14 34"><rect x="1.5" y="1.5" width="11" height="31" rx="2" fill="#fff" stroke="${INK}" stroke-width="2.5"/></svg>`;
const PEEL=`<svg viewBox="0 0 80 34"><path d="M6 24Q4 12 22 12Q40 10 58 12Q76 12 74 24Q60 18 40 20Q20 18 6 24z" fill="#FFD23F" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M14 22Q8 30 12 32Q20 28 26 22zM66 22Q74 30 68 32Q60 28 54 22z" fill="#FFE98A" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M26 18q14-4 28 0" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
const BEE=`<svg viewBox="0 0 30 22"><ellipse cx="11" cy="5" rx="6" ry="4" fill="#fff" stroke="${INK}" stroke-width="1.5" transform="rotate(-25 11 5)"/><ellipse cx="19" cy="5" rx="6" ry="4" fill="#fff" stroke="${INK}" stroke-width="1.5" transform="rotate(25 19 5)"/><ellipse cx="14" cy="14" rx="11" ry="7" fill="#FFD23F" stroke="${INK}" stroke-width="2"/><path d="M10 8v12M16 8v12" stroke="${INK}" stroke-width="3"/><path d="M25 14l4 1" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><circle cx="7" cy="12" r="1.6" fill="${INK}"/></svg>`;
const CALC=`<svg viewBox="0 0 120 150"><rect x="4" y="4" width="112" height="142" rx="12" fill="#6B7194" stroke="${INK}" stroke-width="3.5"/><rect x="14" y="14" width="92" height="34" rx="5" fill="#BFE9D0" stroke="${INK}" stroke-width="3"/><text class="d2-num" x="100" y="40" text-anchor="end" font-family="Lilita One, sans-serif" font-size="24" fill="${INK}">88888</text><text class="d2-err" x="60" y="40" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="21" fill="#EE4B3B">ERROR</text><g fill="#fff" stroke="${INK}" stroke-width="2.5"><rect x="14" y="58" width="20" height="16" rx="4"/><rect x="40" y="58" width="20" height="16" rx="4"/><rect x="66" y="58" width="20" height="16" rx="4"/><rect x="14" y="80" width="20" height="16" rx="4"/><rect x="40" y="80" width="20" height="16" rx="4"/><rect x="66" y="80" width="20" height="16" rx="4"/><rect x="14" y="102" width="20" height="16" rx="4"/><rect x="40" y="102" width="20" height="16" rx="4"/><rect x="66" y="102" width="20" height="16" rx="4"/><rect x="14" y="124" width="46" height="16" rx="4"/></g><g stroke="${INK}" stroke-width="2.5"><rect x="92" y="58" width="14" height="38" rx="4" fill="#FF8A2B"/><rect x="92" y="102" width="14" height="38" rx="4" fill="#EE4B3B"/><rect x="66" y="124" width="20" height="16" rx="4" fill="#fff"/></g></svg>`;
function swarm(){let b='';const n=10;for(let i=0;i<n;i++){const a=Math.round(i*360/n),r=48+(i%3)*14,t=(0.9+(i%4)*.15).toFixed(2);
  b+=`<div class="d2-orb" style="--a:${a}deg;--t:${t}s"><div class="d2-bee" style="--r:${r}px;animation-delay:-${(i*.13).toFixed(2)}s">${BEE}</div></div>`}
  return `<div class="d2-swarm">${b}</div>`}
const WELTS=`<div class="actor d2-puffbean d2-welts"><svg viewBox="0 -14 100 140"><rect x="18" y="14" width="64" height="92" rx="32" fill="#EE4B3B" opacity=".55"/><g fill="#EE4B3B" stroke="${INK}" stroke-width="1.8"><circle cx="30" cy="30" r="4"/><circle cx="68" cy="26" r="3.5"/><circle cx="24" cy="62" r="3.5"/><circle cx="76" cy="58" r="4"/><circle cx="50" cy="92" r="4"/><circle cx="34" cy="98" r="3"/><circle cx="66" cy="96" r="3.5"/><circle cx="50" cy="22" r="3"/></g></svg></div>`;
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
  bonk:p=>`${actor(p,99,'a-bonk')}<div class="pot">${POT}</div><div class="stars">★ ★ ★</div>`,
  piano:p=>`${actor(p,.9,'a-squash')}<div class="d2-piano">${PIANO}</div><div class="d2-key" style="--dx:-90px;--r:-200deg">${PKEY}</div><div class="d2-key" style="--dx:80px;--r:240deg;animation-delay:.94s">${PKEY}</div><div class="d2-key" style="--dx:-30px;--r:120deg;animation-delay:.98s">${PKEY}</div><div class="puff" style="left:14%;--dx:-34px"></div><div class="puff" style="left:68%;--dx:34px"></div>`,
  banana:p=>`<div class="d2-peel">${PEEL}</div>${actor(p,1.05,'d2-slip')}<div class="d2-cover"></div><div class="d2-hole top"></div>`,
  bees:p=>`${actor(p,1.9,'d2-puffbean')}${WELTS}${swarm()}`,
  calc:p=>`${actor(p,.9,'a-squash')}<div class="d2-calc">${CALC}</div><div class="puff" style="left:16%;--dx:-34px"></div><div class="puff" style="left:66%;--dx:34px"></div>`
};
window.EXTRA_DEATH_SFX={piano:[['d_piano',.86],['bonk',1.0,.8]],banana:[['d_slip',.45],['whoosh',1.3,1.7]],bees:[['d_buzz',.05],['d_buzz',1.3,1.15]],calc:[['d_slam',.86],['error',1.0,1.4]]};

