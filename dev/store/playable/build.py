#!/usr/bin/env python3
"""High & Low playable ad: builds one self-contained HTML file per ad network.

Run:  python3 store/playable/build.py        (needs: pip install fonttools brotli)
Out:  store/playable/dist/{preview.html, meta.html, applovin.html, unity.html,
                           google/ + google.zip, tiktok/ + tiktok.zip, mintegral/ + mintegral.zip}

The art, CSS, death scene and sounds are NOT copied: they are read from the game's own
source (src/*.css, src/base.js, src/rating.js, src/main.js home sky, site/sfx, site/fonts) at build time,
so the ad always matches the game. Only the ad logic lives in store/playable/src/.
"""
import base64, io, json, pathlib, re, sys, zipfile

# =====================================================================================
# CONFIG: OWNER EDITS THESE TWO LINES BEFORE SHIPPING.  Placeholders, not real listings.
IOS_URL = "https://apps.apple.com/app/id0000000000"                         # PLACEHOLDER
ANDROID_URL = "https://play.google.com/store/apps/details?id=com.example.highandlow"  # PLACEHOLDER
# =====================================================================================

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]            # the game repo (store/playable/build.py -> repo root)
SRC, SITE = ROOT / "src", ROOT / "site"
DIST = HERE / "dist"

# sounds used by the ad (all real recordings from site/sfx, byte-identical, already mono ~80-96 kbps and short)
SFX = ["pick", "send", "yes", "nope", "tick", "win", "hint", "land", "k_crack",          # ad UI + the squeeze chop
       "k_yelp", "k_plop", "d_piano",                                                    # piano (+ shared)
       "k_squeak", "k_boing2", "k_popbang", "pop", "k_woosh",                            # balloon pop
       "k_boom", "key", "k_zap", "k_sizzle",                                             # zap
       "k_whoop", "k_slam", "bonk", "k_ring"]                                            # banana
LIMIT_SINGLE = 2 * 1024 * 1024    # Meta single-file limit (hard fail above)
LIMIT_ZIP = 5 * 1024 * 1024       # Google / TikTok / Mintegral zip limit


def b64(p):
    return base64.b64encode(pathlib.Path(p).read_bytes()).decode()


def subset_font(path, unicodes):
    """Subset a woff2 to the given code points. Falls back to the whole file if fonttools/brotli are missing."""
    try:
        from fontTools import subset
    except Exception:
        print("WARN: fonttools/brotli missing, embedding full fonts (pip install fonttools brotli)")
        return pathlib.Path(path).read_bytes()
    o = subset.Options()
    o.flavor = "woff2"
    o.layout_features = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk"]
    o.name_IDs = [1, 2]
    o.notdef_outline = False
    f = subset.load_font(str(path), o)
    s = subset.Subsetter(o)
    s.populate(unicodes=unicodes)
    s.subset(f)
    buf = io.BytesIO()
    subset.save_font(f, buf, o)
    return buf.getvalue()


def fonts_css():
    cps = list(range(0x20, 0x7F)) + [0xD7, 0x2013, 0x2019, 0x2212]
    fd = SITE / "fonts"
    out = []
    # Bagel Fat One 400: logo, buttons, bubbles.  Baloo 2: 700 (also used for 500/600 asks) and 800.
    for fam, wt, fn in [("Bagel Fat One", "400", "bagel-fat-one-latin-400-normal.woff2"),
                        ("Baloo 2", "500 700", "baloo-2-latin-700-normal.woff2"),
                        ("Baloo 2", "800", "baloo-2-latin-800-normal.woff2")]:
        data = base64.b64encode(subset_font(fd / fn, cps)).decode()
        out.append("@font-face{font-family:'%s';font-style:normal;font-weight:%s;font-display:block;"
                   "src:url(data:font/woff2;base64,%s) format('woff2')}" % (fam, wt, data))
    return "\n".join(out)


def game_css():
    fontre = re.compile(r"/\*FONTS\*/.*?/\*/FONTS\*/\n?", re.S)   # drop the game's own @font-face (file urls)
    css = "".join((SRC / f).read_text() for f in ["base.css", "extra.css", "deaths.css", "ui2.css"] if (SRC / f).exists())
    css += "".join(f.read_text() for f in sorted(SRC.glob("zz_*.css")))
    css = fontre.sub("", css)
    reset = "body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}\n"
    return reset + css + "\n" + fonts_css() + "\n" + (HERE / "src/style.css").read_text()


