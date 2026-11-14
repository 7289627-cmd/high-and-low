"""Contact sheets of the rated-duel result sheet, one frame every 100 ms (animations are stepped, not timed).
Usage: python3 shot_result.py   (needs ../artifact.html from `python3 build.py`; writes shots/res_*.png)"""
import sys
from playwright.sync_api import sync_playwright
from PIL import Image
html=open('/home/claude/hl/artifact.html').read()
page_html='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
# name, win?, from, to, up?
CASES=[('win',True,1100,1120),('loss',False,1120,1100),('rankup',True,1040,1062),('top',True,1650,1668),('rankdown',False,1155,1140)]
SIZES=[(390,844),(320,568)]
STEPS=range(0,2400,100) if len(sys.argv)<2 else [int(x) for x in sys.argv[1].split(',')]
def prep(pg):
    pg.evaluate("window.HL_TEST_FILL_MS=500")
    pg.click('#playBtn'); pg.wait_for_selector('#lockBtn',timeout=20000)
    pg.click('#lockBtn'); pg.wait_for_timeout(2500)
    print('state',pg.evaluate("[G.phase,G.pub,G.players.length]"))
def show(pg,win,a,b):
    pg.evaluate(f"""(()=>{{closeOv();const o=G.players.find(p=>p.pid!==PID);G.phase='over';G.win=({'true' if win else 'false'})?PID:o.pid;
      const d={b-a};eloLast={{gid:G.gid,d,from:{a},to:{b},up:rankName({b})!==rankName({a})&&{b}>{a}}};showWinner()}})()""")
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    for (w,h) in SIZES:
        innerW,innerH=w,h
        pg=br.new_page(viewport={'width':w,'height':h})
        errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.set_content(page_html);pg.wait_for_timeout(500)
        prep(pg)
        for name,win,a,b in CASES:
            show(pg,win,a,b); pg.wait_for_selector('.sheet .er',timeout=3000)
            frames=[]
            for t in STEPS:
                pg.evaluate(f"document.getAnimations().forEach(a=>{{a.pause();a.currentTime={t}}})")
                pg.wait_for_timeout(30)
                path=f'shots/_f.png'
                bb=pg.evaluate("(()=>{const r=document.querySelector('#ov .sheet').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()")
                pg.screenshot(path=path,clip={'x':max(0,bb[0]-4),'y':max(0,bb[1]-4),'width':min(innerW,bb[2]+8),'height':min(innerH,bb[3]+8)})
                frames.append(Image.open(path).convert('RGB').copy())
            # layout facts at the end of the timeline
            info=pg.evaluate("""(()=>{const s=document.querySelector('#ov .sheet'),b=document.querySelector('#againBtn').getBoundingClientRect();
              return {sheetScroll:s.scrollHeight>s.clientHeight+1,hscroll:s.scrollWidth>s.clientWidth+1,btnBottom:Math.round(b.bottom),vh:innerHeight,x:!!document.querySelector('#ovX'),again:!!document.querySelector('#againBtn')}})()""")
            print(w,h,name,info)
            cols=6;fw,fh=frames[0].size;sc=min(1,2000/(cols*fw))
            tw,th=int(fw*sc),int(fh*sc);rows=(len(frames)+cols-1)//cols
            sheet=Image.new('RGB',(cols*tw,rows*th),'white')
            for i,f in enumerate(frames): sheet.paste(f.resize((tw,th)),((i%cols)*tw,(i//cols)*th))
            sheet.save(f'shots/res_{name}_{w}.png')
            frames[-1].save(f'shots/res_{name}_{w}_end.png')
            pg.evaluate("closeOv()")
        print('errors',errs)
        pg.close()
    br.close()
