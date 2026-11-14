import sys,json,base64
from playwright.sync_api import sync_playwright
S='/tmp/claude-0/-home-claude/6c2b5f03-7d11-550a-a2af-2801283b81c5/scratchpad'
f=lambda n:base64.b64encode(open(f'{S}/node_modules/@fontsource/{n}/files/{n}-latin-400-normal.woff2','rb').read()).decode()
html=open('/home/claude/hl/artifact.html').read()
page='<!doctype html><html lang=en><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>@font-face{font-family:"Bagel Fat One";src:url(data:font/woff2;base64,'+f('bagel-fat-one')+')}@font-face{font-family:"Baloo 2";font-weight:500 800;src:url(data:font/woff2;base64,'+f('baloo-2')+')}[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
TAPJS=r"""(scope)=>{
 const root=scope?document.querySelector(scope):document;
 const sel='button,a[href],input,[role=slider],[role=radio],[tabindex]:not([tabindex="-1"])';
 let els=[...root.querySelectorAll(sel)].filter(e=>{const r=e.getBoundingClientRect();if(r.width<1||r.height<1)return false;
   if(e.closest('[hidden]'))return false; const cs=getComputedStyle(e); if(cs.visibility==='hidden'||cs.display==='none')return false;
   if(!scope){const ov=document.getElementById('ov'); if(ov&&!ov.hidden&&!ov.contains(e))return false}
   return true});
 const hit=(e,r)=>{ // effective hit box: probe outward
   const ok=(x,y)=>{const t=document.elementFromPoint(x,y);return t&&(t===e||e.contains(t))};
   const cx=r.left+r.width/2,cy=r.top+r.height/2;let L=0,R=0,T=0,B=0;
   if(!ok(cx,cy))return null;
   while(L<16&&ok(r.left-L-0.5,cy))L++;while(R<16&&ok(r.right+R+0.5,cy))R++;
   while(T<16&&ok(cx,r.top-T-0.5))T++;while(B<16&&ok(cx,r.bottom+B+0.5))B++;
   // also inner edges (clipped)
   return {l:r.left-L,r:r.right+R,t:r.top-T,b:r.bottom+B}};
 const out=els.map(e=>{const r=e.getBoundingClientRect();const h=hit(e,r)||{l:r.left,r:r.right,t:r.top,b:r.bottom};
  return {n:e.id?('#'+e.id):(e.tagName.toLowerCase()+'.'+(e.className&&e.className.baseVal===undefined?String(e.className).trim().split(/\s+/).slice(0,2).join('.'):'')+(e.dataset&&Object.keys(e.dataset).length?'['+Object.keys(e.dataset)[0]+'='+Object.values(e.dataset)[0]+']':'')),
   w:+(h.r-h.l).toFixed(1),h:+(h.b-h.t).toFixed(1),bw:+r.width.toFixed(1),bh:+r.height.toFixed(1),l:h.l,r:h.r,t:h.t,b:h.b,dis:!!e.disabled,txt:(e.textContent||'').trim().slice(0,12),al:e.getAttribute('aria-label')}});
 const gaps=[];for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++){const a=out[i],b=out[j];
   const dx=Math.max(a.l-b.r,b.l-a.r),dy=Math.max(a.t-b.b,b.t-a.b);const g=Math.max(dx,dy);
   if(g<8&&!(dx<0&&dy<0))gaps.push([a.n,b.n,+g.toFixed(1)]); else if(dx<0&&dy<0)gaps.push([a.n,b.n,'OVERLAP'])}
 return {items:out,gaps}}"""
CJS=r"""()=>{
 const parse=c=>{const q=c.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/);if(q)return {r:q[1]*255,g:q[2]*255,b:q[3]*255,a:q[4]===undefined?1:+q[4]};const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(/[ ,\/]+/).map(Number);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}};
 const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)};
 const over=(t,b)=>({r:t.r*t.a+b.r*(1-t.a),g:t.g*t.a+b.g*(1-t.a),b:t.b*t.a+b.b*(1-t.a),a:1});
 const res=[];const seen=new Set();
 const ov=document.getElementById('ov');const scope=(ov&&!ov.hidden)?ov:document.getElementById('app');
 const w=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);let n;
 while(n=w.nextNode()){const t=n.textContent.trim();if(!t)continue;const e=n.parentElement;if(!e||seen.has(e))continue;seen.add(e);
  const r=e.getBoundingClientRect();if(r.width<1||r.height<1)continue;if(e.closest('[hidden],svg,[aria-hidden=true]'))continue;
  const cs=getComputedStyle(e);if(cs.visibility==='hidden'||+cs.opacity===0)continue;
  let fg=parse(cs.color);let op=1;for(let x=e;x&&x!==document.documentElement;x=x.parentElement){op*=+getComputedStyle(x).opacity}
  // background: stack up ancestors
  const chain=[];let grad=false;for(let x=e;x;x=x.parentElement){const s=getComputedStyle(x);const bc=parse(s.backgroundColor);if(s.backgroundImage&&s.backgroundImage!=='none')grad=true;if(bc&&bc.a>0){chain.push(bc);if(bc.a>=1)break}}
  let bg={r:255,g:255,b:255,a:1};for(let i=chain.length-1;i>=0;i--)bg=over(chain[i],bg);
  const fgc=over({...fg,a:fg.a*op},bg);
  const L1=lum(fgc),L2=lum(bg),ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
  const fs=parseFloat(cs.fontSize),bold=+cs.fontWeight>=700;const large=fs>=24||(fs>=18.66&&bold);
  const stroke=parseFloat(cs.webkitTextStrokeWidth)>0;
  res.push({t:t.slice(0,22),cls:(e.id?'#'+e.id:e.tagName.toLowerCase()+'.'+String(e.className&&e.className.baseVal===undefined?e.className:'').trim().split(/\s+/).slice(0,2).join('.')),ratio:+ratio.toFixed(2),fs:+fs.toFixed(1),large,stroke,grad,fg:cs.color,bg:`rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,op:+op.toFixed(2),font:cs.fontFamily.split(',')[0]})}
 return res}"""
