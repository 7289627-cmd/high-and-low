import sys,base64
from playwright.sync_api import sync_playwright
from PIL import Image
S='/tmp/claude-0/-home-claude/6c2b5f03-7d11-550a-a2af-2801283b81c5/scratchpad'
kinds=sys.argv[1].split(','); times=[float(x) for x in (sys.argv[2] if len(sys.argv)>2 else '0.5,1.5,2.2,3.0,4.4').split(',')]
font=base64.b64encode(open(f'{S}/node_modules/@fontsource/bagel-fat-one/files/bagel-fat-one-latin-400-normal.woff2','rb').read()).decode()
html=open('/home/claude/hl/artifact.html').read()
page='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>@font-face{font-family:"Bagel Fat One";src:url(data:font/woff2;base64,'+font+')}[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    for kind in kinds:
        frames=[]
        for t in times:
            pg=b.new_page(viewport={'width':390,'height':420}); pg.set_content(page); pg.wait_for_timeout(350)
            pg.evaluate("""k=>{document.getElementById('app').innerHTML='<div class="sheet center" style="margin:8px"><div class="stage">'+SCENES[k]({color:COLORS[0],acc:0,id:1},{color:COLORS[1],acc:1,id:2},'9,100')+'</div></div>'}""",kind)
            pg.wait_for_timeout(int(t*1000)); f=f'{S}/_f.png'; pg.locator('.stage').screenshot(path=f); frames.append(Image.open(f).copy()); pg.close()
        w,h=frames[0].size; sheet=Image.new('RGB',(w*len(frames)+6*(len(frames)-1),h),'white')
        for i,fr in enumerate(frames): sheet.paste(fr,(i*(w+6),0))
        sheet.save(f'shots/f_{kind}.png'); print(kind,sheet.size)
    b.close()
