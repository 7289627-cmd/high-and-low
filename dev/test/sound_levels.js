// Sound level check: every SFX key has an mp3, a GAIN entry, true peak <= -0.5 dBTP and leading silence <= 20 ms.
// Measured with ffmpeg (ebur128 true peak, raw f32 decode for leading silence at -50 dBFS).
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'src','sound.js'),'utf8');
const km=src.match(/KEYS:\[([^\]]*)\]/);
const keys=km?km[1].split(',').map(s=>s.trim().replace(/['"]/g,'')).filter(Boolean):[];
const gm=src.match(/GAIN:\{([^}]*)\}/);
let GAIN={};
try{GAIN=gm?Function('return {'+gm[1]+'}')():{}}catch(e){}
const bad=[];
if(keys.length<40)bad.push('KEYS too short ('+keys.length+')');
Object.keys(GAIN).forEach(k=>{if(!keys.includes(k))bad.push(k+': GAIN entry without a key')});
for(const k of keys){
  const f=path.join(root,'site','sfx',k+'.mp3');
  if(!fs.existsSync(f)){bad.push(k+': file missing');continue}
  if(!(typeof GAIN[k]==='number'&&GAIN[k]>0&&GAIN[k]<=4))bad.push(k+': no valid GAIN entry');
  const r=cp.spawnSync('ffmpeg',['-nostdin','-hide_banner','-i',f,'-af','ebur128=peak=true','-f','f32le','-ac','1','-ar','44100','-'],{maxBuffer:64<<20});
  if(r.status!==0){bad.push(k+': ffmpeg failed');continue}
  const err=r.stderr.toString(),i=err.lastIndexOf('Summary:');
  const pm=err.slice(i).match(/Peak:\s+(-?[\d.]+|-inf)\s+dBFS/);
  const peak=pm?parseFloat(pm[1]):NaN;
  if(!(peak<=-0.5))bad.push(k+': true peak '+peak+' dB > -0.5');
  const b=r.stdout,n=Math.floor(b.length/4),thr=Math.pow(10,-50/20);let lead=n;
  for(let j=0;j<n;j++){if(Math.abs(b.readFloatLE(j*4))>thr){lead=j;break}}
  const ms=lead/44.1;
  if(!(ms<=20))bad.push(k+': leading silence '+ms.toFixed(1)+' ms > 20');
}
console.log(bad.length?'FAIL sound levels: '+bad.join('; '):'PASS sound levels');
process.exit(bad.length?1:0);