def audit(pg,name,res,scope=None):
    cr=pg.evaluate(CJS)
    CON.append((name,cr))
    d=pg.evaluate(TAPJS,scope)
    small=[i for i in d['items'] if i['w']<43 or i['h']<43]
    res.append({'screen':name,'count':len(d['items']),'small':[(i['n'],i['txt'],i['al'],i['w'],i['h'],i['bw'],i['bh'],i['dis']) for i in small],'gaps':d['gaps']})
CON=[]
def main(w,h,fs=None):
    res=[]
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        pg=b.new_page(viewport={'width':w,'height':h},has_touch=True); errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.set_content(page); pg.wait_for_timeout(1200)
        if fs: pg.add_style_tag(content='html{font-size:%s!important}'%fs)
        audit(pg,'home',res)
        pg.click('#infoBtn'); pg.wait_for_timeout(300); audit(pg,'info sheet',res); pg.evaluate("closeOv()")
        pg.click('#friendsBtn'); pg.wait_for_timeout(500); audit(pg,'friends lobby',res)
        pg.click('#lookBtn'); pg.wait_for_timeout(300); audit(pg,'lobby look picker',res)
        pg.click('#startBtn'); pg.wait_for_timeout(500); 
        if not pg.query_selector('#secSld'):
            pg.click('#addBot');pg.click('#startBtn');pg.wait_for_timeout(500)
        audit(pg,'secret slider',res)
        pg.click('#lockBtn')
        for i in range(400):
            if pg.query_selector('[data-pickdir]'): break
            pg.wait_for_timeout(250)
        pg.wait_for_timeout(300); 
        if pg.evaluate("!document.getElementById('ov').hidden"): audit(pg,'wheel overlay',res); pg.evaluate("closeOv()")
        pg.wait_for_timeout(300); audit(pg,'HIGHER/LOWER',res)
        pg.click('#pwBtn'); pg.wait_for_timeout(300); audit(pg,'powers sheet',res); pg.click('#pwClose'); pg.wait_for_timeout(200)
        pg.click('[data-pickdir="h"]'); pg.wait_for_timeout(800); audit(pg,'ask slider',res)
        pg.click('#askGo'); pg.wait_for_timeout(1800); audit(pg,'duel view',res)
        pg.click('#leaveBtn'); pg.wait_for_timeout(300)
        audit(pg,'leave (non-duel arm)',res)
        pg.evaluate("window.eloAtStake=()=>12;document.getElementById('leaveBtn').click()"); pg.wait_for_timeout(300); audit(pg,'leave confirm',res); pg.evaluate("closeOv()")
        # guess grid
        for mx,tag in [(100,'guess grid (1-100)'),(100000,'guess grid 7-digit (100k)')]:
            pg.evaluate("""(()=>{const o=G.players.find(p=>p.pid!==PID),s=botSecrets[o.pid]||5,lo=Math.max(1,Math.min(s-4,%d-9));G.kn[PID][o.pid]={lo:lo,hi:lo+9,x:[]};G.turn=G.players.findIndex(p=>p.pid===PID);G.sub=[o.pid];G.stage='await';G.q=null;G.seq++;publishG()})()"""%mx)
            pg.wait_for_timeout(700)
            if mx==100000:
                pg.evaluate("""(()=>{const o=G.players.find(p=>p.pid!==PID);G.kn[PID][o.pid]={lo:99991,hi:100000,x:[]};G.seq++;publishG()})()"""); pg.wait_for_timeout(600)
            audit(pg,tag,res)
        pg.evaluate("G.phase='over';G.win=PID;publishG();showWinner()"); pg.wait_for_timeout(600); audit(pg,'result sheet',res)
        print('errs',errs)
        pg.screenshot(path=f'shots/a11_end_{w}.png')
        b.close()
    return res
if __name__=='__main__':
    w,h=int(sys.argv[1]),int(sys.argv[2]); fs=sys.argv[3] if len(sys.argv)>3 else None
    for r in main(w,h,fs):
        print('==',r['screen'],r['count'])
        for s in r['small']: print('  SMALL',s)
        for g in r['gaps']: print('  GAP',g)
    if len(sys.argv)>4:
        for name,cr in CON:
            for c in cr:
                need=3 if c['large'] else 4.5
                if c['ratio']<need: print('CONTRAST',name,c['cls'],repr(c['t']),c['ratio'],'fs',c['fs'],'large' if c['large'] else '','STROKE' if c['stroke'] else '','GRAD' if c['grad'] else '',c['fg'],c['bg'],'op',c['op'])
