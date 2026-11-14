from playwright.sync_api import sync_playwright
html=open('/home/claude/hl/artifact.html').read()
page_html='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    for w,h,n in [(390,760,'k_phone'),(390,844,'k_tall'),(1366,768,'k_pc')]:
        pg=b.new_page(viewport={'width':w,'height':h}); errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.set_content(page_html); pg.wait_for_timeout(2500); pg.screenshot(path=f'shots/{n}1.png'); pg.wait_for_timeout(3300); pg.screenshot(path=f'shots/{n}2.png'); print(n,errs)
    b.close()
