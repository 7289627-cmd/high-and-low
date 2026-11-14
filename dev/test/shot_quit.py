from playwright.sync_api import sync_playwright
html=open('/home/claude/hl/artifact.html').read()
page_html='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':390,'height':760})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.set_content(page_html); pg.wait_for_timeout(500); pg.evaluate("window.HL_TEST_FILL_MS=400")
    pg.click('#playBtn'); pg.wait_for_selector('#lockBtn',timeout=20000); pg.click('#lockBtn')
    for i in range(200):
        if pg.evaluate("G.phase==='play'&&G.stage!=='wheel'"): break
        pg.wait_for_timeout(200)
    pg.evaluate("closeOv()"); pg.click('#leaveBtn'); pg.wait_for_timeout(400); pg.screenshot(path='shots/s_quit.png')
    pg.click('#stayBtn'); pg.wait_for_timeout(200); print('stayed',pg.evaluate("view"))
    pg.click('#leaveBtn'); pg.click('#quitBtn'); pg.wait_for_timeout(600); print('left',pg.evaluate("view"),pg.evaluate("JSON.stringify(eloLast)"),errs)
    b.close()
