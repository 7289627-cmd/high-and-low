/* Nickname filter. Pure functions, no dependencies. nameOK(name,lite) and safeName(name,lite).
   Strict (public Play duels): substring list + whole-word list + impersonation + must contain a letter.
   lite=true (private friends rooms): substring list only, so a friend can still be called Dick or Cox.
   Lists are stored rot13 so this file is not a wall of slurs. Matching is done on a normalised copy:
   lowercase, accents and full-width removed, look-alike letters and leetspeak mapped, separators removed, stretched letters tolerated. */
const NF_SUB='shpx fuvg ovgpu phag avtt sntt juber fyhg onfgneq qvyqb cravf intvan uvgyre ergneq gjng jnax cbea chffl nffubyr qhzonff wnpxnff qvpxurnq oybjwbo puvax pbpxfhpx zbgures wvmm znfgheo betnfz uragnv zbyrfg crqbcu cnrqb obyybpx qbhpuront genaal furznyr jrgonpx gbjryurnq enturnq anmvf pnoeba craqrw zvreqn uvwbqrchgn uvwbchgn uvwhrchgn chgnznqer puvatnq puvatne puvatng znevpba tvyvcbyy crybghq phyvnq';
const NF_WHOLE='encvfg qvpx pbpx nff nefr nany nahf frk frkl phz gvg gvgf obbo obbof snt sntbg ubzb ubeal zvys ahqr ahqrf ubr gubg phpx vapry cvff cevpx qbhpur gbffre xvxr fcvp pbba cnxv tbbx jbc qntb wnc gneq zbat fcnm encr encrq crqb xlf anmv vfvf chgn chgb chgnf uqc iretn pbab phyb cvapur wbqre znevpn znzba vqvbgn rfghcvqb vzorpvy phyreb wbgb chargn sbyyne znznqn artengn fhqnpn pbwbarf cvwn cgz zeq spx shx shd';
const NF_IMP_SUB='nqzva zbqrengbe bssvpvny';
const NF_IMP_WHOLE='zbq zbqf obg obgf fgnss fhccbeg flfgrz qri qrif bjare uvtunaqybj uvtuybj';
/* Each word becomes a regex where every letter may be stretched (fuuuck) and a doubled letter needs at least two (ass, not as). */
const nfRx=(w,whole)=>new RegExp((whole?'^':'')+w.replace(/(.)\1*/g,(m,c)=>c+'{'+m.length+',}')+(whole?'$':''));
const nfDecode=(s,whole)=>s.replace(/[a-z]/g,c=>String.fromCharCode((c.charCodeAt(0)-84)%26+97)).split(' ').map(w=>nfRx(w,whole));
const NF_L={SUB:nfDecode(NF_SUB),WHOLE:nfDecode(NF_WHOLE+' '+NF_IMP_WHOLE,1),IMP:nfDecode(NF_IMP_SUB)};
const NF_LEET={'0':'o','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s','!':'i','|':'l','+':'t'};
const NF_HG={'а':'a','с':'c','е':'e','о':'o','р':'p','х':'x','у':'y','і':'i','ѕ':'s','ј':'j','ο':'o','α':'a','ι':'i','ß':'ss'};
/* Returns three readings of the name (1 as i, 1 as l, leetspeak off), each as a list of letter-only tokens. */
function nfTokens(name){
  let s=String(name==null?'':name).replace(/([a-z])([A-Z])/g,'$1 $2').normalize('NFKD').toLowerCase();
  s=s.replace(/[\u0300-\u036f\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,'').replace(/[^\x00-\x7f]/g,c=>NF_HG[c]||'');
  const parts=s.split(/[^a-z0-9@$!|+]+/).filter(Boolean);
  const rd=f=>parts.map(t=>t.replace(/[^a-z]/g,'')===t?t:f(t)).map(t=>t.replace(/[^a-z]/g,'')).filter(Boolean);
  return [rd(t=>t.replace(/[0-9@$!|+]/g,c=>c==='1'?'i':NF_LEET[c]||'')),rd(t=>t.replace(/[0-9@$!|+]/g,c=>c==='1'?'l':NF_LEET[c]||'')),rd(t=>t)];
}
function nameOK(name,lite){
  const raw=typeof name==='string'?name:'';
  if(!lite&&!/\p{L}/u.test(raw))return false;
  for(const toks of nfTokens(raw)){
    const j=toks.join('').replace(/scunthorpe/g,'');
    if(NF_L.SUB.some(r=>r.test(j)))return false;
    if(lite)continue;
    if(NF_L.IMP.some(r=>r.test(j)))return false;
    if(NF_L.WHOLE.some(r=>r.test(j)||toks.some(t=>r.test(t))))return false;
  }
  return true;
}
function safeName(name,lite){return nameOK(name,lite)?(typeof name==='string'?name:''):'Bean'}
