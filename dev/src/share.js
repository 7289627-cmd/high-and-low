/* ---------- Share a win (behind flag HL_FLAGS.share) ---------- */
const SHARE_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SHARE_OK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 13 4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function shareOn(){return !!(window.HL_FLAGS&&window.HL_FLAGS.share)}
function shareUrl(){try{if((window.HLNative||location.protocol==='capacitor:')&&window.HL_SITE)return window.HL_SITE;return location.origin&&location.origin!=='null'?location.origin+location.pathname:location.href}catch(e){return ''}}
function shareFacts(){
  const out=[];
  if(G&&G.max)out.push('1 – '+fmt(G.max));
  if(G&&typeof eloLast!=='undefined'&&eloLast&&eloLast.gid===G.gid)out.push(uiText(rankName(eloLast.to))+' '+fmt(eloLast.to));
  return out.join('  ·  ');
}
function shareImg(src){return new Promise(res=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>res(null);i.src=src})}
/* Draws the 1080x1350 card. p = {color,acc,id} look, facts = one line of text. Returns the canvas. */
async function drawShareCard(p,facts,addr){
  const W=1080,H=1350,c=document.createElement('canvas');c.width=W;c.height=H;
  const x=c.getContext('2d');
  try{if(document.fonts){await Promise.race([Promise.all([document.fonts.load('100px "Bagel Fat One"'),document.fonts.ready]),new Promise(r=>setTimeout(r,1500))])}}catch(e){}
  const D='"Bagel Fat One","Arial Rounded MT Bold","Trebuchet MS",sans-serif';
  const GROUND=1085;
  const g=x.createLinearGradient(0,0,0,GROUND);g.addColorStop(0,'#5BB8D2');g.addColorStop(1,'#7FD0E4');
  x.fillStyle=g;x.fillRect(0,0,W,H);
  x.fillStyle='#F4C04F';x.fillRect(0,GROUND,W,H-GROUND);
  x.fillStyle='#D9A22F';x.fillRect(0,GROUND,W,14);
  // clouds
  const cloud=(cx,cy,s)=>{x.fillStyle='rgba(255,255,255,.75)';x.beginPath();x.arc(cx,cy,40*s,0,7);x.arc(cx+45*s,cy-22*s,50*s,0,7);x.arc(cx+100*s,cy,42*s,0,7);x.rect(cx,cy,100*s,40*s);x.fill()};
  cloud(70,470,1.1);cloud(800,330,1.2);cloud(840,760,.9);
  // confetti in the game colors
  const cols=['#EE4B3B','#3D7BFF','#2FA36B','#A35BFF','#FF8A2B','#FF5FA8','#FFD23F'];
  let sd=7;const rn=()=>(sd=(sd*9301+49297)%233280)/233280;
  for(let i=0;i<46;i++){
    const px=rn()*W,py=rn()*GROUND;if(px>150&&px<930&&py>110&&py<460)continue;
    x.save();x.translate(px,py);x.rotate(rn()*6.3);x.fillStyle=cols[i%7];x.fillRect(-11,-18,22,36);x.restore();
  }
  // title
  x.textAlign='center';x.textBaseline='alphabetic';x.lineJoin='round';
  const big=(t,y,sz,fill)=>{x.font=sz+'px '+D;x.lineWidth=sz*.14;x.strokeStyle='#1E2240';x.strokeText(t,W/2,y);x.fillStyle=fill;x.fillText(t,W/2,y)};
  big(uiText('I won'),230,150,'#FFFFFF');
  big('High & Low',395,172,'#FFD23F');
  // bean
  const bw=500,bh=Math.round(bw*1.4);
  x.fillStyle='rgba(30,34,64,.28)';x.beginPath();x.ellipse(W/2,GROUND+8,230,30,0,0,7);x.fill();
  try{
    const svg=charSVG(p,'happy').replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="'+bw+'" height="'+bh+'" ').replace(/style="[^"]*"/,'');
    const im=await shareImg('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg));
    if(im)x.drawImage(im,(W-bw)/2,GROUND-bh+12,bw,bh);
  }catch(e){}
  // facts pill
  if(facts){
    x.font='64px '+D;const tw=Math.min(x.measureText(facts).width,900),pw=tw+90,ph=104,px=(W-pw)/2,py=GROUND+58;
    x.fillStyle='#1E2240';x.beginPath();x.roundRect?x.roundRect(px,py+8,pw,ph,36):x.rect(px,py+8,pw,ph);x.fill();
    x.fillStyle='#FFFFFF';x.beginPath();x.roundRect?x.roundRect(px,py,pw,ph,36):x.rect(px,py,pw,ph);x.fill();
    x.lineWidth=7;x.strokeStyle='#1E2240';x.stroke();
    x.fillStyle='#1E2240';x.fillText(facts,W/2,py+72,900);
  }
  if(addr){x.font='44px '+D;x.fillStyle='#1E2240';x.globalAlpha=.8;x.fillText(addr.replace(/^https?:\/\//,'').replace(/\/$/,''),W/2,H-44,960);x.globalAlpha=1}
  return c;
}
function shareCanvas(){
  const w=G&&byPid(G.win);if(!w)return Promise.resolve(null);
  return drawShareCard(pv(w),shareFacts(),shareUrl());
}
function shareBlob(cv){return new Promise(res=>{try{cv.toBlob(b=>res(b),'image/png')}catch(e){res(null)}})}
async function shareWin(btn){
  const url=shareUrl(),text=uiText('I won High & Low!'),title='High & Low';
  const isAbort=e=>e&&(e.name==='AbortError'||/cancel/i.test(e.message||''));
  try{
    if(btn){if(btn.dataset.busy)return;btn.dataset.busy='1'}
    let cv=null;try{cv=await shareCanvas()}catch(e){}
    if(window.HLNative&&typeof HLNative.share==='function'){
      let dataUrl='';try{dataUrl=cv?cv.toDataURL('image/png'):''}catch(e){}
      try{await HLNative.share({dataUrl,text,url});track('share',{how:'native'})}catch(e){}
      return;
    }
    const nav=typeof navigator!=='undefined'?navigator:{};
    if(cv&&typeof nav.share==='function'&&typeof nav.canShare==='function'&&typeof File==='function'){
      try{
        const b=await shareBlob(cv);
        if(b){
          const f=new File([b],'high-and-low.png',{type:'image/png'});
          if(nav.canShare({files:[f]})){
            try{await nav.share({files:[f],title,text,url});track('share',{how:'files'});return}
            catch(e){if(isAbort(e))return}
          }
        }
      }catch(e){}
    }
    if(typeof nav.share==='function'){
      try{await nav.share({title,text,url});track('share',{how:'link'});return}
      catch(e){if(isAbort(e))return}
    }
    let ok=false;
    try{if(nav.clipboard&&nav.clipboard.writeText){await nav.clipboard.writeText(url);ok=true}}catch(e){}
    if(ok){
      track('share',{how:'copy'});
      if(btn){btn.innerHTML=SHARE_OK;setTimeout(()=>{try{btn.innerHTML=SHARE_ICON}catch(e){}},1500)}
    }
  }catch(e){}
  finally{if(btn)delete btn.dataset.busy}
}
function shareBtnHTML(){
  const w=G&&byPid(G.win);
  if(!shareOn()||!w||w.pid!==PID)return '';
  return `<button class="btn round share-btn" id="shareBtn" aria-label="${uiHTML("Share")}">${SHARE_ICON}</button>`;
}
