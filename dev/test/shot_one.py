import sys,base64,os
from playwright.sync_api import sync_playwright
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
F=os.path.join(ROOT,'site','fonts'); b64=lambda n:base64.b64encode(open(os.path.join(F,n),'rb').read()).decode()
kind=sys.argv[1]; w=int(sys.argv[2]); ts=[float(x) for x in sys.argv[3].split(',')]; num=int(sys.argv[4]) if len(sys.argv)>4 else 9100
html=open(os.path.join(ROOT,'artifact.html')).read()
css='@font-face{font-family:"Bagel Fat One";src:url(data:font/woff2;base64,'+b64('bagel-fat-one-latin-400-normal.woff2')+')}@font-face{font-family:"Baloo 2";font-weight:500 800;src:url(data:font/woff2;base64,'+b64('baloo-2-latin-700-normal.woff2')+')}[hidden]{display:none!important}'
page='<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body>'+html+'</body></html>'
from PIL import Image
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=br.new_page(viewport={'width':w,'height':640},device_scale_factor=2); pg.set_content(page); pg.wait_for_timeout(1000)
    pg.evaluate("([k,n])=>showScene(k,{color:COLORS[0],acc:2,id:1,pid:'x',name:'Me'},'t','t',999999,{color:COLORS[1],acc:1,id:2},n)",[kind,num]); pg.wait_for_timeout(250)
    fr=[]
    for t in ts:
        pg.evaluate("t=>document.getAnimations().forEach(a=>{a.pause();a.currentTime=t})",t*1000); pg.wait_for_timeout(40)
        pg.locator('.stage').screenshot(path='/tmp/_c05o.png'); fr.append(Image.open('/tmp/_c05o.png').convert('RGB').copy())
    W=sum(f.width for f in fr); s=Image.new('RGB',(W,fr[0].height)); x=0
    for f in fr: s.paste(f,(x,0)); x+=f.width
    s.save(f'shots/c05_one_{kind}_{w}.png'); print(s.size); br.close()
