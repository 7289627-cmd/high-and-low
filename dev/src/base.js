const COLORS=['#EE4B3B','#3D7BFF','#2FA36B','#A35BFF','#FF8A2B','#FF5FA8'];
const BOT_NAMES=['Bean','Pickle','Noodle','Biscuit','Waffle','Turnip'];
const DEATHS=['anvil','zap','rocket','chomp','melt','pop','piano','banana','calc'];
const CAPTION={anvil:'got flattened by a falling anvil.',zap:'got zapped by a grumpy cloud.',rocket:'rode a firework straight into space.',chomp:'got gobbled up by the number monster.',melt:'melted into a sad little puddle.',pop:'got pumped up until they popped.',piano:'got flattened by a falling grand piano.',banana:'slipped on a banana peel into the void.',bees:'got chased and puffed up by angry bees.',calc:'got crushed by a giant calculator. ERROR.'};
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
const TOMB=`<svg class="bean" viewBox="0 -14 100 140" aria-hidden="true"><path d="M22 120V42a28 28 0 0 1 56 0v78z" fill="#C9CCD8" stroke="${INK}" stroke-width="4"/><text x="50" y="66" text-anchor="middle" font-family="Bagel Fat One, sans-serif" font-size="20" fill="#545C7D">RIP</text><path d="M8 122h84" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M30 112q6-8 12 0M58 114q5-6 10 0" stroke="#2FA36B" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`;

/* ---------- Scene props ---------- */
const ANVIL=`<svg viewBox="0 0 124 64"><path d="M6 8h80q24 0 34 14H90v10q-6 9-18 11v11h12v8H30v-8h12V43Q26 40 22 24H6z" fill="#3A3F5C" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><text x="44" y="22" font-family="Bagel Fat One, sans-serif" font-size="12" fill="#fff">1 TON</text></svg>`;
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
const CALC=`<svg viewBox="0 0 120 150"><rect x="4" y="4" width="112" height="142" rx="12" fill="#6B7194" stroke="${INK}" stroke-width="3.5"/><rect x="14" y="14" width="92" height="34" rx="5" fill="#BFE9D0" stroke="${INK}" stroke-width="3"/><text class="d2-num" x="100" y="40" text-anchor="end" font-family="Bagel Fat One, sans-serif" font-size="24" fill="${INK}">88888</text><text class="d2-err" x="60" y="40" text-anchor="middle" font-family="Bagel Fat One, sans-serif" font-size="21" fill="#EE4B3B">ERROR</text><g fill="#fff" stroke="${INK}" stroke-width="2.5"><rect x="14" y="58" width="20" height="16" rx="4"/><rect x="40" y="58" width="20" height="16" rx="4"/><rect x="66" y="58" width="20" height="16" rx="4"/><rect x="14" y="80" width="20" height="16" rx="4"/><rect x="40" y="80" width="20" height="16" rx="4"/><rect x="66" y="80" width="20" height="16" rx="4"/><rect x="14" y="102" width="20" height="16" rx="4"/><rect x="40" y="102" width="20" height="16" rx="4"/><rect x="66" y="102" width="20" height="16" rx="4"/><rect x="14" y="124" width="46" height="16" rx="4"/></g><g stroke="${INK}" stroke-width="2.5"><rect x="92" y="58" width="14" height="38" rx="4" fill="#FF8A2B"/><rect x="92" y="102" width="14" height="38" rx="4" fill="#EE4B3B"/><rect x="66" y="124" width="20" height="16" rx="4" fill="#fff"/></g></svg>`;
function swarm(){let b='';const n=10;for(let i=0;i<n;i++){const a=Math.round(i*360/n),r=48+(i%3)*14,t=(0.9+(i%4)*.15).toFixed(2);
  b+=`<div class="d2-orb" style="--a:${a}deg;--t:${t}s"><div class="d2-bee" style="--r:${r}px;animation-delay:-${(i*.13).toFixed(2)}s">${BEE}</div></div>`}
  return `<div class="d2-swarm">${b}</div>`}
const WELTS=`<div class="actor d2-puffbean d2-welts"><svg viewBox="0 -14 100 140"><rect x="18" y="14" width="64" height="92" rx="32" fill="#EE4B3B" opacity=".55"/><g fill="#EE4B3B" stroke="${INK}" stroke-width="1.8"><circle cx="30" cy="30" r="4"/><circle cx="68" cy="26" r="3.5"/><circle cx="24" cy="62" r="3.5"/><circle cx="76" cy="58" r="4"/><circle cx="50" cy="92" r="4"/><circle cx="34" cy="98" r="3"/><circle cx="66" cy="96" r="3.5"/><circle cx="50" cy="22" r="3"/></g></svg></div>`;
function actor(p,deadAt,cls=''){
  return `<div class="actor ${cls}">${charSVG(p,'scared')}<div class="layer-dead" style="animation-delay:${deadAt}s">${charSVG(p,'dead')}</div></div>`;
}

