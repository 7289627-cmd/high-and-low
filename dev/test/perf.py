import base64,sys,json
from playwright.sync_api import sync_playwright
S='/tmp/claude-0/-home-claude/6c2b5f03-7d11-550a-a2af-2801283b81c5/scratchpad'
f=lambda n:base64.b64encode(open(f'{S}/node_modules/@fontsource/{n}/files/{n}-latin-400-normal.woff2','rb').read()).decode()
import os
html=open(os.environ.get('HL_ART','/home/claude/hl/artifact.html')).read()
page='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>@font-face{font-family:"Bagel Fat One";src:url(data:font/woff2;base64,'+f('bagel-fat-one')+')}@font-face{font-family:"Baloo 2";font-weight:500 800;src:url(data:font/woff2;base64,'+f('baloo-2')+')}[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
PROBE="""
window.__m=null;
window.__start=function(){
  const m={fr:[],lt:[],rend:0,mut:0,t0:performance.now()};window.__m=m;
  let last=performance.now();
  (function f(n){if(window.__m!==m)return;m.fr.push(n-last);last=n;requestAnimationFrame(f)})(last);
  try{m.po=new PerformanceObserver(l=>{for(const e of l.getEntries())m.lt.push(e.duration)});m.po.observe({entryTypes:['longtask']})}catch(e){}
  const app=document.getElementById('app');m.mo=new MutationObserver(r=>{for(const x of r)if(x.target===app)m.mut++});m.mo.observe(app,{childList:true});
  if(!window.__rw){window.__rw=1;const o=window.render;window.render=function(){const s=lastSig;const r=o.apply(this,arguments);if(window.__m&&lastSig!==s)window.__m.rend++;return r}}
};
window.__stop=function(){const m=window.__m;window.__m=null;m.po&&m.po.disconnect();m.mo.disconnect();
  const fr=m.fr.slice(2).sort((a,b)=>a-b),n=fr.length,avg=fr.reduce((a,b)=>a+b,0)/n;
  const secs=(performance.now()-m.t0)/1000;
  return {avg:+avg.toFixed(1),p95:+fr[Math.floor(n*.95)].toFixed(1),fps:+(n/secs).toFixed(1),lt:m.lt.length,ltms:Math.round(m.lt.reduce((a,b)=>a+b,0)),rebuild_s:+(m.mut/secs).toFixed(2),nodes:document.getElementsByTagName('*').length,heapMB:+(performance.memory.usedJSHeapSize/1048576).toFixed(1)}};
0;
"""
def run(label_rate=4, only=None):
    out={}
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--enable-precise-memory-info'])
        pg=b.new_page(viewport={'width':390,'height':844}); errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        cdp=pg.context.new_cdp_session(pg); cdp.send('Emulation.setCPUThrottlingRate',{'rate':label_rate})
        pg.set_content(page); pg.wait_for_timeout(1500); pg.evaluate(PROBE)
        cdp.send('Performance.enable')
        def pm():
            return {m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
        def meas(name,ms=5000,act=None):
            m0=pm();t0=__import__('time').time()
            pg.evaluate("__start()")
            if act: act()
            else: pg.wait_for_timeout(ms)
            r=pg.evaluate("__stop()");m1=pm();dt=__import__('time').time()-t0
            r['script_pct']=round(100*(m1['ScriptDuration']-m0['ScriptDuration'])/dt,1);r['task_pct']=round(100*(m1['TaskDuration']-m0['TaskDuration'])/dt,1);r['style_pct']=round(100*(m1['RecalcStyleDuration']-m0['RecalcStyleDuration'])/dt,1);r['layout_pct']=round(100*(m1['LayoutDuration']-m0['LayoutDuration'])/dt,1)
            out[name]=r
        meas('a_home')
        if os.environ.get('HL_ONLY')=='home':
            b.close(); return {'errs':errs,**out}
        pg.evaluate("window.HL_TEST_FILL_MS=300"); pg.click('[data-mode="m"]'); pg.click('#playBtn'); pg.wait_for_selector('#lockBtn',timeout=30000); pg.wait_for_timeout(300); pg.click('#lockBtn')
        for i in range(300):
            if pg.query_selector('[data-pickdir]'): break
            pg.wait_for_timeout(200)
        pg.evaluate("closeOv()"); pg.wait_for_timeout(300)
        pg.click('[data-pickdir="h"]'); pg.wait_for_timeout(700)
        # slider drag in ask screen
        def drag():
            el=pg.query_selector('.slider, #sld, input[type=range], [class*=sld]')
            bb=el.bounding_box() if el else None
            if not bb: out['_note']='no slider'; pg.wait_for_timeout(5000); return
            y=bb['y']+bb['height']/2
            pg.mouse.move(bb['x']+10,y); pg.mouse.down()
            for i in range(50):
                pg.mouse.move(bb['x']+10+(bb['width']-20)*((i%25)/25 if (i//25)%2==0 else 1-(i%25)/25),y); pg.wait_for_timeout(100)
            pg.mouse.up()
        meas('c_slider',act=drag)
        pg.click('#askGo'); pg.wait_for_timeout(1500)
        meas('b_duel_idle')
        pg.evaluate("showScene('anvil',{name:'Bob',c:1,k:null,dg:0},null,'Anvil!','Ouch',9000,null,42)") if False else None
        meas('d_death',act=lambda:(pg.evaluate("showScene('anvil',pv(G.players[0]),'Squashed','Ouch',9000,null,42)"),pg.wait_for_timeout(5000)))
        pg.evaluate("closeOv()")
        meas('e_wheel',act=lambda:(pg.evaluate("sceneSeq++;showWheel()"),pg.wait_for_timeout(5000)))
        pg.evaluate("closeOv()")
        b.close()
    return {'errs':errs,**out}
if __name__=='__main__':
    print(os.environ.get('HL_TAG','run'),json.dumps(run()))
