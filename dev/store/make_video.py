#!/usr/bin/env python3
"""Record an app-store preview video of real High & Low gameplay.

Run from anywhere:  python3 store/make_video.py [--death piano] [--keep-raw]
Needs: `python3 build.py` first (writes artifact.html), python playwright, /usr/bin/google-chrome, ffmpeg.
Output: store/video/preview_886x1920.mp4 (App Store 6.5"-class), store/video/preview_1080x1920.mp4 (Play / social),
        store/video/raw/*.webm (playwright recording, kept with --keep-raw).

No game source is changed. Same techniques as store/make_screens.py: real fonts as data URIs, offline test build,
HL_TEST_FILL_MS for a fast fill-in opponent, the dev "Practice" pill hidden by one CSS rule, names via localStorage / G.players.
All taps and drags are real mouse input with steps, so the slider visibly moves in the recording.
"""
import base64, pathlib, shutil, subprocess, sys, time, argparse, glob
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = HERE / 'video'
CHROME = '/usr/bin/google-chrome'
VW, VH = 390, 845            # CSS viewport, same aspect as 886x1920
REC_W, REC_H = 886, 1920     # recording size
ME, OPP, MY_ELO, SECRET = 'Maya', 'Theo', 1184, 7421
DEATH = 'piano'
T0 = [0.0]


def font_dirs():
    d = [HERE / 'fonts', ROOT / 'node_modules/@fontsource', ROOT / 'test/node_modules/@fontsource']
    d += [pathlib.Path(p) for p in glob.glob('/tmp/claude-0/*/*/scratchpad/node_modules/@fontsource')]
    d += [pathlib.Path(p) for p in glob.glob('/usr/lib/node_modules/@fontsource')]
    return d


def find_font(name, w):
    fn = f'{name}-latin-{w}-normal.woff2'
    for d in font_dirs():
        for c in (d / fn, d / name / 'files' / fn):
            if c.exists():
                return c
    raise SystemExit('missing font ' + fn + ' (put it in store/fonts or npm i @fontsource/' + name + ')')


def b64(p):
    return base64.b64encode(pathlib.Path(p).read_bytes()).decode()


def font_css():
    css = '@font-face{font-family:"Bagel Fat One";src:url(data:font/woff2;base64,%s)}' % b64(find_font('bagel-fat-one', 400))
    for w in (500, 600, 700, 800):
        css += '@font-face{font-family:"Baloo 2";font-weight:%d;src:url(data:font/woff2;base64,%s)}' % (w, b64(find_font('baloo-2', w)))
    return css


HIDE_CSS = '.bar .status{display:none!important}'   # dev-only Practice pill; nothing else is touched
# a visible touch dot so viewers see where the finger is (video only, drawn above the game, no game code touched)
TOUCH_JS = """(()=>{const d=document.createElement('div');d.id='fingerDot';
d.style.cssText='position:fixed;z-index:99999;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(255,255,255,.55);border:3px solid #1E2240;pointer-events:none;left:-99px;top:-99px;transition:transform .12s;transform:scale(.7)';
document.body.appendChild(d);
addEventListener('pointermove',e=>{d.style.left=e.clientX+'px';d.style.top=e.clientY+'px'},true);
addEventListener('pointerdown',e=>{d.style.left=e.clientX+'px';d.style.top=e.clientY+'px';d.style.transform='scale(1)'},true);
addEventListener('pointerup',()=>{d.style.transform='scale(.7)'},true)})()"""


def page_html():
    html = (ROOT / 'artifact.html').read_text()
    return ('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1">'
            '<style>' + font_css() + '[hidden]{display:none!important}' + HIDE_CSS + '</style></head><body>' + html + '</body></html>')


APP_URL = 'https://hl.test/'


def wait_for(pg, js, timeout=60000, step=50):
    t = time.time()
    while (time.time() - t) * 1000 < timeout:
        if pg.evaluate(js):
            return True
        pg.wait_for_timeout(step)
    return False


MOUSE = [(195.0, 700.0)]
MARKS = []   # (seconds since recording start, label)


