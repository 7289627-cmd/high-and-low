"""Art-director QA: every screen at phone size with the real fonts.
Run: cd test && python3 shot_all.py [only_substring]   (needs ../site/index.html from `python3 build.py web`)
Serves site/ over http, fakes supabase. Output: shots/qa_*.png"""
import sys, re, socket, subprocess, time, pathlib, traceback, datetime
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from real_browser import FAKE_SUPABASE
HERE = pathlib.Path(__file__).resolve().parent
SITE = HERE.parent / 'site'
OUT = HERE / 'shots'
ONLY = sys.argv[1] if len(sys.argv) > 1 else ''  # comma list of step names, e.g. duel,friends
INIT = ("window.HL_TEST_Q_MS=300;window.HL_TEST_FILL_MS=500;window.HL_TEST_QJOIN_MS=800;"
        "try{if(!localStorage.getItem('hl-name')){localStorage.setItem('hl-name',JSON.stringify('Maya'));localStorage.setItem('hl-elo','1104');localStorage.setItem('hl-elo-n','14')}}catch(e){}")
STUB = "window.HLNative={restore:function(){return Promise.resolve()},buyNoAds:function(){return Promise.resolve(false)},ownsNoAds:function(){return Promise.resolve(false)},haptic:function(){}};"

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

