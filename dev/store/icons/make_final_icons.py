"""High & Low production icon + launch art, from the owner's chosen concept F
(red bean close-up, big eyes looking up, surprised mouth, sweat drop, raised arms, yellow UP arrow on its head, on sky blue).
Run: python3 store/icons/make_final_icons.py     (from anywhere; needs playwright + Pillow + numpy)
Writes (see OUTPUTS at the bottom): store/icons/*, site/icon-180.png, site/icons/*, store/launch/*, store/launch/assets/*
Uses the game's real bean art (charSVG in src/base.js) and the real fonts in site/fonts.
Masters: FULL (1024, close-up), SMALL (simplified: no sweat drop, no highlight, heavier outline, bigger arrow and eyes; used for
the 32 px favicon), HEAD (same face as a squat bean with a rounded bottom, for adaptive/capacitor foreground), FIGURE (whole
standing bean with legs, for the splash)."""
import base64, io, math, pathlib, re
import numpy as np
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent            # store/icons
ROOT = HERE.parent.parent
LAUNCH = ROOT / 'store/launch'; ASSETS = LAUNCH / 'assets'; SITE = ROOT / 'site'
for d in (LAUNCH, ASSETS, SITE / 'icons'): d.mkdir(parents=True, exist_ok=True)
INK, SKY, GROUND = '#1E2240', '#7FD0E4', '#F4C04F'
RED, YEL, WHITE, PAPER = '#EE4B3B', '#FFD23F', '#FFFFFF', '#FFF8EC'
DARK = INK

src = (ROOT / 'src/base.js').read_text()
LIB = ('var INK="#1E2240";' + src[src.index('const ACC='):src.index('const TOMB')]
       .replace('const ACC=', 'var ACC=').replace('const HAT_NAMES', 'var HAT_NAMES')) + ';ACC[0]=function(){return ""};'
def b64(n): return base64.b64encode((SITE / 'fonts' / n).read_bytes()).decode()
CSS = ("@font-face{font-family:'Bagel Fat One';src:url(data:font/woff2;base64,%s) format('woff2')}"
       "svg.bean{overflow:visible}.bean *{animation:none!important}html,body{margin:0}" % b64('bagel-fat-one-latin-400-normal.woff2'))

# ------------------------------------------------------------------ geometry (bean units, 100 wide; arrow in "u" = viewBox y)
KINDS = {
  # k,bx,by place the 1024 master. h = body height (92 = real bean; 80 = squat head).
  'full':   dict(k=8.6, bx=82, by=79, h=92, sw=3.3, ew=11,   pup=4.6, look=-5,   mr=(5, 7), hl=True,  drop=True,  arm=7, legs=False,
                 arrow=dict(w=29,   h=24.4, tip=-9,  sw=2.55)),
  'small':  dict(k=8.6, bx=82, by=92, h=92, sw=4.6, ew=11.8, pup=5.2, look=-5.4, mr=(6, 8), hl=False, drop=False, arm=9, legs=False,
                 arrow=dict(w=33.7, h=27.9, tip=-11, sw=3.1)),
  'head':   dict(h=80, sw=3.4, ew=11, pup=4.6, look=-5, mr=(5, 7), hl=True, drop=True, arm=7.5, legs=False,
                 arrow=dict(w=29, h=24.4, tip=-9, sw=2.7)),
  'figure': dict(h=92, sw=2.9, ew=11, pup=4.6, look=-5, mr=(5, 7), hl=True, drop=True, arm=7, legs=True,
                 arrow=dict(w=29, h=24.4, tip=-9, sw=2.6)),
}
ARM_END = (6, 45)          # raised hand (left; right is mirrored)

def arrow_d(cx, tip, w, h, stem_bottom=20):
    hb = tip + .52 * h
    pts = [(cx, tip), (cx + w / 2, hb), (cx + .24 * w, hb), (cx + .24 * w, stem_bottom),
           (cx - .24 * w, stem_bottom), (cx - .24 * w, hb), (cx - w / 2, hb)]
    return 'M' + 'L'.join('%.2f %.2f' % p for p in pts) + 'z'