def stamp(label):
    t = time.time() - T0[0]
    MARKS.append((t, label))
    print('  t=%5.1fs  %s' % (t, label))


# Target on-screen seconds for the segment that ENDS at each stamp. The recording is real time, so on a loaded machine
# input and waits take longer than on a phone; slower segments are played back faster in post (never slower, never cut).
TARGETS = {'home shown': 1.8, 'mode tiles': 1.0, 'play tapped': 1.0, 'secrets screen': 1.2, 'secret picked': 2.6,
           'wheel': 2.0, 'higher/lower': 0.5, 'slider dragged': 3.6, 'range cut': 2.5, 'opponent turn': 1.8,
           'pedestal': 2.2, 'death scene done': None, 'result sheet': 3.0}
MAX_SPEEDUP = 6.0


def box(pg, sel):
    return pg.eval_on_selector(sel, 'e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.width,r.height]}')


def drag(pg, sel, fracs, step_ms=45, hold_ms=250):
    """Real mouse drag along a slider track through the given x fractions, with visible intermediate moves."""
    bx = box(pg, sel)
    y = bx[1] + bx[3] / 2
    x = lambda f: bx[0] + bx[2] * f
    pg.mouse.move(x(fracs[0]), y, steps=2)
    pg.mouse.down()
    prev = fracs[0]
    for f in fracs[1:]:
        n = max(3, int(abs(f - prev) * 14))
        pg.mouse.move(x(f), y, steps=n)
        pg.wait_for_timeout(step_ms)
        prev = f
    pg.wait_for_timeout(hold_ms)
    pg.mouse.up()


def tap(pg, sel, pause=0):
    bx = box(pg, sel)
    pg.mouse.move(bx[0] + bx[2] / 2, bx[1] + bx[3] / 2, steps=3)
    pg.wait_for_timeout(80)
    pg.mouse.down(); pg.wait_for_timeout(90); pg.mouse.up()
    if pause:
        pg.wait_for_timeout(pause)


