from playwright.sync_api import sync_playwright
html=open('/home/claude/hl/artifact.html').read()
page_html='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':390,'height':760})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.set_content(page_html); pg.wait_for_timeout(500); pg.screenshot(path='shots/u_home.png')
    pg.evaluate("window.HL_TEST_FILL_MS=500")
    pg.click('#playBtn'); pg.wait_for_selector('.key[data-k="7"]',timeout=20000)
    for k in '734': pg.click(f'.key[data-k="{k}"]')
    pg.click('#lockBtn')
    shot=0
    for turn in range(40):
        st=None
        for i in range(400):
            if pg.evaluate("G.phase")=='over': st='over';break
            if pg.query_selector('[data-pickdir]'): st='ask';break
            if pg.query_selector('.guessv'): st='guess';break
            pg.wait_for_timeout(200)
        if st=='over' or st is None: break
        if st=='ask':
            if shot==0:
                pg.evaluate("document.querySelector('#ov').hidden=true")
            pg.click('[data-pickdir="h"]'); pg.wait_for_timeout(500); pg.click('.key[data-k="mid"]'); pg.wait_for_timeout(150); pg.click('#askGo'); pg.wait_for_timeout(1300)
            if shot<2: pg.screenshot(path=f'shots/u_duel{shot}.png'); shot+=1
            pg.wait_for_timeout(1500)
        else:
            pg.wait_for_timeout(400); pg.screenshot(path='shots/u_guess.png')
            # cheat for the screenshot: guess the right one
            n=pg.evaluate("(()=>{const t=curTarget();return botSecrets[t.pid]})()")
            pg.click(f'.g[data-n="{n}"]'); pg.wait_for_timeout(1500); pg.screenshot(path='shots/u_hit.png')
    pg.wait_for_timeout(7000); pg.screenshot(path='shots/u_over.png')
    print(pg.evaluate("JSON.stringify([G.phase,myElo(),eloLast])"),errs)
    b.close()
