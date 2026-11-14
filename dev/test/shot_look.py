"""Home wardrobe + music cut check in real Chrome. Prints PASS look (N checks) or FAIL look: reason."""
import sys,subprocess,time,socket
sys.path.insert(0,'/home/claude/hl/test')
import real_browser as rb
from playwright.sync_api import sync_playwright
port=rb.free_port(); fonts=rb.font_files()
srv=subprocess.Popen([sys.executable,'-m','http.server',str(port),'--bind','127.0.0.1'],cwd=str(rb.SITE),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1); n=0; errs=[]
def ok(c,m):
    global n; n+=1
    if not c: errs.append(m)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path=rb.CHROME,args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    for vp in [(390,844),(320,568)]:
        ctx=b.new_context(viewport={'width':vp[0],'height':vp[1]},is_mobile=True,has_touch=True)
        ctx.add_init_script(rb.INIT); rb.handle_routes(ctx,f'http://127.0.0.1:{port}',fonts)
        pg=ctx.new_page(); pe=[]; pg.on('pageerror',lambda e:pe.append(str(e)))
        pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_selector('#meBtn',timeout=15000)
        pg.screenshot(path=f'/home/claude/hl/test/shots/look_home_{vp[0]}.png')
        pg.evaluate("localStorage.setItem('hl-wins','2')")
        pg.click('#meBtn'); pg.wait_for_selector('.looksheet')
        ok(pg.locator('.looksheet .pk-hat').count()==12,'12 hats listed')
        ok(pg.locator('.looksheet .pk-hat.locked').count()==4,'4 hats locked at 2 wins: %d'%pg.locator('.looksheet .pk-hat.locked').count())
        pg.click('.looksheet [data-hc="3"]'); pg.click('.looksheet [data-hk="7"]')
        ok(pg.evaluate("JSON.parse(localStorage.getItem('hl-look')||'null')")=={'c':3,'k':7},'look saved: %s'%pg.evaluate("localStorage.getItem('hl-look')"))
        pg.evaluate("document.querySelector('.looksheet [data-hk=\"11\"]').disabled=false"); pg.click('.looksheet [data-hk="11"]',force=True)
        ok(pg.evaluate("JSON.parse(localStorage.getItem('hl-look')).k")==7,'locked hat cannot be picked')
        sw=pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=vp[0],'no sideways scroll in sheet (%d)'%sw)
        pg.screenshot(path=f'/home/claude/hl/test/shots/look_sheet_{vp[0]}.png')
        pg.click('#ovX'); ok(pg.locator('.looksheet').count()==0,'sheet closes')
        ok(pg.evaluate("MUSIC.want")=='home','menu tune wanted on home')
        pg.click('#playBtn'); pg.wait_for_timeout(150)
        ok(pg.evaluate("MUSIC.want")=='play','menu tune dropped right after Play: %s'%pg.evaluate("MUSIC.want"))
        ok(pg.evaluate("!(MUSIC.T.home&&MUSIC.T.home.node)"),'home track node stopped')
        ok(not pe,'page errors: %s'%pe[:2]); ctx.close()
    b.close()
finally: srv.kill()
print('PASS look (%d checks)'%n if not errs else 'FAIL look: '+'; '.join(errs[:4]))
