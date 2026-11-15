"""High & Low app-icon options, round 2 (8 concepts A-H) + comparison sheet + home-screen mock.
Run: python3 make_icons_v2.py   (writes icon-A..H.png, sheet.png, homescreen.png next to this file)
Uses the game's real bean art (charSVG from src/base.js) and the real fonts in site/fonts."""
import base64, pathlib, io, re
from PIL import Image
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
INK, SKY, GROUND, GDARK = '#1E2240', '#7FD0E4', '#F4C04F', '#D9A22F'
RED, GREEN, YEL, PAPER, WHITE, BLUE = '#EE4B3B', '#2FA36B', '#FFD23F', '#FFF8EC', '#FFFFFF', '#3D7BFF'

src = (ROOT / 'src/base.js').read_text()
lib = ('var INK="#1E2240";' + src[src.index('const ACC='):src.index('const TOMB')]
       .replace('const ACC=', 'var ACC=').replace('const HAT_NAMES', 'var HAT_NAMES'))
lib += ';ACC[0]=function(){return ""};'   # acc 0 = no hat (we draw our own props)
def b64(n): return base64.b64encode((ROOT / 'site/fonts' / n).read_bytes()).decode()
FONT = ("@font-face{font-family:'Bagel Fat One';src:url(data:font/woff2;base64,%s) format('woff2')}"
        "@font-face{font-family:'Baloo 2';font-weight:700;src:url(data:font/woff2;base64,%s) format('woff2')}"
        % (b64('bagel-fat-one-latin-400-normal.woff2'), b64('baloo-2-latin-700-normal.woff2')))
CSS = FONT + 'svg.bean{overflow:visible}.bean *{animation:none!important}svg.bean rect{stroke-width:var(--sw,5)}html,body{margin:0}'

BEANS = {}   # (color, mood) -> svg string, filled once the page is up

def bean(color, x, y, w, mood='happy', look=(0, 0), pupil=5.2, flip=False, sw=5, hat='', raised=False):
    """Nested real-bean svg. x,y = top-left of its box, w = width (height = 1.4w). look = pupil offset in bean units."""
    s = BEANS[(color, mood)]
    pups = iter([(37 + look[0], 47 + look[1]), (63 + look[0], 47 + look[1])])
    s = re.sub(r'<circle cx="\d+" cy="\d+" r="[\d.]+" fill="#1E2240"/>',
               lambda m: '<circle cx="%s" cy="%s" r="%s" fill="#1E2240"/>' % (*next(pups), pupil), s)
    s = re.sub(r'<svg class="bean [^"]*" style="[^"]*"',
               '<svg x="0" y="0" width="100" height="140" style="--sw:%s;overflow:visible"' % sw, s, count=1)
    s = s.replace('</svg>', hat + '</svg>') if hat else s
    if raised: s = s.replace('M19 66l-9 14M81 66l9 14', 'M19 64L3 34M81 64L97 34')
    k = w / 100
    tf = 'translate(%s %s) scale(%s %s)' % (x + (w if flip else 0), y, -k if flip else k, k)
    return '<g transform="%s">%s</g>' % (tf, s)

def arrow(x, y, w, h, up, fill, sw=20, off=(14, 16), shadow=True):
    pts = [(.5, 0), (1, .52), (.74, .52), (.74, 1), (.26, 1), (.26, .52), (0, .52)]
    if not up: pts = [(px, 1 - py) for px, py in pts]
    d = 'M' + 'L'.join('%.1f %.1f' % (x + px * w, y + py * h) for px, py in pts) + 'z'
    sh = f'<path d="{d}" transform="translate({off[0]} {off[1]})" fill="{INK}" stroke="{INK}" stroke-width="{sw}" stroke-linejoin="round"/>' if shadow else ''
    return sh + f'<path d="{d}" fill="{fill}" stroke="{INK}" stroke-width="{sw}" stroke-linejoin="round"/>'

