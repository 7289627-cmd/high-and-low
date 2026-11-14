"""Launch art (Android adaptive layers, splash, @capacitor/assets sources) drawn from the game's own
charSVG (src/base.js) and logo CSS (src/base.css). Run from anywhere: python3 make_launch.py
Needs: playwright, Pillow, @fontsource/bagel-fat-one (FONT_DIR env or default below)."""
import base64, io, os, pathlib, math
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent          # store/launch
ROOT = HERE.parent.parent                                # project root
A = HERE / 'assets'; A.mkdir(exist_ok=True)
FONT = os.environ.get('FONT_DIR', '/tmp/claude-0/-home-claude/6c2b5f03-7d11-550a-a2af-2801283b81c5/scratchpad/node_modules/@fontsource/bagel-fat-one/files') + '/bagel-fat-one-latin-400-normal.woff2'
SKY, INK, WHITE, YELLOW, RED = '#7FD0E4', '#1E2240', '#FFFFFF', '#FFD23F', '#EE4B3B'
DARK = INK   # dark splash: the game's ink colour, flat (config backgroundColor must be flat)
fb = base64.b64encode(open(FONT, 'rb').read()).decode()
src = (ROOT / 'src/base.js').read_text()
lib = 'var INK="#1E2240";' + src[src.index('const ACC='):src.index('const TOMB')].replace('const ACC=', 'var ACC=').replace('const HAT_NAMES', 'var HAT_NAMES')
CSS = ('@font-face{font-family:"Bagel Fat One";src:url(data:font/woff2;base64,%s)}html,body{margin:0}'
       'svg.bean{overflow:visible;display:block}.bean *{animation:none!important}'
       'svg.bean rect,svg.bean path[stroke="#1E2240"]{stroke-width:5}' % fb)  # thicker outline, as a03's icon

def shot(pg, html, size, omit=False):
    pg.set_viewport_size({'width': size, 'height': size}); pg.set_content(html)
    pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(300)
    return Image.open(io.BytesIO(pg.screenshot(clip={'x': 0, 'y': 0, 'width': size, 'height': size}, omit_background=omit)))

def page(size, bg, inner):
    return f'<!doctype html><meta charset=utf8><style>{CSS}#c{{position:relative;width:{size}px;height:{size}px;overflow:hidden;background:{bg}}}</style><div id=c>{inner}</div>'

def bean_div(bean, size, w, cy):  # bean centred horizontally, vertical centre cy
    return f'<div id=b style="position:absolute;left:{(size-w)/2}px;top:{cy}px;width:{w}px;transform:translateY(-50%)">{bean}</div>'

def wordmark(fs, ink=INK):  # same recipe as .logo in base.css, stroke 5px at 68px => .0735em
    return (f'<h1 style="position:absolute;left:0;right:0;margin:0;text-align:center;white-space:nowrap;font:400 {fs}px/1 \'Bagel Fat One\';'
            f'color:{WHITE};-webkit-text-stroke:{fs*.0735:.1f}px {ink};paint-order:stroke fill;letter-spacing:.01em" id=w>High'
            f'<span style="color:{YELLOW};margin:0 .08em">&amp;</span>Low</h1>')