def run():
    port = free_port()
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=str(SITE), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f'http://127.0.0.1:{port}'
    for _ in range(50):
        try: socket.create_connection(('127.0.0.1', port), 0.2).close(); break
        except OSError: time.sleep(0.1)
    errs = []
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--disable-background-networking'])
            def newpage(w=390, h=844, extra='', hash_='', fresh=False):
                ctx = b.new_context(viewport={'width': w, 'height': h}, is_mobile=True, has_touch=True, device_scale_factor=2)
                ctx.add_init_script(INIT + extra)
                def route(r):
                    u = r.request.url
                    if '/vendor/supabase-' in u: return r.fulfill(status=200, content_type='application/javascript', body=FAKE_SUPABASE)
                    if u.startswith(base) or u.startswith('data:') or u.startswith('blob:'): return r.continue_()
                    return r.abort()
                ctx.route('**/*', route)
                pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
                pg.goto(base + '/index.html' + hash_); pg.wait_for_timeout(1800)
                return ctx, pg
            def S(pg, name):
                pg.screenshot(path=str(OUT / f'qa_{name}.png')); print('shot', name)
            def step(label, fn):
                if ONLY and label not in ONLY.split(','): return
                try: fn()
                except Exception as e:
                    print('FAILED', label, str(e)[:200]); traceback.print_exc(limit=1)
            def wf(pg, js, t=20000):
                s = time.time()
                while (time.time() - s) * 1000 < t:
                    if pg.evaluate(js): return True
                    pg.wait_for_timeout(100)
                return False
            def start_duel(pg, fill=400, lock=True):
                pg.evaluate(f"window.HL_TEST_FILL_MS={fill}")
                pg.click('#playBtn'); pg.wait_for_selector('#lockBtn', timeout=20000)
            def to_ask(pg):
                pg.click('#lockBtn')
                wf(pg, "G&&G.phase==='play'&&G.stage!=='wheel'", 60000)
                wf(pg, "!!document.querySelector('[data-pickdir]')", 60000)
            def result(pg, win, a, b_, flags_up=False):
                pg.evaluate(f"""(()=>{{closeOv();const o=G.players.find(p=>p.pid!==PID);G.phase='over';G.win=({'true' if win else 'false'})?PID:o.pid;
                  const d={b_-a};LS.set('hl-elo',{b_});eloLast={{gid:G.gid,d,from:{a},to:{b_},up:rankName({b_})!==rankName({a})&&{b_}>{a}}};showWinner()}})()""")
                pg.wait_for_timeout(1800)

            # ---- home
            def home():
                ctx, pg = newpage()
                print('font', pg.evaluate("document.fonts.check('20px \"Bagel Fat One\"')"), pg.evaluate("[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family+f.weight).join(',')"))
                S(pg, 'home')
                pg.click('#infoBtn'); pg.wait_for_timeout(500); S(pg, 'info_web'); pg.evaluate('closeOv()')
                pg.evaluate("window.HL_FLAGS.streak=true;LS.set('hl-st-ws',3);LS.set('hl-st-days',%s);LS.set('hl-coins',25)" % [(datetime.date.today() - datetime.timedelta(d)).isoformat() for d in (0, 1, 3, 5)])
                pg.evaluate('render(true)'); pg.wait_for_timeout(600); S(pg, 'home_streak')
                pg.click('#friendsBtn'); pg.wait_for_timeout(500); S(pg, 'home_friends_open')
                ctx.close()
            step('home', home)
            def home_app():
                ctx, pg = newpage(extra=STUB)
                pg.click('#infoBtn'); pg.wait_for_timeout(500); S(pg, 'info_app')
                ctx.close()
            step('info_app', home_app)
            def modes():
                ctx, pg = newpage()
                pg.click('[data-mode="l"]'); pg.wait_for_timeout(300)
                pg.evaluate("window.scrollTo(0,0);document.querySelector('.modes,[data-mode]').scrollIntoView({block:'center'})"); pg.wait_for_timeout(300)
                S(pg, 'modes')
                ctx.close()
            step('modes', modes)
            def offl():
                ctx, pg = newpage()
                ctx.set_offline(True); pg.evaluate("window.dispatchEvent(new Event('offline'))"); pg.wait_for_timeout(800)
                S(pg, 'offline'); ctx.close()
            step('offline', offl)
            def rotate():
                ctx, pg = newpage(844, 390); pg.wait_for_timeout(500); S(pg, 'rotate'); ctx.close()
            step('rotate', rotate)

            # ---- duel flow
            def duel():
                ctx, pg = newpage()
                pg.evaluate("window.HL_TEST_FILL_MS=2500"); pg.click('#playBtn'); pg.wait_for_timeout(900); S(pg, 'searching')
                pg.wait_for_selector('#lockBtn', timeout=60000); pg.wait_for_timeout(500); S(pg, 'duel_found')
                pg.evaluate("LS.set('hl-coins',60)")
                pg.wait_for_timeout(300)
                # secret slider
                S(pg, 'secret')
                pg.click('#lockBtn'); pg.wait_for_timeout(700); S(pg, 'picking_fill')
                wf(pg, "G&&G.phase==='play'&&G.stage!=='wheel'", 60000)
                wf(pg, "!!document.querySelector('[data-pickdir]')", 60000)
                pg.wait_for_timeout(500); S(pg, 'pickdir')
                pg.evaluate('closeOv()'); pg.wait_for_timeout(300)
                pg.click('[data-pickdir="h"]'); pg.wait_for_timeout(800); S(pg, 'ask_start')
                try:
                    pg.click('.key[data-k="mid"]'); pg.wait_for_timeout(300)
                except Exception: pass
                S(pg, 'ask_mid')
                pg.click('#askGo'); pg.wait_for_timeout(1500); S(pg, 'duel_after_ask')
                # narrowed range: wait for next ask
                wf(pg, "!!document.querySelector('[data-pickdir]')||!!document.querySelector('.guessv')", 60000)
                pg.wait_for_timeout(600)
                if pg.query_selector('[data-pickdir]'):
                    pg.evaluate('closeOv()'); pg.wait_for_timeout(300); pg.click('[data-pickdir="l"]'); pg.wait_for_timeout(800); S(pg, 'ask_narrowed')
                pg.click('#leaveBtn'); pg.wait_for_timeout(500); S(pg, 'leave_sheet'); pg.click('#stayBtn')
                ctx.close()
            step('duel', duel)

            def oppturn():
                ctx, pg = newpage()
                start_duel(pg, 400); pg.click('#lockBtn'); wf(pg, "G&&G.phase==='play'&&G.stage!=='wheel'", 60000)
                pg.wait_for_timeout(1500)
                pg.evaluate("""(()=>{closeOv();const o=G.players.find(p=>p.pid!==PID);o.bot=0;o.a=1;G.turn=G.players.indexOf(o);G.stage='await';G.q=null;G.timer=20;G.seq++;ui.timerSeq=G.gid+':'+G.seq;ui.timerStart=Date.now()-6000;render(true)})()""")
                pg.wait_for_timeout(700); S(pg, 'opp_turn')
                pg.evaluate("ui.timerStart=Date.now()-16000;render(true)"); pg.wait_for_timeout(500); S(pg, 'opp_turn_low')
                ctx.close()
            step('oppturn', oppturn)

            def guess():
                ctx, pg = newpage()
                start_duel(pg, 400); pg.click('#lockBtn')
                for i in range(120):
                    if pg.query_selector('.guessv') or pg.query_selector('.g[data-n]'): break
                    if pg.query_selector('[data-pickdir]'):
                        pg.evaluate('closeOv()'); pg.click('[data-pickdir="h"]'); pg.wait_for_timeout(600); pg.click('#askGo')
                    pg.wait_for_timeout(500)
                pg.wait_for_timeout(700); S(pg, 'guess')
                try:
                    pg.evaluate("LS.set('hl-coins',60);render(true)"); pg.click('#pwBtn', timeout=4000); pg.wait_for_timeout(500); S(pg, 'powers')
                except Exception as e: print('no pwBtn', str(e)[:60])
                ctx.close()
            step('guess', guess)

            def results():
                ctx, pg = newpage()
                start_duel(pg, 400); pg.click('#lockBtn'); wf(pg, "G&&G.phase==='play'&&G.stage!=='wheel'", 60000); pg.wait_for_timeout(800)
                result(pg, True, 1100, 1120); S(pg, 'res_win')
                result(pg, False, 1120, 1100); S(pg, 'res_loss')
                result(pg, True, 1040, 1062); pg.wait_for_timeout(1800); S(pg, 'res_rankup')
                pg.click('#repBtn'); pg.wait_for_timeout(500); S(pg, 'res_rankup_reported')
                pg.evaluate('closeOv()')
                ctx.close()
            step('results', results)
            def results_flags():
                ctx, pg = newpage(hash_='#flags=share,streak')
                start_duel(pg, 400); pg.click('#lockBtn'); wf(pg, "G&&G.phase==='play'&&G.stage!=='wheel'", 60000); pg.wait_for_timeout(800)
                pg.evaluate("window.HL_FLAGS.share=true")
                result(pg, True, 1100, 1121); pg.wait_for_timeout(800); S(pg, 'res_win_flags')
                pg.click('#repBtn'); pg.wait_for_timeout(500); S(pg, 'res_win_flags_reported')
                ctx.close()
            step('results_flags', results_flags)

            # ---- friends
            def friends():
                ctx, pg = newpage()
                pg.click('#friendsBtn'); pg.wait_for_selector('#addBot', timeout=15000); pg.wait_for_timeout(800)
                S(pg, 'lobby')
                for i in range(3): pg.click('#addBot'); pg.wait_for_timeout(200)
                pg.wait_for_timeout(500); pg.evaluate("window.scrollTo(0,0)"); S(pg, 'lobby4')
                pg.evaluate("document.querySelector('#startBtn').scrollIntoView()"); pg.wait_for_timeout(200); S(pg, 'lobby4_bottom')
                pg.click('#startBtn'); pg.wait_for_selector('#lockBtn', timeout=15000); pg.wait_for_timeout(400); S(pg, 'friends_secret')
                pg.click('#lockBtn')
                wf(pg, "G&&G.phase==='play'&&G.stage!=='wheel'", 60000); pg.wait_for_timeout(1500)
                pg.evaluate('closeOv()'); pg.wait_for_timeout(500); S(pg, 'friends4_play')
                # watching: make me not a player
                pg.evaluate("G.players=G.players.filter(p=>p.pid!==PID);render(true)"); pg.wait_for_timeout(500); S(pg, 'watching')
                ctx.close()
            step('friends', friends)
            b.close()
    finally:
        srv.kill(); srv.wait()
    print('errors', errs)
run()
