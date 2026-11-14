import sys,base64,re
from playwright.sync_api import sync_playwright
S='/tmp/claude-0/-home-claude/6c2b5f03-7d11-550a-a2af-2801283b81c5/scratchpad'
f=lambda n:base64.b64encode(open(f'{S}/node_modules/@fontsource/{n}/files/{n}-latin-400-normal.woff2','rb').read()).decode()
html=open('/home/claude/hl/artifact.html').read()
cfgs={'p':(390,844,59,34,0,0),'l':(844,390,0,21,47,47),'t':(1024,1366,24,20,0,0)}
def run(key,inset=True):
    w,h,t,bt,l,r=cfgs[key]
    h2=html
    if inset:  # DEBUG ONLY: emulate insets by substituting env() in the built page copy
        for n,v in (('top',t),('bottom',bt),('left',l),('right',r)):
            h2=h2.replace(f'env(safe-area-inset-{n},0px)',f'{v}px').replace(f'env(safe-area-inset-{n})',f'{v}px')
    page='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>@font-face{font-family:"Bagel Fat One";src:url(data:font/woff2;base64,'+f('bagel-fat-one')+')}@font-face{font-family:"Baloo 2";font-weight:500 800;src:url(data:font/woff2;base64,'+f('baloo-2')+')}[hidden]{display:none!important}</style></head><body>'+h2+'</body></html>'
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
        pg=b.new_page(viewport={'width':w,'height':h}); errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        S2=lambda n:pg.screenshot(path=f'shots/a01_{key}_{n}.png')
        pg.set_content(page); pg.wait_for_timeout(1500); S2('1home')
        pg.evaluate("window.HL_TEST_FILL_MS=300"); pg.click('#playBtn'); pg.wait_for_selector('#lockBtn',timeout=20000); pg.wait_for_timeout(300)
        S2('2secret'); pg.click('#lockBtn')
        for i in range(300):
            if pg.query_selector('[data-pickdir]'): break
            pg.wait_for_timeout(200)
        pg.wait_for_timeout(500); S2('3dir')
        pg.evaluate("closeOv()"); pg.wait_for_timeout(300)
        pg.click('[data-pickdir="h"]'); pg.wait_for_timeout(700); S2('4ask')
        pg.click('#askGo'); pg.wait_for_timeout(1400); S2('5duel')
        for i in range(400):
            if pg.query_selector('.guessv') or pg.evaluate("G.phase")=='over': break
            if pg.query_selector('[data-pickdir]'):
                pg.evaluate("closeOv()");pg.click('[data-pickdir="h"]'); pg.wait_for_timeout(500); pg.click('#askGo')
            pg.wait_for_timeout(300)
        pg.wait_for_timeout(500); S2('6guess')
        n=pg.evaluate("(()=>{const t=curTarget();return botSecrets[t.pid]})()")
        if pg.query_selector(f'.g[data-n="{n}"]'): pg.click(f'.g[data-n="{n}"]')
        pg.wait_for_timeout(9000); S2('7result')
        print(key,pg.evaluate("document.documentElement.scrollWidth<=innerWidth"),errs)
        b.close()
for k in sys.argv[1:]: run(k)
