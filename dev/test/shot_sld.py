from playwright.sync_api import sync_playwright
html=open('/home/claude/hl/artifact.html').read()
page_html='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':390,'height':760},has_touch=True)
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.set_content(page_html); pg.wait_for_timeout(500)
    pg.click('#friendsBtn'); pg.wait_for_timeout(400); pg.screenshot(path='shots/s_lobby.png')
    pg.click('#addBot'); pg.click('#startBtn'); pg.wait_for_timeout(200)
    for k in '734': pg.click(f'.key[data-k="{k}"]')
    pg.click('#lockBtn')
    for i in range(400):
        if pg.query_selector('[data-pickdir]'): break
        pg.wait_for_timeout(250)
    pg.wait_for_timeout(300); pg.click('[data-pickdir="l"]'); pg.wait_for_timeout(700); pg.screenshot(path='shots/s_mid.png')
    box=pg.eval_on_selector('#sldTrack','e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.width,r.height]}')
    y=box[1]+box[3]/2
    pg.mouse.move(box[0]+box[2]*0.5,y); pg.mouse.down()
    for f in [0.55,0.62,0.7,0.78]: pg.mouse.move(box[0]+box[2]*f,y); pg.wait_for_timeout(40)
    pg.wait_for_timeout(100); pg.screenshot(path='shots/s_drag.png'); pg.mouse.up()
    print('after drag',pg.evaluate("[askX(),document.querySelector('#bigNum').textContent]"))
    pg.click('.key[data-k="inc"]'); pg.click('.key[data-k="inc"]'); print('after ++',pg.evaluate("askX()"))
    pg.mouse.move(box[0]+2,y); pg.mouse.down(); pg.mouse.up(); print('far left',pg.evaluate("askX()"))
    pg.mouse.move(box[0]+box[2]-2,y); pg.mouse.down(); pg.mouse.up(); print('far right',pg.evaluate("askX()"), pg.evaluate("JSON.stringify(mv(curTarget()))"))
    pg.screenshot(path='shots/s_right.png')
    pg.click('#flipDir'); pg.wait_for_timeout(500); pg.screenshot(path='shots/s_hi.png')
    pg.click('#askGo'); pg.wait_for_timeout(1500); print(pg.evaluate("JSON.stringify(G.ev)")[:200], errs)
    b.close()