def game_js():
    main = (SRC / "main.js").read_text()
    # the real home landscape (sky, sun, clouds, hills, trees, flowers, path): lifted verbatim from main.js
    m = re.search(r"const SCENE_T0=.*?(?=/\* The kite:)", main, re.S)
    if not m:
        sys.exit("build.py: could not find homeSceneHTML in src/main.js")
    home = m.group(0)
    snd = (SRC / "sound.js").read_text()
    g = re.search(r"GAIN:\{(.*?)\n  \},", snd, re.S)               # the game's per-sound loudness table
    gain = "{" + (g.group(1) if g else "") + "}"
    audio = {k: b64(SITE / "sfx" / (k + ".mp3")) for k in SFX}
    parts = [
        (SRC / "base.js").read_text(),
        (SRC / "rating.js").read_text(),
        home,
        "window.HLAD_AUDIO=" + json.dumps(audio) + ";window.HLAD_GAIN=" + gain + ";",
        (HERE / "src/game.js").read_text(),
    ]
    return "\n".join(parts)


# ---------------------------------------------------------------- network adapters
# Contract: window.HLP = {boot(g), cta(), end()}; g = {start(), pause(), resume()}.
URLS = "var HL_IOS=%s,HL_AND=%s;function HL_URL(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?HL_IOS:HL_AND}" % (
    json.dumps(IOS_URL), json.dumps(ANDROID_URL))

MRAID = URLS + """
window.HLP={
  boot:function(g){
    var started=false;
    function begin(){if(!started){started=true;g.start()}else g.resume()}
    function setup(){
      mraid.addEventListener('viewableChange',function(v){if(v)begin();else g.pause()});
      mraid.addEventListener('stateChange',function(s){if(s==='hidden')g.pause();else if(s!=='loading'&&mraid.isViewable())begin()});
      if(mraid.isViewable())begin();
    }
    if(typeof mraid==='undefined'){begin();return}            /* no MRAID container (desktop test): just run */
    if(mraid.getState()==='loading')mraid.addEventListener('ready',setup);else setup();
  },
  cta:function(){if(typeof mraid!=='undefined')mraid.open(HL_URL());else window.open(HL_URL())},
  end:function(){}
};"""

ADAPTERS = {
    "preview": """
window.HLP={boot:function(g){g.start()},
  cta:function(){window.__ctaCount=(window.__ctaCount||0)+1;var d=document.getElementById('ctaTest');
    if(!d){d=document.createElement('div');d.id='ctaTest';d.style.cssText='position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:999;background:#1E2240;color:#fff;font:800 18px system-ui;padding:8px 16px;border-radius:99px';document.body.appendChild(d)}
    d.textContent='CTA fired';},
  end:function(){}};""",
    "meta": """
window.HLP={boot:function(g){g.start()},
  cta:function(){FbPlayableAd.onCTAClick()},
  end:function(){}};""",
    "applovin": MRAID,
    "unity": MRAID,
    "google": """
window.HLP={boot:function(g){g.start()},
  cta:function(){ExitApi.exit()},
  end:function(){}};""",
    "tiktok": """
window.HLP={boot:function(g){g.start()},
  cta:function(){window.openAppStore()},
  end:function(){}};""",
    "mintegral": """
window.HLP={boot:function(g){g.start();window.gameReady&&window.gameReady()},
  cta:function(){window.install()},
  end:function(){window.gameEnd&&window.gameEnd()}};""",
}

HEAD_EXTRA = {
    "google": '<meta name="ad.orientation" content="portrait">\n'
              '<script type="text/javascript" src="https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"></script>\n',
}


def page(net, css, js):
    tpl = (HERE / "src/template.html").read_text()
    return (tpl.replace("{{HEAD}}", HEAD_EXTRA.get(net, ""))
               .replace("{{CSS}}", css)
               .replace("{{ADAPTER}}", ADAPTERS[net])
               .replace("{{JS}}", js.replace("</script", "<\\/script")))


def zip_dir(folder, zpath):
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in sorted(folder.rglob("*")):
            if p.is_file():
                z.write(p, p.relative_to(folder).as_posix())


def main():
    css, js = game_css(), game_js()
    if DIST.exists():
        import shutil
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)
    sizes = {}
    for net in ["preview", "meta", "applovin", "unity"]:
        p = DIST / (net + ".html")
        p.write_text(page(net, css, js))
        sizes[net + ".html"] = p.stat().st_size
    for net in ["google", "tiktok", "mintegral"]:
        d = DIST / net
        d.mkdir()
        (d / "index.html").write_text(page(net, css, js))
        if net == "tiktok":
            (d / "config.json").write_text(json.dumps({"playable_orientation": 0, "playable_languages": ["en"]}, indent=1) + "\n")
        zip_dir(d, DIST / (net + ".zip"))
        sizes[net + ".zip"] = (DIST / (net + ".zip")).stat().st_size
        sizes[net + "/index.html"] = (d / "index.html").stat().st_size
    bad = []
    for k, v in sizes.items():
        lim = LIMIT_ZIP if k.endswith(".zip") else LIMIT_SINGLE
        print("%-24s %9d bytes  (%.0f KB)%s" % (k, v, v / 1024, "" if v < lim else "   OVER LIMIT"))
        if v >= lim:
            bad.append(k)
    if bad:
        sys.exit("build.py: over size limit: " + ", ".join(bad))


if __name__ == "__main__":
    main()