def chevron(cx, cy, w, up, fill, sw=18):
    h = w * .55; d = -1 if up else 1
    p = f'M{cx-w/2} {cy-d*h/2}L{cx} {cy+d*h/2}L{cx+w/2} {cy-d*h/2}'
    return (f'<path d="{p}" fill="none" stroke="{INK}" stroke-width="{w*.5+sw}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="{p}" fill="none" stroke="{fill}" stroke-width="{w*.5}" stroke-linecap="round" stroke-linejoin="round"/>')

def text(s, x, y, size, fill=WHITE, sw=22, anchor='middle', rot=0, extra=''):
    return (f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="Bagel Fat One" font-size="{size}" fill="{fill}" '
            f'stroke="{INK}" stroke-width="{sw}" stroke-linejoin="round" paint-order="stroke fill" '
            f'transform="rotate({rot} {x} {y})" {extra}>{s}</text>')

def flat_shadow(inner, dx=14, dy=16):
    """Flat offset shadow: the same shapes in ink, behind."""
    return inner

def svgdoc(body, bg=''):
    return (f'<!doctype html><style>{CSS}</style><svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" '
            f'viewBox="0 0 1024 1024" style="display:block">{bg}{body}</svg>')

def rect(x, y, w, h, fill): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}"/>'
def ground(y=830): return rect(0, y, 1024, 1024 - y, GROUND) + rect(0, y, 1024, 18, GDARK)

# ---------------------------------------------------------------- concepts
def A():
    body = ground(840)
    body += bean(GREEN, 70, 360, 380, 'happy', look=(5, -5), sw=6)
    body += arrow(560, 150, 330, 320, True, YEL) + arrow(560, 520, 330, 320, False, RED)
    return svgdoc(body, rect(0, 0, 1024, 1024, SKY))

def B():
    bg = rect(0, 0, 512, 1024, SKY) + rect(512, 0, 512, 1024, PAPER)
    body = rect(500, 0, 24, 1024, INK)
    body += bean(RED, 70, 380, 330, 'happy', look=(4, 0), sw=6)
    body += bean(GREEN, 624, 380, 330, 'scared', look=(-4, 0), flip=True, sw=6)
    body += arrow(125, 110, 220, 230, True, YEL, sw=18) + arrow(679, 110, 220, 230, False, RED, sw=18)
    return svgdoc(body, bg)

def C():
    body = ground(850)
    body += bean(RED, 215, 100, 600, 'scared', look=(0, -4), sw=6)
    # card in front, hiding the lower body
    body += f'<g transform="rotate(-7 512 700)"><rect x="150" y="480" width="724" height="440" rx="50" fill="{INK}" transform="translate(16 18)"/>' \
            f'<rect x="150" y="480" width="724" height="440" rx="50" fill="{PAPER}" stroke="{INK}" stroke-width="22"/>' \
            + text('?', 516, 868, 440, RED, 28) + '</g>'
    return svgdoc(body, rect(0, 0, 1024, 1024, SKY))

def D():
    body = ground(880)
    body += bean(RED, 90, 480, 360, 'happy', look=(-5, -6), sw=6)
    bub = ('M130 90h560q70 0 70 70v250q0 70-70 70H400l-110 100v-100H130q-70 0-70-70V160q0-70 70-70z')
    body += f'<g transform="translate(70 40) scale(.9)"><path d="{bub}" fill="{INK}" transform="translate(14 16)" stroke="{INK}" stroke-width="24" stroke-linejoin="round"/>' \
            f'<path d="{bub}" fill="{WHITE}" stroke="{INK}" stroke-width="24" stroke-linejoin="round"/></g>'
    body += text('7?', 440, 400, 290, INK, 0)
    body += chevron(770, 560, 150, True, YEL) + chevron(770, 800, 150, False, RED)
    return svgdoc(body, rect(0, 0, 1024, 1024, SKY))

def E():
    bg = rect(0, 0, 1024, 1024, SKY)
    body = bean(RED, 292, 110, 440, 'scared', look=(0, -5), sw=6)
    body += f'<g font-family="Bagel Fat One">'
    body += text(f'H<tspan fill="{YEL}">&amp;</tspan>L', 512, 810, 470, WHITE, 40, extra='textLength="860" lengthAdjust="spacingAndGlyphs"')
    body += '</g>'
    return svgdoc(body, bg)