def write_raw(RAW, frames):
    """Frames (timestamp, jpeg) -> constant 30 fps intermediate with t=0 at the recording start."""
    ff = shutil.which('ffmpeg')
    t_first = frames[0][0]
    # screencast timestamps and time.time() share the epoch clock: shift marks so mark time == video time
    off = t_first - T0[0]
    global MARKS
    MARKS = [(t - off, l) for t, l in MARKS]   # marks are seconds since T0; video t=0 is the first frame
    lines = []
    for i, (ts, jpg) in enumerate(frames):
        (RAW / ('f%05d.jpg' % i)).write_bytes(jpg)
        dur = (frames[i + 1][0] - ts) if i + 1 < len(frames) else 0.04
        lines.append("file 'f%05d.jpg'\nduration %.4f" % (i, max(dur, 0.001)))
    lines.append("file 'f%05d.jpg'" % (len(frames) - 1))
    (RAW / 'list.txt').write_text('\n'.join(lines))
    out = RAW / 'raw.mp4'
    subprocess.run([ff, '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(RAW / 'list.txt'),
                    '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '12', '-preset', 'veryfast', str(out)], check=True)
    for f in RAW.glob('f*.jpg'):
        f.unlink()
    return out


def record(death, death_ms):
    RAW = OUT / 'raw'
    shutil.rmtree(RAW, ignore_errors=True)
    RAW.mkdir(parents=True)
    page = page_html().encode()
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = b.new_context(viewport={'width': VW, 'height': VH}, has_touch=False,
                            )
        ctx.route('**/*', lambda r: r.fulfill(body=page, content_type='text/html') if r.request.url == APP_URL else r.abort())
        ctx.add_init_script(
            "try{localStorage.setItem('hl-name',JSON.stringify(%r));localStorage.setItem('hl-elo',%d);localStorage.setItem('hl-elo-n','14');"
            "localStorage.setItem('hl-pm',JSON.stringify('m'));localStorage.setItem('hl-look',JSON.stringify({c:0,k:3}))}catch(e){}" % (ME, MY_ELO))
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        # Playwright's record_video does not upscale (letterboxes 390x845) and the CDP screencast is capped at CSS size,
        # so frames are grabbed with Page.captureScreenshot at the real device resolution (886x1920, ~18 fps even on a busy
        # machine) from every wait and mouse step, each stamped with its capture time; ffmpeg turns that into 30 fps.
        cdp = ctx.new_cdp_session(pg)
        FRAMES = []

        def shoot():
            d = cdp.send('Page.captureScreenshot', {'format': 'jpeg', 'quality': 90, 'optimizeForSpeed': True,
                                                    'clip': {'x': 0, 'y': 0, 'width': VW, 'height': VH, 'scale': REC_W / VW}})
            FRAMES.append((time.time(), base64.b64decode(d['data'])))

        def pause(ms):
            end = time.time() + ms / 1000
            while True:
                shoot()
                if time.time() >= end:
                    break
                time.sleep(0.005)

        real_move = pg.mouse.move

        def move(x, y, steps=1):
            cur = MOUSE[0]
            for i in range(1, steps + 1):
                real_move(cur[0] + (x - cur[0]) * i / steps, cur[1] + (y - cur[1]) * i / steps)
                shoot()
            MOUSE[0] = (x, y)
        pg.wait_for_timeout = pause
        pg.mouse.move = move
        T0[0] = time.time()
        pg.goto(APP_URL)
        pg.evaluate(TOUCH_JS)
        pg.wait_for_timeout(1200)                       # the first page paint; trimmed off below via START marker
        start = time.time() - T0[0]
        stamp('START')
        # 1. home with the living landscape
        pg.wait_for_timeout(2000)
        # 2. mode tiles, then Play
        stamp('home shown')
        pg.evaluate("window.HL_TEST_FILL_MS=600")
        tap(pg, '[data-mode="m"]', 500)
        stamp('mode tiles')
        tap(pg, '#playBtn')
        stamp('play tapped')
        # 3. opponent found, pick your number
        pg.wait_for_selector('#lockBtn', timeout=30000)
        stamp('secrets screen')
        wait_for(pg, "G&&G.players.length>=2")
        pg.evaluate("(()=>{const o=G.players.find(p=>p.pid!==PID);o.name=%r;o.el=%d;o.k=5;publishG()})()" % (OPP, MY_ELO + 31))
        pg.wait_for_timeout(400)
        drag(pg, '#secTrack', [.5, .85, .4, .72], hold_ms=150)
        pg.wait_for_timeout(300)
        stamp('secret picked')
        tap(pg, '#lockBtn')
        # 4. duel: higher/lower
        # the 'who goes first' wheel: show it briefly, then dismiss (it runs ~8 s, too long for a preview)
        wait_for(pg, "!document.getElementById('ov').hidden", 40000)
        pg.wait_for_timeout(1300)
        stamp('wheel')
        pg.evaluate("closeOv()")
        if not wait_for(pg, "!!document.querySelector('[data-pickdir]')", 60000):
            raise SystemExit('no HIGHER/LOWER screen reached')
        pg.evaluate("closeOv()")
        pg.wait_for_timeout(700)
        stamp('higher/lower')
        tap(pg, '[data-pickdir="h"]', 600)
        # 5. ask with the slider
        drag(pg, '#sldTrack', [.5, .62, .42, .3, .36])
        pg.wait_for_timeout(250)
        stamp('slider dragged')
        pg.evaluate("(()=>{const o=G.players.find(p=>p.pid!==PID);botSecrets[o.pid]=%d})()" % SECRET)
        tap(pg, '#askGo')
        wait_for(pg, "!!document.querySelector('.rb.live')", 5000, 30)
        pg.wait_for_timeout(1800)
        stamp('range cut')
        # 6. opponent's turn (the real game hands the turn over; wait for it, then show it)
        pg.wait_for_timeout(1500)
        stamp('opponent turn')
        print('  turn is', pg.evaluate("G.turn===G.players.findIndex(p=>p.pid===PID)?'me':'opp'"))
        # 7. final guess on the pedestal
        pg.evaluate("""(()=>{const o=G.players.find(p=>p.pid!==PID),s=botSecrets[o.pid],lo=Math.max(1,Math.min(s-4,9991));
          G.kn[PID][o.pid]={lo:lo,hi:lo+9,x:[lo+1,lo+3,lo+4,lo+8]};G.turn=G.players.findIndex(p=>p.pid===PID);
          G.sub=[o.pid];G.stage='await';G.q=null;G.seq++;publishG()})()""")
        wait_for(pg, "!!document.querySelector('.guessv')", 8000)
        pg.wait_for_timeout(1200)
        stamp('pedestal')
        # 8. death scene, played in full by the game's own scene code
        pg.evaluate("""(()=>{const o=G.players.find(p=>p.pid!==PID);
          showScene(%r,byPid(PID),o.name+' guessed '+fmt(%d)+'!','You '+CAPTION[%r],60000,o,%d)})()""" % (death, SECRET, death, SECRET))
        pg.wait_for_timeout(death_ms)
        stamp('death scene done')
        pg.evaluate("closeOv()")
        # 9. result sheet with rating gain
        pg.evaluate("""(()=>{const g=G.gid;G.phase='over';G.win=PID;G.stage='show';G.q=null;
          eloLast={gid:g,d:27,from:%d,to:%d,up:false};showWinner()})()""" % (MY_ELO, MY_ELO + 27))
        pg.wait_for_timeout(3500)
        stamp('result sheet')
        pg.wait_for_timeout(200)
        if errs:
            print('  page errors:', errs[:3])
        ctx.close()
        b.close()
    return write_raw(RAW, FRAMES)


def segments(death_s):
    """[(start, end, speed)] per storyboard segment, from the stamps recorded during the run."""
    segs = []
    for (t0, _), (t1, lab) in zip(MARKS, MARKS[1:]):
        tgt = TARGETS.get(lab) or death_s
        segs.append((t0, t1, max(1.0, min(MAX_SPEEDUP, (t1 - t0) / tgt))))
    return segs


def encode(raw, death_s):
    ff = shutil.which('ffmpeg')
    if not ff:
        raise SystemExit('ffmpeg not found')
    segs = segments(death_s)
    parts = ''.join('[0:v]trim=start=%.3f:end=%.3f,setpts=(PTS-STARTPTS)/%.4f[s%d];' % (a, b, k, i) for i, (a, b, k) in enumerate(segs))
    parts += ''.join('[s%d]' % i for i in range(len(segs))) + 'concat=n=%d:v=1:a=0[cat];' % len(segs)
    total = sum((b - a) / k for a, b, k in segs)
    print('  planned duration %.1fs' % total)
    sil = ['-f', 'lavfi', '-t', '%.2f' % (total + 1), '-i', 'anullsrc=r=44100:cl=stereo']
    enc = ['-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '30', '-crf', '17', '-preset', 'slow',
           '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart']
    a = OUT / 'preview_886x1920.mp4'
    fc = parts + '[cat]scale=886:1920:flags=lanczos,fps=30,setsar=1,format=yuv420p[v]'
    subprocess.run([ff, '-y', '-v', 'error', '-i', str(raw)] + sil + ['-filter_complex', fc, '-map', '[v]', '-map', '1:a'] + enc + [str(a)], check=True)
    # 1080x1920: the same video centred over a blurred copy of itself (9:16 is wider than the 886x1920 aspect)
    fc = (parts + '[cat]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=40:4[bg];'
          '[b]scale=-2:1920:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:0,fps=30,setsar=1,format=yuv420p[v]')
    c = OUT / 'preview_1080x1920.mp4'
    subprocess.run([ff, '-y', '-v', 'error', '-i', str(raw)] + sil + ['-filter_complex', fc, '-map', '[v]', '-map', '1:a'] + enc + [str(c)], check=True)
    return a, c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--death', default=DEATH)
    ap.add_argument('--death-ms', type=int, default=3600)
    ap.add_argument('--keep-raw', action='store_true')
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    raw = record(a.death, a.death_ms)
    outs = encode(raw, a.death_ms / 1000)
    if not a.keep_raw:
        shutil.rmtree(OUT / 'raw', ignore_errors=True)
    for o in outs:
        print('saved', o.relative_to(ROOT))


if __name__ == '__main__':
    main()
