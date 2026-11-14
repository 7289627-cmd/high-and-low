"""Renders icon options with the game's own charSVG (src/base.js). Run: python3 make_options.py"""
import base64,re,pathlib
from playwright.sync_api import sync_playwright
H=pathlib.Path('/home/claude/hl'); OUT=H/'store/icon-options'
FONT='/tmp/claude-0/-home-claude/6c2b5f03-7d11-550a-a2af-2801283b81c5/scratchpad/node_modules/@fontsource/bagel-fat-one/files/bagel-fat-one-latin-400-normal.woff2'
fb=base64.b64encode(open(FONT,'rb').read()).decode()
SKY,GROUND,GDARK,INK='#7FD0E4','#F4C04F','#D9A22F','#1E2240'
def page(body,extra=''):
    return f'''<!doctype html><meta charset=utf8><style>@font-face{{font-family:"Bagel Fat One";src:url(data:font/woff2;base64,{fb})}}
html,body{{margin:0;background:#fff}}#c{{position:relative;width:1024px;height:1024px;overflow:hidden;background:linear-gradient(to top,{GROUND} 0 190px,{GDARK} 190px 206px,{SKY} 206px)}}
#c .bean{{position:absolute;animation:none!important}}.bean *{{animation:none!important}}svg.bean{{overflow:visible}}svg.bean rect,svg.bean path[stroke="#1E2240"]{{stroke-width:5}}{extra}</style><div id=c>{body}</div>'''
def bean(p,x,y,w,rot=0,z=1):  # x = centre x, y = top of box
    return f'<div style="position:absolute;left:{x-w/2}px;top:{y}px;width:{w}px;transform:rotate({rot}deg);z-index:{z}">%s</div>'%('@@'+p+'@@')
VARS={
 'a_one_bean':[('red',512,125,600,0,2)],
 'b_two_peek':[('red',410,135,600,-4,3),('blue',800,330,380,8,1)],
 'c_bean_question':[('red',400,150,600,-3,2)],
}
Q=f'''<div style="position:absolute;left:560px;top:70px;width:380px;height:300px;z-index:5"><svg viewBox="0 0 380 300" width=380 height=300><path d="M40 20h300a30 30 0 0 1 30 30v170a30 30 0 0 1-30 30H200l-60 46 14-46H40a30 30 0 0 1-30-30V50a30 30 0 0 1 30-30z" fill="#fff" stroke="{INK}" stroke-width="14" stroke-linejoin="round"/><text x="190" y="205" text-anchor="middle" font-family="Bagel Fat One" font-size="210" fill="{INK}">?</text></svg></div>'''
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1024,'height':1024}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.set_content('<html><body></body></html>')
    src=(H/'src/base.js').read_text()
    start=src.index('const INK='); end=src.index('const TOMB')
    pg.evaluate('()=>{window.esc=s=>s}')
    pg.add_script_tag(content=src[start:end].replace('const INK','window.INK').replace('const ACC=','window.ACC=').replace('function charSVG','window.charSVG=function charSVG') if False else 'var INK="#1E2240";'+src[src.index('const ACC='):end].replace('const ACC=','var ACC=').replace('const HAT_NAMES','var HAT_NAMES'))
    COL={'red':'#EE4B3B','blue':'#3D7BFF'}
    def svg(c,acc,mood): return pg.evaluate('([c,a,m])=>charSVG({color:c,acc:a,id:0},m)',[COL[c],acc,mood])
    for name,items in VARS.items():
        body=''
        for c,x,y,w,rot,z in items:
            acc=0 if c=='red' else 3
            s=svg(c,acc,'happy' if c=='red' else 'idle')
            body+=f'<div style="position:absolute;left:{x-w/2}px;top:{y}px;width:{w}px;transform:rotate({rot}deg);z-index:{z}">{s}</div>'
        if name.startswith('c_'): body+=Q
        pg.set_content(page(body)); pg.wait_for_timeout(500)
        pg.screenshot(path=str(OUT/f'{name}.png'),clip={'x':0,'y':0,'width':1024,'height':1024})
    print('errs',errs); b.close()