def F():
    bg = rect(0, 0, 1024, 1024, SKY)
    body = f'<rect x="492" y="200" width="40" height="110" fill="{INK}"/>' + arrow(402, 50, 220, 210, True, YEL, sw=20)
    body += bean(RED, 42, 0, 940, 'scared', look=(0, -5), pupil=4.6, sw=6)
    return svgdoc(body, bg)

def G():
    body = ground(840)
    # shadow on the ground, falling anvil above, scared bean between
    body += f'<ellipse cx="512" cy="905" rx="300" ry="46" fill="{GDARK}"/>'
    body += bean(RED, 332, 440, 360, 'scared', look=(0, -5), sw=6)
    av = ('M170 90H640Q840 90 880 210H700V260Q660 330 590 345V420H690V490H270V420H370V345Q230 330 190 220H170z')
    body += f'<g transform="translate(60 -50)"><path d="{av}" fill="{INK}" transform="translate(14 16)" stroke="{INK}" stroke-width="22" stroke-linejoin="round"/>' \
            f'<path d="{av}" fill="#8A90B0" stroke="{INK}" stroke-width="22" stroke-linejoin="round"/>' \
            + arrow(290, 105, 110, 135, True, YEL, sw=10, off=(0, 0), shadow=False) \
            + arrow(430, 105, 110, 135, False, RED, sw=10, off=(0, 0), shadow=False) + '</g>'
    body += f'<g stroke="{INK}" stroke-width="22" stroke-linecap="round"><path d="M150 330v110M890 330v110M60 280v90M980 280v90"/></g>'
    return svgdoc(body, rect(0, 0, 1024, 1024, SKY))

def H():
    """Paddle bean: a bean holds up a yellow UP paddle and a red DOWN paddle, like an auction. Says 'higher or lower' in one glance."""
    bg = rect(0, 0, 1024, 1024, SKY)
    bx, by, bw = 322, 480, 380
    k = bw / 100
    body = ground(900)
    body += bean(GREEN, bx, by, bw, 'happy', look=(0, -4), sw=7, raised=True)
    def paddle(cx, fill, up, argb):
        hx, hy = cx, by + (34 + 14) * k
        st = f'<path d="M{hx} {hy} V440" stroke="{INK}" stroke-width="40" stroke-linecap="round"/>'
        r = f'<rect x="{cx-125}" y="140" width="250" height="300" rx="46" fill="{INK}" transform="translate(12 14)"/>'
        r += f'<rect x="{cx-125}" y="140" width="250" height="300" rx="46" fill="{fill}" stroke="{INK}" stroke-width="22"/>'
        return st + r + arrow(cx - 80, 180, 160, 220, up, argb, sw=14, off=(0, 0), shadow=False)
    lx, rx_ = bx + 3 * k, bx + 97 * k
    body += paddle(lx, YEL, True, WHITE) + paddle(rx_, RED, False, WHITE)
    return svgdoc(body, bg)

CONCEPTS = {'A': A, 'B': B, 'C': C, 'D': D, 'E': E, 'F': F, 'G': G, 'H': H}

SHEET_LAYOUT = """"""
def build():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': 1024, 'height': 1024})
        pg.set_content('<html></html>'); pg.add_script_tag(content=lib)
        for col in (RED, GREEN, BLUE):
            for mood in ('happy', 'scared', 'idle'):
                BEANS[(col, mood)] = pg.evaluate('([c,m])=>charSVG({color:c,acc:0,id:0},m)', [col, mood])
        for k, fn in CONCEPTS.items():
            pg.set_content(fn()); pg.wait_for_timeout(250)
            im = Image.open(io.BytesIO(pg.screenshot(clip={'x': 0, 'y': 0, 'width': 1024, 'height': 1024}))).convert('RGB')
            im.save(HERE / f'icon-{k}.png')
        sheets(pg)
        b.close()

