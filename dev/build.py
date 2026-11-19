"""Build the single-file game from src/*. `python3 build.py` writes artifact.html (offline test build). `python3 build.py web` writes the product index.html into site/ (or, in the GitHub repo layout where this folder is dev/, into the repo root). Runs from any location."""
import pathlib,sys,json,re
FONTRE=re.compile(r'/\*FONTS\*/.*?/\*/FONTS\*/\n?',re.S)
H=pathlib.Path(__file__).resolve().parent
OUTDIR=H/'site' if (H/'site').is_dir() or not (H.parent/'index.html').exists() else H.parent
SITE='https://7289627-cmd.github.io/high-and-low/'  # public address; change when the game moves to its own domain
HEAD='''<title>High and Low</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=Baloo+2:wght@500;600;700;800&display=swap">
<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"></script>
'''
css=''.join((H/'src'/f).read_text() for f in ['base.css','extra.css','deaths.css','ui2.css'] if (H/'src'/f).exists())
css+=''.join(f.read_text() for f in sorted((H/'src').glob('zz_*.css')))  # extra stylesheets, loaded last
art_css=FONTRE.sub('',css)  # artifact build keeps Google Fonts (single file, no fonts/ folder)
snd=(H/'src/sound.js').read_text()+(H/'src/music.js').read_text()+(H/'src/haptics.js').read_text()
catalogs={f.stem:json.loads(f.read_text(encoding='utf-8-sig')) for f in sorted((H/'src/locales').glob('*.json'))}
localization='window.HL_TRANSLATIONS='+json.dumps(catalogs).replace('<','\\u003c')+';\n'+(H/'src/i18n.js').read_text(encoding='utf-8')+'\n'
js=localization+snd+(H/'src/flags.js').read_text()+(H/'src/track.js').read_text()+(H/'src/ads.js').read_text()+(H/'src/base.js').read_text()+((H/'src/showdown.js').read_text() if (H/'src/showdown.js').exists() else '')+((H/'src/powers.js').read_text() if (H/'src/powers.js').exists() else '')+(H/'src/names.js').read_text()+(H/'src/rating.js').read_text()+(H/'src/botlife.js').read_text()+(H/'src/streak.js').read_text()+(H/'src/share.js').read_text()+(H/'src/main.js').read_text()
import sys,json
if len(sys.argv)>1 and sys.argv[1]=='web':
    cfgp=H/'config.json'
    if cfgp.exists(): cfg=json.loads(cfgp.read_text())
    else:
        cfg={'url':'','key':''}; print('WARNING: config.json missing, using empty url/key')
    wjs=(H/'src/net-supabase.js').read_text()+js
    import re as _re
    _h=_re.match(r'^https://([a-z0-9-]+\.supabase\.co)$',cfg.get('url',''))
    CONNECT=("https://"+_h.group(1)+" wss://"+_h.group(1)) if _h else 'https://*.supabase.co wss://*.supabase.co'  # only this game's own project, so injected code cannot send data to another one
    head=('<!doctype html><html lang="en"><head>'
    '<meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">'
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; media-src 'self'; manifest-src 'self'; connect-src 'self' "+CONNECT+"; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'\">"
    '<meta name="apple-mobile-web-app-capable" content="yes">'
    '<meta name="mobile-web-app-capable" content="yes">'
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
    '<meta name="theme-color" content="#7FD0E4">'
    '<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icon-180.png"><meta name="apple-mobile-web-app-title" content="High &amp; Low"><link rel="icon" type="image/png" sizes="32x32" href="icons/icon-32.png"><link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">\n'
    '<title>High &amp; Low</title>\n'
    '<meta name="description" content="Hide a number. Guess theirs. Last bean standing wins.">\n'
    '<meta property="og:type" content="website"><meta property="og:site_name" content="High &amp; Low">\n'
    '<meta property="og:title" content="High &amp; Low"><meta property="og:description" content="Hide a number. Guess theirs. Last bean standing wins.">\n'
    '<meta property="og:url" content="'+SITE+'"><meta property="og:image" content="'+SITE+'og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">\n'
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="'+SITE+'og.png">\n'
    '<link rel="preload" as="font" type="font/woff2" href="fonts/bagel-fat-one-latin-400-normal.woff2" crossorigin>\n'
    '<link rel="preload" as="font" type="font/woff2" href="fonts/baloo-2-latin-700-normal.woff2" crossorigin>\n')
    reset=':root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}\n'
    out=(head+'<style>'+reset+css+'</style>\n</head><body>\n<div id="app"></div>\n<div id="ov" hidden></div>\n<div class="rotate-cover" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6.5" y="2" width="11" height="20" rx="2.5"/><path d="M10.5 18.5h3"/></svg></div>\n\n'
    '<script src="vendor/supabase-2.118.0.js"></script>\n'
    '<script src="vendor/qrcode-1.4.4.js"></script>\n'
    '<script>window.HL_CONFIG={url:'+json.dumps(cfg.get('url',''))+',key:'+json.dumps(cfg.get('key',''))+'};window.HL_NEED_NET=1;window.HL_SITE='+json.dumps(SITE)+'</script>\n'
    '<script>\n'+wjs+'</script>\n</body></html>\n')
    OUTDIR.mkdir(exist_ok=True)
    (OUTDIR/'index.html').write_text(out)
    (H/'test/_built_web.js').write_text(wjs)
    print('WEB BUILD OK', len(out),'bytes')
    sys.exit(0)
out=HEAD+'<style>'+art_css+'</style>\n\n<div id="app"></div>\n<div id="ov" hidden></div>\n\n<script>\n'+js+'</script>\n'
(H/'artifact.html').write_text(out)
(H/'test/_built.js').write_text(js)
print('BUILD OK', len(out),'bytes')
