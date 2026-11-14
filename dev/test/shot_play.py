from playwright.sync_api import sync_playwright
html=open('/home/claude/hl/artifact.html').read()
def page_html(): return '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}</style></head><body>'+html+'</body></html>'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    errs=[]
    def mk(w,h,hold=True):
        pg=b.new_page(viewport={'width':w,'height':h})
        pg.on('pageerror',lambda e:errs.append(str(e)))
        if hold: pg.add_init_script('window.HL_TEST_FILL_MS=100000')
        pg.set_content(page_html()); pg.wait_for_timeout(600); return pg
    for w,h,name in [(390,760,'p_home'),(320,640,'p_home_320'),(430,860,'p_home_430')]:
        pg=mk(w,h); pg.screenshot(path=f'shots/{name}.png')
        r=pg.evaluate("[document.documentElement.scrollWidth,innerWidth,document.querySelector('#playBtn').getBoundingClientRect().bottom,document.querySelector('#playBtn').getBoundingClientRect().height,getComputedStyle(document.querySelector('#playBtn')).fontSize,document.querySelector('#friendsBtn').getBoundingClientRect().height,innerHeight]")
        print(name,r); pg.close()
    pg=mk(390,760); pg.click('#friendsBtn'); pg.wait_for_timeout(200); pg.screenshot(path='shots/p_home_friends.png',full_page=True)
    print('friends sw',pg.evaluate("[document.documentElement.scrollWidth,innerWidth]")); pg.close()
    pg=mk(390,760); pg.click('#infoBtn'); pg.wait_for_timeout(200); pg.screenshot(path='shots/p_info.png'); pg.close()
    pg=mk(390,760); pg.fill('#nameIn','Dodgy'); pg.click('#playBtn'); pg.wait_for_timeout(300)
    pg.evaluate("addFillBot();publishG()"); pg.wait_for_timeout(600); pg.screenshot(path='shots/p_finding.png')
    print('finding text',pg.inner_text('#app').replace('\n',' | '))
    pg.evaluate("G.players.length<4&&(addFillBot(),addFillBot());hostStart()"); pg.wait_for_timeout(300)
    pg.evaluate("G.phase='over';G.win=PID;G.players.forEach(p=>{if(p.pid!==PID){p.a=0;p.d='anvil'}});publishG()")
    pg.wait_for_timeout(2500); pg.screenshot(path='shots/p_over.png')
    print('over',pg.evaluate("[!!document.querySelector('#againBtn'),!!document.querySelector('#ovClose')]"),errs)
    b.close()
