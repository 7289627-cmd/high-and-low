from playwright.sync_api import sync_playwright
html=open('/home/claude/hl/artifact.html').read()
page_html='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':390,'height':760})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.set_content(page_html); pg.wait_for_timeout(600)
    pg.fill('#nameIn','Dodgy'); pg.click('#friendsBtn'); pg.click('#soloBtn'); pg.wait_for_timeout(200)
    pg.click('#addBot'); pg.wait_for_timeout(100)
    pg.click('#startBtn'); pg.wait_for_timeout(200)
    for k in '734': pg.click(f'.key[data-k="{k}"]')
    pg.click('#lockBtn')
    def myturn():
        for i in range(600):
            if pg.query_selector('[data-pickdir]'): return True
            if pg.query_selector('.guess-grid'): return False
            pg.wait_for_timeout(250)
    myturn(); pg.wait_for_timeout(300)
    pg.click('[data-pickdir="h"]'); pg.wait_for_timeout(700)
    pg.screenshot(path='shots/r_empty.png')
    for k in '300': pg.click(f'.key[data-k="{k}"]')
    pg.wait_for_timeout(300); pg.screenshot(path='shots/r_num.png')
    pg.click('#askGo')
    for i in range(80):
        if len(pg.query_selector_all('.dmg'))>=1: break
        pg.wait_for_timeout(50)
    pg.wait_for_timeout(350); pg.screenshot(path='shots/r_dmg.png')
    pg.wait_for_timeout(2500); pg.screenshot(path='shots/r_after.png')
    n=0
    while n<3 and myturn():
        n+=1; pg.wait_for_timeout(300); pg.click('[data-pickdir="l"]'); pg.wait_for_timeout(600)
        pg.click('.key[data-k="mid"]'); pg.wait_for_timeout(300); pg.screenshot(path=f'shots/r_num{n}.png')
        pg.click('#askGo'); pg.wait_for_timeout(2600); pg.screenshot(path=f'shots/r_after{n}.png')
    print(errs)
    b.close()