def arms_d(): return 'M21 64L%d %d' % ARM_END, 'M79 64L%d %d' % (100 - ARM_END[0], ARM_END[1])

BEAN = {}
def bean_markup(kind):
    P = KINDS[kind]; s = BEAN['scared']
    s = re.sub(r'<svg class="bean[^"]*" style="[^"]*"', '<svg class="bean" x="0" y="0" width="100" height="140" style="overflow:visible"', s)
    ink_arm = ''
    a1, a2 = arms_d()
    limbs = (f'<g fill="none" stroke-linecap="round"><path d="{a1}M79 64L{100-ARM_END[0]} {ARM_END[1]}" stroke="{INK}" stroke-width="{P["arm"] + 2 * P["sw"] * .8:.2f}"/>'
             f'<path d="{a1}M79 64L{100-ARM_END[0]} {ARM_END[1]}" stroke="{RED}" stroke-width="{P["arm"]}"/>')
    if P['legs']:
        limbs += (f'<path d="M40 100l-3 18M60 100l3 18" stroke="{INK}" stroke-width="{P["arm"] + 2 * P["sw"] * .8:.2f}"/>'
                  f'<path d="M40 100l-3 18M60 100l3 18" stroke="{RED}" stroke-width="{P["arm"]}"/>')
    limbs += '</g>'
    s = re.sub(r'<g stroke="#EE4B3B" stroke-width="7"[^>]*>.*?</g>', limbs, s, flags=re.S)
    if not P['legs']:
        s = re.sub(r'<ellipse cx="35" cy="120"[^>]*/><ellipse cx="65" cy="120"[^>]*/>', '', s)
    s = s.replace('height="92" rx="32" fill="#EE4B3B" stroke="#1E2240" stroke-width="2.5"',
                  f'height="{P["h"]}" rx="32" fill="#EE4B3B" stroke="#1E2240" stroke-width="{P["sw"]}"')
    if not P['hl']: s = re.sub(r'<ellipse cx="34" cy="32"[^>]*/>', '', s)
    s = s.replace('r="11" fill="#fff"', f'r="{P["ew"]}" fill="#fff"')
    pups = iter([37, 63])
    s = re.sub(r'<circle cx="\d+" cy="\d+" r="[\d.]+" fill="#1E2240"/>',
               lambda m: f'<circle cx="{next(pups)}" cy="{47 + P["look"]}" r="{P["pup"]}" fill="#1E2240"/>', s)
    s = s.replace('rx="5" ry="7"', f'rx="{P["mr"][0]}" ry="{P["mr"][1]}"')
    s = re.sub(r'<path d="M82 28[^>]*/>', '', s)
    if P['drop']:
        s = s.replace('</svg>', f'<path d="M85 24q7 10 0 15q-7-5 0-15z" fill="#BFE9FF" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/></svg>')
    return s

def unit_group(kind):
    """arrow + bean in unit space (g-space: unit y + 14 = svg y). Origin = bean box top-left."""
    P = KINDS[kind]; A = P['arrow']
    d = arrow_d(50, A['tip'], A['w'], A['h'])
    arrow = (f'<g transform="translate(0 14)"><path d="{d}" fill="{YEL}" stroke="{INK}" stroke-width="{A["sw"]}" stroke-linejoin="round"/></g>')
    return arrow + bean_markup(kind)

def placed(kind):
    P = KINDS[kind]
    return f'<g transform="translate({P["bx"]} {P["by"]}) scale({P["k"]})">{unit_group(kind)}</g>'

