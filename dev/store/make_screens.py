#!/usr/bin/env python3
"""Render real store screenshots from the actual game build.

Run from anywhere:   python3 store/make_screens.py [--only iphone69,android] [--no-marketing]
Needs: `python3 build.py` first (writes artifact.html), python playwright, /usr/bin/google-chrome.
Output: store/shots/<device>/<n>_<name>.png, store/shots/feature/feature_graphic_1024x500.png,
        store/shots/framed/<n>_<name>.png (captioned variants of the 6.9" phone scenes).
Seven scenes in selling order: oops (piano), duel (slider + narrowed range), last_guess (pedestal), rank_up (win sheet), wardrobe, home (three modes), friends lobby.

How it works (no game source is changed):
 - loads artifact.html (the offline test build) with the real fonts from store/fonts injected as data URIs
 - HL_TEST_FILL_MS makes the fill-in opponent show up fast, so Play starts a real duel without a network
 - the dev "Practice" status pill is hidden with one injected CSS rule (.bar .status), nothing else is faked
 - player names / rating are set through localStorage and the opponent's name through G.players
"""
import base64, pathlib, sys, time, argparse
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
FONTS = HERE / 'fonts'
OUT = HERE / 'shots'
CHROME = '/usr/bin/google-chrome'

# device folder -> (CSS width, CSS height, device scale factor) => pixel size
DEVICES = {
    'iphone69': (440, 956, 3),    # 1320x2868  App Store 6.9" iPhone
    'iphone65': (428, 926, 3),    # 1284x2778  App Store 6.5" iPhone
    'ipad13':   (1032, 1376, 2),  # 2064x2752  App Store 13" iPad
    'android':  (360, 720, 3),    # 1080x2160 (2:1) Google Play phone: Play allows long side max 2x short side, so 1080x2400 (2.22:1) is out; 1080x1920 crowds the layout
}
ME, OPP = 'Maya', 'Theo'
SECRET = 7421
MY_ELO = 1138

NAMES = ['oops', 'duel', 'last_guess', 'rank_up', 'wardrobe', 'home', 'friends']

CAPTIONS = {
    'oops': 'Wrong guesses hurt',
    'duel': 'Higher or lower?',
    'last_guess': 'One guess left',
    'rank_up': 'Climb the ranks',
    'wardrobe': 'Dress your bean',
    'home': 'Three ways to play',
    'friends': 'Bring your friends',
}


def b64(p):
    return base64.b64encode(pathlib.Path(p).read_bytes()).decode()


def font_css():
    css = '@font-face{font-family:"Bagel Fat One";src:url(data:font/woff2;base64,%s)}' % b64(FONTS / 'bagel-fat-one-latin-400-normal.woff2')
    for w in (500, 600, 700, 800):
        css += '@font-face{font-family:"Baloo 2";font-weight:%d;src:url(data:font/woff2;base64,%s)}' % (w, b64(FONTS / f'baloo-2-latin-{w}-normal.woff2'))
    return css


# Hides the dev-only "Practice"/"Live" status pill in the in-game header. Nothing else is touched.
HIDE_CSS = '.bar .status{display:none!important}.prow2 .x{display:none!important}'


def page_html():
    html = (ROOT / 'artifact.html').read_text()
    return ('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1">'
            '<style>' + font_css() + '[hidden]{display:none!important}' + HIDE_CSS + '</style></head><body>' + html + '</body></html>')


APP_URL = 'https://hl.test/'
PAGE = [b'']


def new_page(b, w, h, dsf, seed_ls=True):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dsf, has_touch=True, is_mobile=False)
    # a real (fake) origin, so localStorage works; every other request is blocked (offline build, fonts are injected)
    ctx.route('**/*', lambda r: r.fulfill(body=PAGE[0], content_type='text/html') if r.request.url == APP_URL else r.abort())
    if seed_ls:
        ctx.add_init_script(
            "try{localStorage.setItem('hl-name',JSON.stringify(%r));localStorage.setItem('hl-elo',%d);localStorage.setItem('hl-elo-n','14');"
            "localStorage.setItem('hl-pm',JSON.stringify('m'));localStorage.setItem('hl-wins','5');localStorage.setItem('hl-look',JSON.stringify({c:0,k:6}))}catch(e){}" % (ME, MY_ELO))
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    return ctx, pg, errs


