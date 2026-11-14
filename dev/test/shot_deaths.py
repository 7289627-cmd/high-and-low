import sys,base64,os
from playwright.sync_api import sync_playwright
from PIL import Image,ImageDraw
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
F=os.path.join(ROOT,'site','fonts')
b64=lambda n:base64.b64encode(open(os.path.join(F,n),'rb').read()).decode()
kinds=(sys.argv[1] if len(sys.argv)>1 else 'anvil,zap,rocket,chomp,melt,pop,piano,banana,calc').split(',')
tag=sys.argv[2] if len(sys.argv)>2 else 'a'
num=sys.argv[3] if len(sys.argv)>3 else '9100'
html=open(os.path.join(ROOT,'artifact.html')).read()
css='@font-face{font-family:"Bagel Fat One";src:url(data:font/woff2;base64,'+b64('bagel-fat-one-latin-400-normal.woff2')+')}@font-face{font-family:"Baloo 2";font-weight:500 800;src:url(data:font/woff2;base64,'+b64('baloo-2-latin-700-normal.woff2')+')}[hidden]{display:none!important}'
page='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body>'+html+'</body></html>'
os.makedirs(os.path.join(HERE,'shots'),exist_ok=True)
STEP=0.12
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    for (w,h) in [(390,844),(360,640)]:
        pg=br.new_page(viewport={'width':w,'height':h}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.set_content(page); pg.wait_for_timeout(1200)
        for kind in kinds:
            ms=pg.evaluate("""([k,n])=>{window.sceneMs&&0;const ms=SCENE_MS[k]||4800;
              showScene(k,{color:COLORS[0],acc:2,id:1,pid:'x',name:'Me'},{color:COLORS[1],acc:1,id:2,pid:'y',name:'Foe'}&&'T','t',999999,{color:COLORS[1],acc:1,id:2},+n);return ms}""",[kind,int(num)])
            pg.wait_for_timeout(250)
            n=int(ms/1000/STEP)+1; frames=[]
            for i in range(n):
                t=i*STEP*1000
                pg.evaluate("t=>{document.getAnimations().forEach(a=>{a.pause();a.currentTime=t})}",t)
                pg.wait_for_timeout(30)
                pg.locator('.stage').screenshot(path='/tmp/_c05f.png'); frames.append(Image.open('/tmp/_c05f.png').convert('RGB').copy())
            pg.evaluate("closeOv()")
            fw,fh=frames[0].size; cols,rws=6,4; per=cols*rws; sc=0.72
            tw,th=int(fw*sc),int(fh*sc)
            for pgi in range(0,len(frames),per):
                part=frames[pgi:pgi+per]
                sh=Image.new('RGB',(cols*(tw+4),rws*(th+18)),'#888'); d=ImageDraw.Draw(sh)
                for i,fr in enumerate(part):
                    x,y=(i%cols)*(tw+4),(i//cols)*(th+18)
                    sh.paste(fr.resize((tw,th)),(x,y+16)); d.text((x+2,y+2),'%.2fs'%((pgi+i)*STEP),fill='white')
                out=os.path.join(HERE,'shots',f'c05_{tag}_{kind}_{w}_p{pgi//per+1}.png'); sh.save(out); print(out)
        print(w,errs); pg.close()
    br.close()
