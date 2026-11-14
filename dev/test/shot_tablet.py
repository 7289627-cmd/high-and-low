#!/usr/bin/env python3
"""Screens at tablet / desktop / phone sizes (c09). Uses the helpers of store/make_screens.py.
Usage: python3 test/shot_tablet.py [--html artifact.html] [--out test/shots/tablet] [--det] [--sizes 768x1024,1024x768] [--only home,lobby]
Scenes: home, lobby, secret, ask, duel, guess, death, result.  --det seeds Math.random and freezes animations (for pixel diffs)."""
import sys, pathlib, argparse
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / 'store'))
import make_screens as ms
from playwright.sync_api import sync_playwright

SIZES = '390x844,768x1024,820x1180,1024x1366,800x1280,1024x768,1280x800,1920x1080'
SCENES = ['home', 'lobby', 'secret', 'ask', 'duel', 'guess', 'death', 'result']
SEED = "(()=>{let s=12345;Math.random=()=>{s=(s*1664525+1013904223)%4294967296;return s/4294967296}})();"

def run(b, w, h, a):
    ctx, pg, errs = ms.new_page(b, w, h, 1)
    if a.det:
        ctx.add_init_script(SEED)
    html = open(a.html).read()
    ms.PAGE[0] = ('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"><style>' + ms.font_css() + '[hidden]{display:none!important}' + ms.HIDE_CSS + '</style></head><body>' + html + '</body></html>').encode()
    out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
    tag = f'{w}x{h}'
    def S(n):
        if n not in a.only: return
        pg.wait_for_timeout(200)
        pg.screenshot(path=str(out / f'{tag}_{n}.png'), animations='disabled' if a.det else 'allow')
    pg.goto(ms.APP_URL); pg.wait_for_timeout(2600); S('home')
    if 'lobby' in a.only:
        pg.click('#friendsBtn'); pg.wait_for_timeout(600); pg.click('#addBot'); pg.wait_for_timeout(500); S('lobby')
        pg.evaluate("leaveGame()"); pg.wait_for_timeout(500)
    pg.evaluate("window.HL_TEST_FILL_MS=250")
    pg.click('[data-mode="m"]'); pg.click('#playBtn'); pg.wait_for_selector('#lockBtn', timeout=30000); pg.wait_for_timeout(400); S('secret')
    pg.click('#lockBtn')
    ms.wait_for(pg, "G&&G.players.length>=2&&G.phase!=='lobby'")
    pg.evaluate("(()=>{const o=G.players.find(p=>p.pid!==PID);o.name='Theo';o.el=1215;o.k=5;publishG()})()")
    ms.wait_for(pg, "G.phase==='play'&&G.stage==='await'", 40000)
    if not ms.wait_for(pg, "!!document.querySelector('[data-pickdir]')", 60000): raise SystemExit('no pickdir')
    pg.evaluate("closeOv()"); pg.wait_for_timeout(900)
    pg.click('[data-pickdir="h"]'); pg.wait_for_timeout(800)
    box = pg.eval_on_selector('#sldTrack', 'e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.width,r.height]}')
    y = box[1] + box[3] / 2
    pg.mouse.move(box[0] + box[2] * .5, y); pg.mouse.down()
    for f in (.45, .4, .36, .34):
        pg.mouse.move(box[0] + box[2] * f, y); pg.wait_for_timeout(40)
    pg.mouse.up(); pg.wait_for_timeout(500); S('ask')
    pg.evaluate("(()=>{const o=G.players.find(p=>p.pid!==PID);botSecrets[o.pid]=7421})()")
    pg.click('#askGo'); ms.wait_for(pg, "!!document.querySelector('.rb.live')", 5000, 30); pg.wait_for_timeout(2500)
    S('duel')
    pg.evaluate("""(()=>{const o=G.players.find(p=>p.pid!==PID),s=botSecrets[o.pid],lo=Math.max(1,Math.min(s-4,9991));
      G.kn[PID][o.pid]={lo:lo,hi:lo+9,x:[lo+1,lo+3,lo+4,lo+8]};G.turn=G.players.findIndex(p=>p.pid===PID);
      G.sub=[o.pid];G.stage='await';G.q=null;G.seq++;publishG()})()""")
    ms.wait_for(pg, "!!document.querySelector('.guessv')", 8000); pg.wait_for_timeout(900); S('guess')
    pg.evaluate("""(()=>{const o=G.players.find(p=>p.pid!==PID);
      showScene('piano',byPid(PID),o.name+' guessed '+fmt(7421)+'!','You '+CAPTION['piano'],60000,o,7421)})()""")
    pg.wait_for_timeout(1600); S('death'); pg.evaluate("closeOv()")
    pg.evaluate("""(()=>{const g=G.gid;G.phase='over';G.win=PID;G.stage='show';G.q=null;
      eloLast={gid:g,d:27,from:1184,to:1211,up:false};showWinner()})()""")
    pg.wait_for_timeout(1900); S('result')
    ov = pg.evaluate("document.documentElement.scrollWidth<=innerWidth")
    print(tag, 'noHscroll', ov, 'errs', errs[:2]); ctx.close()

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--html', default=str(ROOT / 'artifact.html'))
    ap.add_argument('--out', default=str(HERE / 'shots' / 'tablet'))
    ap.add_argument('--det', action='store_true')
    ap.add_argument('--sizes', default=SIZES)
    ap.add_argument('--only', default=','.join(SCENES))
    a = ap.parse_args(); a.only = a.only.split(',')
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=ms.CHROME, args=['--no-sandbox'])
        try:
            for s in a.sizes.split(','):
                w, h = map(int, s.split('x')); run(b, w, h, a)
        finally: b.close()
