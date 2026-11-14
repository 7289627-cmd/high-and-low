from playwright.sync_api import sync_playwright
html=open('/home/claude/hl/artifact.html').read()
page_html='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':390,'height':760})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.set_content(page_html); pg.wait_for_timeout(500)
    pg.click('#friendsBtn'); pg.wait_for_timeout(300); pg.click('#startBtn'); pg.wait_for_timeout(400)
    print('start',pg.evaluate("ui.sec"))
    box=pg.eval_on_selector('#secTrack','e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.width,r.height]}')
    y=box[1]+box[3]/2
    pg.mouse.move(box[0]+box[2]*0.3,y); pg.mouse.down()
    for f in [0.4,0.5,0.63]: pg.mouse.move(box[0]+box[2]*f,y); pg.wait_for_timeout(40)
    pg.screenshot(path='shots/s_sec.png'); pg.mouse.up()
    a=pg.evaluate("ui.sec"); pg.click('.key[data-k="inc"]'); print('drag',a,'inc',pg.evaluate("ui.sec"))
    pg.keyboard.press('4'); pg.keyboard.press('2'); print('typed',pg.evaluate("ui.sec"),pg.inner_text('#secNum'))
    pg.click('#lockBtn'); pg.wait_for_timeout(500); print('locked',pg.evaluate("mySecret&&mySecret.n"),errs)
    b.close()
