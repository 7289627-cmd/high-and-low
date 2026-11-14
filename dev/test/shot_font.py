import base64
from playwright.sync_api import sync_playwright
S='/tmp/claude-0/-home-claude/6c2b5f03-7d11-550a-a2af-2801283b81c5/scratchpad'
f=lambda n:base64.b64encode(open(f'{S}/node_modules/@fontsource/{n}/files/{n}-latin-400-normal.woff2','rb').read()).decode()
html=open('/home/claude/hl/artifact.html').read()
page='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>@font-face{font-family:"Bagel Fat One";src:url(data:font/woff2;base64,'+f('bagel-fat-one')+')}@font-face{font-family:"Baloo 2";font-weight:500 800;src:url(data:font/woff2;base64,'+f('baloo-2')+')}[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    for w,h,tag in [(390,760,''),(320,640,'_320')]:
        pg=b.new_page(viewport={'width':w,'height':h}); errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.set_content(page); pg.wait_for_timeout(1500); pg.screenshot(path=f'shots/b_home{tag}.png')
        pg.evaluate("window.HL_TEST_FILL_MS=300"); pg.click('[data-mode="m"]'); pg.click('#playBtn'); pg.wait_for_selector('#lockBtn',timeout=20000); pg.wait_for_timeout(300); pg.screenshot(path=f'shots/b_sec{tag}.png'); pg.click('#lockBtn')
        for i in range(300):
            if pg.query_selector('[data-pickdir]'): break
            pg.wait_for_timeout(200)
        pg.evaluate("closeOv()"); pg.wait_for_timeout(400); pg.screenshot(path=f'shots/b_dir{tag}.png')
        pg.click('[data-pickdir="h"]'); pg.wait_for_timeout(700); pg.screenshot(path=f'shots/b_ask{tag}.png')
        pg.click('#askGo'); pg.wait_for_timeout(1400); pg.screenshot(path=f'shots/b_duel{tag}.png')
        print(tag or 'phone', pg.evaluate("document.documentElement.scrollWidth<=innerWidth"), errs); pg.close()
    b.close()
