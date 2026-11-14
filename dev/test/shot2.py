from playwright.sync_api import sync_playwright
html=open('/home/claude/hl/artifact.html').read()
page_html='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':390,'height':760})
    pg.set_content(page_html); pg.wait_for_timeout(600)
    pg.fill('#nameIn','Dodgy'); pg.click('#soloBtn'); pg.wait_for_timeout(200)
    pg.click('#addBot'); pg.wait_for_timeout(100)
    pg.click('[data-max="100000"]'); pg.wait_for_timeout(100)
    pg.click('#startBtn'); pg.wait_for_timeout(200)
    for k in '42': pg.click(f'.key[data-k="{k}"]')
    pg.screenshot(path='t1.png')
    for k in '817': pg.click(f'.key[data-k="{k}"]')
    pg.click('#lockBtn'); pg.wait_for_timeout(6500)
    pg.screenshot(path='t2.png')
    for i in range(200):
        if pg.query_selector('[data-pickdir]'): break
        pg.wait_for_timeout(250)
    pg.click('[data-pickdir="h"]'); pg.wait_for_timeout(700)
    for k in '35': pg.click(f'.key[data-k="{k}"]')
    pg.wait_for_timeout(300)
    pg.screenshot(path='t3.png')
    b.close()