def mono_parts(kind):
    """Monochrome layers in unit space: sil (solid), holes (cut out), add (put back)."""
    P = KINDS[kind]; A = P['arrow']; d = arrow_d(50, A['tip'], A['w'], A['h'])
    a1, _ = arms_d(); arms = f'{a1}M79 64L{100-ARM_END[0]} {ARM_END[1]}'
    gap = 1.9
    sil = (f'<g transform="translate(0 14)"><path d="{arms}" stroke="#000" stroke-width="{P["arm"] + 1}" stroke-linecap="round" fill="none"/>'
           f'<rect x="18" y="14" width="64" height="{P["h"]}" rx="32" fill="#000"/>'
           f'<path d="{d}" fill="#000" stroke="#000" stroke-width="{A["sw"]}" stroke-linejoin="round"/></g>')
    holes = (f'<g transform="translate(0 14)"><path d="{d}" fill="none" stroke="#000" stroke-width="{A["sw"] + 2 * gap}" stroke-linejoin="round"/>'
             f'<circle cx="37" cy="47" r="{P["ew"]}"/><circle cx="63" cy="47" r="{P["ew"]}"/>'
             f'<ellipse cx="50" cy="76" rx="{P["mr"][0]}" ry="{P["mr"][1]}"/></g>')
    add = (f'<g transform="translate(0 14)"><path d="{d}" fill="#000" stroke="#000" stroke-width="{A["sw"]}" stroke-linejoin="round"/>'
           f'<circle cx="37" cy="{47 + P["look"]}" r="{P["pup"]}"/><circle cx="63" cy="{47 + P["look"]}" r="{P["pup"]}"/></g>')
    return sil, holes, add

# ------------------------------------------------------------------ rendering
class R:
    def __init__(self, pg): self.pg = pg
    def svg(self, inner, size, vb=(0, 0, 1024, 1024), bg='', transparent=False, extra_css=''):
        html = (f'<!doctype html><meta charset=utf8><style>{CSS}{extra_css}</style><svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
                f'viewBox="{vb[0]} {vb[1]} {vb[2]} {vb[3]}" style="display:block">{bg}{inner}</svg>')
        self.pg.set_viewport_size({'width': size, 'height': size}); self.pg.set_content(html)
        self.pg.evaluate('document.fonts.ready'); self.pg.wait_for_timeout(120)
        im = Image.open(io.BytesIO(self.pg.screenshot(clip={'x': 0, 'y': 0, 'width': size, 'height': size}, omit_background=transparent)))
        return im.convert('RGBA' if transparent else 'RGB')

def sky(): return f'<rect width="1024" height="1024" fill="{SKY}"/>'

def enclosing_circle(alpha, step=4):
    ys, xs = np.nonzero(alpha[::step, ::step] > 20)
    pts = np.stack([xs * step, ys * step], 1).astype(float)
    c = pts.mean(0)
    for i in range(1, 600):                                   # Badoiu-Clarkson minimal enclosing circle
        far = pts[np.argmax(((pts - c) ** 2).sum(1))]
        c = c + (far - c) / (i + 1)
    return c, float(np.sqrt(((pts - c) ** 2).sum(1)).max())

def fit(r, kind, canvas, radius_frac, sup=2048):
    """Scale + centre the unit group of `kind` so its minimal enclosing circle has radius radius_frac*canvas, centred.
    Returns the svg transform string in a canvas-sized (1024-based) space plus (s, centre)."""
    probe = r.svg(f'<g transform="translate(900 900) scale(6)">{unit_group(kind)}</g>', sup, vb=(0, 0, 1800, 1800), transparent=True)
    a = np.array(probe)[..., 3]
    c, rad = enclosing_circle(a, 4)
    c = c * 1800 / sup; rad = rad * 1800 / sup                 # to 1800-space (6 px per unit)
    # canvas-space layout: canvas side 1024, target radius T
    T = radius_frac * 1024
    s = T / rad                                                # multiplies the 6 px/unit scale
    # point p in probe space -> (p - 900)/6 unit -> *6*s px; place enclosing centre at (512,512)
    cu = ((c - 900) / 6)                                       # centre in unit coords (g-space)
    k = 6 * s
    return f'translate({512 - cu[0] * k:.3f} {512 - cu[1] * k:.3f}) scale({k:.4f})', k

def radial_max(im, centre=None):
    a = np.array(im)[..., 3]; h, w = a.shape
    ys, xs = np.nonzero(a > 8)
    cx, cy = (w / 2, h / 2) if centre is None else centre
    return float(np.sqrt((xs + .5 - cx) ** 2 + (ys + .5 - cy) ** 2).max())

