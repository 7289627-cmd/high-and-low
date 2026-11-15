#!/usr/bin/env python3
"""Plays the High & Low playable ad end to end in headless Chrome and checks it.

    python3 store/playable/build.py && python3 store/playable/test_playable.py

For preview.html and every network build (meta, applovin, unity, google, tiktok, mintegral) at 390x844 and 320x480:
real mouse drags and taps, no console/page errors, no network requests, round finishes, a death scene plays, end card appears,
CTA fires exactly once per tap, sound stays silent until the first touch. New: tap-to-set on the bar, "Guess my number!" bubble, three pips, chop + rescale of the range, nervous bean levels, every death
in the set (piano, pop, zap, banana) reaches the end card, replay never repeats the last death, timings for an active and an idle player,
"Now beat a real player" line. Extra: one run with no input at all (idle auto-advance),
MRAID start/pause rules, iOS vs Android store URL, zip contents, file sizes, static scan of the HTML.
Writes the contact sheet and key frames to store/playable/shots/.  Prints "PASS playable (N checks)".
"""
import json, pathlib, re, sys, time, zipfile

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
DIST = HERE / "dist"
SHOTS = HERE / "shots"
CHROME = "/usr/bin/google-chrome"
IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
AND_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36"
EXIT_URL = "https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"

# build name -> (file, the one API call its CTA must make, all counted API names)
BUILDS = {
    "preview": ("preview.html", None),
    "meta": ("meta.html", "fb"),
    "applovin": ("applovin.html", "mraid.open"),
    "unity": ("unity.html", "mraid.open"),
    "google": ("google/index.html", "exit"),
    "tiktok": ("tiktok/index.html", "openAppStore"),
    "mintegral": ("mintegral/index.html", "install"),
}
N = 0
FAILS = []


def check(cond, msg):
    global N
    N += 1
    if not cond:
        FAILS.append(msg)
        print("  FAIL:", msg)


STUB = r"""
(function(){
  var C={},LOG=[];window.__calls=C;window.__log=LOG;
  function c(n,a){C[n]=(C[n]||0)+1;LOG.push([n].concat(a||[]))}
  window.FbPlayableAd={onCTAClick:function(){c('fb')}};
  window.ExitApi={exit:function(){c('exit')}};
  window.openAppStore=function(){c('openAppStore')};
  window.install=function(){c('install')};
  window.gameReady=function(){c('gameReady')};
  window.gameEnd=function(){c('gameEnd')};
  var L={},cfg=window.__MRAID||{state:'default',viewable:true};
  window.mraid={_s:cfg.state,_v:cfg.viewable,
    getState:function(){return this._s},isViewable:function(){return this._v},
    addEventListener:function(e,f){(L[e]=L[e]||[]).push(f)},removeEventListener:function(){},
    open:function(u){c('mraid.open',[u])},
    _emit:function(e,a){(L[e]||[]).slice().forEach(function(f){f(a)})}};
  // audio probes: how many contexts were created, how many sounds started
  var AC=window.AudioContext||window.webkitAudioContext;window.__ac=0;window.__plays=0;
  if(AC){var W=function(){window.__ac++;return new AC()};W.prototype=AC.prototype;window.AudioContext=W;window.webkitAudioContext=W;
    var st=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(){window.__plays++;return st.apply(this,arguments)}}
})();
"""


def phase(pg):
    return pg.evaluate("document.documentElement.getAttribute('data-phase')")


def box_center(pg, sel):
    b = pg.locator(sel).bounding_box()
    return b["x"] + b["width"] / 2, b["y"] + b["height"] / 2, b


def drag(pg, frac, slow=False):
    tr = pg.locator("#paTrack").bounding_box()
    y = tr["y"] + tr["height"] / 2
    pg.mouse.move(tr["x"] + tr["width"] * 0.5, y)
    pg.mouse.down()
    n = 14 if slow else 5
    for i in range(1, n + 1):
        pg.mouse.move(tr["x"] + tr["width"] * (0.5 + (frac - 0.5) * i / n), y)
        if slow:
            pg.wait_for_timeout(45)
    pg.mouse.up()


