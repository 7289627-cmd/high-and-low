from playwright.sync_api import sync_playwright
import sys
html=open('/home/claude/hl/artifact.html').read()
page_html='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>:root{padding:0}body{margin:0}[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1366,'height':768})
    pg.set_content(page_html); pg.wait_for_timeout(600); pg.screenshot(path='shots/pc_home.png')
    pg.click('#friendsBtn'); pg.click('#soloBtn'); pg.wait_for_timeout(200); pg.click('#addBot'); pg.screenshot(path='shots/pc_lobby.png'); pg.click('#startBtn'); pg.wait_for_timeout(200)
    pg.screenshot(path='shots/pc_secret.png')
    for k in '734': pg.click(f'.key[data-k="{k}"]')
    pg.click('#lockBtn'); pg.wait_for_timeout(1500); pg.screenshot(path='shots/pc_wheel.png')
    for i in range(400):
        if pg.query_selector('[data-pickdir]'): break
        pg.wait_for_timeout(250)
    pg.wait_for_timeout(300); pg.screenshot(path='shots/pc_dir.png')
    pg.click('[data-pickdir="h"]'); pg.wait_for_timeout(600)
    for k in '300': pg.click(f'.key[data-k="{k}"]')
    pg.wait_for_timeout(200); pg.screenshot(path='shots/pc_ask.png')
    pg.click('#askGo'); pg.wait_for_timeout(2500); pg.screenshot(path='shots/pc_play.png')
    b.close()