def down(im, n): return im.resize((n, n), Image.LANCZOS)

def build():
    out = {}
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': 1024, 'height': 1024})
        pg.set_content('<html></html>'); pg.add_script_tag(content=LIB)
        BEAN['scared'] = pg.evaluate('()=>charSVG({color:"#EE4B3B",acc:0,id:0},"scared")')
        r = R(pg)

        # ---------- masters
        full = r.svg(placed('full'), 2048, bg=sky()).convert('RGB')
        small = r.svg(placed('small'), 2048, bg=sky()).convert('RGB')
        f1024, s1024 = down(full, 1024), down(small, 1024)
        out['full'] = f1024; out['small'] = s1024
        # maskable: same art scaled 0.92 about the centre; sky fills the rest; body still runs off the bottom edge
        def maskable(n, sc=.92):
            return down(r.svg(f'<g transform="translate(512 512) scale({sc}) translate(-512 -512)">{placed("full")}</g>', 2048, bg=sky()), n)
        out['mask1024'] = maskable(1024)

        # ---------- app icons (RGB, no alpha)
        for n in (1024, 512, 180):
            (f1024 if n == 1024 else down(full, n)).convert('RGB').save(HERE / f'icon-{n}.png')
        down(full, 180).save(SITE / 'icon-180.png')
        down(full, 192).save(SITE / 'icons/icon-192.png'); down(full, 512).save(SITE / 'icons/icon-512.png')
        down(small, 32).save(SITE / 'icons/icon-32.png')
        maskable(192).save(SITE / 'icons/icon-maskable-192.png'); maskable(512).save(SITE / 'icons/icon-maskable-512.png')

        # ---------- Android adaptive (432) and capacitor foreground (1024): head variant inside the 66% safe circle
        # safe circle = 66/108 of the canvas as diameter -> radius 0.3056; aim for 0.318*? no: 140/432 = 0.324 of canvas is the
        # old margin; here radius = 0.30 (a ~2% margin inside the 0.3056 circle).
        tf, k = fit(r, 'head', 1024, 0.300)
        fg_big = r.svg(f'<g transform="{tf}">{unit_group("head")}</g>', 2048, transparent=True)
        fg1024 = down(fg_big, 1024); fg432 = down(fg_big, 432)
        out['fg432'] = fg432; out['fg1024'] = fg1024
        fg432.save(LAUNCH / 'ic_foreground.png'); fg432.save(HERE / 'adaptive-foreground-432.png')
        fg1024.save(ASSETS / 'icon-foreground.png')
        Image.new('RGB', (432, 432), SKY).save(LAUNCH / 'ic_background.png')
        Image.new('RGB', (1024, 1024), SKY).save(ASSETS / 'icon-background.png')
        f1024.save(ASSETS / 'icon-only.png')
        out['safe_r432'] = radial_max(fg432, (216, 216))
        # monochrome: silhouette with cut-out eyes / mouth / arrow gap, single colour (alpha is what the launcher uses)
        sil, holes, add = mono_parts('head')
        L = [np.array(r.svg(f'<g transform="{tf}">{x}</g>', 2048, transparent=True))[..., 3] / 255. for x in (sil, holes, add)]
        a = np.maximum(L[0] * (1 - L[1]), L[2])
        mono = Image.new('RGBA', (2048, 2048), (0, 0, 0, 0)); mono.putalpha(Image.fromarray((a * 255).astype('uint8')))
        mono = down(mono, 432); mono.save(LAUNCH / 'ic_monochrome.png'); out['mono432'] = mono

        # ---------- splash: whole bean + arrow above the wordmark, inside the centre 1200 px
        S = 2732
        def splash(bg, ink_bg):
            ks = 5.6
            fw, fh = 116 * ks, 146 * ks                  # figure svg viewBox -8 0 116 146 (g-space)
            fs = 210; gap = 70
            total = fh + gap + fs
            top = (S - total) / 2
            rim = ''
            if ink_bg:
                rim = 'filter:' + ' '.join(f'drop-shadow({dx}px {dy}px 0 {PAPER})' for dx, dy in ((8, 0), (-8, 0), (0, 8), (0, -8), (6, 6), (-6, 6), (6, -6), (-6, -6))) + ';'
            sk = INK if not ink_bg else '#000'
            fig = (f'<svg viewBox="-8 0 116 146" width="{fw}" height="{fh}" style="position:absolute;left:{(S - fw) / 2}px;top:{top}px;overflow:visible;{rim}">'
                   f'{unit_group("figure")}</svg>')
            wm = (f'<h1 style="position:absolute;left:0;right:0;top:{top + fh + gap}px;margin:0;text-align:center;white-space:nowrap;'
                  f'font:400 {fs}px/1 \'Bagel Fat One\';color:#fff;-webkit-text-stroke:{fs * .0735:.1f}px {sk};paint-order:stroke fill;letter-spacing:.01em">'
                  f'High<span style="color:{YEL};margin:0 .08em">&amp;</span>Low</h1>')
            html = (f'<!doctype html><meta charset=utf8><style>{CSS}#c{{position:relative;width:{S}px;height:{S}px;overflow:hidden;background:{bg}}}</style>'
                    f'<div id=c>{fig}{wm}</div>')
            pg.set_viewport_size({'width': S, 'height': S}); pg.set_content(html); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(300)
            return Image.open(io.BytesIO(pg.screenshot(clip={'x': 0, 'y': 0, 'width': S, 'height': S}))).convert('RGB')
        sp, spd = splash(SKY, False), splash(DARK, True)
        sp.save(ASSETS / 'splash.png'); spd.save(ASSETS / 'splash-dark.png')
        sp.save(LAUNCH / 'splash.png'); spd.save(LAUNCH / 'splash-dark.png')
        out['splash'] = sp; out['splash_dark'] = spd
        for nm, im, bgc in (('splash', sp, SKY), ('dark', spd, DARK)):
            ref = Image.new('RGB', im.size, bgc); bb = Image.fromarray(np.abs(np.array(im, int) - np.array(ref, int)).sum(2).astype('uint8') > 12).getbbox()
            out['splash_bbox_' + nm] = bb
        # Android 12+ splash logo: whole figure, transparent, inside the centre 2/3 circle (radius 341 of 1024)
        tf2, k2 = fit(r, 'figure', 1024, 0.325)
        lg = down(r.svg(f'<g transform="{tf2}">{unit_group("figure")}</g>', 2048, transparent=True), 1024)
        lg.save(LAUNCH / 'splash-logo.png'); out['logo'] = lg; out['logo_r'] = radial_max(lg)
        b.close()
    return out

