"""Powers icon QA. Run: cd test && python3 shot_powers.py   (needs ../site/index.html from `python3 build.py web`)
Output: shots/pw_*.png and shots/pw_icons.png"""
import sys, re, socket, subprocess, time, pathlib
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from real_browser import FAKE_SUPABASE
HERE = pathlib.Path(__file__).resolve().parent
SITE = HERE.parent / 'site'
OUT = HERE / 'shots'; OUT.mkdir(exist_ok=True)
INIT = ("window.HL_TEST_Q_MS=300;window.HL_TEST_FILL_MS=500;window.HL_TEST_QJOIN_MS=800;"
        "try{localStorage.setItem('hl-name',JSON.stringify('Maya'));localStorage.setItem('hl-elo','1104');localStorage.setItem('hl-elo-n','14');localStorage.setItem('hl-coins','25')}catch(e){}")
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
def wf(pg, js, t=20000):
    s = time.time()
    while (time.time() - s) * 1000 < t:
        if pg.evaluate(js): return True
        pg.wait_for_timeout(100)
    return False
def main():
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
            ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
            ctx.add_init_script(INIT)
            def route(r):
                u = r.request.url
                if '/vendor/supabase-' in u: return r.fulfill(status=200, content_type='application/javascript', body=FAKE_SUPABASE)
                if u.startswith(base) or u.startswith('data:') or u.startswith('blob:'): return r.continue_()
                return r.abort()
            ctx.route('**/*', route)
            pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(base + '/index.html'); pg.wait_for_timeout(1800)
            S = lambda n: (pg.screenshot(path=str(OUT / f'pw_{n}.png')), print('shot', n))
            pg.evaluate("window.HL_TEST_FILL_MS=400")
            pg.click('#playBtn'); pg.wait_for_selector('#lockBtn', timeout=60000)
            pg.click('#lockBtn')
            wf(pg, "G&&G.phase==='play'&&G.stage!=='wheel'", 60000)
            wf(pg, "!!document.querySelector('#pwBtn')", 60000)
            pg.evaluate("closeOv();const o=G.players.find(p=>p.pid!==PID);o.bot=0;o.a=1;G.players.forEach(p=>{p.sh=1;p.fz=0});o.fz=1;G.turn=G.players.indexOf(o);G.stage='await';G.q=null;G.timer=20;G.seq++;ui.timerSeq=G.gid+':'+G.seq;ui.timerStart=Date.now()-6000;render(true)")
            pg.wait_for_timeout(800)
            S('duel_status')
            pg.evaluate("G.turn=G.players.findIndex(p=>p.pid===PID);G.players.forEach(p=>{p.sh=0;p.fz=0});G.timer=0;render(true)")
            pg.wait_for_timeout(500)
            pg.click('#pwBtn'); pg.wait_for_timeout(500); S('sheet')
            pg.evaluate("document.querySelector('[data-pw=\"peek\"]').click()"); pg.wait_for_timeout(400); S('peek_pick')
            pg.evaluate("closeOv();ui.pwOpen=false;const o=G.players.find(p=>p.pid!==PID);G.turn=G.players.indexOf(o);G.timer=20;G.seq++;ui.timerSeq=G.gid+':'+G.seq;ui.timerStart=Date.now()-6000;render(true)")
            pg.wait_for_timeout(500)
            for i, (t, who) in enumerate([('peek', 'tg'), ('shield', 'a'), ('freeze', 'tg'), ('frozen', 'tg'), ('blocked', 'tg')]):
                pg.evaluate("(a)=>{const me=G.players.find(p=>p.pid===PID),o=G.players.find(p=>p.pid!==PID);const ev={id:9000+a[1],t:a[0],a:me.pid,tg:o.pid};G.ev=ev;pwEvent(ev)}", [t, i])
                pg.wait_for_timeout(500); S('bub_' + t)
                pg.evaluate("ui.bubble=null;render(true)")
            # icon sheet
            ids = ['snap', 'peek', 'double', 'shield', 'freeze']
            pg.evaluate("""(ids)=>{const mk=(bg,t)=>`<div style="background:${bg};padding:10px;margin:0 0 6px"><div style="font:12px sans-serif">${t}</div>`+[18,28,44,96].map(s=>`<div style="display:flex;gap:${s>40?14:10}px;align-items:center;margin:4px 0">${ids.map(i=>`<span style="width:${s}px;height:${s}px;display:block">${pwIcon(i)}</span>`).join('')}</div>`).join('')+'</div>';
              const d=document.createElement('div');d.id='iconsheet';d.style.cssText='position:fixed;inset:0;z-index:99999;overflow:auto;background:#fff';
              d.innerHTML=mk('#FFF8EC','cream')+mk('#7FD0E4','sky');document.body.appendChild(d);document.querySelectorAll('#iconsheet .pw-svg').forEach(s=>{s.style.width='100%';s.style.height='100%'})}""", ids)
            pg.wait_for_timeout(300); pg.screenshot(path=str(OUT / 'pw_icons.png')); print('shot icons')
            print('errors', errs)
            b.close()
    finally:
        srv.terminate()
main()