def open_page(browser, name, vw, vh, ua=None, mraid=None, route_exit=True):
    ctx = browser.new_context(viewport={"width": vw, "height": vh}, user_agent=ua, has_touch=False)
    pg = ctx.new_page()
    st = {"errors": [], "requests": [], "url": None}
    pg.on("console", lambda m: st["errors"].append("console: " + m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: st["errors"].append("pageerror: " + str(e)))
    pg.on("request", lambda r: st["requests"].append(r.url))
    if route_exit:
        ctx.route(EXIT_URL, lambda route: route.fulfill(status=200, content_type="application/javascript", body="/* exitapi stub */"))
    init = STUB
    if mraid:
        init = "window.__MRAID=%s;" % json.dumps(mraid) + STUB
    pg.add_init_script(init)
    path = DIST / BUILDS[name][0]
    st["url"] = path.as_uri()
    pg.goto(st["url"])
    return ctx, pg, st


def audit_requests(label, name, st):
    bad = []
    for u in st["requests"]:
        if u == st["url"] or u.startswith("data:") or u.startswith("blob:"):
            continue
        if name == "google" and u == EXIT_URL:
            continue
        bad.append(u)
    check(not bad, "%s: unexpected network requests %s" % (label, bad))
    check(not st["errors"], "%s: errors %s" % (label, st["errors"]))


DEATHS = ["piano", "pop", "zap", "banana"]


def tap(pg, frac):
    tr = pg.locator("#paTrack").bounding_box()
    pg.mouse.click(tr["x"] + tr["width"] * frac, tr["y"] + tr["height"] / 2)


def pips_on(pg):
    return pg.evaluate("document.querySelectorAll('#paPips i.on').length")


def play(pg, capture=None, slow=False, timeout=70, think=0, tap_first=False, checks=None):
    """Drive the whole ad with real mouse input. Returns the observed facts."""
    facts = {"phases": [], "guess": [], "secret": None, "scene_seen": False, "ac_before_touch": None, "ranges": [], "t_scene": None, "t_end": None, "death": None, "pips": [], "lv": []}
    facts["ac_before_touch"] = pg.evaluate("window.__ac")
    fr = [0.33, 0.68, 0.42]
    rounds_done = 0
    acted_round = -1
    t0 = time.time()
    frame_i = 0
    next_cap = 0.0
    while time.time() - t0 < timeout:
        ph = phase(pg)
        if not facts["phases"] or facts["phases"][-1] != ph:
            facts["phases"].append(ph)
        if capture is not None and time.time() - t0 >= next_cap:
            capture.append((time.time() - t0, ph, pg.screenshot()))
            next_cap += 0.4
        if ph == "scene" and not facts["scene_seen"]:
            facts["scene_seen"] = bool(pg.evaluate("!!document.querySelector('#ov .stage svg') && !document.getElementById('ov').hidden"))
            facts["t_scene"] = time.time() - t0
            facts["death"] = pg.evaluate("__hlad.death()")
        if ph == "end":
            facts["t_end"] = time.time() - t0
            break
        if ph == "ask" and acted_round != rounds_done:
            acted_round = rounds_done
            lo, hi = pg.evaluate("[+document.getElementById('paLo').textContent,+document.getElementById('paHi').textContent]")
            facts["ranges"].append((lo, hi))
            facts["pips"].append(pips_on(pg))
            facts["lv"].append(pg.evaluate("document.getElementById('paObWrap').className"))
            if think:
                pg.wait_for_timeout(think)
            if tap_first and rounds_done == 0:
                tap(pg, fr[0])
            else:
                drag(pg, fr[rounds_done], slow)
            facts["guess"].append(pg.evaluate("+document.getElementById('paNum').textContent"))
            cx, cy, _ = box_center(pg, "#paGo")
            pg.mouse.click(cx, cy)
            rounds_done += 1
        pg.wait_for_timeout(60 if capture is None else 30)
    facts["secret"] = pg.evaluate("document.getElementById('paSecret').textContent")
    facts["pips"].append(pips_on(pg))
    return facts


def verify_round(label, facts):
    check(facts["phases"][-1] == "end", "%s: ad did not reach the end card (phases %s)" % (label, facts["phases"]))
    check(len(facts["guess"]) == 3, "%s: expected 3 guesses, got %s" % (label, facts["guess"]))
    check(facts["scene_seen"], "%s: death scene did not play" % label)
    check(facts["death"] in DEATHS, "%s: unknown death %s" % (label, facts["death"]))
    check(facts["pips"] == [0, 1, 2, 3], "%s: pips should fill 0,1,2,3 as guesses are used, got %s" % (label, facts["pips"]))
    check(facts["lv"][0].endswith("lv0") and facts["lv"][1].endswith("lv1") and facts["lv"][2].endswith("lv2"), "%s: red bean nerves should grow each round %s" % (label, facts["lv"]))
    check(facts["t_end"] is not None and facts["t_end"] < 22, "%s: end card took %s s (want < 22)" % (label, facts["t_end"]))
    check(facts["t_scene"] is not None and facts["t_scene"] < 16, "%s: death came at %s s (want < 16)" % (label, facts["t_scene"]))
    check(str(facts["guess"][-1]) == facts["secret"], "%s: third guess %s was not the secret %s" % (label, facts["guess"][-1], facts["secret"]))
    r = facts["ranges"]
    check(len(r) == 3 and r[1][1] - r[1][0] < r[0][1] - r[0][0] and r[2][1] - r[2][0] < r[1][1] - r[1][0], "%s: range bar did not narrow each round %s" % (label, r))
    check(r[0] == (1, 100), "%s: first range is not 1-100 %s" % (label, r))
    check(r[2][0] <= facts["guess"][-1] <= r[2][1], "%s: third guess outside the remaining range" % label)
    ph = facts["phases"]
    check(ph.index("scene") > ph.index("answer") and ph.index("end") > ph.index("scene"), "%s: phase order wrong %s" % (label, ph))


def end_card_checks(label, pg, name, expect_call):
    pg.wait_for_timeout(1500)
    check(pg.evaluate("document.getElementById('paEloN').textContent") == "1020", "%s: rating did not count up to 1020" % label)
    check("+20" in pg.evaluate("document.querySelector('.elo-res .d').textContent"), "%s: +20 missing" % label)
    check(pg.evaluate("!!document.querySelector('.pa-end .logo.big') && document.querySelector('.pa-end h2').textContent") == "You win!", "%s: end card text" % label)
    check(pg.evaluate("document.querySelector('.pa-end .pa-line').textContent") == "Now beat a real player", "%s: end line missing" % label)
    check(pg.evaluate("getComputedStyle(document.getElementById('paCta')).animationName") != "none", "%s: Play free should pulse" % label)
    ln, cta = pg.locator(".pa-end .pa-line").bounding_box(), pg.locator("#paCta").bounding_box()
    check(ln["y"] + ln["height"] <= cta["y"] + 1 and ln["x"] >= 0 and ln["x"] + ln["width"] <= pg.evaluate("innerWidth"), "%s: end line overlaps or is clipped" % label)
    check(pg.evaluate("(function(){var e=document.querySelector('.pa-end .pa-line'),c=e.parentNode.getBoundingClientRect();return e.scrollWidth<=e.clientWidth+1&&c.bottom<=innerHeight+1})()"), "%s: end card text cut off" % label)
    check(pg.evaluate("getComputedStyle(document.querySelector('.pa-end .logo')).fontFamily").startswith('"Bagel Fat One"'), "%s: logo font" % label)
    check(pg.evaluate("document.fonts.check('20px \"Bagel Fat One\"') && document.fonts.check('800 20px \"Baloo 2\"')"), "%s: fonts not loaded" % label)
    calls0 = pg.evaluate("window.__calls")
    key = expect_call
    # tap the big button: exactly one call
    cx, cy, _ = box_center(pg, "#paCta")
    pg.mouse.click(cx, cy)
    pg.wait_for_timeout(200)
    c1 = pg.evaluate("window.__calls")
    if name == "preview":
        check(pg.evaluate("window.__ctaCount") == 1 and pg.evaluate("document.getElementById('ctaTest').textContent") == "CTA fired", "%s: preview CTA text" % label)
    else:
        check(c1.get(key, 0) == 1, "%s: button tap should call %s once, calls=%s" % (label, key, c1))
    # tap anywhere on the card (the logo): one more call
    lx, ly, _ = box_center(pg, ".pa-end .logo")
    pg.mouse.click(lx, ly)
    pg.wait_for_timeout(200)
    c2 = pg.evaluate("window.__calls")
    if name == "preview":
        check(pg.evaluate("window.__ctaCount") == 2, "%s: tap on card should fire CTA (preview count)" % label)
    else:
        check(c2.get(key, 0) == 2, "%s: tap anywhere should call %s again (now %s)" % (label, key, c2))
        others = {k: v for k, v in c2.items() if k not in (key, "gameReady", "gameEnd")}
        check(not others, "%s: other network APIs were called: %s" % (label, others))
        if name == "mintegral":
            check(c2.get("gameReady") == 1 and c2.get("gameEnd") == 1, "%s: gameReady/gameEnd %s" % (label, c2))
        else:
            check("gameReady" not in c2 and "gameEnd" not in c2, "%s: gameReady/gameEnd should only fire for mintegral" % label)
    # replay arrow: no CTA, game restarts
    rx, ry, _ = box_center(pg, "#paReplay")
    pg.mouse.click(rx, ry)
    pg.wait_for_timeout(400)
    c3 = pg.evaluate("window.__calls")
    check(c3 == c2 or name == "preview", "%s: replay must not fire the CTA" % label)
    if name == "preview":
        check(pg.evaluate("window.__ctaCount") == 2, "%s: replay fired CTA (preview)" % label)
    check(phase(pg) == "ask" and pg.evaluate("document.getElementById('paEnd')") is None, "%s: replay did not restart" % label)
    return c2


def main():
    SHOTS.mkdir(exist_ok=True)
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])

        # ---------------- every build, both sizes, real drags
        k_run = 0
        for name, (fn, expect) in BUILDS.items():
            for vw, vh in [(390, 844), (320, 480)]:
                label = "%s@%dx%d" % (name, vw, vh)
                ctx, pg, st = open_page(br, name, vw, vh)
                pg.wait_for_selector("#paGo", timeout=5000)
                check(phase(pg) == "ask", "%s: did not open straight into the duel" % label)
                check(pg.evaluate("document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth"), "%s: page scrolls" % label)
                pg.wait_for_timeout(900)   # let the intro drop-in animation finish
                # layout: every control fully inside the viewport
                inside = pg.evaluate("""(function(){var r=[];['#paGo','#paTrack','#paPips','#paSay','#paAns'].forEach(function(s){var b=document.querySelector(s).getBoundingClientRect();r.push(b.left>=-1&&b.right<=innerWidth+1&&b.top>=-1&&b.bottom<=innerHeight+1)});return r.every(Boolean)})()""")
                check(inside, "%s: controls outside the viewport" % label)
                # the goal is in the opponent's speech bubble, the hidden card wobbles, one small hint hand and no other helper text
                check(pg.evaluate("document.getElementById('paAns').textContent") == "Guess my number!" and pg.evaluate("document.getElementById('paAns').classList.contains('on')"), "%s: 'Guess my number!' bubble missing" % label)
                check(pg.evaluate("document.getElementById('paCard').classList.contains('wob')"), "%s: hidden card does not wobble" % label)
                check(pg.evaluate("document.querySelectorAll('.pa-lbl,.pa-hand2').length") == 0, "%s: extra helper text still present" % label)
                check(pg.evaluate("document.querySelectorAll('#paPips i').length") == 3 and pips_on(pg) == 0, "%s: three empty pips expected at the start" % label)
                check(pg.evaluate("parseFloat(getComputedStyle(document.getElementById('paNum')).fontSize)") >= 60 and pg.evaluate("parseFloat(getComputedStyle(document.getElementById('paLo')).fontSize)") >= 26, "%s: numbers not large enough" % label)
                ac0, plays0 = pg.evaluate("window.__ac"), pg.evaluate("window.__plays")   # nothing may sound before the first touch
                # tap anywhere on the bar jumps the thumb there; the Ask button then pulses
                tap(pg, 0.8)
                pg.wait_for_timeout(300)
                num = pg.evaluate("+document.getElementById('paNum').textContent")
                check(abs(num - 80) <= 5, "%s: tap at 80%% of the bar set %s" % (label, num))
                tb, trk = pg.locator("#paThumb").bounding_box(), pg.locator("#paTrack").bounding_box()
                check(abs((tb["x"] + tb["width"] / 2) - (trk["x"] + trk["width"] * 0.8)) < trk["width"] * 0.06, "%s: thumb did not jump to the tapped spot" % label)
                check(pg.evaluate("document.getElementById('paGo').classList.contains('pulse')") and pg.evaluate("getComputedStyle(document.getElementById('paGo')).animationName") != "none", "%s: Ask does not pulse after a number is chosen" % label)
                tap(pg, 0.1)
                pg.wait_for_timeout(200)
                check(pg.evaluate("+document.getElementById('paNum').textContent") <= 15, "%s: second tap near the left did not move the number" % label)
                pg.evaluate("__hlad.setDeath('%s')" % DEATHS[k_run % 4])
                k_run += 1
                f = play(pg, tap_first=(k_run % 2 == 0))
                check(f["death"] == DEATHS[(k_run - 1) % 4], "%s: forced death %s but got %s" % (label, DEATHS[(k_run - 1) % 4], f["death"]))
                check(ac0 == 0 and plays0 == 0, "%s: AudioContext/sound existed before the first touch (ac=%s plays=%s)" % (label, ac0, plays0))
                verify_round(label, f)
                check(pg.evaluate("window.__ac") >= 1 and pg.evaluate("window.__plays") >= 10, "%s: sounds did not play after touch (ac=%s plays=%s)" % (label, pg.evaluate("window.__ac"), pg.evaluate("window.__plays")))
                end_card_checks(label, pg, name, expect)
                audit_requests(label, name, st)
                ctx.close()
                print("ok", label, f["guess"], f["secret"])

        # ---------------- idle run: no input at all, must still reach the end card (and stay silent)
        t0 = time.time()
        ctx, pg, st = open_page(br, "preview", 390, 844)
        ph_seen = []
        ranges = []
        while time.time() - t0 < 60 and phase(pg) != "end":
            ph = phase(pg)
            if not ph_seen or ph_seen[-1] != ph:
                ph_seen.append(ph)
                if ph == "ask":
                    ranges.append(pg.evaluate("[+document.getElementById('paLo').textContent,+document.getElementById('paHi').textContent]"))
            pg.wait_for_timeout(100)
        el = time.time() - t0
        check(phase(pg) == "end", "idle: did not reach the end card in 60 s (%s)" % ph_seen)
        check(10 <= el < 30, "idle: whole ad took %.1f s (want under 30)" % el)
        check(pg.evaluate("window.__ac") == 0 and pg.evaluate("window.__plays") == 0, "idle: audio started without a touch")
        check(len(ranges) == 3 and ranges[1] != ranges[0], "idle: rounds did not advance by themselves %s" % ranges)
        audit_requests("idle", "preview", st)
        ctx.close()
        print("ok idle run %.1fs" % el)

        # ---------------- idle auto-advance picks up a suggested guess within ~6 s
        ctx, pg, st = open_page(br, "preview", 390, 844)
        pg.wait_for_selector("#paGo")
        pg.wait_for_function("document.getElementById('paLo').textContent!='1'", timeout=12000)
        check(True, "auto-advance after first idle round")
        ctx.close()

        # ---------------- the squeeze: the ruled-out part is chopped away and the rest rescales to fill the bar; the red bean sweats
        ctx, pg, st = open_page(br, "preview", 390, 844)
        pg.wait_for_selector("#paGo")
        pg.wait_for_timeout(800)
        tap(pg, 0.3)
        cx, cy, _ = box_center(pg, "#paGo")
        pg.mouse.click(cx, cy)
        seen_cut = False
        for _ in range(25):
            pg.wait_for_timeout(40)
            seen_cut = seen_cut or pg.evaluate("""(function(){var l=document.getElementById('paCutL'),r=document.getElementById('paCutR'),t=document.getElementById('paTrack').getBoundingClientRect();
              var lw=l.getBoundingClientRect().width, rl=r.getBoundingClientRect().left;
              return (document.documentElement.dataset.phase==='answer')&&l.classList.contains('on')&&r.classList.contains('on')&&(lw>t.width*0.1||rl<t.right-t.width*0.1)})()""")
        check(seen_cut, "squeeze: the ruled-out part of the range was never shown as chopped")
        pg.wait_for_timeout(900)
        lo, hi = pg.evaluate("[+document.getElementById('paLo').textContent,+document.getElementById('paHi').textContent]")
        check((lo, hi) != (1, 100) and hi - lo < 99, "squeeze: range ends did not update (%s,%s)" % (lo, hi))
        pg.wait_for_function("document.documentElement.dataset.phase==='ask'", timeout=4000)
        pg.wait_for_timeout(420)
        check(pg.evaluate("getComputedStyle(document.getElementById('paCutL')).opacity+getComputedStyle(document.getElementById('paCutR')).opacity") == "00", "squeeze: chopped blocks not removed")
        tb, trk = pg.locator("#paThumb").bounding_box(), pg.locator("#paTrack").bounding_box()
        mid = (tb["x"] + tb["width"] / 2 - trk["x"]) / trk["width"]
        check(0.35 < mid < 0.65, "squeeze: thumb did not settle in the middle of the rescaled bar (%.2f)" % mid)
        check(pg.evaluate("document.getElementById('paFill').getBoundingClientRect().width") > 20 and abs(pg.evaluate("document.getElementById('paThumb').getBoundingClientRect().left") - tb["x"]) < 2, "squeeze: fill/thumb unstable")
        check(pg.evaluate("document.getElementById('paObWrap').className.endsWith('lv1')") and pg.evaluate("getComputedStyle(document.querySelector('.pa-sw.s1')).display") == "block", "nerve: level 1 sweat drop missing")
        check(pg.evaluate("document.getElementById('paMe').classList.contains('hop')"), "squeeze: blue bean did not hop")
        audit_requests("squeeze", "preview", st)
        ctx.close()
        print("ok squeeze")

        # ---------------- every death in the set, at the smallest size, reaches the end card with the line and the pulse
        for d in DEATHS:
            ctx, pg, st = open_page(br, "preview", 320, 480)
            pg.wait_for_selector("#paGo")
            pg.evaluate("__hlad.setDeath('%s')" % d)
            f = play(pg, think=700)
            verify_round("death-%s" % d, f)
            check(f["death"] == d, "death %s: got %s" % (d, f["death"]))
            pg.wait_for_timeout(1500)
            check(pg.evaluate("document.querySelector('.pa-end h2').textContent") == "You win!" and pg.evaluate("document.getElementById('paEloN').textContent") == "1020", "death %s: end card incomplete" % d)
            audit_requests("death-" + d, "preview", st)
            ctx.close()
            print("ok death", d, "scene at %.1fs end at %.1fs" % (f["t_scene"], f["t_end"]))

        # ---------------- replay never repeats the last death (3 replays in a row, random picks)
        ctx, pg, st = open_page(br, "preview", 390, 844)
        pg.wait_for_selector("#paGo")
        seen = []
        for g in range(4):
            f = play(pg)
            verify_round("replay-game%d" % g, f)
            seen.append(f["death"])
            pg.wait_for_timeout(800)
            if g < 3:
                rx, ry, _ = box_center(pg, "#paReplay")
                pg.mouse.click(rx, ry)
                pg.wait_for_timeout(500)
        check(all(seen[i] != seen[i + 1] for i in range(3)), "replay repeated a death: %s" % seen)
        audit_requests("replay", "preview", st)
        ctx.close()
        print("ok replay deaths", seen)

        # ---------------- an active human pace (1.6 s to think per round): death in about 12-15 s, end card by about 20 s
        ctx, pg, st = open_page(br, "preview", 390, 844)
        pg.wait_for_selector("#paGo")
        f = play(pg, think=1600, slow=True)
        verify_round("human", f)
        check(11 <= f["t_scene"] <= 16, "human pace: death at %.1f s (want about 12-15)" % f["t_scene"])
        check(f["t_end"] <= 21, "human pace: end card at %.1f s (want about 20 or less)" % f["t_end"])
        ctx.close()
        print("ok human pace: death %.1fs end %.1fs" % (f["t_scene"], f["t_end"]))

        # ---------------- MRAID builds: wait for ready + viewable, pause when hidden, store url by user agent
        for name in ["applovin", "unity"]:
            ctx, pg, st = open_page(br, name, 390, 844, ua=AND_UA, mraid={"state": "loading", "viewable": False})
            pg.wait_for_timeout(700)
            check(phase(pg) is None and pg.evaluate("document.getElementById('paGo')") is None, "%s: started before MRAID ready" % name)
            pg.evaluate("mraid._s='default';mraid._emit('ready')")
            pg.wait_for_timeout(500)
            check(phase(pg) is None, "%s: started while not viewable" % name)
            pg.evaluate("mraid._v=true;mraid._emit('viewableChange',true)")
            pg.wait_for_selector("#paGo", timeout=4000)
            check(phase(pg) == "ask", "%s: did not start when viewable" % name)
            pg.mouse.move(200, 400); pg.mouse.down(); pg.mouse.up()    # first touch unlocks sound
            pg.wait_for_timeout(300)
            check(pg.evaluate("__hlad.audioState()") == "running", "%s: sound did not start after touch" % name)
            pg.evaluate("mraid._v=false;mraid._emit('viewableChange',false)")
            pg.wait_for_timeout(200)
            check(pg.evaluate("document.body.classList.contains('pa-paused')"), "%s: not paused when hidden" % name)
            check(pg.evaluate("__hlad.audioState()") == "suspended", "%s: audio not stopped when hidden" % name)
            pg.wait_for_timeout(7000)   # longer than the idle auto-advance: nothing may happen while hidden
            check(phase(pg) == "ask" and pg.evaluate("document.getElementById('paLo').textContent") == "1", "%s: game advanced while hidden" % name)
            pg.evaluate("mraid._v=true;mraid._emit('viewableChange',true)")
            pg.wait_for_timeout(200)
            check(not pg.evaluate("document.body.classList.contains('pa-paused')"), "%s: did not resume" % name)
            f = play(pg)
            verify_round(name + " mraid", f)
            pg.wait_for_timeout(1200)
            cx, cy, _ = box_center(pg, "#paCta")
            pg.mouse.click(cx, cy)
            pg.wait_for_timeout(200)
            log = pg.evaluate("window.__log")
            opens = [l for l in log if l[0] == "mraid.open"]
            ads = json.loads(re.search(r'ANDROID_URL = "([^"]+)"', (HERE / "build.py").read_text()) and json.dumps(re.search(r'ANDROID_URL = "([^"]+)"', (HERE / "build.py").read_text()).group(1)))
            check(len(opens) == 1 and opens[0][1] == ads, "%s: Android UA should open the Android URL, got %s" % (name, opens))
            audit_requests(name + " mraid", name, st)
            ctx.close()
            # iOS user agent
            ctx, pg, st = open_page(br, name, 390, 844, ua=IOS_UA)
            f = play(pg)
            pg.wait_for_timeout(1200)
            cx, cy, _ = box_center(pg, "#paCta")
            pg.mouse.click(cx, cy)
            pg.wait_for_timeout(200)
            opens = [l for l in pg.evaluate("window.__log") if l[0] == "mraid.open"]
            ios = re.search(r'IOS_URL = "([^"]+)"', (HERE / "build.py").read_text()).group(1)
            check(len(opens) == 1 and opens[0][1] == ios, "%s: iOS UA should open the iOS URL, got %s" % (name, opens))
            ctx.close()
            print("ok mraid", name)

        # ---------------- contact sheets: one full active run per size, a frame about every 400 ms
        runs = []
        for vw, vh in [(390, 844), (320, 480)]:
            ctx, pg, st = open_page(br, "preview", vw, vh)
            pg.wait_for_selector("#paGo")
            frames = []
            for _ in range(3):   # the opening, before the viewer touches anything (bubble, wobble, hand demonstrates the drag)
                pg.wait_for_timeout(300)
                frames.append((-1.0, "open", pg.screenshot()))
            pg.evaluate("__hlad.setDeath('%s')" % ("zap" if vw == 320 else "piano"))
            f = play(pg, capture=frames, slow=True, think=300)
            for _ in range(6):   # a few frames of the end card too
                pg.wait_for_timeout(400)
                frames.append((999.0, "end", pg.screenshot()))
            ctx.close()
            runs.append((vw, vh, frames))
        br.close()

    # ---------------- contact sheet + key frames
    from PIL import Image
    import io
    for vw, vh, frames in runs:
        suffix = "" if vw == 390 else "_320"
        ims = [Image.open(io.BytesIO(b)).convert("RGB") for _, _, b in frames]
        meta = [(t, ph) for t, ph, _ in frames]
        check(len(ims) >= 24, "contact sheet %dx%d has too few frames (%d)" % (vw, vh, len(ims)))
        tw = 156
        th = int(tw * vh / vw)
        cols = 10
        rows = (len(ims) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * tw, rows * th), "white")
        for i, im in enumerate(ims):
            sheet.paste(im.resize((tw, th)), ((i % cols) * tw, (i // cols) * th))
        sheet.save(SHOTS / ("contact_sheet%s.png" % suffix))
        n = len(ims)
        scene = [i for i, m in enumerate(meta) if m[1] == "scene"]
        answers = [i for i, m in enumerate(meta) if m[1] == "answer"]
        thinks = [i for i, m in enumerate(meta) if m[1] == "ask"]
        keys = [2,                                                            # opening: bubble, wobbling card, hand
                answers[0] if answers else 0,                                 # first answer: red block being chopped
                answers[len(answers) // 2] if answers else 0,                 # a nervous bean, range rescaled
                answers[-1] if answers else 0,                                # third guess: card flips, tick
                scene[len(scene) // 3] if scene else 0,                       # the death scene, setting up
                scene[(len(scene) * 3) // 4] if scene else 0,                 # the gag has landed
                n - 1]                                                        # end card
        names = ["1_open", "2_chop", "3_nervous", "4_third_guess", "5_death_setup", "6_death_landed", "7_end_card"]
        for k, nm in zip(keys, names):
            ims[k].save(SHOTS / ("key%s_%s.png" % (suffix, nm)))
        print("contact sheet %dx%d: %d frames -> %s" % (vw, vh, n, SHOTS / ("contact_sheet%s.png" % suffix)))

    # ---------------- sizes, zips, static scan
    LIM1, LIM5 = 2 * 1024 * 1024, 5 * 1024 * 1024
    for name, (fn, _) in BUILDS.items():
        sz = (DIST / fn).stat().st_size
        check(sz < LIM1, "%s is %d bytes, over the 2 MB single-file limit" % (fn, sz))
        html = (DIST / fn).read_text()
        for bad in ["localStorage", "sessionStorage", "<iframe", "alert(", "fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "@import", "window.location", "location.href", "location.replace"]:
            check(bad not in html, "%s contains %s" % (fn, bad))
        ext = re.findall(r'''(?:src|href)\s*=\s*["']\s*https?://[^"']+|url\(\s*["']?https?://[^)]+''', html)
        allowed = ['src="%s' % EXIT_URL]
        ext = [e for e in ext if not (name == "google" and e.replace("'", '"').startswith(allowed[0]))]
        check(not ext, "%s has external references %s" % (fn, ext))
        check(("mraid" in html) == (name in ("applovin", "unity")), "%s: mraid usage wrong for this network" % fn)
        check(("FbPlayableAd" in html) == (name == "meta"), "%s: FbPlayableAd usage" % fn)
        check(("ExitApi" in html) == (name == "google"), "%s: ExitApi usage" % fn)
        check(("openAppStore" in html) == (name == "tiktok"), "%s: openAppStore usage" % fn)
        check(("window.install" in html) == (name == "mintegral"), "%s: install usage" % fn)
    g = (DIST / "google/index.html").read_text()
    head = g.split("</head>")[0]
    check('<meta name="ad.orientation" content="portrait">' in head and '<script type="text/javascript" src="%s"></script>' % EXIT_URL in head, "google head tags")
    for net in ["google", "tiktok", "mintegral"]:
        z = DIST / (net + ".zip")
        check(z.stat().st_size < LIM5, "%s.zip over 5 MB" % net)
        with zipfile.ZipFile(z) as zf:
            names = sorted(zf.namelist())
            check("index.html" in names, "%s.zip has no top-level index.html: %s" % (net, names))
            check(zf.read("index.html") == (DIST / net / "index.html").read_bytes(), "%s.zip index.html differs from folder" % net)
            if net == "tiktok":
                cfg = json.loads(zf.read("config.json"))
                check(cfg.get("playable_orientation") == 0 and "config.json" in names, "tiktok config.json portrait")
    for k in ["preview.html", "meta.html", "applovin.html", "unity.html", "google.zip", "tiktok.zip", "mintegral.zip"]:
        print("%-16s %8d bytes" % (k, (DIST / k).stat().st_size))

    if FAILS:
        print("FAIL playable (%d checks, %d failed)" % (N, len(FAILS)))
        sys.exit(1)
    print("PASS playable (%d checks)" % N)


if __name__ == "__main__":
    main()
