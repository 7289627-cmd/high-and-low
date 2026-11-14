import base64
from playwright.sync_api import sync_playwright
S='/tmp/claude-0/-home-claude/6c2b5f03-7d11-550a-a2af-2801283b81c5/scratchpad'
f=lambda n:base64.b64encode(open(f'{S}/node_modules/@fontsource/{n}/files/{n}-latin-400-normal.woff2','rb').read()).decode()
html=open('/home/claude/hl/artifact.html').read()
page='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>@font-face{font-family:"Bagel Fat One";src:url(data:font/woff2;base64,'+f('bagel-fat-one')+')}@font-face{font-family:"Baloo 2";font-weight:500 800;src:url(data:font/woff2;base64,'+f('baloo-2')+')}[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':390,'height':844}); errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pass
    pg.set_content(page); pg.wait_for_timeout(1200); pg.evaluate('HL_FLAGS.share=true')
    pg.evaluate("""G={phase:'over',win:PID,max:10000,gid:'g1',pub:1,players:[{pid:PID,name:'Me',c:3,k:6},{pid:'zz',name:'Them',c:2}]};eloLast={gid:'g1',d:18,from:1130,to:1148,up:false};showWinner()""")
    pg.wait_for_timeout(1500); pg.screenshot(path='shots/share_sheet.png')
    d=pg.evaluate("""async()=>{const cv=await shareCanvas();return cv.toDataURL('image/png')}""")
    open('shots/share_card.png','wb').write(base64.b64decode(d.split(',')[1]))
    print(errs); b.close()