def wait_for(pg, js, timeout=60000, step=100):
    t = time.time()
    while (time.time() - t) * 1000 < timeout:
        if pg.evaluate(js):
            return True
        pg.wait_for_timeout(step)
    return False


def shot(pg, dev, n, name):
    d = OUT / dev
    d.mkdir(parents=True, exist_ok=True)
    p = d / f'{n}_{name}.png'
    pg.screenshot(path=str(p))
    print('  saved', p.relative_to(ROOT))


def force_my_turn(pg):
    pg.evaluate("""(()=>{const me=G.players.findIndex(p=>p.pid===PID);G.turn=me;G.stage='await';G.q=null;G.seq++;
      G.sub=['*'];G.subN=G.players.filter(p=>p.pid!==PID&&p.a).length;publishG()})()""")


def run_device(b, dev, w, h, dsf):
    print(dev, f'{w}x{h}@{dsf} -> {w*dsf}x{h*dsf}')
    ctx, pg, errs = new_page(b, w, h, dsf)
    PAGE[0] = page_html().encode()
    pg.goto(APP_URL)
    pg.wait_for_timeout(2600)                      # let the landscape, clouds and kite settle
    shot(pg, dev, 6, NAMES[5])                     # home: three modes + living landscape

    # wardrobe sheet (the player's bean beside the name)
    pg.click('#meBtn')
    pg.wait_for_timeout(900)
    shot(pg, dev, 5, NAMES[4])
    pg.click('#ovX')
    pg.wait_for_timeout(400)

    pg.evaluate("window.HL_TEST_FILL_MS=250")
    pg.click('[data-mode="m"]')
    pg.click('#playBtn')
    pg.wait_for_selector('#lockBtn', timeout=30000)
    pg.click('#lockBtn')
    wait_for(pg, "G&&G.players.length>=2&&G.phase!=='lobby'")
    pg.evaluate("(()=>{const o=G.players.find(p=>p.pid!==PID);o.name=%r;o.el=%d;o.k=5;publishG()})()" % (OPP, MY_ELO + 31))
    wait_for(pg, "G.phase==='play'&&G.stage==='await'", 40000)
    pg.wait_for_timeout(300)
    if not wait_for(pg, "!!document.querySelector('[data-pickdir]')", 60000):
        raise SystemExit('no HIGHER/LOWER screen reached')
    pg.evaluate("closeOv()")
    pg.wait_for_timeout(500)

    def ask(fracs, pick='h'):
        pg.click('[data-pickdir="%s"]' % pick)
        pg.wait_for_timeout(700)
        box = pg.eval_on_selector('#sldTrack', 'e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.width,r.height]}')
        y = box[1] + box[3] / 2
        pg.mouse.move(box[0] + box[2] * fracs[0], y)
        pg.mouse.down()
        for f in fracs[1:]:
            pg.mouse.move(box[0] + box[2] * f, y)
            pg.wait_for_timeout(40)

    # first question: a clear YES that cuts the range
    ask([.5, .4, .34])
    pg.mouse.up()
    pg.evaluate("(()=>{const o=G.players.find(p=>p.pid!==PID);botSecrets[o.pid]=%d})()" % SECRET)
    pg.click('#askGo')
    wait_for(pg, "!!document.querySelector('.rb.live')", 5000, 30)
    pg.wait_for_timeout(2600)
    # second question: slider shown over the already narrowed range
    force_my_turn(pg)
    if not wait_for(pg, "!!document.querySelector('[data-pickdir]')", 8000):
        pg.screenshot(path='/tmp/claude-0/dbg.png')
        print(pg.evaluate("JSON.stringify({t:G.turn,st:G.stage,q:G.q,sub:G.sub,step:ui.step,tg:ui.target})"))
    pg.wait_for_timeout(600)
    ask([.5, .58, .64, .6])
    pg.mouse.up()
    pg.wait_for_timeout(600)
    shot(pg, dev, 2, NAMES[1])

    # pedestal guess view: opponent's number known to a 10 wide range, a few crossed out
    pg.evaluate("""(()=>{const o=G.players.find(p=>p.pid!==PID),s=botSecrets[o.pid],lo=Math.max(1,Math.min(s-4,9991));
      G.kn[PID][o.pid]={lo:lo,hi:lo+9,x:[lo+1,lo+3,lo+4,lo+8]};G.turn=G.players.findIndex(p=>p.pid===PID);
      G.sub=[o.pid];G.stage='await';G.q=null;G.seq++;publishG()})()""")
    wait_for(pg, "!!document.querySelector('.guessv')", 8000)
    pg.wait_for_timeout(1000)
    shot(pg, dev, 3, NAMES[2])

    # death scene, played for real by the game's own scene code, captured at the impact
    pg.evaluate("""(()=>{const o=G.players.find(p=>p.pid!==PID);
      showScene(%r,byPid(PID),o.name+' guessed '+fmt(%d)+'!','You '+CAPTION[%r],60000,o,%d)})()""" % (DEATH, SECRET, DEATH, SECRET))
    pg.wait_for_timeout(int(DEATH_MS))
    shot(pg, dev, 1, NAMES[0])
    pg.evaluate("closeOv()")

    # win sheet: rating count-up and the rank-up moment (Guesser -> Sharp)
    pg.evaluate("""(()=>{const g=G.gid;G.phase='over';G.win=PID;G.stage='show';G.q=null;
      eloLast={gid:g,d:27,from:%d,to:%d,up:true};showWinner()})()""" % (MY_ELO, MY_ELO + 27))
    if WIN_DEBUG:
        for t in range(8):
            pg.wait_for_timeout(500)
            pg.screenshot(path='/tmp/claude-0/win%d.png' % t)
    pg.wait_for_timeout(WIN_MS)
    shot(pg, dev, 4, NAMES[3])
    pg.click('#ovX')
    pg.wait_for_timeout(300)

    # play with friends lobby with four beans
    pg.evaluate("""(async()=>{await leaveGame();startSolo(false);G.players=G.players.slice(0,0);
      const me={pid:PID,name:%r,c:0,k:6,a:1,d:'',dg:0};
      const mk=(n,c,k)=>({pid:'p-'+n,name:n,c:c,k:k,bot:1,hb:1,a:1,d:'',dg:0});
      G.players=[me,mk('Theo',1,5),mk('Ana',3,1),mk('Leo',4,7)];
      mode='online';code='KMRT';publishG&&0;render(true)})()""" % ME)
    pg.wait_for_timeout(1500)
    shot(pg, dev, 7, NAMES[6])
    if errs:
        print('  page errors:', errs[:3])
    ctx.close()


