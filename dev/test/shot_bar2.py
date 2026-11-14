import base64
from playwright.sync_api import sync_playwright
S='/tmp/claude-0/-home-claude/6c2b5f03-7d11-550a-a2af-2801283b81c5/scratchpad'
f=lambda n:base64.b64encode(open(f'{S}/node_modules/@fontsource/{n}/files/{n}-latin-400-normal.woff2','rb').read()).decode()
html=open('/home/claude/hl/artifact.html').read()
page='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>@font-face{font-family:"Bagel Fat One";src:url(data:font/woff2;base64,'+f('bagel-fat-one')+')}@font-face{font-family:"Baloo 2";font-weight:500 800;src:url(data:font/woff2;base64,'+f('baloo-2')+')}[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':390,'height':760}); errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.set_content(page); pg.wait_for_timeout(800)
    pg.evaluate("window.HL_TEST_FILL_MS=300"); pg.click('[data-mode="l"]'); pg.click('#playBtn'); pg.wait_for_selector('#lockBtn',timeout=20000); pg.click('#lockBtn')
    for i in range(300):
        if pg.query_selector('[data-pickdir]'): break
        pg.wait_for_timeout(200)
    pg.evaluate("closeOv()"); pg.click('[data-pickdir="h"]'); pg.wait_for_timeout(600)
    for i in range(30): pg.click('.key[data-k="dec"]')
    print('after 30 minus taps', pg.evaluate("askX()")); pg.wait_for_timeout(1500); print('1.5s later', pg.evaluate("askX()"))
    pg.click('.key[data-k="mid"]'); pg.click('#askGo')
    for i in range(100):
        if pg.query_selector('.rb.live'): break
        pg.wait_for_timeout(50)
    pg.wait_for_timeout(250); pg.screenshot(path='shots/v_cut1.png'); pg.wait_for_timeout(650); pg.screenshot(path='shots/v_cut2.png'); pg.wait_for_timeout(1500); pg.screenshot(path='shots/v_cut3.png')
    pg.evaluate("""(()=>{const o=G.players.find(p=>p.pid!==PID),s=botSecrets[o.pid],lo=Math.max(1,Math.min(s-4,99991));G.kn[PID][o.pid]={lo:lo,hi:lo+9,x:[lo+2,lo+7]};G.turn=G.players.findIndex(p=>p.pid===PID);G.sub=[o.pid];G.stage='await';G.q=null;G.seq++;publishG()})()""")
    pg.wait_for_selector('.guessv',timeout=8000); pg.wait_for_timeout(400); pg.screenshot(path='shots/v_guess100k.png')
    print('grid fits', pg.evaluate("[...document.querySelectorAll('.guess-grid .g')].every(b=>b.scrollWidth<=b.clientWidth+1)"))
    pg.evaluate("G.turn=G.players.findIndex(p=>p.pid!==PID);G.sub=['*'];G.seq++;publishG()"); pg.wait_for_timeout(700); pg.screenshot(path='shots/v_zone.png')
    print(errs); b.close()