def uri(k): return 'data:image/png;base64,' + base64.b64encode((HERE / f'icon-{k}.png').read_bytes()).decode()
RAD = '22.37%'
def sheets(pg):
    # ---- comparison sheet
    cells = ''
    for k in CONCEPTS:
        row = ''
        for bgc, nm in (('#fff', 'white'), ('#15172b', 'dark')):
            row += f'<div class=strip style="background:{bgc}">' + ''.join(
                f'<img src="{uri(k)}" style="width:{s}px;height:{s}px;border-radius:{RAD}">' for s in (180, 120, 60, 29)) + '</div>'
        cells += (f'<div class=cell><div class=lab>{k}</div><img class=big src="{uri(k)}">'
                  f'<div class=strips>{row}</div></div>')
    html = (f'<!doctype html><style>body{{margin:0;background:#e9e9ee;font:600 15px/1 Arial,sans-serif;color:#222;width:1600px}}'
            f'.g{{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;padding:24px;box-sizing:border-box}}.cell{{background:#fff;border-radius:16px;padding:16px;position:relative;display:flex;gap:16px}}'
            f'.lab{{position:absolute;left:20px;top:16px;font-size:22px;font-weight:700;color:#222;background:#fff;border-radius:8px;padding:2px 8px;z-index:2}}'
            f'.big{{width:256px;height:256px;border-radius:{RAD};flex:none}}.strips{{display:flex;flex-direction:column;gap:8px;justify-content:center;flex:1}}'
            f'.strip{{display:flex;align-items:center;gap:14px;padding:12px;border-radius:12px;border:1px solid #ddd}}</style><div class=g>{cells}</div>')
    pg.set_viewport_size({'width': 1600, 'height': 900}); pg.set_content(html); pg.wait_for_timeout(500)
    pg.screenshot(path=str(HERE / 'sheet.png'), full_page=True)
    # ---- home screen mock: one phone per candidate, neutral neighbour tiles, 60pt icons
    tiles = ['#c9d1e0', '#e3c9c9', '#c9e3d2', '#e3dcc9', '#d0c9e3', '#c9dfe3', '#dcdcdc', '#e0c9d8']
    def phone(k, wall):
        cells = ''
        for i in range(20):
            if i == 6:
                cells += f'<div class=ic><img src="{uri(k)}"><span>High &amp; Low</span></div>'
            else:
                cells += f'<div class=ic><i style="background:{tiles[(i*3+1) % len(tiles)]}"></i><span style="opacity:0">x</span></div>'
        return f'<div class=ph style="background:{wall}"><div class=grid>{cells}</div><div class=dock>' + ''.join(
            f'<i style="background:{tiles[j]}"></i>' for j in range(4)) + f'</div><div class=cap>{k}</div></div>'
    walls = ['linear-gradient(160deg,#6aa7d8,#c5a0d6)', 'linear-gradient(160deg,#2b2e4a,#0d0e1c)']
    phones = ''.join(phone(k, walls[0 if n % 2 == 0 else 1]) for n, k in enumerate(CONCEPTS))
    html = ('<!doctype html><style>body{margin:0;background:#f2f2f5;font-family:Arial,sans-serif;width:1700px}'
            '.row{display:grid;grid-template-columns:repeat(4,1fr);gap:28px;padding:28px}'
            '.ph{position:relative;height:640px;border-radius:44px;padding:44px 22px 0;box-sizing:border-box;border:6px solid #222;overflow:hidden}'
            '.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px 8px}'
            '.ic{display:flex;flex-direction:column;align-items:center;gap:5px}'
            '.ic img,.ic i{width:60px;height:60px;border-radius:13.4px;display:block}'
            '.ic span{font-size:10.5px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5);white-space:nowrap}'
            '.dock{position:absolute;left:14px;right:14px;bottom:14px;height:84px;border-radius:30px;background:rgba(255,255,255,.28);display:flex;justify-content:space-around;align-items:center}'
            '.dock i{width:60px;height:60px;border-radius:13.4px;display:block}'
            '.cap{position:absolute;left:0;right:0;bottom:104px;text-align:center;color:#fff;font:700 22px Arial;text-shadow:0 1px 3px rgba(0,0,0,.6)}'
            f'</style><div class=row>{phones}</div>')
    pg.set_viewport_size({'width': 1700, 'height': 700}); pg.set_content(html); pg.wait_for_timeout(500)
    pg.screenshot(path=str(HERE / 'homescreen.png'), full_page=True)

if __name__ == '__main__':
    build()
