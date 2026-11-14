"""d01 helper: reach a screen at one viewport and dump element boxes. usage: d01_probe.py WxH screen js_file
screen in: dir, ask, lobby, duel"""
import sys, real_browser as rb
from playwright.sync_api import sync_playwright
import subprocess
w,h=map(int,sys.argv[1].split('x')); screen=sys.argv[2]; js=open(sys.argv[3]).read()
fonts=rb.font_files(); port=rb.free_port()
srv=subprocess.Popen([sys.executable,'-m','http.server',str(port),'--bind','127.0.0.1'],cwd=str(rb.SITE),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
import time; time.sleep(1); base=f'http://127.0.0.1:{port}'
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path=rb.CHROME,args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=True,has_touch=True,device_scale_factor=1)
    ctx.add_init_script(rb.INIT); rb.handle_routes(ctx,base,fonts); pg=ctx.new_page()
    pg.goto(base+'/index.html'); rb.wait_for(pg,"typeof roomState!=='undefined'&&roomState==='ok'&&!!document.querySelector('#playBtn')",8000)
    pg.wait_for_timeout(500); pg.fill('#nameIn','Dodgy')
    if screen=='lobby':
        pg.click('#friendsBtn'); pg.wait_for_timeout(600)
    else:
        pg.click('#playBtn'); rb.wait_for(pg,"!!document.querySelector('#secTrack')",20000); pg.wait_for_timeout(400)
        pg.click('#lockBtn')
        rb.wait_for(pg,"!!document.querySelector('[data-pickdir]')||!!document.querySelector('#sld')",25000); pg.wait_for_timeout(500)
        if pg.evaluate("!document.querySelector('#ov').hidden"): pg.evaluate("closeOv()"); pg.wait_for_timeout(300)
        if screen in('ask','duel'):
            pg.click('[data-pickdir="h"]'); pg.wait_for_timeout(500)
        if screen=='duel':
            rb.drag_slider(pg,'#sldTrack',.55); pg.click('#askGo'); pg.wait_for_timeout(900)
    print(pg.evaluate(js))
    ctx.close(); b.close()
finally: srv.kill()
