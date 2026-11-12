"""Build the single-file game: src/* -> /home/claude/high-and-low.html. Run: python3 /home/claude/hl/build.py"""
import pathlib
H=pathlib.Path('/home/claude/hl')
SITE='https://7289627-cmd.github.io/high-and-low/'  # public address; change when the game moves to its own domain
HEAD='''<title>High and Low</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Baloo+2:wght@500;600;700;800&display=swap">
<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"></script>
'''
css=''.join((H/'src'/f).read_text() for f in ['base.css','extra.css','deaths.css','ui2.css'] if (H/'src'/f).exists())
snd=(H/'src/sound.js').read_text()
js=snd+(H/'src/track.js').read_text()+(H/'src/ads.js').read_text()+(H/'src/base.js').read_text()+((H/'src/showdown.js').read_text() if (H/'src/showdown.js').exists() else '')+((H/'src/powers.js').read_text() if (H/'src/powers.js').exists() else '')+(H/'src/rating.js').read_text()+(H/'src/botlife.js').read_text()+(H/'src/main.js').read_text()
import sys,json
if len(sys.argv)>1 and sys.argv[1]=='web':
    cfgp=H/'config.json'
    if cfgp.exists(): cfg=json.loads(cfgp.read_text())
    else:
        cfg={'url':'','key':''}; print('WARNING: config.json missing, using empty url/key')
    wjs=(H/'src/net-supabase.js').read_text()+js
    head=('<!doctype html><html lang="en"><head>'
    '<meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">'
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'\">"
    '<meta name="apple-mobile-web-app-capable" content="yes">'
    '<meta name="mobile-web-app-capable" content="yes">'
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
    '<meta name="theme-color" content="#7FD0E4">'
    '<link rel="apple-touch-icon" href="icon-180.png"><meta name="apple-mobile-web-app-title" content="High &amp; Low"><link rel="icon" type="image/png" href="icon-180.png">\n'
    '<title>High &amp; Low</title>\n'
    '<meta name="description" content="Hide a number. Guess theirs. Last bean standing wins.">\n'
    '<meta property="og:type" content="website"><meta property="og:site_name" content="High &amp; Low">\n'
    '<meta property="og:title" content="High &amp; Low"><meta property="og:description" content="Hide a number. Guess theirs. Last bean standing wins.">\n'
    '<meta property="og:url" content="'+SITE+'"><meta property="og:image" content="'+SITE+'og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">\n'
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="'+SITE+'og.png">\n'
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Baloo+2:wght@500;600;700;800&display=swap">\n')
    reset=':root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}\n'
    out=(head+'<style>'+reset+css+'</style>\n</head><body>\n<div id="app"></div>\n<div id="ov" hidden></div>\n\n'
    '<script src="vendor/supabase-2.118.0.js"></script>\n'
    '<script src="vendor/qrcode-1.4.4.js"></script>\n'
    '<script>window.HL_CONFIG={url:'+json.dumps(cfg.get('url',''))+',key:'+json.dumps(cfg.get('key',''))+'}</script>\n'
    '<script>\n'+wjs+'</script>\n</body></html>\n')
    (H/'site').mkdir(exist_ok=True)
    (H/'site/index.html').write_text(out)
    (H/'test/_built_web.js').write_text(wjs)
    print('WEB BUILD OK', len(out),'bytes')
    sys.exit(0)
out=HEAD+'<style>'+css+'</style>\n\n<div id="app"></div>\n<div id="ov" hidden></div>\n\n<script>\n'+js+'</script>\n'
pathlib.Path('/home/claude/high-and-low.html').write_text(out)
(H/'test/_built.js').write_text(js)
print('BUILD OK', len(out),'bytes')