# ------------------------------------------------------------------ previews
def mask(kind, n):
    N = n * 4; m = Image.new('L', (N, N), 0); d = ImageDraw.Draw(m)
    if kind == 'circle': d.ellipse((0, 0, N - 1, N - 1), fill=255)
    elif kind == 'rounded': d.rounded_rectangle((0, 0, N - 1, N - 1), radius=int(N * .22), fill=255)
    else:
        yy, xx = np.mgrid[0:N, 0:N]
        m = Image.fromarray(((np.abs((xx + .5) / N * 2 - 1) ** 4 + np.abs((yy + .5) / N * 2 - 1) ** 4) <= 1).astype('uint8') * 255)
    return m.resize((n, n), Image.LANCZOS)

def previews(o):
    fg = o['fg432']; layers = Image.new('RGBA', (432, 432), SKY); layers.alpha_composite(fg)
    mono_on = Image.new('RGBA', (432, 432), (30, 34, 64, 255)); mono_on.paste(Image.new('RGBA', (432, 432), (255, 255, 255, 255)), mask=o['mono432'].split()[3])
    sheet = Image.new('RGB', (4 * 320 + 20, 2 * 320 + 20), (235, 235, 235))
    for rr, img in enumerate((layers.crop((72, 72, 360, 360)), mono_on.crop((72, 72, 360, 360)))):
        for c, kind in enumerate(('circle', 'squircle', 'rounded')):
            cell = img.copy(); cell.putalpha(mask(kind, 288)); sheet.paste(cell, (20 + c * 320, 20 + rr * 320), cell)
    raw = layers.convert('RGB'); d = ImageDraw.Draw(raw)
    d.rectangle((72, 72, 360, 360), outline=(255, 0, 0)); d.ellipse((216 - 142.5, 216 - 142.5, 216 + 142.5, 216 + 142.5), outline=(0, 0, 0), width=2)
    sheet.paste(raw.resize((288, 288)), (20 + 3 * 320, 20))
    sheet.paste(Image.new('RGB', (288, 288), (60, 60, 70)), (20 + 3 * 320, 340)); m = o['mono432'].resize((288, 288))
    tmp = Image.new('RGB', (288, 288), (255, 255, 255)); tmp.paste(Image.new('RGB', (288, 288), (0, 0, 0)), mask=m.split()[3]); sheet.paste(tmp, (20 + 3 * 320, 340))
    sheet.save(LAUNCH / 'preview-adaptive-masks.png')

