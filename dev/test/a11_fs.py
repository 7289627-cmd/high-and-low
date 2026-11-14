import sys
exec(open('a11_audit.py').read().split("def main(")[0])
CHK="""()=>{const o=[];const W=innerWidth;
 for(const e of document.querySelectorAll('#app *')){const r=e.getBoundingClientRect();if(r.width<1)continue;if(e.closest('svg,.hscene,[hidden]'))continue;
  if(r.right>W+1||r.left<-1)o.push(['off-x',e.tagName+'.'+String(e.className).slice(0,20),Math.round(r.left),Math.round(r.right)]);
  if(e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).overflow!=='visible'&&e.clientWidth>0&&e.tagName!=='MAIN'&&e.tagName!=='SECTION')o.push(['clip-x',e.tagName+'.'+String(e.className).slice(0,20),e.scrollWidth,e.clientWidth])}
 const bt=document.querySelector('#playBtn,#askGo');const r=bt&&bt.getBoundingClientRect();
 return {sw:document.documentElement.scrollWidth,iw:W,docH:document.documentElement.scrollHeight,ih:innerHeight,btn:r&&[Math.round(r.top),Math.round(r.bottom)],rem:getComputedStyle(document.documentElement).fontSize,bodyfs:getComputedStyle(document.body).fontSize,o:o.slice(0,12)}}"""
SCALE="""(f)=>{for(const e of document.querySelectorAll('#app *')){if(e.closest('svg'))continue;const c=parseFloat(getComputedStyle(e).fontSize);e.style.setProperty('font-size',(c*f)+'px','important')}}"""
for fs in ['100%','125%','150%']:
  for (w,h) in [(390,844),(320,640)]:
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        pg=b.new_page(viewport={'width':w,'height':h}); pg.set_content(page); pg.wait_for_timeout(1000)
        pg.evaluate(SCALE,float(fs[:-1])/100); pg.wait_for_timeout(300)
        r=pg.evaluate(CHK); pg.screenshot(path=f'shots/a11_home_{fs[:-1]}_{w}.png'); print(fs,w,'HOME',r)
        pg.evaluate("window.HL_TEST_FILL_MS=300"); pg.click('#playBtn'); pg.wait_for_selector('#lockBtn',timeout=20000); pg.click('#lockBtn')
        for i in range(300):
            if pg.query_selector('[data-pickdir]'): break
            pg.wait_for_timeout(200)
        pg.evaluate("closeOv()"); pg.wait_for_timeout(300); pg.click('[data-pickdir="h"]'); pg.wait_for_timeout(700); pg.evaluate(SCALE,float(fs[:-1])/100); pg.wait_for_timeout(200)
        r=pg.evaluate(CHK); pg.screenshot(path=f'shots/a11_ask_{fs[:-1]}_{w}.png'); print(fs,w,'ASK',r); b.close()
