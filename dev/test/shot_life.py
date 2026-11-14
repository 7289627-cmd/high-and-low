from playwright.sync_api import sync_playwright
html=open('/home/claude/hl/artifact.html').read()
page_html='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':390,'height':760})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.set_content(page_html); pg.wait_for_timeout(500)
    print('names:',pg.evaluate("Array.from({length:40},()=>freshName([])).join(' ')"))
    pg.evaluate("PZ_POOL.length=0;PZ_POOL.push('echo','spam','react')")
    pg.click('#playBtn'); pg.wait_for_selector('.key[data-k="7"]',timeout=20000)
    print(pg.evaluate("JSON.stringify(G.players.map(p=>[p.name,p.c,p.k,p.hb]))"))
    for k in '734': pg.click(f'.key[data-k="{k}"]')
    pg.click('#lockBtn'); pg.wait_for_timeout(9000)
    for i in range(4):
        pg.evaluate("tauntSend(0)"); pg.wait_for_timeout(1700)
    pg.wait_for_timeout(1200); pg.screenshot(path='shots/life.png')
    pg.wait_for_timeout(20000)
    print(pg.evaluate("JSON.stringify([G.bt,botPz,ui.pops.length])"))
    print(errs); b.close()