FEATURE_CSS = (
    '.panel,.info-btn,.mute-btn,.wins-pill,.elo-pill,.skygap,.hscene .fnum,.hscene .bird,.hs-walk,.hs-run,.hs-chase,.hs-catch,.hs-nap,.hs-kiter,.hs-b,.hs-ballx,.bfly,.hscene .cloud,.hscene .tree,.hscene .flower,.kite,#kiteSvg{display:none!important}'
    'main.home{max-width:none!important;width:1024px!important;margin:0!important;padding:0!important;min-height:500px!important;height:500px!important;overflow:hidden!important}'
    '.hscene{width:1024px!important}'
    '.hero{position:fixed!important;left:48px!important;right:auto!important;width:470px!important;top:150px;padding:0!important;z-index:5;display:block!important}'
    '.logo.big{font-size:92px!important;-webkit-text-stroke:10px #1E2240!important;width:100%!important;max-width:none!important;white-space:nowrap;text-align:left;text-wrap:nowrap!important}'
    '.hsun{left:-30px!important;top:-40px!important;transform:none!important}'
    '#fgBeans{position:absolute;right:60px;bottom:62px;width:430px;height:240px;z-index:6}'
    '#fgBeans span{position:absolute;width:190px;display:block}#fgBeans svg{width:100%;height:auto;display:block}'
    '#fgBeans .l{left:0;bottom:0}#fgBeans .r{right:0;bottom:10px;transform:scaleX(-1)}')


