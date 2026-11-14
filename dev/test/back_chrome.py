# Real Chrome check of the Back button. Run: cd test && python3 back_chrome.py  (needs: python3 build.py web first)
import http.server,threading,functools
from playwright.sync_api import sync_playwright
H=functools.partial(http.server.SimpleHTTPRequestHandler,directory='/home/claude/hl/site')
H.log_message=lambda *a:None
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),H);port=srv.server_address[1]
threading.Thread(target=srv.serve_forever,daemon=True).start()
U=f'http://127.0.0.1:{port}/index.html'
bad=[]
def chk(c,m):
    if not c: bad.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':390,'height':844});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('about:blank');pg.goto(U+'#room=ABCD&flags=x');pg.wait_for_selector('#infoBtn',timeout=15000)
    chk(pg.evaluate('location.hash')=='#flags=x','hash after load: '+pg.evaluate('location.hash'))
    pg.click('#infoBtn');pg.wait_for_timeout(300)
    chk(pg.evaluate('!$("#ov").hidden'),'sheet open')
    pg.go_back();pg.wait_for_timeout(400)
    chk(U in pg.url,'still on game after Back 1: '+pg.url)
    chk(pg.evaluate('$("#ov").hidden'),'sheet closed by Back')
    chk(pg.evaluate('location.hash')=='#flags=x','hash kept '+pg.evaluate('location.hash'))
    pg.mouse.click(195,300);pg.wait_for_timeout(200)   # a tap re-arms the sentinel
    pg.go_back();pg.wait_for_timeout(600)
    chk(pg.url=='about:blank','Back on home leaves the page: '+pg.url)
    b.close()
chk(not errs,'page errors '+str(errs))
print('FAIL back_chrome',bad) if bad else print('PASS back_chrome')