def radial_max(im):  # farthest opaque pixel from centre
    a = im.split()[3]; w, h = im.size; px = a.load(); m = 0
    for y in range(h):
        for x in range(w):
            if px[x, y] > 8: m = max(m, math.hypot(x + .5 - w / 2, y + .5 - h / 2))
    return m

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1024, 'height': 1024}); pg.set_content('<html></html>'); pg.add_script_tag(content=lib)
    bean = pg.evaluate('()=>charSVG({color:"#EE4B3B",acc:0,id:0},"happy")')   # acc 0 = party hat

    # ---- Android adaptive layers, 432 px. Safe circle = 66% = 285 px diameter (r 142.5).
    # Render big, then shrink until every opaque pixel is inside r 140 (2 px margin).
    big = 1728
    w = 880
    while True:
        fg = shot(pg, page(big, 'transparent', bean_div(bean, big, w, big / 2)), big, True).convert('RGBA')
        fg4 = fg.resize((432, 432), Image.LANCZOS)
        r = radial_max(fg4)
        if r <= 140: break
        w -= 12
    fg4.save(HERE / 'ic_foreground.png')
    Image.new('RGB', (432, 432), SKY).save(HERE / 'ic_background.png')
    mono = Image.new('RGBA', (432, 432), (0, 0, 0, 0)); mono.putalpha(fg4.split()[3])   # black silhouette, alpha only matters
    mono.save(HERE / 'ic_monochrome.png')
    print('fg bean width', w, 'max radius', round(r, 1), 'bbox', fg4.getbbox())

    # ---- 1024 icon sources for @capacitor/assets (>=1024 required for foreground/background)
    fg1k = shot(pg, page(2048, 'transparent', bean_div(bean, 2048, round(w * 2048 / big), 1024)), 2048, True).convert('RGBA').resize((1024, 1024), Image.LANCZOS)
    fg1k.save(A / 'icon-foreground.png')
    Image.new('RGB', (1024, 1024), SKY).save(A / 'icon-background.png')
    # icon-only: a03's final 1024 App Store icon (sky + ground strip + bean), copied unchanged for a consistent set
    a03 = pathlib.Path('/home/claude/ws/a03/store/icons/icon-1024.png')
    icon_only = ROOT / 'store/icons/icon-1024.png'
    for c in (icon_only, a03):
        if c.exists(): Image.open(c).convert('RGB').save(A / 'icon-only.png'); break

    # ---- splash 2732. Bean + wordmark stacked, whole group inside the middle 1200 px (666..2066)
    S = 2732
    RIM = ' '.join(f'drop-shadow({dx}px {dy}px 0 #FFF8EC)' for dx, dy in ((9,0),(-9,0),(0,9),(0,-9),(6,6),(-6,6),(6,-6),(-6,-6)))
    def splash(bg, ink, rim=False):   # dark variant: ink outline would vanish on navy, so add a paper-white rim
        inner = bean_div(bean, S, 620, 0) + wordmark(210, ink)
        if rim: inner = inner.replace('<div id=b style="', f'<div id=b style="filter:{RIM};')
        pg.set_viewport_size({'width': S, 'height': S}); pg.set_content(page(S, bg, inner)); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(300)
        # measure the real group box, then centre it vertically
        bb = pg.evaluate('''()=>{const b=document.getElementById('b').getBoundingClientRect(),w=document.getElementById('w').getBoundingClientRect();return [b.width,b.height]}''')
        bh = bb[1]; gap = 40; wh = 210 * 1.0; total = bh + gap + wh
        top = (S - total) / 2
        pg.evaluate(f'''()=>{{const b=document.getElementById('b'),w=document.getElementById('w');b.style.top={top+bh/2}+'px';w.style.top={top+bh+gap}+'px'}}''')
        pg.wait_for_timeout(100)
        im = Image.open(io.BytesIO(pg.screenshot(clip={'x': 0, 'y': 0, 'width': S, 'height': S}))).convert('RGB')
        return im
    splash(SKY, INK).save(A / 'splash.png'); splash(DARK, '#000000', True).save(A / 'splash-dark.png')

    # ---- Android 12+ splash logo: 1024 transparent, bean inside the centre 2/3 circle (683 px)
    wl = 640
    while True:
        lg = shot(pg, page(1024, 'transparent', bean_div(bean, 1024, wl, 512)), 1024, True).convert('RGBA')
        if radial_max(lg) <= 341: break
        wl -= 8
    lg.save(HERE / 'splash-logo.png'); print('logo bean width', wl)
    b.close()

# ---- copy outputs to the layout, then previews
for f in ('splash.png', 'splash-dark.png'): (HERE / f).write_bytes((A / f).read_bytes())

def mask(kind, n):
    m = Image.new('L', (n * 4, n * 4), 0); d = ImageDraw.Draw(m); N = n * 4
    if kind == 'circle': d.ellipse((0, 0, N - 1, N - 1), fill=255)
    elif kind == 'rounded': d.rounded_rectangle((0, 0, N - 1, N - 1), radius=int(N * .22), fill=255)
    else:  # squircle, superellipse |x|^4+|y|^4=1
        px = m.load()
        for y in range(N):
            for x in range(N):
                if abs((x + .5) / N * 2 - 1) ** 4 + abs((y + .5) / N * 2 - 1) ** 4 <= 1: px[x, y] = 255
    return m.resize((n, n), Image.LANCZOS)

layers = Image.new('RGBA', (432, 432), SKY); layers.alpha_composite(Image.open(HERE / 'ic_foreground.png'))
vis = layers.crop((72, 72, 360, 360))       # visible window = 72dp of 108dp = 288 px
mono_on = Image.new('RGBA', (432, 432), (30, 34, 64, 255)); m4 = Image.open(HERE / 'ic_monochrome.png'); wh = Image.new('RGBA', (432, 432), (255, 255, 255, 255)); mono_on.paste(wh, mask=m4.split()[3])
vis_m = mono_on.crop((72, 72, 360, 360))
sheet = Image.new('RGB', (4 * 320 + 20, 3 * 320 + 20), (235, 235, 235)); sd = ImageDraw.Draw(sheet)
for r, (name, img) in enumerate((('colour', vis), ('themed (monochrome)', vis_m))):
    for c, kind in enumerate(('circle', 'squircle', 'rounded')):
        cell = img.copy(); cell.putalpha(mask(kind, 288)); sheet.paste(cell, (20 + c * 320, 20 + r * 320), cell)
# column 4: raw 432 layers with the safe circle drawn on the full 108dp canvas
raw = layers.convert('RGB'); d = ImageDraw.Draw(raw); d.ellipse((72 - 0, 72 - 0, 360, 360), outline=(255, 0, 0), width=2); d.ellipse((74.5, 74.5, 357.5, 357.5), outline=(0, 0, 0), width=1)
d.ellipse((216 - 142.5, 216 - 142.5, 216 + 142.5, 216 + 142.5), outline=(255, 0, 0), width=2)
sheet.paste(raw.resize((288, 288)), (20 + 3 * 320, 20))
sheet.crop((0, 0, 4 * 320 + 20, 2 * 320 + 20)).save(HERE / 'preview-adaptive-masks.png')
print('done')