def feature_graphic(b):
    """Google Play feature graphic 1024x500: logo left, two beans mid-duel right, the real home hills, no other text."""
    print('feature graphic')
    ctx, pg, errs = new_page(b, 1024, 500, 1)
    PAGE[0] = page_html().replace('</style></head>', FEATURE_CSS + '</style></head>', 1).encode()
    pg.goto(APP_URL)
    pg.wait_for_timeout(1200)
    pg.evaluate("""(()=>{const m=document.querySelector('main.home');const d=document.createElement('div');d.id='fgBeans';
      d.innerHTML='<span class="l bob" style="'+ph(2.4,0)+'">'+charSVG({color:COLORS[0],acc:6,id:0},'happy')+'</span><span class="r bob" style="'+ph(2.4,.9)+'">'+charSVG({color:COLORS[1],acc:5,id:1},'scared')+'</span>';m.appendChild(d)})()""")
    pg.wait_for_timeout(1500)
    d = OUT / 'feature'
    d.mkdir(parents=True, exist_ok=True)
    pg.screenshot(path=str(d / 'feature_graphic_1024x500.png'))
    print('  saved store/shots/feature/feature_graphic_1024x500.png', errs[:2])
    ctx.close()


HILLS = ('<svg viewBox="0 0 1320 420" width="1320" height="420" style="position:absolute;left:0;bottom:0">'
         '<path d="M0 420V150C180 40 380 30 600 140S1000 230 1320 90V420Z" fill="#7AD3A6" stroke="#1E2240" stroke-width="14"/>'
         '<path d="M0 420V250C220 150 420 160 640 250S1060 300 1320 200V420Z" fill="#3FB67A" stroke="#1E2240" stroke-width="14"/></svg>')


def framed(b):
    """Marketing variants: the real 6.9" screenshot (rounded, ink outline) on the game's sky with hills, plus a short Bagel Fat One caption."""
    print('framed')
    d = OUT / 'framed'
    d.mkdir(parents=True, exist_ok=True)
    ctx = b.new_context(viewport={'width': 1320, 'height': 2868}, device_scale_factor=1)
    pg = ctx.new_page()
    for i, name in enumerate(NAMES, 1):
        src = OUT / 'iphone69' / f'{i}_{name}.png'
        html = ('<!doctype html><style>' + font_css() +
                'html,body{margin:0;width:1320px;height:2868px;background:#7FD0E4;overflow:hidden;position:relative}'
                '.c{font-family:"Bagel Fat One";font-size:116px;line-height:1;text-align:center;position:absolute;left:0;right:0;top:140px;'
                'color:#fff;-webkit-text-stroke:20px #1E2240;paint-order:stroke fill;white-space:nowrap}'
                '.s{position:absolute;left:170px;top:380px;width:980px;height:2132px;border:14px solid #1E2240;border-radius:96px;overflow:hidden;box-sizing:content-box;background:#1E2240}'
                '.s img{display:block;width:980px;height:2132px}</style>'
                '<div class=c><span id=t style="display:inline-block">%s</span></div>%s<div class=s><img src="data:image/png;base64,%s"></div>'
                % (CAPTIONS[name], HILLS, b64(src)))
        pg.set_content(html)
        pg.wait_for_timeout(300)
        w = pg.evaluate("document.getElementById('t').offsetWidth")
        if w > 1160:
            print('  CAPTION TOO WIDE', name, w)
        pg.screenshot(path=str(d / f'{i}_{name}.png'))
        print('  saved', (d / f'{i}_{name}.png').relative_to(ROOT))
    ctx.close()


def strip_alpha():
    """Both stores reject PNGs with an alpha channel: flatten every output to RGB."""
    from PIL import Image
    for f in OUT.rglob('*.png'):
        im = Image.open(f)
        if im.mode != 'RGB':
            im.convert('RGB').save(f, optimize=True)


CUT_MS = 150
DEATH = 'piano'      # piano at ~1.6s was the funniest frame (anvil at ~1.5s is the alternative: --death anvil --death-ms 1500)
DEATH_MS = 1600
WIN_MS = 2300
WIN_DEBUG = False


def main():
    global DEATH, DEATH_MS, CUT_MS
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--death', default=DEATH)
    ap.add_argument('--death-ms', type=int, default=DEATH_MS)
    ap.add_argument('--cut-ms', type=int, default=CUT_MS)
    ap.add_argument('--no-marketing', action='store_true')
    a = ap.parse_args()
    DEATH, DEATH_MS, CUT_MS = a.death, a.death_ms, a.cut_ms
    only = [s for s in a.only.split(',') if s]
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        try:
            for dev, (w, h, dsf) in DEVICES.items():
                if only and dev not in only:
                    continue
                run_device(b, dev, w, h, dsf)
            if not a.no_marketing:
                feature_graphic(b)
                framed(b)
        finally:
            b.close()
    strip_alpha()


if __name__ == '__main__':
    main()