def check_sheet(o):
    def uri(im): bf = io.BytesIO(); im.save(bf, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(bf.getvalue()).decode()
    full, small = o['full'], o['small']
    def row(bgc):
        s = ''
        for n, im in ((180, full), (120, full), (60, full), (60, small), (40, small), (29, small), (29, full)):
            s += f'<figure><img src="{uri(down(im, n))}" style="width:{n}px;height:{n}px;border-radius:22.37%"><figcaption>{n}{"s" if im is small else ""}</figcaption></figure>'
        z = ''
        for n, im in ((60, full), (60, small), (40, small), (29, small), (29, full)):
            z += f'<img src="{uri(down(im, n))}" style="width:{n * 4}px;height:{n * 4}px;image-rendering:pixelated;border-radius:22.37%">'
        return f'<div class=row style="background:{bgc}">{s}</div><div class=row style="background:{bgc}">{z}</div>'
    mk = o['mask1024'].resize((300, 300)); circ = Image.new('RGBA', (300, 300), (0, 0, 0, 0)); circ.paste(mk, mask=mask('circle', 300))
    html = (f'<!doctype html><style>body{{margin:0;width:1500px;font:600 14px Arial;color:#888;background:#ddd}}.row{{display:flex;gap:20px;align-items:flex-end;padding:14px}}'
            f'figure{{margin:0;text-align:center}}img{{display:block}}.sp{{display:flex;gap:20px;padding:14px;align-items:flex-start}}</style>'
            f'<div class=row style="background:#fff"><img src="{uri(down(full, 1024))}" style="width:512px;height:512px;border-radius:22.37%">'
            f'<img src="{uri(o["mask1024"].resize((256, 256), Image.LANCZOS))}" style="width:256px"><img src="{uri(circ)}" style="width:300px">'
            f'<img src="{uri(down(small, 256))}" style="width:256px;border-radius:22.37%"></div>{row("#ffffff")}{row("#15172b")}'
            f'<div class=sp><img src="{uri(Image.open(LAUNCH / "preview-adaptive-masks.png"))}" style="width:900px">'
            f'<img src="{uri(o["splash"].resize((340, 340), Image.LANCZOS))}"><img src="{uri(o["splash_dark"].resize((340, 340), Image.LANCZOS))}"></div>'
            f'<div class=sp style="background:#fff"><img src="{uri(o["logo"].resize((300, 300), Image.LANCZOS))}" style="background:{SKY}">'
            f'<img src="{uri(o["fg1024"].resize((300, 300), Image.LANCZOS))}" style="background:{SKY}"></div>')
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': 1500, 'height': 900}); pg.set_content(html); pg.wait_for_timeout(500)
        pg.screenshot(path=str(HERE / 'final-check.png'), full_page=True); b.close()

if __name__ == '__main__':
    o = build(); previews(o); check_sheet(o)
    print('adaptive fg max radius (px of 432, safe 142.5):', round(o['safe_r432'], 1))
    print('splash content bbox (centre 1200 = 766..1966):', o['splash_bbox_splash'], o['splash_bbox_dark'])
    print('splash-logo max radius (px of 1024, limit 341):', round(o['logo_r'], 1))
