import base64,sys
from playwright.sync_api import sync_playwright
S='/tmp/claude-0/-home-claude/6c2b5f03-7d11-550a-a2af-2801283b81c5/scratchpad'
f=lambda n:base64.b64encode(open(f'{S}/node_modules/@fontsource/{n}/files/{n}-latin-400-normal.woff2','rb').read()).decode()
html=open('/home/claude/hl/artifact.html').read()
page='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>@font-face{font-family:"Bagel Fat One";src:url(data:font/woff2;base64,'+f('bagel-fat-one')+')}@font-face{font-family:"Baloo 2";font-weight:500 800;src:url(data:font/woff2;base64,'+f('baloo-2')+')}[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    for (w,h) in [(390,844),(320,568)]:
        pg=b.new_page(viewport={'width':w,'height':h}); errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.set_content(page); pg.wait_for_timeout(1200)
        pg.evaluate("""G={phase:'over',win:PID,max:10000,gid:'g1',pub:1,players:[{pid:PID,name:'Me',c:3,k:6},{pid:'zz',name:'Them',c:2}]};mode='online';isPub=true;eloLast={gid:'g1',d:18,from:1130,to:1148,up:false};showWinner()""")
        pg.wait_for_timeout(1200); pg.screenshot(path=f'test/shots/c04_result_{w}.png')
        pg.click('#repBtn'); pg.wait_for_timeout(600); pg.screenshot(path=f'test/shots/c04_reported_{w}.png')
        print(w,pg.evaluate("[JSON.stringify(G.players.map(p=>p.name)),JSON.stringify(repList)]"))
        pg.evaluate("closeOv();window.HLNative={restore(){return Promise.resolve(true)},buyNoAds(){return Promise.resolve(false)},showInterstitial(){return Promise.resolve()}};HLAds.setNoAds(false);document.querySelector('#infoBtn')&&0")
        pg.evaluate("openOv('<div class=\"sheet center\"><h2>x</h2></div>')")
        pg.evaluate("closeOv();leaveGame&&0")
        # info sheet needs home view
        pg.evaluate("G=null;mode='';view='home';render(true)")
        pg.wait_for_timeout(500)
        pg.click('#infoBtn'); pg.wait_for_timeout(500); pg.screenshot(path=f'test/shots/c04_info_{w}.png')
        pg.evaluate("closeOv();G={phase:'play',max:100,gid:'g2',pub:0,turn:0,players:[{pid:PID,name:'Me',c:3,a:1,h:3,dg:0},{pid:'zz',name:'Them',c:2,a:1,h:3,dg:0}],st:{}};mode='solo';view='game';render(true)")
        pg.wait_for_timeout(600); pg.screenshot(path=f'test/shots/c04_game_{w}.png')
        print(w,errs); pg.close()
    U='file:///home/claude/hl/site/index.html'
    pg=b.new_page(viewport={'width':844,'height':390},has_touch=True,is_mobile=True); pg.goto(U);pg.wait_for_timeout(1500)
    pg.screenshot(path='test/shots/c04_rotate_844.png'); pg.wait_for_timeout(1200); pg.screenshot(path='test/shots/c04_rotate_844b.png')
    print('home still mounted',pg.evaluate("!!document.querySelector('#playBtn')"))
    for (w,h,t) in [(1024,768,True),(1280,380,False),(390,844,True)]:
        q=b.new_page(viewport={'width':w,'height':h},has_touch=t,is_mobile=t); q.goto(U); q.wait_for_timeout(500)
        print(w,h,t,q.evaluate("getComputedStyle(document.querySelector('.rotate-cover')).display")); q.close()
    print('phone',pg.evaluate("getComputedStyle(document.querySelector('.rotate-cover')).display"))
    b.close()
