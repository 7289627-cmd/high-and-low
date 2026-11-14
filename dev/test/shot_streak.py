import base64,datetime
from playwright.sync_api import sync_playwright
S='/tmp/claude-0/-home-claude/6c2b5f03-7d11-550a-a2af-2801283b81c5/scratchpad'
f=lambda n:base64.b64encode(open(f'{S}/node_modules/@fontsource/{n}/files/{n}-latin-400-normal.woff2','rb').read()).decode()
html=open('/home/claude/hl/artifact.html').read()
page='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>@font-face{font-family:"Bagel Fat One";src:url(data:font/woff2;base64,'+f('bagel-fat-one')+')}@font-face{font-family:"Baloo 2";font-weight:500 800;src:url(data:font/woff2;base64,'+f('baloo-2')+')}[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
t=datetime.date.today()
days=[(t-datetime.timedelta(d)).isoformat() for d in (0,1,3,5)]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':390,'height':844});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://x.test/**',lambda r:r.fulfill(body=page,content_type='text/html'));pg.goto('https://x.test/');pg.wait_for_timeout(500)
    pg.evaluate("window.HL_FLAGS.streak=true;LS.set('hl-st-ws',3);LS.set('hl-st-days',%s);LS.set('hl-elo',1180);LS.set('hl-coins',25)"%days)
    pg.evaluate("render(true)");pg.wait_for_timeout(600);pg.screenshot(path='shots/streak_home.png')
    pg.evaluate("""(()=>{LS.del('hl-st-bd');G={pub:1,gid:'sx',en:1,phase:'over',win:PID,max:100,players:[{pid:PID,name:'Me',c:1,a:1},{pid:'o',name:'Rival',c:2,a:0}]};countWin();stGame(true,true);eloLast={gid:'sx',d:21,from:1159,to:1180,up:false};showWinner()})()""")
    pg.wait_for_timeout(1500);pg.screenshot(path='shots/streak_result.png');print(errs);b.close()