/* ---------- Death scenes v3: three-beat cartoons (setup, gag, aftermath) ---------- */
const SCENE_MS={anvil:4600,zap:4400,rocket:4600,chomp:4800,melt:4800,pop:4600,piano:4600,banana:4800,bees:4600,calc:4800};
const ACCBOX=['30 -16 40 36','40 -14 20 30','18 -2 76 30','52 -2 34 30','38 -10 34 30','14 30 72 36','20 -12 60 32','12 -16 76 38','0 -16 100 42','22 -16 56 38','0 -12 100 44','20 -10 60 22'];
function accSVG(p,w){const i=(p.acc||0)%ACC.length;return `<svg viewBox="${ACCBOX[i]}" style="width:${w}px;display:block;overflow:visible">${ACC[i]()}</svg>`}
const STAR3=`<svg viewBox="0 0 24 24"><path d="M12 2l3 7 7.5.6-5.7 4.9 1.8 7.4L12 18l-6.6 3.9 1.8-7.4L1.5 9.6 9 9z" fill="#FFD23F" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/></svg>`;
const NOTE3=c=>`<svg viewBox="0 0 24 24"><path d="M9 18V6l12-2v12" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M9 6l12-2v4L9 10z" fill="${INK}"/><ellipse cx="6" cy="18.5" rx="4.6" ry="3.6" fill="${c}" stroke="${INK}" stroke-width="2.2"/><ellipse cx="18" cy="16.5" rx="4.6" ry="3.6" fill="${c}" stroke="${INK}" stroke-width="2.2"/></svg>`;
function E3(c,st,h=''){return `<div class="${c}" style="${st}">${h}</div>`}
function T3(n,x,y,fs,fill,ex='',anchor='middle'){n=String(n);const f=Math.min(fs,fs*5.2/Math.max(n.length,1));
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Bagel Fat One, sans-serif" font-size="${f.toFixed(1)}" fill="${fill}" ${ex}>${esc(n)}</text>`}
function stars3(d,x,y,n=6,r=70){let h='';for(let i=0;i<n;i++){const a=Math.PI+(i+.5)/n*Math.PI,dx=Math.round(Math.cos(a)*r*(i%2?1:.75)),dy=Math.round(Math.sin(a)*r*.85);
  h+=`<i class="x3-st" style="left:calc(50% + ${x}px);bottom:${y}px;--dx:${dx}px;--dy:${dy}px;--r:${(i%2?1:-1)*(160+i*45)}deg;animation-delay:${d}s">${STAR3}</i>`}return h}
function word3(t,d,x,y,rot,fs){return `<div class="x3-word" style="left:${x};top:${y}px;--rot:${rot}deg;animation-delay:${d}s${fs?`;font-size:${fs}px`:''}">${t}</div>`}
function puff3(d,x,dx,big,col){return `<div class="puff${big?' big':''}" style="left:calc(50% + ${x}px);--dx:${dx}px;animation-delay:${d}s${col?`;background:${col}`:''}"></div>`}
function K3(k,st,cls='',inner=''){return k?`<div class="x3-k ${cls}" style="${st}">${charSVG(k,'happy')}${inner}</div>`:''}
function A3(p,o={}){
  const s=o.s==null?.4:o.s,d=o.d;
  const ex=o.ex===false?'':`<div class="x3-ex" style="animation:x3pop .3s ease-out ${s}s forwards${d!=null?`,x3off .01s linear ${d}s forwards`:''}">!</div>`;
  const dead=d==null?'':`<div class="x3-l" style="opacity:0;animation:x3on .01s linear ${d}s forwards">${o.dead||charSVG(p,'dead')}</div>`;
  return `<div class="actor x3-a ${o.cls||''}" style="${o.st||''}">${ex}${o.under||''}<div style="animation:x3off .01s linear ${s}s forwards">${charSVG(p,'idle')}</div><div class="x3-l" style="opacity:0;animation:x3on .01s linear ${s}s forwards${d!=null?`,x3off .01s linear ${d}s forwards`:''}">${charSVG(p,'scared')}</div>${dead}${o.over||''}</div>`}
const SH=(d,dur,off)=>`animation:x3shake ${dur||.55}s linear ${d}s both`;
const ROPE_TAN='#C79A5E';

/* props v3 */
const ANVIL3=n=>ANVIL.replace(/<text[^]*<\/text>/,T3(n||'1 TON',46,21.5,15,'#fff'));
const ROCKET3=n=>ROCKET.replace('class="flame"','class="x3-fl"').replace('class="rocket"','').replace('<path d="M8 122h38M8 134h38" stroke="#EE4B3B" stroke-width="5"/>',n?T3(n,33,112,17,'#EE4B3B','transform="rotate(-90 33 112)"'):'<path d="M8 122h38M8 134h38" stroke="#EE4B3B" stroke-width="5"/>');
const CLOUD3=`<svg viewBox="0 0 150 70"><path d="M30 64a22 22 0 0 1 4-43a28 28 0 0 1 52-6a22 22 0 0 1 38 14a18 18 0 0 1-2 35z" fill="#5A6080" stroke="${INK}" stroke-width="3"/><g stroke="${INK}" stroke-width="2.5"><circle cx="58" cy="40" r="9" fill="#fff"/><circle cx="92" cy="40" r="9" fill="#fff"/></g><circle cx="60" cy="42" r="3.6" fill="${INK}"/><circle cx="90" cy="42" r="3.6" fill="${INK}"/><path d="M46 25l22 9M104 25l-22 9" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/><path d="M63 58q12-9 24 0" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/></svg>`;
const CLOUDG=`<svg viewBox="0 0 150 70"><path d="M30 64a22 22 0 0 1 4-43a28 28 0 0 1 52-6a22 22 0 0 1 38 14a18 18 0 0 1-2 35z" fill="#FFE98A" stroke="${INK}" stroke-width="3"/></svg>`;
const PIANO3=n=>PIANO.replace('<path d="M20 22H108"',(n?T3(n,82,48,24,'#FFD23F'):'')+'<path d="M20 22H108"');
const CALC3=n=>CALC.replace(/<text class="d2-num"[^]*?<\/text>/,T3(n||'88888',100,40,26,INK,'class="x3-num"','end')).replace('class="d2-err"','class="x3-err"');
const MINICALC=`<svg viewBox="0 0 30 40"><rect x="2" y="2" width="26" height="36" rx="4" fill="#6B7194" stroke="${INK}" stroke-width="2.5"/><rect x="5" y="5" width="20" height="9" rx="2" fill="#BFE9D0" stroke="${INK}" stroke-width="1.5"/><g fill="#fff" stroke="${INK}" stroke-width="1.5"><rect class="x3-mk" x="5" y="17" width="6" height="5" rx="1.5" style="animation-delay:.6s"/><rect class="x3-mk" x="12" y="17" width="6" height="5" rx="1.5" style="animation-delay:.8s"/><rect class="x3-mk" x="19" y="17" width="6" height="5" rx="1.5" style="animation-delay:1s"/><rect x="5" y="24" width="6" height="5" rx="1.5"/><rect x="12" y="24" width="6" height="5" rx="1.5"/></g><rect class="x3-mk x3-eq" x="19" y="24" width="6" height="12" rx="1.5" fill="#EE4B3B" stroke="${INK}" stroke-width="1.5"/></svg>`;
const SIGN3=(n,fb)=>`<svg viewBox="0 0 66 40"><path d="M10 0l-3 14M56 0l3 14" stroke="${INK}" stroke-width="1.8" fill="none"/><rect x="2" y="14" width="62" height="25" rx="5" fill="#FFF8EC" stroke="${INK}" stroke-width="3"/>${T3(n||fb||'?',33,33,19,INK)}</svg>`;
const PANCAKE=(p,shoes)=>`<svg viewBox="0 0 176 44"><ellipse cx="88" cy="28" rx="82" ry="13" fill="${p.color}" stroke="${INK}" stroke-width="3"/><ellipse cx="60" cy="21" rx="30" ry="4" fill="#fff" opacity=".28"/>${shoes?`<ellipse cx="7" cy="36" rx="7" ry="4" fill="${INK}"/><ellipse cx="169" cy="36" rx="7" ry="4" fill="${INK}"/>`:''}<g stroke="${INK}" stroke-width="3.5" stroke-linecap="round"><path d="M61 22l9 9M70 22l-9 9M105 22l9 9M114 22l-9 9"/></g><path d="M80 36q8-5 16 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
const BEE3=`<div class="x3-bee">${BEE}</div>`;
function orbit3(count,rbase,rstep,tbase,cls){let b='';for(let i=0;i<count;i++){const a=Math.round(i*360/count),r=rbase+(i%3)*rstep,t=(tbase+(i%4)*.14).toFixed(2);
  b+=`<div class="x3-orb" style="--a:${a}deg;--t:${t}s"><div class="x3-bee" style="--r:${r}px;animation-delay:-${(i*.13).toFixed(2)}s">${BEE}</div></div>`}return b}

const SCENES={
anvil:(p,k,n)=>`<div class="x3-shake" style="${SH(1.36)}">
${E3('x3-shadow','animation:x3shg 1.2s ease-in .1s both,x3off .01s linear 2.1s forwards')}
${k?`<svg class="x3-ov" viewBox="0 0 314 250" preserveAspectRatio="none"><g fill="none" stroke-linecap="round"><g style="animation:x3off .01s linear 1.06s forwards"><path d="M22 150L157 8" stroke="${INK}" stroke-width="7"/><path d="M22 150L157 8" stroke="${ROPE_TAN}" stroke-width="3.5"/></g><g style="opacity:0;animation:x3on .01s linear 1.06s forwards"><path d="M22 150C24 176 48 190 78 186" stroke="${INK}" stroke-width="7"/><path d="M22 150C24 176 48 190 78 186" stroke="${ROPE_TAN}" stroke-width="3.5"/></g></g></svg>`:''}
${E3('x3-ceil','','')}
<div class="x3-anv" style="animation:x3anv 2.7s linear both"><div class="x3-rope"></div>${ANVIL3(n)}</div>
${A3(p,{s:.34,d:1.36,cls:'x3-anvb',st:'animation:x3anvb 1.8s linear both,x3off .01s linear 1.8s forwards'})}
${E3('x3-pc','animation:x3on .01s linear 1.8s forwards,x3pcw .6s ease-out 2s forwards',PANCAKE(p,1))}
${E3('x3-flag','animation:x3flag .45s cubic-bezier(.2,1.8,.4,1) 2.6s both',`<svg viewBox="0 0 76 86"><path d="M9 84V6" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M9 6h62v30H9z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>${T3(n||'RIP',41,29,19,INK)}</svg>`)}
${E3('x3-diz','animation:x3on .01s linear 2.9s forwards',[0,.35,.7].map(d=>`<i class="x3-dz" style="animation-delay:${d}s"><i style="animation-delay:${(d+.2).toFixed(2)}s">${STAR3}</i></i>`).join(''))}
${puff3(1.38,-86,-36)}${puff3(1.38,38,36)}${stars3(1.4,0,100,6,82)}
${word3('CLANG!',1.42,'50%',16,-7)}
${K3(k,'left:6px','x3-ka')}
</div>`,

zap:(p,k,n)=>`<div class="x3-shake" style="${SH(1.5,.5)}">
${E3('x3-zc','',`<div class="x3-zci" style="animation:x3zc 3.8s linear both"><div class="x3-zj">${CLOUD3}<div class="x3-zg" style="animation:x3flick .1s steps(1) 1.2s 3 alternate">${CLOUDG}</div>${[22,42,62].map((l,i)=>`<i class="x3-rd" style="left:${l}%;animation-delay:${(.9+i*.17).toFixed(2)}s"></i>`).join('')}</div></div>`)}
${A3(p,{s:.45,d:2.1,cls:'x3-zb',st:'animation:x3zb 1.2s linear both,x3zfl .6s linear 1.5s both',dead:`<div class="x3-char" style="animation:x3cblink .9s linear infinite">${charSVG({color:'#454A66',acc:p.acc,id:p.id},'dead')}</div>`})}
${[0,.5,1].map(d=>`<i class="x3-sm" style="left:calc(50% - 38px);animation-delay:${(2.1+d*.45).toFixed(2)}s"></i>`).join('')}
${E3('x3-bolt','animation:x3bolt .55s linear 1.5s forwards',BOLT)}
${E3('x3-flash','animation:flash .6s linear 1.5s both')}
${K3(k,'right:8px','x3-kz',`<div class="x3-rem"><svg viewBox="0 0 24 44"><path d="M12 6V-6" stroke="${INK}" stroke-width="2.5"/><circle cx="12" cy="-6" r="2.5" fill="#EE4B3B"/><rect x="3" y="6" width="18" height="36" rx="5" fill="#3A3F5C" stroke="${INK}" stroke-width="2.5"/><circle class="x3-rb" cx="12" cy="18" r="5" fill="#EE4B3B" stroke="${INK}" stroke-width="2"/><rect x="7" y="29" width="10" height="4" rx="1" fill="#9AA0B8"/></svg><i class="x3-sg" style="animation-delay:1.3s"></i><i class="x3-sg" style="animation-delay:1.42s"></i></div>`)}
${word3('ZAP!',1.52,'74%',40,8,50)}
</div>`,

rocket:(p,k,n)=>`<div class="x3-shake" style="${SH(1.5,.7)}">
${E3('x3-scorch','animation:x3on .01s linear 1.55s forwards')}
${E3('x3-fuse',k?'':'left:-4px',`<div class="x3-fu"></div><div class="x3-fub"></div><i class="x3-spk" style="animation:x3sp .7s linear .5s forwards,x3off .01s linear 1.2s forwards,x3spin .25s linear infinite">${STAR3}</i>`)}
<div class="x3-rig" style="animation:x3rig 2.2s linear both">
 <div class="x3-rk">${ROCKET3(n)}</div>
 ${A3(p,{s:.3,cls:'x3-rb2',st:'left:-84px;margin-left:0;bottom:0;width:100px;animation:x3hug .2s linear 1.2s 6 alternate'})}
 <div class="x3-strap"></div>
</div>
${[[1.5,-70,-40],[1.6,-10,0],[1.7,30,44]].map(a=>puff3(a[0],a[1],a[2],1)).join('')}
${word3('ZOOM!',1.7,'76%',96,8,42)}
<div class="x3-fw" style="animation:x3on .01s linear 2.3s forwards">${Array.from({length:12},(_,i)=>`<i class="x3-ray" style="--a:${i*30}deg;background:${['#FFD23F',p.color,'#fff'][i%3]};animation-delay:2.3s"></i>`).join('')}<i class="x3-fwc" style="animation-delay:2.3s"></i></div>
<div class="x3-bstar" style="animation:x3pop .4s ease-out 2.6s forwards,x3twk 1s ease-in-out 3s 2 alternate">${STAR3.replace('#FFD23F',p.color)}</div>
<div class="x3-hat"><div style="animation:x3hd .9s linear 2.5s both"><div style="animation:x3hs 1.2s cubic-bezier(.15,.7,.3,1) 3.4s both">${accSVG(p,52)}</div></div></div>
${K3(k,'left:6px','x3-kr',`<i class="x3-match"><i></i></i>`)}
</div>`,

chomp:(p,k,n)=>`<div class="x3-shake" style="${SH(1.5,.5)}">
${E3('x3-dark','animation:x3dk 3.6s linear .2s both')}
${E3('x3-in','animation:x3on .01s linear 1.45s forwards')}
${A3(p,{s:.55,d:null,cls:'x3-cb',st:'animation:x3cb 1.5s linear both,x3off .01s linear 1.46s forwards'})}
<div class="x3-jt" style="animation:x3jt 3.6s linear both">${E3('x3-me','animation:x3off .01s linear 2.7s forwards',MON_EYES)}${E3('x3-me','opacity:0;animation:x3on .01s linear 2.7s forwards',`<svg viewBox="0 0 120 40"><path d="M14 30q16-26 32 0M74 30q16-26 32 0" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><ellipse cx="22" cy="31" rx="9" ry="4" fill="#FF8FB5" opacity=".7"/><ellipse cx="98" cy="31" rx="9" ry="4" fill="#FF8FB5" opacity=".7"/></svg>`)}${teeth(true)}</div>
<div class="x3-jb" style="animation:x3jb 3.6s linear both">${teeth(false)}<div class="x3-bib"><svg viewBox="0 0 90 74"><path d="M10 0Q45 18 80 0M14 3L18 56Q45 76 72 56L76 3" fill="#FFF8EC" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>${T3(n||'YUM',45,46,19,INK)}</svg></div></div>
${E3('x3-chat','opacity:0;animation:x3on .01s linear 2.85s forwards',`<div style="animation:x3chx .6s linear 2.85s both"><div style="animation:x3chy .6s linear 2.85s both">${accSVG(p,46)}</div></div>`)}
${K3(k,'left:6px','x3-kc',`<div class="x3-bell"><svg viewBox="0 0 30 34"><path d="M15 2v5M5 28q1-14 10-17q9 3 10 17z" fill="#FFD23F" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="15" cy="30" r="3" fill="${INK}"/></svg></div>`)}
${stars3(1.5,0,90,6,90)}
<div class="x3-word" style="left:50%;top:92px;--rot:-6deg;font-size:50px;animation:x3word .45s cubic-bezier(.2,1.6,.4,1) 1.5s both,x3off .01s linear 2.6s forwards">CHOMP!</div>
<div class="puff big" style="left:calc(50% - 35px);bottom:76px;--dx:0px;animation-delay:2.82s;background:#C8F0A0"></div>
${word3('*BURP*',2.85,'50%',112,5,34)}
</div>`,

melt:(p,k,n)=>`<div class="x3-shake" style="${SH(2,.4)}">
<div class="x3-sun" style="animation:x3sun .8s cubic-bezier(.2,1.5,.4,1) .1s both"><svg viewBox="0 0 130 130"><g class="x3-sr" style="animation:x3spin 9s linear infinite">${Array.from({length:12},(_,i)=>`<path d="M65 2l9 16h-18z" fill="#FFB52E" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" transform="rotate(${i*30} 65 65)"/>`).join('')}</g><circle cx="65" cy="65" r="42" fill="#FFD23F" stroke="${INK}" stroke-width="3.5"/><g style="animation:x3gl .5s ease-out .6s both"><path d="M36 54h58v6q0 12-12 12h-4q-9 0-11-8h-8q-2 8-11 8h-4q-12 0-12-12z" fill="${INK}"/><path d="M42 57l8 8M70 57l8 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></g><path d="M46 82q19 12 40-2" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="38" cy="76" rx="6" ry="4" fill="#FF8A2B" opacity=".5"/></svg></div>
${k?`<svg class="x3-ov x3-ovr" viewBox="0 0 314 250" preserveAspectRatio="none"><g style="opacity:0;animation:x3on .3s linear 1s forwards"><path d="M268 30L292 50L228 128L184 104z" fill="#FFF2A8" opacity=".6"/><path d="M186 106L228 124L172 130z" fill="#FFF2A8" opacity=".85"/></g></svg>`:''}
${A3(p,{s:.5,d:2.05,cls:'x3-mb',st:'margin-left:-79px;animation:x3mb 2.7s linear both,x3off .01s linear 2.7s forwards'})}
${[-40,-20,0,20,38].map((x,i)=>`<i class="x3-dr" style="background:${p.color};left:calc(50% - 24px + ${x}px);animation-delay:${(1.25+i*.2).toFixed(2)}s"></i>`).join('')}
${[[-36,.8],[34,.95],[-8,1.1]].map(a=>`<i class="x3-sw" style="left:calc(50% - 24px + ${a[0]}px);animation-delay:${a[1]}s"></i>`).join('')}
${[-30,-8,16].map((x,i)=>`<svg class="x3-ht" viewBox="0 0 20 40" style="left:calc(50% - 24px + ${x}px);animation-delay:${(.7+i*.3).toFixed(2)}s"><path d="M10 38q-8-8 0-15t0-15" fill="none" stroke="#FFF" stroke-width="4" stroke-linecap="round" opacity=".8"/></svg>`).join('')}
${E3('x3-pud','opacity:0;animation:x3on .01s linear 1.3s forwards,x3pud 1.5s ease-in 1.3s both',`<svg viewBox="0 0 240 46"><path d="M6 28Q4 14 40 12Q70 3 110 8Q150 2 190 10Q236 12 234 28Q230 42 190 41Q120 45 60 41Q10 41 6 28z" fill="${p.color}" stroke="${INK}" stroke-width="3"/><ellipse cx="70" cy="14" rx="40" ry="3.5" fill="#fff" opacity=".35"/><g class="x3-pe"><circle cx="58" cy="26" r="10" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="86" cy="26" r="10" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="60" cy="28" r="4.5" fill="${INK}"/><circle cx="88" cy="28" r="4.5" fill="${INK}"/></g>${n?T3(n,162,34,22,'#fff','stroke="'+INK+'" stroke-width="4" paint-order="stroke"'):''}</svg><i class="x3-bub" style="left:46px;animation-delay:3s"></i><i class="x3-bub" style="left:92px;animation-delay:3.5s"></i>`)}
${E3('x3-lens','animation:x3on .01s linear .9s forwards',`<svg viewBox="0 0 60 84"><path d="M42 44L55 80" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M42 44L55 80" stroke="#8A6A3B" stroke-width="4.5" stroke-linecap="round"/><circle cx="30" cy="26" r="22" fill="#CFF1FF" fill-opacity=".45" stroke="${INK}" stroke-width="4"/><path d="M18 20q4-8 12-9" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`)}
${k?E3('x3-hot','animation:x3on .01s linear 1.1s forwards,x3pulse .25s linear 1.1s infinite alternate',STAR3):''}
${word3('GLOOP!',2.1,'42%',28,-7,48)}
${K3(k,'right:6px','x3-km')}
</div>`,

pop:(p,k,n)=>{let bits='';const cols=[p.color,'#FFD23F','#fff','#FF5FA8','#3D7BFF'];
  for(let i=0;i<26;i++){const a=i*2.399,dist=70+(i*47%90),dx=Math.round(Math.cos(a)*dist),up=-(50+(i*31%70));
    bits+=`<i class="x3-bit" style="--dx:${dx}px;--up:${up}px;--dy:${60+(i%4)*4}px;--r:${(i%2?1:-1)*(200+i*37)}deg;background:${cols[i%5]};animation-delay:${(2.05+(i%5)*.02).toFixed(2)}s"></i>`}
  return `<div class="x3-shake" style="${SH(2.05,.5)}">
${k?`<svg class="x3-ov" viewBox="0 0 314 250" preserveAspectRatio="none"><g fill="none" stroke-linecap="round"><g style="animation:x3off .01s linear 2.05s forwards"><path d="M90 168Q94 140 112 138" stroke="${INK}" stroke-width="8"/><path d="M90 168Q94 140 112 138" stroke="#9AA0B8" stroke-width="4"/></g><g style="opacity:0;animation:x3on .01s linear 2.05s forwards"><path d="M90 168Q92 202 130 206L156 208" stroke="${INK}" stroke-width="8"/><path d="M90 168Q92 202 130 206L156 208" stroke="#9AA0B8" stroke-width="4"/></g></g></svg>
${E3('x3-pump','',`<div class="x3-ps" style="animation:x3pmp .15s ease-in-out .5s 10 alternate"><i></i></div><div class="x3-pcy"></div>`)}`:''}
${A3(p,{s:.55,d:null,cls:'x3-pb',st:'width:96px;margin-left:-48px;animation:x3pb 2.05s linear both,x3off .01s linear 2.05s forwards',over:`<svg class="x3-belly" viewBox="0 -14 100 140">${T3(n||'POP',50,98,19,'#fff','stroke="'+INK+'" stroke-width="4" paint-order="stroke"')}</svg>`})}
${E3('x3-ring','animation:x3ring .5s ease-out 2.05s forwards')}
${bits}${stars3(2.05,0,112,7,90)}
${E3('x3-skin','animation:x3skin 1.3s linear 2.25s both',`<svg viewBox="0 0 150 60"><path d="M10 50Q2 32 28 26Q46 8 78 22Q112 10 132 32Q146 44 124 52Q70 60 10 50z" fill="${p.color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M130 40l16-8v16z" fill="${p.color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><ellipse cx="40" cy="30" rx="12" ry="3" fill="#fff" opacity=".3"/><g stroke="${INK}" stroke-width="3" stroke-linecap="round"><path d="M32 32l7 7M39 32l-7 7M50 33l7 7M57 33l-7 7"/></g>${n?T3(n,98,44,17,'#fff','stroke="'+INK+'" stroke-width="3.5" paint-order="stroke"'):''}</svg>`)}
${word3('POP!',2.07,'50%',24,-6,60)}
${K3(k,'left:6px','x3-kp')}
</div>`},

piano:(p,k,n)=>`<div class="x3-shake" style="${SH(1.42,.6)}">
${E3('x3-shadow','animation:x3shg 1.3s ease-in .2s both')}
${[[38,0],[48,.3],[58,.62],[44,.9],[54,.15]].map((a,i)=>`<i class="x3-nt" style="left:${a[0]}%;animation-delay:${a[1]}s;${i%2?'':'color:#FF5FA8'}">${NOTE3(['#FFD23F','#FF5FA8','#7FD0E4'][i%3])}</i>`).join('')}
${A3(p,{s:.95,d:1.42,cls:'x3-pyb',st:'animation:x3sway .5s ease-in-out 0s 2 alternate,x3off .01s linear 1.45s forwards'})}
${E3('x3-pc','width:132px;margin-left:-66px;bottom:38px;animation:x3on .01s linear 1.45s forwards',PANCAKE(p,0))}
<div class="x3-pi" style="animation:x3pif 2.2s linear both">${PIANO3(n)}${K3(k,'bottom:calc(100% - 5px);left:86px;width:54px','x3-kpi')}</div>
${[[-150,-104,1.44],[98,-76,1.47],[140,98,1.53]].map(a=>`<div class="x4-key" style="--dx:${a[0]}px;--r:${a[1]}deg;animation-delay:${a[2]}s">${PKEY}</div>`).join('')}
<div class="x4-flag" style="animation:x4flagup .45s cubic-bezier(.3,1.5,.5,1) 2.05s both"><svg viewBox="0 0 60 70" style="animation:x4wave .42s ease-in-out 2.5s infinite alternate"><path d="M52 66Q40 60 34 44" fill="none" stroke="${p.color}" stroke-width="9" stroke-linecap="round"/><path d="M34 46V6" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M34 7Q22 2 10 8Q16 14 10 22Q22 17 34 22Z" fill="#fff" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><circle cx="34" cy="45" r="6.5" fill="${p.color}" stroke="${INK}" stroke-width="3"/></svg></div>
${[[0,1.7],[1,2.1],[2,2.5]].map(a=>`<i class="x3-nt2" style="left:calc(50% + ${[-20,10,40][a[0]]}px);animation-delay:${a[1]}s">${NOTE3(['#FFD23F','#FF5FA8','#7FD0E4'][a[0]])}</i>`).join('')}
${puff3(1.44,-90,-40)}${puff3(1.44,44,40)}${stars3(1.44,-66,60,5,70)}
${word3('BWANG!',1.5,'28%',16,-8,44)}
</div>`,

banana:(p,k,n)=>`<div class="x3-shake" style="${SH(2.1,.5)}">
${E3('x3-hole','animation:x3hole .3s ease-out 2s both')}
${E3('x3-peel','animation:x3peel 2.2s linear both',`<div style="animation:x3sq .15s ease-out 2s both">${PEEL}</div>`)}
<div class="x3-walk" style="animation:x3walk 2.9s linear both">
 ${E3('x3-wn','animation:x3off .01s linear 1.08s forwards',`<i style="animation:x3nb .5s ease-in-out infinite alternate">${NOTE3('#FFD23F')}</i><i style="animation:x3nb .5s ease-in-out .25s infinite alternate">${NOTE3('#7FD0E4')}</i>`)}
 ${A3(p,{s:1.08,d:2.1,cls:'x3-bnb',st:'animation:x3bob .22s ease-in-out 0s 5 alternate,x3ban 2.9s linear both,x3off .01s linear 2.62s forwards',ex:true})}
</div>
${E3('x3-sign','animation:x3flag .45s cubic-bezier(.2,1.8,.4,1) 2.6s both',`<svg viewBox="0 0 66 70"><path d="M33 40v28" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M33 40v28" stroke="#C79A5E" stroke-width="4" stroke-linecap="round"/>${SIGN3(n,'DOWN').replace('<svg viewBox="0 0 66 40">','<svg viewBox="0 0 66 40" y="0" width="66" height="40">')}</svg>`)}
${E3('x3-gh','animation:x3ghost 1.9s ease-out 2.9s both',`<div style="animation:x3gb 1s ease-in-out infinite alternate">${charSVG({color:'#EEF4FF',acc:11,id:p.id},'idle')}</div>`)}
${stars3(2.1,40,60,5,60)}
${word3('SLIP!',1.2,'28%',24,-8,48)}
${K3(k,'right:6px','x3-kb')}
</div>`,

bees:(p,k,n)=>`<div class="x3-shake" style="${SH(1.95,.5)}">
<div class="x3-hive" style="animation:x3hive 2s linear both"><svg viewBox="0 0 60 84"><path d="M30 0V16" stroke="${INK}" stroke-width="4"/><path d="M30 16q22 0 26 24q4 22-26 40Q0 62 4 40q4-24 26-24z" fill="#F2B84B" stroke="${INK}" stroke-width="3.5"/><path d="M9 38q21 9 42 0M6 52q24 10 48 0M13 66q17 8 34 0" fill="none" stroke="#C98A22" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="30" cy="62" rx="8" ry="6" fill="${INK}"/></svg></div>
${k?`<div class="x3-stick" style="animation:x3stick 1.6s linear both"></div>`:''}
${A3(p,{s:.6,d:1.95,cls:'x3-bb2',st:'animation:x3bb 3.2s linear both',over:`<svg class="bean x3-w" viewBox="0 -14 100 140" style="opacity:0;animation:x3on .01s linear 1.95s forwards"><rect x="18" y="14" width="64" height="92" rx="32" fill="#EE4B3B" opacity=".4"/><g fill="#EE4B3B" stroke="${INK}" stroke-width="1.8"><circle cx="30" cy="30" r="4.5"/><circle cx="68" cy="26" r="4"/><circle cx="24" cy="62" r="4"/><circle cx="76" cy="58" r="4.5"/><circle cx="50" cy="94" r="4.5"/><circle cx="34" cy="98" r="3.5"/><circle cx="66" cy="96" r="4"/><circle cx="50" cy="20" r="3.5"/><circle cx="60" cy="72" r="3.5"/><circle cx="40" cy="78" r="3"/></g></svg>`,under:`<div class="x3-sw2" style="animation:x3swin .7s ease-out .5s both,x3swout .9s ease-in 2.5s forwards">${orbit3(8,34,9,.85)}</div><div class="x3-sw2 x3-mini" style="opacity:0;animation:x3on .01s linear 3s forwards">${orbit3(3,40,0,1.4)}</div><div class="x3-ban" style="animation:x3ban2 .7s ease-out .5s both,x3plant .5s ease-in-out 2.45s forwards"><div style="animation:x3bnb .5s ease-in-out infinite alternate"><div class="x3-bee" style="position:relative;margin:0 auto;animation:none">${BEE}</div>${SIGN3(n,'BZZ')}</div></div>`})}
${word3('BZZZT!',1.97,'72%',4,6,32)}
${K3(k,'left:6px','x3-kbe')}
</div>`,

calc:(p,k,n)=>`<div class="x3-shake" style="${SH(2.05,.6)}">
${E3('x3-shadow','animation:x3shg 1.9s ease-in .3s both')}
${A3(p,{s:.5,d:2.05,cls:'x3-clb',st:'animation:x3off .01s linear 2.06s forwards'})}
<div class="x3-cal" style="animation:x3cal 2.3s linear both"><div class="x3-prop" style="animation:x3pr 2.3s linear both"><svg viewBox="0 0 60 18"><path d="M30 18V8" stroke="${INK}" stroke-width="4"/><ellipse cx="30" cy="6" rx="26" ry="4" fill="#FFD23F" stroke="${INK}" stroke-width="2.5" style="transform-box:fill-box;transform-origin:center;animation:x3rot .09s linear infinite alternate"/></svg></div>${CALC3(n)}</div>
${E3('x3-tape','animation:x3tape 1s steps(8) 2.7s both',`<span>X_X</span>`)}
${E3('x3-pc','width:132px;margin-left:-66px;bottom:38px;animation:x3on .01s linear 2.06s forwards',PANCAKE(p,0))}
${puff3(2.05,-84,-36)}${puff3(2.05,44,36)}${stars3(2.07,0,120,6,86)}
${word3('CRUNCH!',2.1,'50%',4,-6,36)}
${K3(k,'left:6px','x3-kcl',`<div class="x3-mc">${MINICALC}</div>`)}
</div>`,

bonk:p=>`${actor(p,99,'a-bonk')}<div class="pot">${POT}</div><div class="stars">★ ★ ★</div>`
};
const DEATH_SFX={
 anvil:[['k_squeak',.36,.9],['k_squeak',.62,1.1],['k_yelp',.98,1.1],['k_clang',1.36,.72],['k_slam',1.36,.9],['k_ring',1.38,.6,.7],['k_rattle',1.52,1,.7],['k_boing2',1.56,.8,.6],['k_squeak',1.95,.7],['k_squeak',2.2,.75],['k_plop',2.6,1.2]],
 zap:[['k_boom',.55,.7,.5],['key',1.3,1.4],['k_crack',1.5,1.1],['k_zap',1.5,1],['k_yelp',1.53,1.5],['k_zap',1.66,1.25],['zap',1.74],['k_gloop',2.1,1.6,.6],['k_plop',2.7,1.5,.6]],
 rocket:[['d_fuse',.55],['d_fuse',.7,1.1],['d_fuse',.85,1.2],['d_fuse',1,1.3],['d_fuse',1.12,1.4],['k_yelp',1.28,1.2],['k_launch',1.5,1],['k_explode',2.3,1],['k_crackle',2.38,1,.8],['d_ding',3.04,1.6,.7],['k_boing',3.3,1.3,.7],['k_plop',3.62,1]],
 chomp:[['k_boom',.3,.6,.4],['k_ring',1,1.5,.7],['k_ring',1.12,1.5,.7],['k_ring',1.24,1.5,.7],['k_yelp',1.3,1.2],['k_eat1',1.42],['k_eat2',1.72],['k_eat3',1.96],['k_burp',2.82,.9],['k_plop',3.45,1.1]],
 melt:[['k_gloop2',1.6,.8],['k_gloop',2.05,.7],['k_splash',2.1,.8,.6],['k_bubble',3,1.2],['k_bubble',3.5,1.5]],
 pop:[['k_squeak',.5,.8],['k_squeak',.8,.9],['k_squeak',1.1,1],['k_squeak',1.4,1.1],['k_squeak',1.7,1.2],['k_boing2',1.82,1.4,.7],['k_popbang',2.05,1],['pop',2.05],['k_woosh',2.5,.8],['k_plop',3,.8]],
 piano:[['hint',.15],['hint',.4,1.26],['hint',.65,1.5],['k_yelp',1.1,1],['d_piano',1.42],['k_plop',2.16,1.4,.7],['k_plop',2.26,1.6,.7]],
 banana:[['k_woosh',.9,1],['k_woosh',1.18,1.4],['k_yelp',1.26,1.3],['k_slam',2.1,.8,.8],['bonk',2.1,.9],['k_ring',2.95,1.8,.6],['k_plop',3.4,.7]],
 bees:[['bonk',.45,1.5,.6],['d_buzz',.6],['k_bug',1.3,1],['d_buzz',1.3,1.15],['k_bug2',1.5,1.2],['k_yelp',1.7,1.3],['bonk',1.95,1.6],['k_ouch',1.97,1.2],['k_boing2',2.1,.7,.7],['d_buzz',2.6,1.3]],
 calc:[['key',.6,1.2],['key',.8,1.2],['key',1,1.2],['error',1.15,1.4],['k_yelp',1.8,1.2],['d_slam',2.05],['k_crunch',2.05,.8],['k_clang',2.07,.9,.5],['k_paper',2.7],['k_paper',2.8],['k_paper',2.9],['k_paper',3,1.2],['k_paper',3.1,1.2]]
};
window.DEATH_SFX=DEATH_SFX;
window.EXTRA_DEATH_SFX={piano:DEATH_SFX.piano,banana:DEATH_SFX.banana,bees:DEATH_SFX.bees,calc:DEATH_SFX.calc};
const DEATH_ICON={
 anvil:`<svg viewBox="0 0 24 24"><path d="M3 5h13q5 0 6 4h-6v2q-1 2-3 2v3h3v3H7v-3h3v-3Q6 12 5 9H3z" fill="#3A3F5C" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
 zap:`<svg viewBox="0 0 24 24"><path d="M14 2L5 13.5h6L9 22l10-12.5h-6z" fill="#FFE14D" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
 rocket:`<svg viewBox="0 0 24 24"><path d="M12 2q6 5 6 12v4H6v-4q0-7 6-12z" fill="#fff" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.3" fill="#7FD0E4" stroke="${INK}" stroke-width="1.5"/><path d="M6 14l-3 5h3zM18 14l3 5h-3z" fill="#EE4B3B" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 20q3 4 6 0z" fill="#FF8A2B" stroke="${INK}" stroke-width="1.3"/></svg>`,
 chomp:`<svg viewBox="0 0 24 24"><path d="M2 7q10-6 20 0v3L19 12l-3-2-3 2-3-2-3 2-3-2-2 0zM2 17q10 6 20 0v-3l-3-2-3 2-3-2-3 2-3-2-3 2z" fill="#fff" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
 melt:`<svg viewBox="0 0 24 24"><path d="M12 3q7 8 7 13a7 7 0 0 1-14 0q0-5 7-13z" fill="#7FD0E4" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 15q0 3 3 3" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>`,
 pop:`<svg viewBox="0 0 24 24"><path d="M12 1l2.5 6L21 4l-3 6 5 2-6 2 3 6-6-3-1 6-2-6-5 3 2-6-6-2 6-3-3-6 6 3z" fill="#FFD23F" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
 piano:`<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="15" rx="2" fill="#fff" stroke="${INK}" stroke-width="1.8"/><path d="M7 20V12M12 20V12M17 20V12" stroke="${INK}" stroke-width="1.3"/><path d="M5 5v8M10 5v8M14 5v8M19 5v8" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/></svg>`,
 banana:`<svg viewBox="0 0 24 24"><path d="M4 6q2 14 16 14q2 0 2-2-10 1-14-12z" fill="#FFD23F" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 6l2-3 2 2" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
 bees:`<svg viewBox="0 0 24 24"><ellipse cx="8" cy="7" rx="5" ry="3.2" fill="#fff" stroke="${INK}" stroke-width="1.5" transform="rotate(-25 8 7)"/><ellipse cx="15" cy="7" rx="5" ry="3.2" fill="#fff" stroke="${INK}" stroke-width="1.5" transform="rotate(25 15 7)"/><ellipse cx="12" cy="15" rx="8" ry="6" fill="#FFD23F" stroke="${INK}" stroke-width="1.8"/><path d="M9 10v10M14 10v10" stroke="${INK}" stroke-width="2.4"/></svg>`,
 calc:`<svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="3" fill="#6B7194" stroke="${INK}" stroke-width="1.8"/><rect x="7" y="5" width="10" height="4.5" rx="1" fill="#BFE9D0" stroke="${INK}" stroke-width="1.3"/><g fill="#fff"><circle cx="8.5" cy="13" r="1.4"/><circle cx="12" cy="13" r="1.4"/><circle cx="15.5" cy="13" r="1.4"/><circle cx="8.5" cy="17" r="1.4"/><circle cx="12" cy="17" r="1.4"/></g><circle cx="15.5" cy="17" r="1.4" fill="#EE4B3B"/></svg>`
};
