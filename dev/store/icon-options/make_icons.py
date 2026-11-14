"""Exports the chosen icon (option A, one bean) to site/icons and store/icons. Run: python3 make_icons.py"""
import base64,pathlib,io
from PIL import Image
from playwright.sync_api import sync_playwright
H=pathlib.Path('/home/claude/hl'); W=H/'site/icons'; S=H/'store/icons'; O=H/'store/icon-options'
SKY,GROUND,GDARK='#7FD0E4','#F4C04F','#D9A22F'
src=(H/'src/base.js').read_text()
lib='var INK="#1E2240";'+src[src.index('const ACC='):src.index('const TOMB')].replace('const ACC=','var ACC=').replace('const HAT_NAMES','var HAT_NAMES')
CSS='svg.bean{overflow:visible}.bean *{animation:none!important}svg.bean rect,svg.bean path[stroke="#1E2240"]{stroke-width:5}html,body{margin:0}'
def doc(bean,w,top,bg,size):  # bean svg placed centred, width w, top px; bg True = sky+ground
    g=f'background:linear-gradient(to top,{GROUND} 0 {size*.1855:.1f}px,{GDARK} {size*.1855:.1f}px {size*.2:.1f}px,{SKY} {size*.2:.1f}px)' if bg else 'background:transparent'
    return f'<!doctype html><style>{CSS}#c{{position:relative;width:{size}px;height:{size}px;overflow:hidden;{g}}}</style><div id=c><div style="position:absolute;left:{(size-w)/2}px;top:{top}px;width:{w}px">{bean}</div></div>'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1024,'height':1024}); pg.set_content('<html></html>'); pg.add_script_tag(content=lib)
    bean=pg.evaluate('()=>charSVG({color:"#EE4B3B",acc:0,id:0},"happy")')
    def shot(html,size,omit=False):
        pg.set_viewport_size({'width':size,'height':size}); pg.set_content(html); pg.wait_for_timeout(300)
        return Image.open(io.BytesIO(pg.screenshot(clip={'x':0,'y':0,'width':size,'height':size},omit_background=omit)))
    master=shot(doc(bean,600,125,True,1024),1024).convert('RGB')
    master.save(S/'icon-1024.png')  # App Store: RGB, no alpha, square
    for n in (512,192,180,32): master.resize((n,n),Image.LANCZOS).save((H/'site' if n==180 else W)/(f'icon-{n}.png'))
    master.resize((180,180),Image.LANCZOS).save(S/'icon-180.png')
    master.resize((512,512),Image.LANCZOS).save(S/'icon-512.png')
    # maskable: full-bleed background, bean inside the central 66%
    for n in (512,192):
        m=shot(doc(bean,round(n*.46),round(n*.17),True,n),n).convert('RGB'); m.save(W/f'icon-maskable-{n}.png')
    # Android adaptive foreground 432, content (bean ~139 units tall of 140) inside the 66% safe zone (285px)
    fg=shot(doc(bean,200,80,False,432),432,True).convert('RGBA'); fg.save(S/'adaptive-foreground-432.png')
    open(S/'adaptive-background-color.txt','w').write(SKY+'\n')
    b.close()
bb=fg.getbbox(); print('fg bbox',bb,'safe',(432-285)//2,(432+285)//2)
